import { NextResponse } from "next/server";
import { sincronizarConsolidador } from "@/lib/consolidador";
import { variableDeEntorno } from "@/lib/entorno";
import { getPrisma } from "@/lib/prisma";
import { secretoValido } from "@/lib/webhook";

export const runtime = "nodejs";

const MAXIMO_CUERPO = 64 * 1024;

/// Los merge-tags que HighLevel no resuelve llegan literales (`{{...}}`), y un
/// campo vacío puede llegar como la palabra «null». Las dos cosas son «no hay
/// dato», no un valor.
function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (!limpio) return null;
  if (limpio.startsWith("{{") && limpio.endsWith("}}")) return null;
  if (limpio === "null" || limpio === "undefined") return null;
  return limpio;
}

function primero(objeto: Record<string, unknown>, ...claves: string[]) {
  for (const clave of claves) {
    const dato = texto(objeto[clave]);
    if (dato) return dato;
  }
  return null;
}

/// Webhook de **asignación de contacto**. HighLevel lo dispara cuando su flujo
/// asigna o cambia el usuario dueño de un contacto, y así el sistema se entera
/// de una decisión que se toma allá.
///
/// Es la mitad «CRM → sistema» de la sincronización de doble vía; la otra mitad
/// (`exportarConsolidador`) vive en `src/lib/highlevel-salida.ts`. El bucle se
/// corta en `sincronizarConsolidador`: si el valor que llega ya es el que hay,
/// no se escribe nada ni se devuelve nada.
///
/// Mapeo en el paso Webhook de HighLevel:
///   contactId = {{contact.id}} · userId = {{contact.assigned_to}}
/// (también se aceptan `assignedTo` / `ownerId` por si el flujo los manda así).
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

  let entrada: Record<string, unknown>;
  try {
    const cuerpo = await request.text();
    if (cuerpo.length > MAXIMO_CUERPO) throw new Error("cuerpo grande");
    entrada = JSON.parse(cuerpo) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo JSON no es válido." },
      { status: 400 },
    );
  }

  const contacto = (entrada.contact ?? {}) as Record<string, unknown>;
  const datos = (entrada.customData ?? {}) as Record<string, unknown>;
  const plano = { ...entrada, ...contacto, ...datos };

  const contactId = primero(plano, "contactId", "contact_id", "id");
  if (!contactId) {
    return NextResponse.json(
      { ok: false, error: "Falta el contacto." },
      { status: 422 },
    );
  }

  // Sin usuario asignado, el contacto queda sin dueño también aquí. Es un
  // valor legítimo, no un error: significa «todavía nadie».
  const highlevelUserId = primero(
    plano,
    "userId",
    "user_id",
    "assignedTo",
    "assigned_to",
    "ownerId",
    "owner_id",
  );

  const prisma = await getPrisma();
  const locationId =
    primero(plano, "locationId", "location_id") ??
    (await variableDeEntorno("HIGHLEVEL_LOCATION_ID")) ??
    null;

  const enlace =
    locationId
      ? await prisma.highLevelContact.findUnique({
          where: { locationId_contactId: { locationId, contactId } },
          select: {
            person: { select: { learnerProfile: { select: { id: true } } } },
          },
        })
      : null;

  const learnerId = enlace?.person.learnerProfile?.id ?? null;
  if (!learnerId) {
    return NextResponse.json(
      { ok: false, error: "No encontramos a esa persona." },
      { status: 404 },
    );
  }

  const consolidador = highlevelUserId
    ? await prisma.appUser.findUnique({
        where: { highlevelUserId },
        select: { id: true },
      })
    : null;

  // El contacto trae dueño pero ese usuario no está mapeado en el sistema:
  // dejarlo como está y avisar, en vez de borrarle el consolidador.
  if (highlevelUserId && !consolidador) {
    return NextResponse.json(
      {
        ok: false,
        estado: "usuario_sin_mapear",
        error:
          "Ese usuario de HighLevel no está enlazado a nadie del equipo (falta su highlevel_user_id).",
        highlevelUserId,
      },
      { status: 422 },
    );
  }

  const resultado = await sincronizarConsolidador(prisma, {
    learnerId,
    nuevoConsolidadorId: consolidador?.id ?? null,
    origen: "highlevel",
    actorId: null,
    motivo: "Asignación hecha en HighLevel",
  });

  return NextResponse.json({
    ok: true,
    estado: resultado.cambio ? "consolidador_actualizado" : "sin_cambios",
    ...(resultado.cambio
      ? { anterior: resultado.anterior, nuevo: resultado.nuevo }
      : {}),
  });
}
