import { NextResponse } from "next/server";
import type { Prisma } from "@iglesia/prisma-client";
import { auditar } from "@/lib/audit";
import { colaDeTelefono } from "@/lib/dominio";
import { variableDeEntorno } from "@/lib/entorno";
import { normalizarPayloadHighLevel } from "@/lib/highlevel";
import { getPrisma } from "@/lib/prisma";
import { buscarDuplicados, crearRegistroEnTransaccion } from "@/lib/registro";

export const runtime = "nodejs";

const MAXIMO_CUERPO = 128 * 1024;

function secretoValido(recibido: string | null, esperado: string) {
  if (!recibido || recibido.length !== esperado.length) return false;
  let diferencia = 0;
  for (let indice = 0; indice < esperado.length; indice += 1) {
    diferencia |= recibido.charCodeAt(indice) ^ esperado.charCodeAt(indice);
  }
  return diferencia === 0;
}

function datosAusentes(persona: {
  lastName: string | null;
  gender: string | null;
  birthDate: Date | null;
  callPhone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  address: string | null;
  prayerRequest: string | null;
  callSchedules: string[];
  callScheduleNote: string | null;
}, datos: ReturnType<typeof normalizarPayloadHighLevel>["datos"]) {
  return {
    ...(persona.lastName ? {} : { lastName: datos.lastName }),
    ...(persona.gender ? {} : { gender: datos.gender }),
    ...(persona.birthDate || !datos.birthDate
      ? {}
      : { birthDate: new Date(datos.birthDate) }),
    ...(persona.callPhone ? {} : { callPhone: datos.callPhone }),
    ...(persona.whatsappPhone
      ? {}
      : { whatsappPhone: datos.whatsappPhone }),
    ...(persona.email ? {} : { email: datos.email }),
    ...(persona.address ? {} : { address: datos.address }),
    ...(persona.prayerRequest
      ? {}
      : { prayerRequest: datos.prayerRequest }),
    ...(persona.callSchedules.length
      ? {}
      : { callSchedules: datos.callSchedules }),
    ...(persona.callScheduleNote
      ? {}
      : { callScheduleNote: datos.callScheduleNote }),
  };
}

