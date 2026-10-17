import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { colaDeTelefono, nombreCompleto } from "@/lib/dominio";
import { ETIQUETA_FASE } from "@/lib/procesos-catalogo";
import {
  type FiltroDeOracion,
  type OrigenDeLaPeticion,
  type PeticionParaPintar,
  DIAS_DE_LA_SEMANA,
  DIAS_DEL_MES,
  desdeHace,
  type ResumenDeOracion,
  esOrigen,
  peticionValida,
  resumirPeticiones,
} from "@/lib/oracion-catalogo";

/// Núcleo del módulo de oración: lo que toca la base de datos.
/// Lo que puede calcularse sin ella vive en `oracion-catalogo.ts` y tiene
/// pruebas (la regla del 6-sep-2026).

/// ⚠️ **Un tope, porque esta lista SÍ puede crecer sin freno.** Entran ~1,5
/// peticiones al día y nunca se borra ninguna, así que en dos años son ~1 100.
/// Es la lección del 12-sep: aquel día seis contadores salían de una lista
/// recortada y ya estaban a punto de mentir. Aquí **las cifras de arriba se
/// cuentan en la base**, no sobre la lista, y la pantalla avisa si la lista
/// quedó corta.
const TOPE_PETICIONES = 400;

const CAMPOS = {
  id: true,
  text: true,
  origin: true,
  reserved: true,
  createdAt: true,
  prayedAt: true,
  prayedNote: true,
  recordedBy: { select: { fullName: true } },
  prayedBy: { select: { fullName: true } },
  person: {
    select: {
      firstName: true,
      lastName: true,
      learnerProfile: { select: { id: true, phase: true } },
    },
  },
} as const;

type FilaDePeticion = {
  id: string;
  text: string;
  origin: string;
  reserved: boolean;
  createdAt: Date;
  prayedAt: Date | null;
  prayedNote: string | null;
  recordedBy: { fullName: string } | null;
  prayedBy: { fullName: string } | null;
  person: {
    firstName: string;
    lastName: string | null;
    learnerProfile: { id: string; phase: string } | null;
  };
};

function aPintar(fila: FilaDePeticion): PeticionParaPintar {
  return {
    id: fila.id,
    texto: fila.text,
    // Un origen que la pantalla no sepa pintar se trata como histórico en vez
    // de romper el renglón. El CHECK de la base ya lo impide; esto es la red.
    origen: esOrigen(fila.origin) ? fila.origin : "HISTORICO",
    nombre: nombreCompleto(fila.person),
    reservada: fila.reserved,
    learnerId: fila.person.learnerProfile?.id ?? null,
    fase: fila.person.learnerProfile
      ? (ETIQUETA_FASE[
          fila.person.learnerProfile.phase as keyof typeof ETIQUETA_FASE
        ] ?? fila.person.learnerProfile.phase)
      : null,
    pedidaEl: fila.createdAt,
    registradaPor: fila.recordedBy?.fullName ?? null,
    oradaEl: fila.prayedAt,
    oradaPor: fila.prayedBy?.fullName ?? null,
    notaDeOracion: fila.prayedNote,
  };
}

export type ListadoDeOracion = {
  peticiones: PeticionParaPintar[];
  resumen: ResumenDeOracion;
  /// La lista topó y hay más de las que se ven. Las cifras siguen siendo
  /// exactas: se cuentan en la base.
  recortado: boolean;
};

