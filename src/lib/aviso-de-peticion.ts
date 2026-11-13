import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { nombreCompleto as armarNombre } from "@/lib/dominio";
import { correoPeticionNueva, URL_SISTEMA } from "@/lib/correo";
import { vistaHabilitada } from "@/lib/vistas";
import type { OrigenDeLaPeticion } from "@/lib/oracion-catalogo";
import { debeAvisar } from "@/lib/aviso-de-peticion-catalogo";

// ---------------------------------------------------------------------------
// Avisar de una petición nueva (12-nov-2026)
//
// Quién recibe: las cuentas activas con `receives_prayer_alerts` encendido —
// hoy los 12 pastores y administradores activos más Jairo Esquivel, Ruth
// Bonilla, Yuli Perdomo y Nora Bonilla, de la mesa ministerial. Se enciende y
// se apaga cuenta por cuenta en Administración.
// ---------------------------------------------------------------------------

export type ResultadoDelAviso = {
  /// Cuántos correos salieron de verdad (Resend los aceptó).
  enviados: number;
  /// A quién no se le pudo mandar, y por qué. Se dice, no se traga: un aviso
  /// que no sale sin dejar rastro es imposible de diagnosticar desde fuera.
  fallos: { nombre: string; motivo: string }[];
  /// Cuántas cuentas tenían el aviso encendido pero no tienen correo.
  sinCorreo: number;
};

const VACIO: ResultadoDelAviso = { enviados: 0, fallos: [], sinCorreo: 0 };

/// **Avisa de una petición recién guardada.**
///
/// Best-effort de punta a punta: nunca lanza. La petición ya quedó guardada y
/// no se deshace porque un correo falle — es la misma regla de `enviarCorreo`.
///
/// ⚠️ **Se llama DESPUÉS de guardar, nunca dentro de la transacción.** Dieciséis
/// llamadas HTTP dentro de una transacción de Prisma se comerían el timeout de
/// 5 s (fue el fallo de los registros por webhook del 1-sep).
export async function avisarDePeticionNueva(datos: {
  peticionId: string;
  personId: string;
  origen: OrigenDeLaPeticion;
  reservada: boolean;
  tipos: readonly string[];
  quiereProceso: boolean;
  texto: string;
}): Promise<ResultadoDelAviso> {
  if (!debeAvisar(datos.origen)) return VACIO;

  try {
    const prisma = await getPrisma();

    // Un solo viaje para las tres cosas: con `PrismaPg max: 1` las consultas se
    // serializan aunque vayan en un `Promise.all`, así que cada viaje de más es
    // latencia que espera la persona que acaba de pulsar «enviar» (§12.5).
    const [persona, destinatarios, porRol] = await prisma.$transaction([
      prisma.person.findUnique({
        where: { id: datos.personId },
        select: { firstName: true, lastName: true, callPhone: true, whatsappPhone: true },
      }),
      prisma.appUser.findMany({
        where: { active: true, receivesPrayerAlerts: true },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          canLeadAlpha: true,
          canLeadFaithHouse: true,
          canMentor: true,
          coordinatesConsolidation: true,
          canSeeAllGroups: true,
          canLeadGi: true,
          coordinatesGi: true,
          person: { select: { firstName: true } },
          vistasPropias: { select: { view: true, enabled: true } },
        },
      }),
      prisma.viewRoleAccess.findMany({ select: { view: true, role: true, enabled: true } }),
    ]);

    if (!persona || destinatarios.length === 0) return VACIO;

    const nombreDeQuienPidio = armarNombre(persona);
    const celular = persona.callPhone ?? persona.whatsappPhone ?? null;

    const resultados = await Promise.all(
      destinatarios.map(async (destinatario) => {
        const nombre = destinatario.fullName;
        if (!destinatario.email) return { nombre, sinCorreo: true as const };

        // ⚠️ **El botón solo se pinta a quien puede abrir Oración.** Jairo, Ruth
        // y Yuli reciben el aviso y NO tienen esa vista (el usuario decidió el
        // 12-nov no tocarles los permisos). Un enlace que los mandaría a
        // «sin permiso» es peor que no ponerlo (§12.6), y el correo ya lleva
        // dentro todo lo que hace falta para orar por la petición.
        const puedeAbrir = vistaHabilitada(
          "oracion",
          {
            role: destinatario.role,
            canLeadAlpha: destinatario.canLeadAlpha,
            canLeadFaithHouse: destinatario.canLeadFaithHouse,
            canMentor: destinatario.canMentor,
            coordinaConsolidacion: destinatario.coordinatesConsolidation,
            veTodosLosGrupos: destinatario.canSeeAllGroups,
            llevaGi: destinatario.canLeadGi,
            coordinaGi: destinatario.coordinatesGi,
          },
          { porRol, porCuenta: destinatario.vistasPropias },
        );

        const envio = await correoPeticionNueva({
          to: destinatario.email,
          // `person.first_name` entero, que es lo que guarda los NOMBRES. Si la
          // cuenta no tiene ficha enganchada queda el nombre de la cuenta: no es
          // ideal, pero es mejor que un saludo vacío.
          paraNombres: destinatario.person?.firstName ?? nombre,
          nombreCompleto: nombreDeQuienPidio,
          nombresDeQuienPidio: persona.firstName,
          reservada: datos.reservada,
          tipos: datos.tipos,
          quiereProceso: datos.quiereProceso,
          texto: datos.texto,
          enlace: puedeAbrir ? `${URL_SISTEMA}/oracion` : null,
          celular,
        });

        return envio.enviado
          ? { nombre, ok: true as const }
          : { nombre, motivo: envio.motivo };
      }),
    );

    const enviados = resultados.filter((r) => "ok" in r).length;
    const sinCorreo = resultados.filter((r) => "sinCorreo" in r).length;
    const fallos = resultados
      .filter((r): r is { nombre: string; motivo: string } => "motivo" in r)
      .map((r) => ({ nombre: r.nombre, motivo: r.motivo }));

    // ⚠️ **Se audita lo que de verdad pasó, no lo que se intentó** (§12.6): el
    // WhatsApp del taller se llamaba `acceso_enviado` y llevaba tres semanas sin
    // mandar nada. Aquí «enviados» significa que Resend los aceptó.
    //
    // ⚠️ Y el TEXTO de la petición no entra, igual que en
    // `oracion.peticion_registrada`: «Actividad del día» la ve cualquier
    // administrador.
    await auditar(prisma, {
      actorId: null,
      action: "oracion.aviso_enviado",
      entityType: "prayer_request",
      entityId: datos.peticionId,
      metadata: {
        enviados,
        destinatarios: destinatarios.length,
        sinCorreo,
        fallos,
        tipos: datos.tipos,
        quiereProceso: datos.quiereProceso,
        reservada: datos.reservada,
      },
    });

    return { enviados, fallos, sinCorreo };
  } catch (error) {
    // La petición ya está guardada. Que el aviso falle no se la quita a nadie.
    console.error("No se pudo avisar de la petición nueva", error);
    return VACIO;
  }
}
