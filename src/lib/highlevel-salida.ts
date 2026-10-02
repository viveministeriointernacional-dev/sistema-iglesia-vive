import type { CallOutcome } from "@iglesia/prisma-client";
import { nombreCompleto, textoDeHorario } from "@/lib/dominio";
import { variableDeEntorno } from "@/lib/entorno";
import { ETIQUETA_LLAMADA } from "@/lib/op72";
import { getPrisma } from "@/lib/prisma";

/// Sincronización de salida: lo que pasa en el sistema se escribe en HighLevel.
///
/// Es el reflejo del webhook de entrada. Todo aquí es «best-effort»: si no hay
/// token configurado, no hace nada; si HighLevel falla, se registra el error
/// pero nunca se rompe la acción del consolidador. El sistema es la fuente de
/// verdad; HighLevel es una copia para quien trabaja en el CRM.

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

/// IDs de los campos personalizados en HighLevel (los mismos que lee el webhook
/// de entrada en `highlevel.ts`).
const CAMPO = {
  confirmacionVisita: "yzgZvkQikaYXnK0fNL81",
  fechaVisita: "RoA76CCpoBd2DvraoQEF",
  estadoLlamada: "U1VhdP5dRedFZ30ihJbJ",
  fechaLlamada: "mXbNh4wigwrtXUpfMSqD",
  observacionLlamada: "r0FlVnHCzP6tqnTMHqdJ",
  /// «Hora de llamada» — texto libre en HighLevel (LARGE_TEXT).
  horaLlamada: "wWioQQ2mGFbj7d7hZw4R",
} as const;

type Credenciales = { token: string; locationId: string };

async function credenciales(): Promise<Credenciales | null> {
  const token = await variableDeEntorno("HIGHLEVEL_API_TOKEN");
  const locationId =
    (await variableDeEntorno("HIGHLEVEL_LOCATION_ID")) ?? null;
  if (!token || !locationId) return null;
  return { token, locationId };
}

async function pedir(
  ruta: string,
  metodo: "POST" | "PUT",
  cuerpo: unknown,
  token: string,
): Promise<Record<string, unknown>> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(
      `HighLevel ${metodo} ${ruta} → ${respuesta.status} ${detalle.slice(0, 300)}`,
    );
  }
  return (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
}

/// Solo fecha, en el formato que aceptan los campos de HighLevel.
function soloFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/// Busca el contacto ya enlazado de la persona del aprendiz.
async function enlaceExistente(learnerId: string) {
  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: {
      personId: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          callPhone: true,
          whatsappPhone: true,
          email: true,
          address: true,
          callSchedules: true,
          callScheduleNote: true,
          highLevelContacts: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { id: true, contactId: true },
          },
        },
      },
    },
  });
  return aprendiz;
}

/// Crea (o reutiliza) el contacto en HighLevel para una persona del sistema y
/// guarda el enlace. Devuelve el id de contacto de HighLevel, o `null` si no se
/// pudo (sin token, o error). No pisa un contacto que ya venía de HighLevel.
export async function exportarContactoNuevo(
  learnerId: string,
): Promise<string | null> {
  const cred = await credenciales();
  if (!cred) return null;

  try {
    const aprendiz = await enlaceExistente(learnerId);
    if (!aprendiz) return null;
    const persona = aprendiz.person;

    // Ya está enlazado (vino de HighLevel o ya se exportó): no se duplica.
    if (persona.highLevelContacts[0]) return persona.highLevelContacts[0].contactId;

    const telefono = persona.callPhone ?? persona.whatsappPhone ?? undefined;
    const cuerpo: Record<string, unknown> = {
      locationId: cred.locationId,
      firstName: persona.firstName,
      lastName: persona.lastName ?? undefined,
      name: nombreCompleto(persona),
      email: persona.email ?? undefined,
      phone: telefono,
      address1: persona.address ?? undefined,
      source: "Sistema Iglesia Vive",
    };

    // `upsert` evita crear un duplicado si el teléfono o el correo ya existe en
    // HighLevel: en ese caso devuelve el contacto que ya estaba.
    const respuesta = await pedir("/contacts/upsert", "POST", cuerpo, cred.token);
    const contacto = (respuesta.contact ?? respuesta) as Record<string, unknown>;
    const contactId =
      typeof contacto.id === "string" ? contacto.id : null;
    if (!contactId) return null;

    const prisma = await getPrisma();
    // Se guarda el enlace para no volver a crearlo y para cerrar el círculo con
    // el webhook de entrada (que deduplica por locationId + contactId).
    await prisma.highLevelContact.upsert({
      where: {
        locationId_contactId: {
          locationId: cred.locationId,
          contactId,
        },
      },
      create: {
        locationId: cred.locationId,
        contactId,
        personId: aprendiz.personId,
      },
      update: { personId: aprendiz.personId },
    });

    return contactId;
  } catch (error) {
    console.error("No se pudo exportar el contacto a HighLevel", error);
    return null;
  }
}

