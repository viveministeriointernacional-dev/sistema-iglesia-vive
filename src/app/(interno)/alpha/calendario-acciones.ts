"use server";

import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import { generarTokenDeCalendario } from "@/lib/calendario";
import { getPrisma } from "@/lib/prisma";

export type ResultadoToken =
  | { ok: true; token: string }
  | { ok: false; mensaje: string };

/// Da (o rehace) el enlace de calendario de **quien lo pide**.
///
/// ⚠️ Cada cuenta solo puede tocar el suyo: no recibe ningún id. El enlace es
/// una credencial, así que dejar que alguien pidiera el de otra persona sería
/// entregarle su calendario.
export async function crearMiEnlaceDeCalendario(): Promise<ResultadoToken> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return { ok: false, mensaje: new ErrorDePermiso().message };
  }

  const prisma = await getPrisma();
  const token = generarTokenDeCalendario();

  await prisma.appUser.update({
    where: { id: usuario.id },
    data: { calendarToken: token },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "acceso.enlace_calendario_rehecho",
    entityType: "app_user",
    entityId: usuario.id,
    // El token NO se audita: es una credencial. Lo que se registra es que se
    // rehizo y cuándo, que es lo que hace falta para investigar después.
    metadata: {},
  });

  revalidatePath("/alpha");
  return { ok: true, token };
}
