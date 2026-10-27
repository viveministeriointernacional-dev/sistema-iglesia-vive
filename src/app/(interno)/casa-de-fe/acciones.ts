"use server";

import { revalidatePath } from "next/cache";
import { LearnerStatus, Phase } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import {
  normalizarReunion,
  REUNION_VACIA,
  type DatosDeReunion,
} from "@/lib/reunion-catalogo";
import { guardarReunionDeGrupo } from "@/lib/reunion";
import {
  borrarGrupo,
  loQueTieneElGrupo,
  renombrarGrupo,
} from "@/lib/grupos-administrar";
import type { LoQueTieneElGrupo } from "@/lib/borrar-grupo-catalogo";
import { nombreCompleto } from "@/lib/dominio";
import { ponerEnEtapaPorInscripcion } from "@/lib/etapa-automatica";
import { auditar } from "@/lib/audit";
import {
  avisoDeDatosQueFaltan,
  type CasaDeLaInscripcion,
  loQueFaltaDeLaCasa,
} from "@/lib/casa-de-fe-bienvenida-catalogo";
import { enviarAccesoAlTaller } from "@/lib/taller-bienvenida";
import {
  ErrorDePermiso,
  obtenerUsuarioActual,
  requerirVistaEnAccion,
} from "@/lib/auth";
import {
  puedeAdministrarCasaDeFe,
  lideresPosiblesCasaDeFe,
  puedeCrearCasaDeFe,
  puedeVerCasaDeFe,
} from "@/lib/casa-de-fe";
import { paraPermiso } from "@/lib/encargados-catalogo";
import { ROTULOS, tipoDeGrupoDelFormulario } from "@/lib/tipo-de-grupo";
import {
  anadirEncargadoAlGrupo,
  cambiarLiderDelGrupo,
  quitarEncargadoDelGrupo,
} from "@/lib/encargados";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

/// Como `Resultado`, pero con un **aviso** que no es un error: la acción sí se
/// hizo y además hay algo que decir. Es la forma que ya usa Administración
/// cuando la contraseña se cambió pero el correo no salió (3-sep-2026).
export type ResultadoConAviso =
  | { ok: true; aviso?: string }
  | { ok: false; mensaje: string };

async function usuarioQueAbreCasas() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeCrearCasaDeFe(usuario)) throw new ErrorDePermiso();
  return usuario;
}

/// La Casa de Fe que esta persona puede administrar: la que lleva, o cualquiera
/// si es de dirección.
/// La casa, con lo que necesita la confirmación de inscripción.
///
/// ⚠️ **Sin `export`, y no es un descuido: este archivo es `"use server"` y ahí
/// solo pueden exportarse funciones `async`** (§12.4). Exportar esto tumbaría
/// la pantalla entera en ejecución, con `tsc`, `eslint` y `cf:build` los tres
/// en verde. Hay un guardián (`src/lib/use-server.test.ts`), pero es más
/// barato no provocarlo.
function casaParaElCorreo(grupo: {
  name: string;
  weekday: number | null;
  meetingTime: string | null;
  everyNWeeks: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  leader: { fullName: string; person: { firstName: string } | null };
}): CasaDeLaInscripcion {
  return {
    nombre: grupo.name,
    weekday: grupo.weekday,
    meetingTime: grupo.meetingTime,
    everyNWeeks: grupo.everyNWeeks,
    address: grupo.address,
    latitude: grupo.latitude,
    longitude: grupo.longitude,
    lider: grupo.leader.fullName,
    // Sin ficha enganchada no hay nombres separados y toca cortar; es lo mejor
    // que se puede hacer con lo que hay.
    liderDePila:
      grupo.leader.person?.firstName?.trim() ||
      (grupo.leader.fullName.split(" ")[0] ?? grupo.leader.fullName),
  };
}

