import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { avisarDePeticionNueva } from "@/lib/aviso-de-peticion";
import { colaDeTelefono, nombreCompleto } from "@/lib/dominio";
import { ETIQUETA_FASE } from "@/lib/procesos-catalogo";
import {
  esTipo,
  type PestanaDePeticion,
  tiposConRespaldo,
} from "@/lib/oracion-catalogo";
import { crearRegistroEnTransaccion } from "@/lib/registro";
import { esquemaRegistro } from "@/lib/validacion-registro";
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
  /// Qué clase de petición se está mirando. Va aparte del filtro porque son dos
  /// cosas distintas: la pestaña dice QUÉ se pidió y el filtro en qué ESTADO
  /// está, así que se combinan («consejería pendiente», «consejería todas»).
  pestana?: PestanaDePeticion;
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
    // La pestaña. `todo` no añade nada; «proceso» mira la columna aparte, no
    // los tipos, porque querer empezar no es una clase de petición.
    ...(opciones.pestana === "proceso" ? { wantsProcess: true } : {}),
    ...(opciones.pestana && esTipo(opciones.pestana)
      ? { types: { has: opciones.pestana } }
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
  /// Qué pidió. Si no se pasa nada, cae en ORACION: una petición sin tipo
  /// quedaría guardada y a la vez invisible en todas las pestañas.
  tipos?: readonly string[];
  /// «Quiero iniciar un proceso». Solo marca la petición; quien abre la
  /// Operación 72 es `pedirAcompanamiento`, que es la que tiene la transacción.
  quiereProceso?: boolean;
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
      types: tiposConRespaldo(datos.tipos ?? []),
      wantsProcess: datos.quiereProceso ?? false,
    },
    select: { id: true, types: true },
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
    // ⚠️ El TEXTO sigue sin entrar (ver arriba). Los tipos sí: dicen QUÉ se
    // pidió sin decir nada de lo que la persona contó.
    metadata: {
      origen: datos.origen,
      reservada: datos.reservada ?? false,
      tipos: creada.types,
      quiereProceso: datos.quiereProceso ?? false,
    },
  });

  // **El aviso a los pastores y a la mesa ministerial.**
  //
  // ⚠️ Va DESPUÉS de guardar y de auditar, y nunca lanza: la petición ya está
  // a salvo, así que un correo caído no se la quita a nadie. Y filtra por
  // origen ella misma (`debeAvisar`): solo avisa de las que la persona pidió
  // por el link, no de las 22 de cada 24 que llegan del formulario de registro.
  await avisarDePeticionNueva({
    peticionId: creada.id,
    personId: datos.personId,
    origen: datos.origen,
    reservada: datos.reservada ?? false,
    tipos: creada.types,
    quiereProceso: datos.quiereProceso ?? false,
    texto: datos.texto,
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

// ---------------------------------------------------------------------------
// El formulario público: oración, consejería y «quiero iniciar un proceso»
// (11-nov-2026)
// ---------------------------------------------------------------------------

/// **Paso 1: ¿te conocemos por este celular?**
///
/// ⚠️ **Devuelve solo el NOMBRE DE PILA, nunca el completo ni el correo.** Este
/// link es público: cualquiera puede teclear un número. Con el nombre de pila,
/// quien es la dueña se reconoce («¿eres tú, Luz Mary?») y quien no lo es se
/// lleva un dato que ya tenía o que no le sirve de nada.
export async function buscarPorCelular(celular: string): Promise<
  | { encontrada: true; personId: string; nombre: string }
  | { encontrada: false; motivo: "sin-numero" | "no-esta" | "varias" }
> {
  const cola = colaDeTelefono(celular);
  if (!cola || cola.length < 10) return { encontrada: false, motivo: "sin-numero" };

  const prisma = await getPrisma();
  const candidatas = await prisma.person.findMany({
    where: {
      OR: [{ callPhone: { endsWith: cola } }, { whatsappPhone: { endsWith: cola } }],
    },
    select: { id: true, firstName: true },
    take: 2,
  });

  // Dos fichas con el mismo número: no se adivina. Sigue por el camino de
  // «cuéntanos quién eres», que crea la suya.
  if (candidatas.length !== 1) {
    return { encontrada: false, motivo: candidatas.length === 0 ? "no-esta" : "varias" };
  }
  return {
    encontrada: true,
    personId: candidatas[0].id,
    nombre: candidatas[0].firstName,
  };
}

export type ResultadoAcompanamiento =
  | { ok: true; nombre: string; abrioProceso: boolean }
  | { ok: false; mensaje: string };

/// **Paso 3: guardar lo que pidió.**
///
/// Las tres cosas que puede pedir van por caminos distintos a propósito:
/// oración y consejería son **tipos de la petición**, y «quiero iniciar un
/// proceso» es lo que abre su **Operación 72**.
///
/// ⚠️ **Operación 72 se abre solo para quien NO estaba.** Si la persona ya tiene
/// ficha puede estar ya en un proceso, en Fortalecer o hasta en el equipo:
/// abrirle una tarjeta nueva duplicaría su recorrido. En ese caso se marca
/// `wantsProcess` y la petición sale en la pestaña «Quieren iniciar proceso»,
/// que es donde consolidación decide qué hacer con alguien que ya conocen.
export async function pedirAcompanamiento(datos: {
  /// Puesto cuando confirmó «sí, soy yo» en el paso 2.
  personId?: string | null;
  celular: string;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  tipos: readonly string[];
  quiereProceso: boolean;
  texto: string;
  reservada: boolean;
}): Promise<ResultadoAcompanamiento> {
  const validacion = peticionValida(datos.texto);
  if (!validacion.ok) return validacion;

  const tipos = tiposConRespaldo(datos.tipos);
  const prisma = await getPrisma();

  // --- Ya la conocíamos: solo se guarda la petición.
  if (datos.personId) {
    const persona = await prisma.person.findUnique({
      where: { id: datos.personId },
      select: { id: true, firstName: true },
    });
    if (!persona) {
      return { ok: false, mensaje: "No encontramos tu ficha. Vuelve a empezar, por favor." };
    }
    const guardada = await registrarPeticion({
      personId: persona.id,
      texto: datos.texto,
      origen: "PERSONA",
      reservada: datos.reservada,
      // ⚠️ Nulo a propósito: la escribió ella, no el equipo.
      recordedById: null,
      tipos,
      quiereProceso: datos.quiereProceso,
    });
    if (!guardada.ok) return guardada;
    return { ok: true, nombre: persona.firstName, abrioProceso: false };
  }

  // --- No estaba: se le crea la ficha, y la Operación 72 solo si la pidió.
  const nombres = (datos.nombres ?? "").trim();
  if (!nombres) {
    return { ok: false, mensaje: "Escribe tu nombre para saber por quién orar." };
  }

  const validados = esquemaRegistro.safeParse({
    firstName: nombres,
    lastName: (datos.apellidos ?? "").trim(),
    callPhone: datos.celular,
    email: (datos.correo ?? "").trim(),
    entryPoint: null,
  });
  if (!validados.success) {
    return { ok: false, mensaje: "Revisa tus datos: alguno no quedó bien escrito." };
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const creado = await crearRegistroEnTransaccion(tx, validados.data, {
      // Nadie del equipo la registró: la persona llegó sola por el link.
      actorId: null,
      // ⚠️ Esto es lo que separa «solo quiero oración» de «quiero empezar»: sin
      // la marca no se abre tarjeta ni se reparte consolidador.
      sinOperacion72: !datos.quiereProceso,
      metadata: { origen: "pedir-oracion", tipos, quiereProceso: datos.quiereProceso },
    });
    return creado;
  });

  const guardada = await registrarPeticion({
    personId: resultado.personId,
    texto: datos.texto,
    origen: "PERSONA",
    reservada: datos.reservada,
    recordedById: null,
    tipos,
    quiereProceso: datos.quiereProceso,
  });
  if (!guardada.ok) return guardada;

  return { ok: true, nombre: nombres, abrioProceso: datos.quiereProceso };
}
