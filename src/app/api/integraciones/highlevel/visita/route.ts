import { NextResponse } from "next/server";
import { auditar } from "@/lib/audit";
import { colaDeTelefono } from "@/lib/dominio";
import { variableDeEntorno } from "@/lib/entorno";
import { normalizarSeguimientoHighLevel } from "@/lib/highlevel";
import { getPrisma } from "@/lib/prisma";
import { programarVisitaDesdeCrm } from "@/lib/registro";
import { secretoValido } from "@/lib/webhook";

export const runtime = "nodejs";

const MAXIMO_CUERPO = 64 * 1024;

/// Webhook de seguimiento de la línea. HighLevel lo dispara cuando se llena
/// «Registro Visita», «Primera Llamada» o «Asignar a Línea» sobre un contacto
/// que ya existe. Reconoce a la persona por el enlace con el contacto (o por
/// su celular/correo si todavía no estaba enlazada) y aplica en Operación 72
/// lo que la línea registró: la visita confirmada pasa a VISITA PENDIENTE; una
/// llamada sola mueve a CONTACTADA o SEGUIMIENTO según si contestó.
export async function POST(request: Request) {
  const secreto = await variableDeEntorno("HIGHLEVEL_WEBHOOK_SECRET");
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: "Integración no configurada." },
      { status: 503 },
    );
  }
  if (!secretoValido(request.headers.get("x-iglesia-webhook-secret"), secreto)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
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

  let normalizado: ReturnType<typeof normalizarSeguimientoHighLevel>;
  try {
    normalizado = normalizarSeguimientoHighLevel(entrada);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Datos inválidos.";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 422 });
  }
  const { contexto, visita } = normalizado;

  const prisma = await getPrisma();
  const locationId =
    contexto.locationId ?? (await variableDeEntorno("HIGHLEVEL_LOCATION_ID")) ?? null;

  // Primero por el enlace con el contacto del CRM; si no está enlazada
  // (personas cargadas antes de la integración), por celular o correo.
  const enlace =
    contexto.contactId && locationId
      ? await prisma.highLevelContact.findUnique({
          where: {
            locationId_contactId: { locationId, contactId: contexto.contactId },
          },
          select: {
            person: { select: { id: true, learnerProfile: { select: { id: true } } } },
          },
        })
      : null;

  let persona = enlace?.person ?? null;
  if (!persona) {
    const cola = colaDeTelefono(contexto.phone);
    const candidatas = await prisma.person.findMany({
      where: {
        OR: [
          ...(cola ? [{ callPhone: { endsWith: cola } }, { whatsappPhone: { endsWith: cola } }] : []),
          ...(contexto.email ? [{ email: contexto.email }] : []),
        ],
      },
      select: { id: true, learnerProfile: { select: { id: true } } },
      take: 2,
    });
    // Con dos candidatas no se adivina: mejor no mover a la persona equivocada.
    persona = candidatas.length === 1 ? candidatas[0] : null;
  }

  if (!persona?.learnerProfile) {
    return NextResponse.json(
      {
        ok: false,
        estado: "sin_persona",
        error:
          "No se encontró en el sistema a la persona de este contacto. Debe registrarse primero con «Registro Nuevo».",
      },
      { status: 404 },
    );
  }

  const aplicado = await prisma.$transaction(
    (tx) => programarVisitaDesdeCrm(tx, persona.learnerProfile!.id, visita),
    { timeout: 30_000, maxWait: 15_000 },
  );

  await auditar(prisma, {
    actorId: null,
    action: "highlevel.seguimiento_recibido",
    entityType: "person",
    entityId: persona.id,
    metadata: {
      highLevelContactId: contexto.contactId,
      form: contexto.formName,
      confirmacion: visita.confirmacion,
      estadoLinea: visita.estadoLinea,
      aplicado,
    },
  });

  return NextResponse.json({
    ok: true,
    estado:
      aplicado === "visita"
        ? "visita_agendada"
        : aplicado === "llamada"
          ? "llamada_registrada"
          : "sin_cambios",
    personId: persona.id,
    learnerId: persona.learnerProfile.id,
  });
}