async function casaPropia(groupId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeVerCasaDeFe(usuario)) throw new ErrorDePermiso();
  const prisma = await getPrisma();
  const grupo = await prisma.faithHouseGroup.findUnique({
    where: { id: groupId },
    // `createdById`: quien la abrió debe poder operarla aunque la lleve otra
    // persona.
    select: {
      id: true,
      // Cuál de los tres es. Manda en tres cosas: si se le exige día, hora y
      // dirección antes de inscribir, si sale el correo con el código del
      // taller, y cómo se le llama en cada aviso.
      kind: true,
      // `name` lo necesita el mensaje de bienvenida: «ya entraste a Casa de fe
      // Oscar & Dana» dice mucho más que «a una Casa de Fe».
      name: true,
      leaderId: true,
      createdById: true,
      closedAt: true,
      coLeaders: { select: { userId: true } },
      // El resto lo necesita la confirmacion de inscripcion: sin el dia, la
      // hora y la direccion, la persona queda inscrita sin saber cuando ni
      // donde presentarse. Van en el MISMO select, asi que no cuestan un viaje
      // mas a la base.
      weekday: true,
      meetingTime: true,
      everyNWeeks: true,
      address: true,
      latitude: true,
      longitude: true,
      // `person.firstName` son los NOMBRES, no la primera palabra: «Paola
      // Alejandra», no «Paola». Cortar por el espacio se equivoca en 7 de los
      // 17 líderes (22-oct).
      leader: { select: { fullName: true, person: { select: { firstName: true } } } },
    },
  });
  if (!grupo) return { usuario, grupo: null };
  if (!(await puedeAdministrarCasaDeFe(usuario, paraPermiso(grupo))))
    return { usuario, grupo: null };
  return { usuario, grupo };
}

/// Abrir una Casa de Fe es de dirección; llevarla, de quien tenga el permiso.
/// Por eso se elige el líder al crearla, en vez de asignárselo a quien la abre.
export async function crearCasaDeFe(
  /// Cuál de los tres: Casa de Fe, Restaurados o Mentoría. **Se valida contra
  /// la lista** y no se escribe lo que llegue: viene del navegador y acaba en
  /// una columna de la base.
  tipo: string,
  nombre: string,
  inicio: string,
  liderId: string,
  reunion: DatosDeReunion = REUNION_VACIA,
): Promise<Resultado> {
  const usuario = await usuarioQueAbreCasas();

  const kind = tipoDeGrupoDelFormulario(tipo);
  if (!kind) return { ok: false, mensaje: "Ese tipo de grupo no existe." };
  const r = ROTULOS[kind];

  if (nombre.trim().length < 3) {
    return { ok: false, mensaje: `Ponle un nombre ${r.articulo === "la" ? "a la" : "al"} ${r.singular}.` };
  }
  if (Number.isNaN(Date.parse(inicio))) {
    return { ok: false, mensaje: "La fecha de inicio no es válida." };
  }

  const limpia = normalizarReunion(reunion);
  if (!limpia.ok) return { ok: false, mensaje: limpia.mensaje };

  const prisma = await getPrisma();
  const lider = await prisma.appUser.findFirst({
    where: { id: liderId, active: true, canLeadFaithHouse: true },
    select: { id: true, teamId: true },
  });
  if (!lider) {
    return {
      ok: false,
      mensaje: "Elige quién la lleva, entre quienes tienen el permiso.",
    };
  }

  const grupo = await prisma.faithHouseGroup.create({
    data: {
      kind,
      name: nombre.trim(),
      startDate: new Date(inicio),
      leaderId: lider.id,
      createdById: usuario.id,
      teamId: lider.teamId ?? usuario.teamId,
      ...limpia.datos,
    },
    select: { id: true },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "casa_de_fe.grupo_abierto",
    entityType: "faith_house_group",
    entityId: grupo.id,
    // ⚠️ El tipo va en el metadato, no en una acción nueva por tipo. Si no,
    // «Actividad del día» y cualquier recuento tendrían que buscar TRES
    // acciones donde antes había una, que es exactamente la trampa de las dos
    // acciones de baja del 16-oct (§12.4).
    metadata: { liderId: lider.id, kind },
  });

  revalidatePath("/alpha");
  return { ok: true };
}