/// Empuja a HighLevel los datos básicos editados de una persona (nombre,
/// teléfono, correo, dirección). Si ya está enlazada, actualiza ese contacto;
/// si no, lo crea. Best-effort: sin token no hace nada y un fallo no rompe la
/// edición en el sistema.
export async function exportarDatosPersona(learnerId: string): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    const aprendiz = await enlaceExistente(learnerId);
    if (!aprendiz) return;
    const persona = aprendiz.person;
    const contactId = aprendiz.person.highLevelContacts[0]?.contactId ?? null;

    // Sin enlace todavía: crear el contacto ya deja los datos en HighLevel.
    if (!contactId) {
      await exportarContactoNuevo(learnerId);
      return;
    }

    const telefono = persona.callPhone ?? persona.whatsappPhone ?? undefined;
    // La hora de llamada también viaja de vuelta: es el dato que el equipo de
    // consolidación mira en el CRM antes de marcar, así que si alguien lo
    // corrige en el sistema tiene que reflejarse allá.
    const horario = textoDeHorario(
      persona.callSchedules,
      persona.callScheduleNote,
    );
    await pedir(
      `/contacts/${contactId}`,
      "PUT",
      {
        firstName: persona.firstName,
        lastName: persona.lastName ?? undefined,
        name: nombreCompleto(persona),
        email: persona.email ?? undefined,
        phone: telefono,
        address1: persona.address ?? undefined,
        ...(horario
          ? {
              customFields: [
                { id: CAMPO.horaLlamada, field_value: horario, value: horario },
              ],
            }
          : {}),
      },
      cred.token,
    );
  } catch (error) {
    console.error("No se pudo exportar los datos de la persona a HighLevel", error);
  }
}

/// Escribe campos personalizados en el contacto. Si aún no hay enlace, primero
/// crea el contacto.
async function actualizarCampos(
  learnerId: string,
  campos: { id: string; valor: string }[],
  cred: Credenciales,
): Promise<void> {
  const aprendiz = await enlaceExistente(learnerId);
  if (!aprendiz) return;

  const contactId =
    aprendiz.person.highLevelContacts[0]?.contactId ??
    (await exportarContactoNuevo(learnerId));
  if (!contactId) return;

  // HighLevel lee los campos como `{ id, value }` pero el endpoint de
  // actualización documenta `field_value`. Se mandan las dos claves con el
  // mismo valor para no depender de cuál interpreta esta versión de la API.
  await pedir(
    `/contacts/${contactId}`,
    "PUT",
    {
      customFields: campos.map((campo) => ({
        id: campo.id,
        field_value: campo.valor,
        value: campo.valor,
      })),
    },
    cred.token,
  );
}