export async function cargarPeticiones(opciones: {
  filtro: FiltroDeOracion;
  busqueda?: string | null;
  ahora?: Date;
}): Promise<ListadoDeOracion> {
  const prisma = await getPrisma();
  const ahora = opciones.ahora ?? new Date();
  const busqueda = opciones.busqueda?.trim() ?? "";

  // ⚠️ **Cada filtro tiene que contar EXACTAMENTE lo que dice su recuadro.**
  // Los tres de arriba son pulsables y llevan aquí: «esperan oración» a
  // `pendientes`, «entraron esta semana» a `semana` y «oraron este mes» a
  // `oradas-mes`. Las dos ventanas de tiempo salen de `desdeHace`, la misma
  // función con la que se cuentan los recuadros, para que no puedan separarse:
  // si una dijera 7 días y la otra 7 días menos un rato, el número de arriba y
  // la lista de abajo se contradirían y no habría forma de saber cuál miente.
  const donde = {
    ...(opciones.filtro === "pendientes" ? { prayedAt: null } : {}),
    ...(opciones.filtro === "atendidas" ? { prayedAt: { not: null } } : {}),
    ...(opciones.filtro === "semana"
      ? { createdAt: { gte: desdeHace(DIAS_DE_LA_SEMANA, ahora) } }
      : {}),
    ...(opciones.filtro === "oradas-mes"
      ? { prayedAt: { gte: desdeHace(DIAS_DEL_MES, ahora) } }
      : {}),
    // ⚠️ El buscador mira `search_text`, que es la columna normalizada sin
    // tildes que mantiene el trigger (§7). Buscar por `firstName` dejaría
    // fuera a «José» cuando se escribe «jose».
    ...(busqueda
      ? { person: { searchText: { contains: busqueda.toLowerCase() } } }
      : {}),
  };

  // ⚠️ UN SOLO VIAJE para las dos cosas. Con `PrismaPg max:1` las consultas se
  // serializan aunque vayan en un `Promise.all` (§12.5), así que pedir la
  // lista y el conteo por separado serían dos latencias en fila.
  const [filas, resumenCrudo] = await prisma.$transaction([
    prisma.prayerRequest.findMany({
      where: donde,
      orderBy: { createdAt: "desc" },
      take: TOPE_PETICIONES,
      select: CAMPOS,
    }),
    // Las cifras salen de TODAS las peticiones, no de las filtradas ni de las
    // que entraron en la lista: son el estado del módulo, no del filtro.
    prisma.prayerRequest.findMany({
      select: { origin: true, createdAt: true, prayedAt: true },
    }),
  ]);

  const resumen = resumirPeticiones(
    resumenCrudo.map((p) => ({
      origen: esOrigen(p.origin) ? p.origin : ("HISTORICO" as OrigenDeLaPeticion),
      pedidaEl: p.createdAt,
      oradaEl: p.prayedAt,
    })),
    ahora,
  );

  return {
    peticiones: (filas as FilaDePeticion[]).map(aPintar),
    resumen,
    recortado: filas.length === TOPE_PETICIONES,
  };
}

/// Registra una petición. Es la puerta única: la usan el formulario público, el
/// webhook de registro y el equipo desde el expediente.
///
/// ⚠️ **`recordedById` va nulo cuando la escribió la persona**, y no es un
/// olvido: poner ahí a alguien del equipo haría creer que ya la atendió.
export async function registrarPeticion(datos: {
  personId: string;
  texto: string;
  origen: OrigenDeLaPeticion;
  reservada?: boolean;
  recordedById?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; mensaje: string }> {
  const validacion = peticionValida(datos.texto);
  if (!validacion.ok) return validacion;

  const prisma = await getPrisma();
  const creada = await prisma.prayerRequest.create({
    data: {
      personId: datos.personId,
      text: datos.texto.trim(),
      origin: datos.origen,
      reserved: datos.reservada ?? false,
      recordedById: datos.recordedById ?? null,
    },
    select: { id: true },
  });

  // ⚠️ **El TEXTO de la petición NO entra en la auditoría.** «Actividad del
  // día» la ve cualquier administrador, y repetir ahí lo que alguien contó de
  // su enfermedad o de su familia lo esparce por una pantalla que no es la
  // suya — y lo haría también con las reservadas, que es exactamente lo
  // contrario de lo que la persona pidió. Es la misma línea que el código del
  // QR y el token del calendario: lo sensible no se duplica.
  await auditar(prisma, {
    actorId: datos.recordedById ?? null,
    action: "oracion.peticion_registrada",
    entityType: "prayer_request",
    entityId: creada.id,
    metadata: { origen: datos.origen, reservada: datos.reservada ?? false },
  });

  return { ok: true, id: creada.id };
}

/// Marca una petición como atendida. Pasa al historial, no se borra.
export async function marcarOrada(datos: {
  peticionId: string;
  usuarioId: string;
  nota?: string | null;
}): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const prisma = await getPrisma();
  const actual = await prisma.prayerRequest.findUnique({
    where: { id: datos.peticionId },
    select: { prayedAt: true },
  });
  if (!actual) return { ok: false, mensaje: "Esa petición ya no existe." };
  if (actual.prayedAt) {
    // No es un error que haya que gritar: dos personas pueden pulsar a la vez.
    return { ok: false, mensaje: "Alguien ya la marcó como atendida." };
  }

  const nota = datos.nota?.trim() || null;
  await prisma.prayerRequest.update({
    where: { id: datos.peticionId },
    data: {
      prayedAt: new Date(),
      prayedById: datos.usuarioId,
      prayedNote: nota,
    },
  });

  await auditar(prisma, {
    actorId: datos.usuarioId,
    action: "oracion.peticion_orada",
    entityType: "prayer_request",
    entityId: datos.peticionId,
    metadata: { conNota: nota !== null },
  });

  return { ok: true };
}


