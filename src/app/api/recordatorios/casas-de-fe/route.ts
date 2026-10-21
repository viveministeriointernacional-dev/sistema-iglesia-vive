import { NextResponse } from "next/server";
import { hoyEnColombia } from "@/lib/dominio";
import { variableDeEntorno } from "@/lib/entorno";
import { getPrisma } from "@/lib/prisma";
import { mandarRecordatorios } from "@/lib/recordatorio-casas-de-fe";
import { tipoValido } from "@/lib/recordatorio-casas-de-fe-catalogo";
import { secretoValido } from "@/lib/webhook";

export const runtime = "nodejs";

/// **El disparador del recordatorio de Casas de Fe.**
///
/// Lo llama un workflow de HighLevel con horario, dos veces al día, con el
/// mismo secreto que los otros tres webhooks (`x-iglesia-webhook-secret`).
///
/// ⚠️ **No es un Cron Trigger de Cloudflare, y no por gusto:** el worker que
/// genera OpenNext **solo exporta `fetch`**, no `scheduled`, así que un cron no
/// tendría nada que lo atendiera y parchear el worker generado es frágil porque
/// se regenera en cada build. Un workflow de HighLevel, además, deja el camino
/// entero en el mismo sitio donde ya vive el envío de WhatsApp, y el usuario lo
/// puede pausar y ver sin tocar código.
///
/// Dos llamadas al día:
/// - `{"tipo":"DIA"}` temprano → las casas que se reúnen **hoy** desde las 9:00.
/// - `{"tipo":"NOCHE_ANTES"}` por la tarde → las de **mañana** antes de las 9:00.
///
/// `tipo` también se acepta por query (`?tipo=DIA`), que es lo más cómodo de
/// configurar en el CRM. Sin `tipo` se asume `DIA`.
///
/// Es **idempotente**: `faith_house_reminder` tiene un índice único por
/// (usuario, día, tipo), así que un reintento del workflow no manda nada dos
/// veces. Por eso se puede reintentar sin miedo.
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

  // El tipo puede venir en el cuerpo o en la query. Un cuerpo que no es JSON no
  // es un error: el workflow puede llamar sin cuerpo y con `?tipo=`.
  let delCuerpo: string | undefined;
  try {
    const cuerpo = await request.text();
    if (cuerpo.trim()) {
      const datos = JSON.parse(cuerpo) as { tipo?: unknown; dia?: unknown };
      if (typeof datos.tipo === "string") delCuerpo = datos.tipo;
    }
  } catch {
    // Sin cuerpo utilizable: se sigue con la query.
  }

  const url = new URL(request.url);
  const tipo = tipoValido(delCuerpo ?? url.searchParams.get("tipo") ?? "DIA");
  if (!tipo) {
    return NextResponse.json(
      { ok: false, error: "El tipo debe ser DIA o NOCHE_ANTES." },
      { status: 400 },
    );
  }

  // El día de las REUNIONES, no el de hoy: el envío de la noche anterior
  // resume las de mañana. Se calcula en hora de Colombia (§12.1), porque el
  // worker corre en UTC y a partir de las 7 p. m. «hoy» allá ya es mañana.
  const hoy = hoyEnColombia();
  const dia = tipo === "DIA" ? hoy : sumarUnDia(hoy);

  try {
    const prisma = await getPrisma();
    const resumen = await mandarRecordatorios(prisma, { dia, tipo });
    return NextResponse.json({ ok: true, ...resumen });
  } catch (error) {
    console.error("Falló el envío de recordatorios de Casa de Fe", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo completar el envío." },
      { status: 500 },
    );
  }
}

/// El día siguiente de una fecha civil «AAAA-MM-DD». Al mediodía UTC para que
/// ningún horario de verano la corra de día (§12.1: las fechas civiles son
/// texto, nunca instantes).
function sumarUnDia(dia: string): string {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString().slice(0, 10);
}