/// Sube al CRM la primera llamada registrada en el sistema.
export async function exportarPrimeraLlamada(
  learnerId: string,
  datos: { resultado: CallOutcome; ocurrioEl: Date; observacion: string | null },
): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    const campos = [
      { id: CAMPO.estadoLlamada, valor: ETIQUETA_LLAMADA[datos.resultado] },
      { id: CAMPO.fechaLlamada, valor: soloFecha(datos.ocurrioEl) },
      ...(datos.observacion
        ? [{ id: CAMPO.observacionLlamada, valor: datos.observacion }]
        : []),
    ];
    await actualizarCampos(learnerId, campos, cred);
  } catch (error) {
    console.error("No se pudo exportar la primera llamada a HighLevel", error);
  }
}

/// Sube al CRM el agendamiento de la visita hecho en el sistema.
export async function exportarVisita(
  learnerId: string,
  datos: { cuando: Date; virtual: boolean },
): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    // Valores exactos de las opciones del campo en HighLevel.
    const confirmacion = datos.virtual
      ? "Desea reunión virtual"
      : "Sí, visita confirmada";
    const campos = [
      { id: CAMPO.confirmacionVisita, valor: confirmacion },
      { id: CAMPO.fechaVisita, valor: soloFecha(datos.cuando) },
    ];
    await actualizarCampos(learnerId, campos, cred);
  } catch (error) {
    console.error("No se pudo exportar la visita a HighLevel", error);
  }
}

/// Limpia en HighLevel la visita que se le había agendado por error.
///
/// Si no se limpiara, el CRM seguiría mostrando «Sí, visita confirmada» con su
/// fecha, y el equipo —que trabaja **solo** con el CRM— iría a visitar a quien
/// no era. Es justo el error que se está deshaciendo.
export async function anularVisitaEnHighLevel(learnerId: string): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    await actualizarCampos(
      learnerId,
      [
        { id: CAMPO.confirmacionVisita, valor: "" },
        { id: CAMPO.fechaVisita, valor: "" },
      ],
      cred,
    );
  } catch (error) {
    console.error("No se pudo anular la visita en HighLevel", error);
  }
}

/// Escribe en HighLevel quién consolida a esta persona (el «usuario asignado»
/// del contacto). Es la mitad «sistema → CRM» de la sincronización de doble vía
/// descrita en `src/lib/consolidador.ts`.
///
/// Best-effort, como el resto de exportaciones: sin token no hace nada, y un
/// fallo del CRM no deshace el cambio que ya quedó guardado en el sistema.
/// Si el consolidador quedó en nulo, se manda `assignedTo` vacío para que allá
/// también quede sin dueño.
export async function exportarConsolidador(learnerId: string): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    const prisma = await getPrisma();
    const aprendiz = await prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: {
        consolidator: { select: { highlevelUserId: true } },
        person: {
          select: {
            highLevelContacts: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { contactId: true },
            },
          },
        },
      },
    });

    const contactId = aprendiz?.person.highLevelContacts[0]?.contactId ?? null;
    if (!contactId) return;

    // Un consolidador sin id de HighLevel no existe para el CRM: mejor no
    // tocar nada que borrarle el dueño al contacto por error.
    const consolidador = aprendiz?.consolidator;
    if (consolidador && !consolidador.highlevelUserId) return;

    await pedir(
      `/contacts/${contactId}`,
      "PUT",
      { assignedTo: consolidador?.highlevelUserId ?? "" },
      cred.token,
    );
  } catch (error) {
    console.error("No se pudo exportar el consolidador a HighLevel", error);
  }
}