export async function inscribirEnCasaDeFe(
  groupId: string,
  learnerId: string,
): Promise<ResultadoConAviso> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };
  const r = ROTULOS[grupo.kind];
  if (grupo.closedAt) {
    return { ok: false, mensaje: `${r.articulo === "la" ? "La" : "El"} ${r.singular} ya está cerrad${r.articulo === "la" ? "a" : "o"}.` };
  }

  // ⚠️ **No se inscribe a nadie en una casa a la que le faltan datos** (petición
  // del usuario, 22-oct). El correo de confirmación lleva el día, la hora y la
  // dirección; sin ellos la persona queda inscrita sin saber cuándo ni dónde
  // presentarse, y el correo sale cojo. Se piden antes, no después.
  //
  // El guardia va en la ACCIÓN y además en la pantalla (§12.6): avisar solo en
  // la pantalla sería cosmético.
  //
  // ⚠️ **Y solo donde hay correo que mandar.** Restaurados y Mentorías no
  // mandan nada al inscribir (decisión del usuario, 27-oct-2026), así que
  // exigirles la dirección sería un guarda que no protege de nada: la trampa
  // del 23-oct, el guarda prudente que bloquea justo el caso que existe para
  // atender. En una mentoría que se acuerda por teléfono, la dirección puede
  // llegar después.
  if (r.conTaller) {
    const avisoDeDatos = avisoDeDatosQueFaltan(loQueFaltaDeLaCasa(grupo));
    if (avisoDeDatos) return { ok: false, mensaje: avisoDeDatos };
  }

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { id: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "Esa persona no existe." };

  const yaEsta = await prisma.faithHouseGroupMember.findUnique({
    where: { groupId_learnerId: { groupId, learnerId } },
    select: { id: true },
  });
  if (yaEsta) return { ok: false, mensaje: "Ya está en la Casa de Fe." };

  await prisma.faithHouseGroupMember.create({ data: { groupId, learnerId } });

  // Estar en una Casa de Fe **es** estar en Fortalecer (regla del usuario,
  // 27-oct-2026): la etapa se mueve sola y no pide requisitos. Vale igual para
  // Restaurados y para las mentorías, que también son discipulado.
  await ponerEnEtapaPorInscripcion(prisma, learnerId, grupo.kind, usuario.id);

  await auditar(prisma, {
    actorId: usuario.id,
    action: "casa_de_fe.miembro_inscrito",
    entityType: "faith_house_group",
    entityId: groupId,
    metadata: { learnerId },
  });

  // ⚠️ **El mensaje se manda DESPUÉS de inscribir y FUERA de cualquier
  // transacción**, porque es red: sostener una transacción mientras se espera a
  // Resend y a HighLevel dejaría ocupada la única conexión de base de datos de
  // la petición (`PrismaPg max:1`, §7). Es la misma decisión del 5-sep-2026 con
  // el formulario de liderazgo.
  //
  // Y **nunca deshace la inscripción**: la persona ya está en la casa. Si el
  // mensaje no salió, se dice y alguien le dicta el código.
  //
  // ⚠️ **Solo Casa de Fe manda algo.** Lo que se reparte aquí es el código y
  // los 12 talleres, y Restaurados y Mentorías no tienen taller: mandarles ese
  // correo sería entregarles una cartilla que no les toca. Decisión del
  // usuario del 27-oct-2026, con lo de WhatsApp apuntado para después.
  if (!r.conTaller) {
    revalidatePath(`/casa-de-fe/${groupId}`);
    return { ok: true };
  }

  const acceso = await enviarAccesoAlTaller(learnerId, {
    casa: casaParaElCorreo(grupo),
    actorId: usuario.id,
  }).catch((error) => {
    console.error("No se pudo mandar el acceso al taller", error);
    return null;
  });

  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true, aviso: avisoDelAcceso(acceso) };
}

