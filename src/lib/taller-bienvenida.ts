import { auditar } from "@/lib/audit";
import { URL_SISTEMA, correoTalleresDeCasaDeFe } from "@/lib/correo";
import { exportarAccesoAlTaller } from "@/lib/highlevel-salida";
import { getPrisma } from "@/lib/prisma";
import { cargarMisTalleres, tokenDeRegreso } from "@/lib/taller";

/// El mensaje de bienvenida al taller: su código y sus 12 talleres, por correo
/// y por WhatsApp.
///
/// ⚠️ **SON DOS CAMINOS A PROPÓSITO, y el dato lo exige: de los 21 miembros de
/// Casa de Fe medidos el 2-oct-2026, los 21 tienen celular y solo 11 tienen
/// correo.** Con correo solo, la mitad del grupo no recibiría nada. El WhatsApp
/// no lo manda este sistema: lo manda **HighLevel**, que es donde está
/// conectado el número de la iglesia — aquí se le escriben el código y el
/// enlace al contacto y se le pone la etiqueta que dispara su workflow (§6).

export type ResultadoDelAcceso = {
  /// Qué pasó con el correo. `null` si la persona no tiene correo registrado —
  /// que no es un fallo, es la mitad de los casos.
  correo: { enviado: boolean; motivo?: string } | null;
  /// Qué pasó con HighLevel (el disparador del WhatsApp).
  crm: { ok: boolean; motivo?: string };
  /// El enlace que se repartió, para poder dictarlo si los dos caminos fallan.
  enlace: string;
  codigo: string;
};

/// Le manda a la persona su código y sus talleres. **Nunca lanza**: la
/// inscripción en la Casa de Fe ya quedó hecha y no se deshace porque un
/// mensaje falle. Devuelve qué pasó con cada camino para que la pantalla lo
/// **diga** — la lección del 3-sep-2026: un correo que no sale sin dejar rastro
/// es imposible de diagnosticar desde fuera.
export async function enviarAccesoAlTaller(
  learnerId: string,
  datos: { casa: string | null; actorId: string | null },
): Promise<ResultadoDelAcceso | null> {
  const prisma = await getPrisma();

  const mis = await cargarMisTalleres(learnerId);
  if (!mis) return null;

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { personId: true, person: { select: { email: true } } },
  });
  if (!aprendiz) return null;

  const token = await tokenDeRegreso(learnerId);

  // ⚠️ **Aquí el dominio SÍ es la constante de producción, al contrario que en
  // el QR impreso** (`enlaceDelTaller` lo saca de la petición). Un enlace que
  // viaja por WhatsApp o por correo sobrevive meses y se abre desde otro
  // teléfono: si saliera con el dominio de la vista previa de una rama, dejaría
  // de funcionar en cuanto esa rama se fusione.
  const enlace = `${URL_SISTEMA}/taller/mis/${token}`;

  const correoDestino = (aprendiz.person.email ?? "").trim();
  let correo: ResultadoDelAcceso["correo"] = null;

  if (correoDestino) {
    const resultado = await correoTalleresDeCasaDeFe({
      to: correoDestino,
      nombre: mis.nombre,
      codigo: mis.codigo,
      casa: datos.casa,
      enlace,
      temas: mis.temas.map((tema) => ({
        number: tema.number,
        name: tema.name,
        enlace: tema.qrCode ? `${URL_SISTEMA}/taller/${tema.qrCode}` : null,
      })),
      registro: {
        prisma,
        tipo: "taller_casa_de_fe",
        personId: aprendiz.personId,
        learnerId,
        actorId: datos.actorId,
      },
    });
    correo = resultado.enviado
      ? { enviado: true }
      : { enviado: false, motivo: resultado.motivo };
  }

  const crm = await exportarAccesoAlTaller(learnerId, {
    codigo: mis.codigo,
    enlace,
  });

  // ⚠️ **El enlace y el código NO se escriben en la auditoría**, igual que el
  // token del calendario (17-sep-2026) y que el código del QR de cada tema: son
  // credenciales, y con ellos se escribe en el expediente de la persona. Lo que
  // se audita es que se repartió el acceso y por dónde salió.
  await auditar(prisma, {
    actorId: datos.actorId,
    action: "casa_de_fe.acceso_enviado",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: {
      casa: datos.casa,
      porCorreo: correo?.enviado ?? false,
      tieneCorreo: Boolean(correoDestino),
      porWhatsapp: crm.ok,
      motivoCorreo: correo?.enviado === false ? correo.motivo : undefined,
      motivoCrm: crm.ok ? undefined : crm.motivo,
    },
  });

  return { correo, crm, enlace, codigo: mis.codigo };
}