/// Le pregunta a HighLevel quién es el dueño de un contacto.
///
/// El webhook de asignación no puede depender de un merge-tag: qué etiquetas
/// existen cambia entre versiones del CRM y entre disparadores, y una que no
/// resuelve llega vacía sin avisar. Con el `contactId` —que sí llega siempre—
/// se le pregunta a la API, que es la respuesta autorizada.
///
/// Devuelve el id de usuario de HighLevel, o `null` si el contacto no tiene
/// dueño. Lanza si no se pudo preguntar, para poder distinguir «no tiene
/// dueño» de «no pude averiguarlo».
export async function consultarDuenoDelContacto(
  contactId: string,
): Promise<string | null> {
  const cred = await credenciales();
  if (!cred) throw new Error("Sin credenciales de HighLevel");

  const respuesta = await fetch(`${BASE}/contacts/${contactId}`, {
    headers: {
      Authorization: `Bearer ${cred.token}`,
      Version: VERSION,
      Accept: "application/json",
    },
  });
  if (!respuesta.ok) {
    throw new Error(`HighLevel GET /contacts/${contactId} → ${respuesta.status}`);
  }
  const cuerpo = (await respuesta.json()) as {
    contact?: { assignedTo?: unknown };
  };
  const dueno = cuerpo.contact?.assignedTo;
  return typeof dueno === "string" && dueno.trim() ? dueno.trim() : null;
}

// ---------------------------------------------------------------------------
// El acceso al taller de Casa de Fe, en el CRM
// ---------------------------------------------------------------------------

/// La etiqueta que se le pone al contacto al entrar a una Casa de Fe. **Es el
/// disparador del WhatsApp**: el workflow de HighLevel escucha «se añadió esta
/// etiqueta» y manda el mensaje con los dos campos de abajo.
///
/// Las etiquetas van **por nombre, no por id**, así que esto funciona sin que
/// nadie tenga que copiar ningún identificador.
export const ETIQUETA_TALLER = "casa-de-fe-taller";

/// Los dos campos personalizados que el mensaje necesita, **buscados por
/// nombre**.
///
/// ⚠️ **A propósito NO se guarda aquí su id, y esa es la decisión que vale la
/// pena conservar.** Los demás campos de este archivo llevan el id a mano
/// porque ya existían; estos dos los crea el usuario en HighLevel ahora, y
/// pedirle que copie dos identificadores de 20 caracteres es **exactamente** el
/// error del 6-sep-2026 — el id de Nora Bonilla quedó mal por dos caracteres
/// (una `I` por una `l`) y una consolidadora entera se cayó del sistema sin que
/// nada avisara. El sistema los busca él mismo con la API, que es la respuesta
/// autorizada, y así tampoco hace falta un despliegue nuevo cuando se creen.
const NOMBRES_DE_CAMPO = {
  codigo: ["codigo de miembro", "código de miembro"],
  enlace: ["enlace de talleres", "enlace de los talleres"],
} as const;

/// Sin tildes, sin mayúsculas y sin espacios de sobra: así «Código de Miembro»
/// y «codigo de miembro» son lo mismo. Es la misma tolerancia que el buscador
/// de personas (`normalizarBusqueda`).
function plano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/// Pregunta a HighLevel los ids de los dos campos del taller.
///
/// Devuelve lo que encuentre: si el usuario solo creó uno, se escribe ese. Un
/// campo que no existe no es un error — es que todavía no lo han creado.
async function camposDelTaller(
  cred: Credenciales,
): Promise<{ codigo: string | null; enlace: string | null }> {
  const respuesta = await fetch(
    `${BASE}/locations/${cred.locationId}/customFields`,
    {
      headers: {
        Authorization: `Bearer ${cred.token}`,
        Version: VERSION,
        Accept: "application/json",
      },
    },
  );
  if (!respuesta.ok) {
    throw new Error(
      `HighLevel GET /locations/${cred.locationId}/customFields → ${respuesta.status}`,
    );
  }

  const cuerpo = (await respuesta.json()) as {
    customFields?: { id?: unknown; name?: unknown; fieldKey?: unknown }[];
  };

  const buscar = (nombres: readonly string[]) => {
    for (const campo of cuerpo.customFields ?? []) {
      if (typeof campo.id !== "string") continue;
      const nombre = typeof campo.name === "string" ? plano(campo.name) : "";
      // `fieldKey` llega como «contact.codigo_de_miembro»: se compara también
      // con los guiones bajos convertidos en espacios, porque es lo que ve el
      // usuario cuando nombra el campo.
      const clave =
        typeof campo.fieldKey === "string"
          ? plano(campo.fieldKey.replace(/^contact\./, "").replace(/_/g, " "))
          : "";
      if (nombres.some((n) => n === nombre || n === clave)) return campo.id;
    }
    return null;
  };

  return {
    codigo: buscar(NOMBRES_DE_CAMPO.codigo),
    enlace: buscar(NOMBRES_DE_CAMPO.enlace),
  };
}

