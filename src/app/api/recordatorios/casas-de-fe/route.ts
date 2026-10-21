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
/// Lo llama **un worker aparte de Cloudflare** (`recordatorio-casas-de-fe`) que
/// no hace más que esto: tiene dos Cron Triggers y en cada uno pide esta ruta
/// con el secreto en la cabecera `x-iglesia-webhook-secret`.
///
/// ⚠️ **Por qué un worker aparte y no el `scheduled` de este mismo:** el worker
/// que genera OpenNext **solo exporta `fetch`**, no `scheduled`, así que un Cron
/// Trigger sobre `sistema-iglesia-vive` se podría configurar y no tendría nada
/// que lo atendiera. Parchear el worker generado es frágil porque se rehace en
/// cada build. Un worker de 20 líneas al lado no tiene ese problema y se ve en
/// el mismo panel.
///
/// ⚠️ **Y por qué no un workflow de HighLevel, que era el plan del 21-oct:**
/// esta cuenta de HighLevel **no tiene ningún activador por horario**. Se buscó
/// `program`, `recurr`, `fech` y `hora` en la lista de activadores y lo único
/// parecido —«Recordatorio de fecha personalizada»— cuelga de una fecha del
/// contacto, no de un reloj. No sirve para «todos los días a las 6».
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
  // **Dos secretos valen aquí, y es a propósito.**
  //
  // Esta ruta no la llama HighLevel: la llama el worker del reloj, que es otra
  // pieza y merece su propia credencial. Si alguna vez hay que rotar una, la
  // otra sigue en pie y no se cae nada.
  //
  // ⚠️ Y hay una razón práctica que pesa más que la teoría: **Cloudflare no
  // deja volver a leer un secreto ya guardado**, ni a su dueño. El valor de
  // `HIGHLEVEL_WEBHOOK_SECRET` solo está escrito dentro de los pasos Webhook de
  // los flujos de HighLevel, y encontrarlo ahí costó más que este cambio. Con
  // `RECORDATORIOS_SECRET` el worker del reloj se configura sin tener que
  // desenterrar nada.
  //
  // Se sigue aceptando el de HighLevel para no dejar fuera a quien ya lo tenga
  // configurado, y porque este webhook se puede probar a mano con él.
  const aceptados = (
    await Promise.all([
      variableDeEntorno("RECORDATORIOS_SECRET"),
      variableDeEntorno("HIGHLEVEL_WEBHOOK_SECRET"),
    ])
  ).filter((valor): valor is string => Boolean(valor));

  if (aceptados.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Integración no configurada." },
      { status: 503 },
    );
  }

  const recibido = request.headers.get("x-iglesia-webhook-secret");
  let autorizado = false;
  for (const esperado of aceptados) {
    // Sin `break`: cortar al primer acierto diría CUÁL de los dos secretos
    // acertó, y `secretoValido` compara en tiempo constante justamente para no
    // filtrar nada por lo que tarda en responder.
    if (secretoValido(recibido, esperado)) autorizado = true;
  }
  if (!autorizado) {
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