// ---------------------------------------------------------------------------
// El formulario público: la persona pide oración desde su celular
// ---------------------------------------------------------------------------

/// ⚠️ **Se reconoce a la persona igual que en «Actualizar datos»** (7-sep):
/// primero por el celular y, si no aparece, por **correo + fecha de
/// nacimiento**. Los dos datos juntos, nunca el correo solo: hay fichas con el
/// correo de otra persona (§8), y solo por correo alguien podría pedir oración
/// a nombre de quien no es.
///
/// **Y si no la encuentra, NO crea ficha.** Es la diferencia con el formulario
/// de liderazgo, y es deliberada: aquel sirve para darse de alta; este es para
/// que alguien que YA está en la casa pida oración. Crear una ficha por cada
/// desconocido que escriba llenaría la base de personas sin proceso, sin
/// consolidador y sin nadie que las llame — justo lo contrario de lo que la
/// Operación 72 existe para evitar.
export async function pedirOracionDesdeElCelular(datos: {
  callPhone: string;
  email: string;
  birthDate: string;
  texto: string;
  reservada: boolean;
}): Promise<
  | { ok: true; nombre: string }
  | { ok: false; mensaje: string; noEncontrada?: boolean }
> {
  const validacion = peticionValida(datos.texto);
  if (!validacion.ok) return validacion;

  const cola = colaDeTelefono(datos.callPhone);
  const correo = datos.email.trim();
  if (!cola && !correo) {
    return {
      ok: false,
      mensaje: "Escribe tu celular para que sepamos por quién orar.",
    };
  }

  const prisma = await getPrisma();
  const CAMPOS_PERSONA = {
    id: true,
    firstName: true,
    lastName: true,
  } as const;

  let candidatas =
    cola && cola.length >= 10
      ? await prisma.person.findMany({
          where: {
            OR: [
              { callPhone: { endsWith: cola } },
              { whatsappPhone: { endsWith: cola } },
            ],
          },
          select: CAMPOS_PERSONA,
        })
      : [];

  if (candidatas.length === 0 && correo && datos.birthDate) {
    candidatas = await prisma.person.findMany({
      where: {
        email: { equals: correo, mode: "insensitive" },
        birthDate: new Date(datos.birthDate),
      },
      select: CAMPOS_PERSONA,
    });
  }

  // Dos fichas que casan: antes que escribir sobre la persona equivocada, se
  // para y se avisa (la misma regla del formulario de liderazgo).
  if (candidatas.length > 1) {
    return {
      ok: false,
      mensaje:
        "Encontramos más de una ficha con esos datos. Avísale al equipo de la iglesia para que lo revisen.",
    };
  }

  const persona = candidatas[0];
  if (!persona) {
    return {
      ok: false,
      noEncontrada: true,
      mensaje:
        "No encontramos tu ficha con ese celular. Prueba con tu correo y tu fecha de nacimiento, o pídele al equipo de la iglesia que te registre.",
    };
  }

  const resultado = await registrarPeticion({
    personId: persona.id,
    texto: datos.texto,
    origen: "PERSONA",
    reservada: datos.reservada,
    // ⚠️ Nulo a propósito: la escribió ella, no el equipo.
    recordedById: null,
  });
  if (!resultado.ok) return resultado;

  return { ok: true, nombre: persona.firstName };
}