export async function POST(request: Request) {
  const secreto = await variableDeEntorno("HIGHLEVEL_WEBHOOK_SECRET");
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: "Integración no configurada." },
      { status: 503 },
    );
  }

  if (!secretoValido(request.headers.get("x-iglesia-webhook-secret"), secreto)) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  const longitud = Number(request.headers.get("content-length") ?? 0);
  if (longitud > MAXIMO_CUERPO) {
    return NextResponse.json(
      { ok: false, error: "El cuerpo excede el límite permitido." },
      { status: 413 },
    );
  }

  let entrada: unknown;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > MAXIMO_CUERPO) throw new Error("cuerpo grande");
    entrada = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo JSON no es válido." },
      { status: 400 },
    );
  }

  let normalizado: ReturnType<typeof normalizarPayloadHighLevel>;
  try {
    normalizado = normalizarPayloadHighLevel(entrada);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Datos inválidos.";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 422 });
  }

  const { contexto, datos } = normalizado;
  const formIdEsperado = await variableDeEntorno("HIGHLEVEL_REGISTRO_FORM_ID");
  if (formIdEsperado && contexto.formId !== formIdEsperado) {
    return NextResponse.json(
      { ok: false, error: "El envío no pertenece al formulario configurado." },
      { status: 422 },
    );
  }

  const prisma = await getPrisma();
  const claveDuplicado =
    colaDeTelefono(datos.callPhone) ??
    datos.email ??
    `${contexto.locationId}:${contexto.contactId}`;
  const tieneIdentificadorParaConciliar = Boolean(
    colaDeTelefono(datos.callPhone) ?? datos.email,
  );

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Serializa altas con la misma identidad normalizada. Esto cierra la
      // carrera entre dos reintentos simultáneos antes de buscar duplicados.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`highlevel:${claveDuplicado}`}))
      `;

      const enlace = await tx.highLevelContact.findUnique({
        where: {
          locationId_contactId: {
            locationId: contexto.locationId,
            contactId: contexto.contactId,
          },
        },
        select: {
          id: true,
          personId: true,
          person: {
            select: {
              learnerProfile: { select: { id: true } },
              lastName: true,
              gender: true,
              birthDate: true,
              callPhone: true,
              whatsappPhone: true,
              email: true,
              address: true,
              prayerRequest: true,
              callSchedules: true,
              callScheduleNote: true,
            },
          },
        },
      });

      if (enlace) {
        await tx.person.update({
          where: { id: enlace.personId },
          data: datosAusentes(enlace.person, datos),
        });
        await tx.highLevelContact.update({
          where: { id: enlace.id },
          data: {
            formId: contexto.formId,
            lastSubmissionId: contexto.submissionId,
            lastReceivedAt: new Date(),
          },
        });
        await auditar(tx, {
          actorId: null,
          action: "highlevel.registro_repetido",
          entityType: "person",
          entityId: enlace.personId,
          metadata: {
            highLevelContactId: contexto.contactId,
            highLevelSubmissionId: contexto.submissionId,
          },
        });
        return {
          estado: "ya_importado" as const,
          personId: enlace.personId,
          learnerId: enlace.person.learnerProfile?.id ?? null,
        };
      }

      const duplicados = await buscarDuplicados(tx, datos);
      if (
        duplicados.length > 1 ||
        (duplicados.length === 1 && !tieneIdentificadorParaConciliar)
      ) {
        await auditar(tx, {
          actorId: null,
          action: "duplicado.detectado",
          entityType: "person",
          metadata: {
            origen: "highlevel",
            highLevelContactId: contexto.contactId,
            coincidencias: duplicados.map((duplicado) => duplicado.id),
          },
        });
        return {
          estado: "requiere_revision" as const,
          coincidencias: duplicados.length,
        };
      }

      if (duplicados.length === 1) {
        const existente = await tx.person.findUniqueOrThrow({
          where: { id: duplicados[0].id },
          select: {
            id: true,
            learnerProfile: { select: { id: true } },
            lastName: true,
            gender: true,
            birthDate: true,
            callPhone: true,
            whatsappPhone: true,
            email: true,
            address: true,
            prayerRequest: true,
            callSchedules: true,
            callScheduleNote: true,
          },
        });
        if (!existente.learnerProfile) {
          await auditar(tx, {
            actorId: null,
            action: "duplicado.detectado",
            entityType: "person",
            entityId: existente.id,
            metadata: {
              origen: "highlevel",
              highLevelContactId: contexto.contactId,
              motivo: "La persona existe sin expediente de aprendiz",
            },
          });
          return {
            estado: "requiere_revision" as const,
            coincidencias: 1,
          };
        }
        await tx.person.update({
          where: { id: existente.id },
          data: datosAusentes(existente, datos),
        });
        await tx.highLevelContact.create({
          data: {
            locationId: contexto.locationId,
            contactId: contexto.contactId,
            personId: existente.id,
            formId: contexto.formId,
            lastSubmissionId: contexto.submissionId,
          },
        });
        await auditar(tx, {
          actorId: null,
          action: "highlevel.contacto_vinculado",
          entityType: "person",
          entityId: existente.id,
          metadata: {
            highLevelContactId: contexto.contactId,
            highLevelSubmissionId: contexto.submissionId,
            criterio: duplicados[0].motivo,
          },
        });
        return {
          estado: "vinculado" as const,
          personId: existente.id,
          learnerId: existente.learnerProfile.id,
        };
      }

      const metadata: Prisma.InputJsonObject = {
        origen: "highlevel",
        highLevelLocationId: contexto.locationId,
        highLevelContactId: contexto.contactId,
        highLevelFormId: contexto.formId,
        highLevelSubmissionId: contexto.submissionId,
      };
      // El propietario del contacto en HighLevel es su consolidador. Se busca
      // por el id de HighLevel del usuario, o por su correo si el CRM lo manda.
      // Si el contacto no trae dueño, se deja el reparto automático de siempre.
      const duenoConocido = Boolean(contexto.ownerId || contexto.ownerEmail);
      const consolidador = duenoConocido
        ? await tx.appUser.findFirst({
            where: {
              active: true,
              OR: [
                ...(contexto.ownerId
                  ? [{ highlevelUserId: contexto.ownerId }]
                  : []),
                ...(contexto.ownerEmail
                  ? [{ email: contexto.ownerEmail.toLowerCase() }]
                  : []),
              ],
            },
            select: { id: true },
          })
        : null;

      const creado = await crearRegistroEnTransaccion(tx, datos, {
        actorId: null,
        metadata: {
          ...metadata,
          ...(duenoConocido
            ? { highLevelOwnerId: contexto.ownerId, ownerAsignado: Boolean(consolidador) }
            : {}),
        },
        ...(duenoConocido
          ? { consolidadorForzado: consolidador ? { id: consolidador.id } : null }
          : {}),
      });
      await tx.highLevelContact.create({
        data: {
          locationId: contexto.locationId,
          contactId: contexto.contactId,
          personId: creado.personId,
          formId: contexto.formId,
          lastSubmissionId: contexto.submissionId,
        },
      });
      await auditar(tx, {
        actorId: null,
        action: "highlevel.registro_importado",
        entityType: "person",
        entityId: creado.personId,
        metadata,
      });
      return { estado: "creado" as const, ...creado };
    });

    if (resultado.estado === "requiere_revision") {
      return NextResponse.json(
        {
          ok: false,
          status: resultado.estado,
          coincidencias: resultado.coincidencias,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, status: resultado.estado, ...resultado });
  } catch (error) {
    const codigo =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    if (codigo === "P2002") {
      const enlace = await prisma.highLevelContact.findUnique({
        where: {
          locationId_contactId: {
            locationId: contexto.locationId,
            contactId: contexto.contactId,
          },
        },
        select: { id: true },
      });
      if (enlace) {
        return NextResponse.json(
          { ok: true, status: "ya_importado" },
          { status: 200 },
        );
      }
    }
    console.error("No se pudo importar el registro de HighLevel", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar el registro." },
      { status: 500 },
    );
  }
}