/// Escribe en el CRM el código de miembro y el enlace a «Mis talleres», y le
/// pone la etiqueta que dispara el WhatsApp.
///
/// ⚠️ **Es best-effort, como todo este archivo**: la persona ya quedó inscrita
/// en la Casa de Fe y eso no se deshace porque el CRM falle. Pero devuelve qué
/// pasó, para que la pantalla que lo pidió pueda **decirlo** en vez de dar por
/// hecho que el mensaje salió — es la lección del 3-sep-2026 con los correos
/// que nunca se enviaron y nadie supo.
export async function exportarAccesoAlTaller(
  learnerId: string,
  datos: { codigo: string; enlace: string },
): Promise<{ ok: boolean; motivo?: string }> {
  const cred = await credenciales();
  if (!cred) {
    return {
      ok: false,
      motivo:
        "HighLevel no está configurado en el Worker (falta HIGHLEVEL_API_TOKEN o HIGHLEVEL_LOCATION_ID).",
    };
  }

  try {
    const aprendiz = await enlaceExistente(learnerId);
    if (!aprendiz) return { ok: false, motivo: "No se encontró la ficha." };

    const contactId =
      aprendiz.person.highLevelContacts[0]?.contactId ??
      (await exportarContactoNuevo(learnerId));
    if (!contactId) {
      return { ok: false, motivo: "No se pudo crear el contacto en HighLevel." };
    }

    const campos = await camposDelTaller(cred);
    const aEscribir = [
      ...(campos.codigo ? [{ id: campos.codigo, valor: datos.codigo }] : []),
      ...(campos.enlace ? [{ id: campos.enlace, valor: datos.enlace }] : []),
    ];

    if (aEscribir.length > 0) {
      await pedir(
        `/contacts/${contactId}`,
        "PUT",
        {
          customFields: aEscribir.map((campo) => ({
            id: campo.id,
            field_value: campo.valor,
            value: campo.valor,
          })),
        },
        cred.token,
      );
    }

    // ⚠️ **La etiqueta va DESPUÉS de los campos, siempre.** Es lo que dispara
    // el mensaje: si fuera primero, el WhatsApp saldría con los campos todavía
    // vacíos y la persona recibiría un mensaje sin su código ni su enlace.
    await pedir(
      `/contacts/${contactId}/tags`,
      "POST",
      { tags: [ETIQUETA_TALLER] },
      cred.token,
    );

    // Faltan los campos: la etiqueta ya está puesta y el workflow va a
    // disparar, así que hay que decir que el mensaje va a salir incompleto.
    if (aEscribir.length < 2) {
      const faltan = [
        campos.codigo ? null : "«Código de miembro»",
        campos.enlace ? null : "«Enlace de talleres»",
      ]
        .filter(Boolean)
        .join(" y ");
      return {
        ok: false,
        motivo: `en HighLevel todavía no existe el campo ${faltan}, así que el WhatsApp va a salir sin ese dato.`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("No se pudo exportar el acceso al taller a HighLevel", error);
    return {
      ok: false,
      motivo: "HighLevel rechazó la escritura. Revisa el registro del Worker.",
    };
  }
}