/// Vuelve a mandarle a alguien su código y sus talleres.
///
/// ⚠️ **Sin esto el envío automático tiene un callejón sin salida.** Un correo
/// rebotado, un celular sin WhatsApp o un campo que todavía no existía en
/// HighLevel dejarían a la persona inscrita y sin forma de entrar, y la única
/// salida sería retirarla de la casa y volver a inscribirla — que ensucia la
/// bitácora con un movimiento que no ocurrió.
///
/// **No crea un token nuevo**: `tokenDeRegreso` reutiliza el que ya tenga, así
/// que el enlace que llegó la primera vez sigue sirviendo. Rehacerlo mataría el
/// mensaje que la persona ya tiene guardado en su WhatsApp.
export async function reenviarAccesoAlTaller(
  groupId: string,
  learnerId: string,
): Promise<ResultadoConAviso> {
  const { grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };
  // El taller es de Casa de Fe. En los otros dos ni se enseña el botón, pero
  // el guardia va también en la acción: esconderlo y dejar la acción abierta
  // es cosmético (§12.6).
  if (!ROTULOS[grupo.kind].conTaller) {
    return { ok: false, mensaje: "Este tipo de grupo no tiene taller." };
  }

  const prisma = await getPrisma();
  const esMiembro = await prisma.faithHouseGroupMember.findUnique({
    where: { groupId_learnerId: { groupId, learnerId } },
    select: { id: true },
  });
  if (!esMiembro) return { ok: false, mensaje: "Esa persona no está en este grupo." };

  const usuario = await obtenerUsuarioActual();
  const acceso = await enviarAccesoAlTaller(learnerId, {
    casa: casaParaElCorreo(grupo),
    actorId: usuario?.id ?? null,
  }).catch((error) => {
    console.error("No se pudo reenviar el acceso al taller", error);
    return null;
  });

  if (!acceso) {
    return { ok: false, mensaje: "No se pudo mandar. Vuelve a intentarlo en un momento." };
  }

  const aviso = avisoDelAcceso(acceso);
  revalidatePath(`/casa-de-fe/${groupId}`);
  return {
    ok: true,
    aviso:
      aviso ??
      `Listo: le volvió a salir por correo y por WhatsApp. Su código es ${acceso.codigo.slice(0, 3)} ${acceso.codigo.slice(3)}.`,
  };
}

/// Qué decirle a quien acaba de inscribir a alguien.
///
/// ⚠️ **Se avisa SOLO cuando hay algo que hacer.** Si los dos caminos
/// funcionaron, no se dice nada: un aviso en cada inscripción se vuelve ruido y
/// se deja de leer, justo cuando importa. Y si **ninguno** funcionó, se da el
/// código en el propio aviso: es lo único que le permite al líder dictárselo
/// por teléfono sin tener que ir a buscarlo a Administración.
function avisoDelAcceso(
  acceso: Awaited<ReturnType<typeof enviarAccesoAlTaller>> | null,
): string | undefined {
  if (!acceso) {
    return "Quedó inscrita, pero no se pudo mandar su código ni sus talleres. Usa «Mandarle su código» en su renglón para volver a intentarlo.";
  }

  const correoBien = acceso.correo?.enviado === true;
  const sinCorreo = acceso.correo === null;
  if (correoBien && acceso.crm.ok) return undefined;

  const partes: string[] = [];
  if (!acceso.crm.ok) {
    partes.push(`el WhatsApp no salió: ${acceso.crm.motivo ?? "HighLevel no respondió"}`);
  }
  if (sinCorreo) {
    partes.push("no tiene correo registrado");
  } else if (!correoBien) {
    partes.push(`el correo no salió: ${acceso.correo?.motivo ?? "sin detalle"}`);
  }

  const nadaSalio = !correoBien && !acceso.crm.ok;
  return `Quedó inscrita, pero ${partes.join("; ")}.${
    nadaSalio
      ? ` Su código es ${acceso.codigo.slice(0, 3)} ${acceso.codigo.slice(3)}: díctaselo y dile que entre a /taller/mis.`
      : ""
  }`;
}

