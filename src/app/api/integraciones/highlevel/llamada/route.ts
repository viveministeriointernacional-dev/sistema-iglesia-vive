import { NextResponse } from "next/server";
import type { Prisma } from "@iglesia/prisma-client";
import { variableDeEntorno } from "@/lib/entorno";
import { normalizarLlamadaHighLevel } from "@/lib/llamada-highlevel";
import { getPrisma } from "@/lib/prisma";
import { secretoValido } from "@/lib/webhook";

export const runtime = "nodejs";

const MAXIMO_CUERPO = 128 * 1024;

/// Comparación en tiempo constante para no filtrar la longitud ni el contenido
/// del secreto por el tiempo de respuesta.
/// Recibe cada evento de llamada de HighLevel y lo guarda en `call_log` para el
/// tablero de administración. Se protege con el mismo secreto de webhook que el
/// registro de personas (`x-iglesia-webhook-secret`).
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

  let llamada: ReturnType<typeof normalizarLlamadaHighLevel>;
  try {
    llamada = normalizarLlamadaHighLevel(entrada);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Datos inválidos.";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 422 });
  }

  const prisma = await getPrisma();

  // Se resuelve quién hizo la llamada. El trigger de HighLevel casi nunca manda
  // el id del usuario, pero sí su correo o su nombre: se cruza por cualquiera de
  // los tres. Si no se puede, la llamada igual se guarda (queda sin asignar).
  const criterios: Prisma.AppUserWhereInput[] = [
    ...(llamada.highlevelUserId
      ? [{ highlevelUserId: llamada.highlevelUserId }]
      : []),
    ...(llamada.callerEmail
      ? [{ email: llamada.callerEmail.toLowerCase() }]
      : []),
    ...(llamada.callerName ? [{ fullName: llamada.callerName }] : []),
  ];
  const usuario = criterios.length
    ? await prisma.appUser.findFirst({
        where: { OR: criterios },
        select: { id: true },
      })
    : null;

  const datos = {
    locationId: llamada.locationId,
    highlevelUserId: llamada.highlevelUserId,
    appUserId: usuario?.id ?? null,
    callerName: llamada.callerName,
    contactId: llamada.contactId,
    contactName: llamada.contactName,
    direction: llamada.direction,
    status: llamada.status,
    answered: llamada.answered,
    durationSeconds: llamada.durationSeconds,
    fromNumber: llamada.fromNumber,
    toNumber: llamada.toNumber,
    recordingUrl: llamada.recordingUrl,
    startedAt: llamada.startedAt,
    // Se guarda el envío tal cual llega del CRM. Sirve de auditoría y, sobre
    // todo, para diagnosticar el mapeo del workflow (ver qué campos manda de
    // verdad HighLevel en cada llamada).
    metadata: (entrada ?? null) as Prisma.InputJsonValue,
  };

  try {
    await prisma.callLog.upsert({
      where: {
        provider_externalId: {
          provider: "highlevel",
          externalId: llamada.externalId,
        },
      },
      create: { provider: "highlevel", externalId: llamada.externalId, ...datos },
      // Un reintento del webhook puede traer el estado final (duración, estado):
      // se actualiza lo que pueda haber cambiado.
      update: datos,
    });
  } catch (error) {
    console.error("No se pudo guardar la llamada de HighLevel", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la llamada." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "registrada",
    personalAsignado: Boolean(usuario),
  });
}