export async function retirarDeCasaDeFe(
  groupId: string,
  membershipId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const prisma = await getPrisma();
  const miembro = await prisma.faithHouseGroupMember.findUnique({
    where: { id: membershipId },
    select: { id: true, groupId: true, learnerId: true },
  });
  // Se comprueba contra el grupo pedido: sin esto, el líder de una Casa podría
  // retirar a alguien de otra.
  if (!miembro || miembro.groupId !== groupId) {
    return { ok: false, mensaje: "Esa persona no está en este grupo." };
  }

  await prisma.faithHouseGroupMember.delete({ where: { id: membershipId } });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "casa_de_fe.miembro_retirado",
    entityType: "faith_house_group",
    entityId: groupId,
    metadata: { learnerId: miembro.learnerId },
  });

  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// Cierra o reabre una Casa de Fe. Cerrarla no borra nada: solo deja de admitir
/// inscripciones y la marca como terminada.
export async function alternarCierreCasaDeFe(
  groupId: string,
  cerrar: boolean,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const prisma = await getPrisma();
  await prisma.faithHouseGroup.update({
    where: { id: groupId },
    data: { closedAt: cerrar ? new Date() : null },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: cerrar ? "casa_de_fe.grupo_cerrado" : "casa_de_fe.grupo_abierto",
    entityType: "faith_house_group",
    entityId: groupId,
  });

  revalidatePath(`/casa-de-fe/${groupId}`);
  revalidatePath("/alpha");
  return { ok: true };
}

export type CandidatoCasaDeFe = {
  learnerId: string;
  nombre: string;
  fase: Phase;
  telefono: string | null;
};

/// Personas activas que todavía no están en esta Casa de Fe.
export async function buscarCandidatosCasaDeFe(
  groupId: string,
  consulta: string,
): Promise<CandidatoCasaDeFe[]> {
  const { grupo } = await casaPropia(groupId);
  if (!grupo) return [];

  const texto = consulta.trim();
  const prisma = await getPrisma();

  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      status: LearnerStatus.ACTIVO,
      faithHouseGroups: { none: { groupId } },
      ...(texto.length >= 2
        ? {
            person: {
              OR: [
                { firstName: { contains: texto, mode: "insensitive" as const } },
                { lastName: { contains: texto, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phase: true,
      person: { select: { firstName: true, lastName: true, callPhone: true } },
    },
  });

  return aprendices.map((aprendiz) => ({
    learnerId: aprendiz.id,
    nombre: nombreCompleto(aprendiz.person),
    fase: aprendiz.phase,
    telefono: aprendiz.person.callPhone,
  }));
}

/// Guarda el día, la hora, la periodicidad y la dirección del grupo.
export async function guardarReunion(
  grupoId: string,
  datos: DatosDeReunion,
): Promise<Resultado> {
  let usuario;
  try {
    usuario = await requerirVistaEnAccion("grupos");
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const prisma = await getPrisma();
  const grupo = await prisma.faithHouseGroup.findUnique({
    where: { id: grupoId },
    select: {
      id: true,
      leaderId: true,
      createdById: true,
      coLeaders: { select: { userId: true } },
    },
  });
  if (!grupo) return { ok: false, mensaje: "No se encontró el grupo." };

  // Mover la reunión le cambia el calendario a todos sus miembros, así que lo
  // hace quien administra el grupo, no cualquiera que pueda verlo.
  if (!(await puedeAdministrarCasaDeFe(usuario, paraPermiso(grupo)))) {
    return { ok: false, mensaje: "No administras este grupo." };
  }

  const resultado = await guardarReunionDeGrupo(
    "casa-de-fe",
    grupoId,
    usuario.id,
    datos,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${grupoId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Quiénes lo llevan: el líder y los encargados
// ---------------------------------------------------------------------------

/// **Cambia el líder del grupo.** El anterior queda de encargado, así que no
/// pierde el grupo de su lista ni de su calendario.
export async function casaDeFeCambiarLider(
  groupId: string,
  nuevoLiderId: string,
  nota: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const resultado = await cambiarLiderDelGrupo(
    "casa-de-fe",
    groupId,
    usuario.id,
    nuevoLiderId,
    nota,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Pone a alguien de encargado**, que administra el grupo igual que el líder.
export async function casaDeFeAnadirEncargado(
  groupId: string,
  userId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const resultado = await anadirEncargadoAlGrupo(
    "casa-de-fe",
    groupId,
    usuario.id,
    userId,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Quita a un encargado.** Al líder no se le quita por aquí: para eso está el
/// cambio de líder, que además pide decir por qué.
export async function casaDeFeQuitarEncargado(
  groupId: string,
  userId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const resultado = await quitarEncargadoDelGrupo(
    "casa-de-fe",
    groupId,
    usuario.id,
    userId,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Las cuentas que pueden llevar este tipo de grupo**: activas y con el
/// permiso. Sirve para las dos listas del panel — la de líder y la de
/// encargados —, y por eso vienen TODAS: descartar aquí a quien ya lleva el
/// grupo dejaría sin candidatos al `<select>` de líder, donde un encargado
/// actual es justamente el caso normal.
///
/// Quién queda fuera de la lista de «añadir» lo decide el componente con
/// `candidatosDisponibles`, que es pura y vive en el catálogo.
export async function casaDeFeCuentasQuePuedenLlevar(
  groupId: string,
): Promise<{ id: string; fullName: string; role: string }[]> {
  const { grupo } = await casaPropia(groupId);
  if (!grupo) return [];
  return lideresPosiblesCasaDeFe();
}

// ---------------------------------------------------------------------------
// Renombrar y borrar la Casa de Fe
// ---------------------------------------------------------------------------

/// **Quién puede renombrar o borrar una Casa de Fe: quien podría haberla
/// abierto, y solo si además la administra.** Ver la nota en `alpha/acciones.ts`.
async function casaPropiaDeDireccion(groupId: string) {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { usuario, grupo: null };
  if (!puedeCrearCasaDeFe(usuario)) return { usuario, grupo: null };
  return { usuario, grupo };
}

/// Le cambia el nombre a la casa. Hasta hoy solo se escribía al crearla, y los
/// nombres los teclea el equipo: hay casas con dos espacios seguidos.
export async function casaDeFeRenombrar(
  groupId: string,
  nombre: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropiaDeDireccion(groupId);
  if (!grupo) {
    return { ok: false, mensaje: "No puedes cambiarle el nombre a este grupo." };
  }

  const resultado = await renombrarGrupo("casa-de-fe", groupId, usuario.id, nombre);
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Borra la Casa de Fe creada por error.** Hay que escribir su nombre, y el
/// servidor lo vuelve a comprobar (`borrarGrupo`).
export async function casaDeFeBorrar(
  groupId: string,
  nombreEscrito: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropiaDeDireccion(groupId);
  if (!grupo) return { ok: false, mensaje: "No puedes borrar este grupo." };

  const resultado = await borrarGrupo("casa-de-fe", groupId, usuario.id, nombreEscrito);
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  return { ok: true };
}

/// Lo que la casa tiene dentro, para que la ventana de confirmación pueda decir
/// qué desaparece. Se pide al abrir la ventana, no al cargar la página (§12.5).
export async function casaDeFeQueSePierdeAlBorrar(
  groupId: string,
): Promise<
  { ok: true; nombre: string; tiene: LoQueTieneElGrupo } | { ok: false; mensaje: string }
> {
  const { grupo } = await casaPropiaDeDireccion(groupId);
  if (!grupo) return { ok: false, mensaje: "No puedes borrar este grupo." };

  const datos = await loQueTieneElGrupo("casa-de-fe", groupId);
  if (!datos) return { ok: false, mensaje: "No se encontró el grupo." };
  return { ok: true, nombre: datos.nombre, tiene: datos.tiene };
}
