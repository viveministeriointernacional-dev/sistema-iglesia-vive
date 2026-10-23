import { Prisma } from "@iglesia/prisma-client";
import { correoRecordatorioCasaDeFe } from "@/lib/correo";
import { exportarRecordatorioDeCasaDeFe } from "@/lib/highlevel-salida";
import {
  armadorDelEnvio,
  faltaUnaHora,
  type Aviso,
  type CasaDelAviso,
  cuantasCasas,
  envioQueLeToca,
  type Papel,
  variableDeWhatsApp,
  type TipoDeEnvio,
} from "@/lib/recordatorio-casas-de-fe-catalogo";
import { enlaceComoLlegar, proximasReuniones, puntoDe } from "@/lib/reunion-catalogo";
import type { ClientePrisma } from "@/lib/prisma";

/// **El recordatorio de las Casas de Fe: a quién le toca hoy y el envío.**
///
/// Lo dispara **un worker aparte de Cloudflare** (`recordatorio-casas-de-fe`)
/// con dos Cron Triggers, que en cada uno pide el webhook
/// `/api/recordatorios/casas-de-fe`. No es un cron de ESTE worker porque **el
/// que genera OpenNext solo exporta `fetch`**, no `scheduled`: un Cron Trigger
/// aquí no tendría nada que lo atendiera, y parchear el worker generado es
/// frágil porque se rehace en cada build. Y no es un workflow de HighLevel
/// —que era el plan— porque esta cuenta **no tiene ningún activador por
/// horario**.
///
/// ## Lo que hace, en orden
///
/// 1. Una sola consulta trae las casas abiertas con día y hora, y **una fila
///    por destinatario**: el líder, sus encargados y el mentor del líder.
/// 2. Se filtra en memoria por la recurrencia (`proximasReuniones`, que ya
///    existía para el calendario) y por el envío que le toca a la hora.
/// 3. Se juntan en **un aviso por persona** y se manda correo y WhatsApp.
///
/// ## La idempotencia, que es lo que de verdad protege
///
/// Antes de mandarle nada a alguien se **reclama su turno** insertando la fila
/// en `faith_house_reminder`, cuyo índice único es `(usuario, día, tipo)`. Si
/// el workflow se reintenta, se duplica o queda configurado dos veces, el
/// segundo intento choca con el índice y no manda nada.
///
/// ⚠️ **El turno se reclama ANTES de enviar, y eso es una decisión, no un
/// descuido.** Si el proceso se muere entre el `insert` y el envío, esa persona
/// **no recibe el aviso de ese día y no se reintenta**. Es el lado seguro: para
/// un recordatorio, perder uno es mejor que mandar dos — y la fila queda con
/// `emailSent: false`, así que se puede ver, que es justo lo que faltaba en los
/// dos fallos del 20-oct.

type FilaCruda = {
  grupo_id: string;
  nombre: string;
  weekday: number;
  meeting_time: string;
  every_n_weeks: number;
  inicio: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  lider_nombre: string;
  miembros: number;
  usuario_id: string;
  papel: string;
  usuario_nombre: string;
  usuario_correo: string | null;
  contact_id: string | null;
};

/// Una fila por (casa, destinatario). El `UNION ALL` de los tres orígenes es lo
/// que convierte «quién tiene que enterarse» en algo que se puede juntar
/// después sin más viajes a la base.
async function filasDelDia(prisma: ClientePrisma): Promise<FilaCruda[]> {
  return prisma.$queryRaw<FilaCruda[]>`
    WITH abiertas AS (
      SELECT g."id" AS grupo_id, g."name" AS nombre, g."weekday", g."meeting_time",
             g."every_n_weeks", g."start_date"::text AS inicio,
             g."address", g."latitude", g."longitude",
             g."leader_id",
             l."full_name" AS lider_nombre,
             (SELECT count(*)::int FROM "faith_house_group_member" m
               WHERE m."group_id" = g."id") AS miembros
      FROM "faith_house_group" g
      JOIN "app_user" l ON l."id" = g."leader_id"
      WHERE g."closed_at" IS NULL
        AND g."weekday" IS NOT NULL
        AND g."meeting_time" IS NOT NULL
    ), destinatarios AS (
      SELECT a.*, a."leader_id" AS usuario_id, 'LIDER'::text AS papel FROM abiertas a
      UNION ALL
      SELECT a.*, cl."user_id", 'ENCARGADO'::text FROM abiertas a
        JOIN "faith_house_co_leader" cl ON cl."group_id" = a.grupo_id
      UNION ALL
      SELECT a.*, mr."mentor_id", 'MENTOR'::text FROM abiertas a
        JOIN "app_user" l ON l."id" = a."leader_id"
        JOIN "person" pl ON pl."id" = l."person_id"
        JOIN "learner_profile" lpl ON lpl."person_id" = pl."id"
        JOIN "mentor_relationship" mr ON mr."learner_id" = lpl."id" AND mr."ended_at" IS NULL
    )
    SELECT d.grupo_id, d.nombre, d."weekday", d."meeting_time", d."every_n_weeks",
           d.inicio, d."address", d."latitude", d."longitude",
           d.lider_nombre, d.miembros,
           d.usuario_id, d.papel,
           u."full_name" AS usuario_nombre, u."email" AS usuario_correo,
           hc."contact_id"
    FROM destinatarios d
    JOIN "app_user" u ON u."id" = d.usuario_id
    LEFT JOIN "person" pu ON pu."id" = u."person_id"
    LEFT JOIN LATERAL (
      SELECT c."contact_id" FROM "highlevel_contact" c
      WHERE c."person_id" = pu."id"
      ORDER BY c."created_at" ASC
      LIMIT 1
    ) hc ON true
    WHERE u."active" = true
  `;
}

function casaDeLaFila(fila: FilaCruda): CasaDelAviso {
  const punto = puntoDe(fila.latitude, fila.longitude);
  return {
    id: fila.grupo_id,
    nombre: fila.nombre,
    hora: fila.meeting_time,
    miembros: fila.miembros,
    direccion: fila.address,
    comoLlegar: enlaceComoLlegar({ address: fila.address, punto }),
    lider: fila.lider_nombre,
  };
}

export type ResumenDelEnvio = {
  dia: string;
  tipo: TipoDeEnvio;
  /// Cuántas casas se reúnen ese día y entran en este envío.
  casas: number;
  /// A cuánta gente le tocaba.
  destinatarios: number;
  /// Cuántos se saltaron porque ya se les había mandado.
  yaEstaban: number;
  correosEnviados: number;
  whatsappsEncolados: number;
  /// Lo que no se pudo mandar, con el motivo. Nunca se traga en silencio.
  fallos: { nombre: string; motivo: string }[];
};

/// **Manda el recordatorio de un día.** `dia` es la fecha civil de las
/// REUNIONES, «AAAA-MM-DD» — no la de hoy: el envío de la noche anterior pasa
/// el día de mañana.
export async function mandarRecordatorios(
  prisma: ClientePrisma,
  opciones: {
    dia: string;
    tipo: TipoDeEnvio;
    /// La hora de Colombia ahora mismo, «HH:mm». **Solo la usa
    /// `UNA_HORA_ANTES`**, que es el único envío que depende del reloj y no del
    /// horario de la casa. Sin ella, ese tipo no manda nada en vez de mandar a
    /// destiempo.
    ahora?: string;
  },
): Promise<ResumenDelEnvio> {
  const { dia, tipo, ahora } = opciones;
  const filas = await filasDelDia(prisma);

  const delDia = filas.filter((fila) => {
    // El aviso de una hora antes no pregunta «¿qué envío le toca a esta hora?»
    // —eso reparte el día entre los dos resúmenes— sino «¿falta una hora?».
    if (tipo === "UNA_HORA_ANTES") {
      if (!ahora || !faltaUnaHora(fila.meeting_time, ahora)) return false;
    } else if (envioQueLeToca(fila.meeting_time) !== tipo) {
      return false;
    }
    // La recurrencia se cuenta desde el inicio del grupo, no desde hoy: una
    // casa cada 15 días se reúne un miércoles sí y otro no, y cuál de los dos
    // depende de cuándo arrancó. `proximasReuniones` ya lo resolvía para el
    // calendario, así que no se reimplementa aquí.
    const primera = proximasReuniones(
      { weekday: fila.weekday, everyNWeeks: fila.every_n_weeks, inicio: fila.inicio },
      dia,
      1,
    )[0];
    return primera === dia;
  });

  const avisos = armadorDelEnvio(tipo)(
    delDia.map((fila) => ({
      usuarioId: fila.usuario_id,
      nombre: fila.usuario_nombre,
      correo: fila.usuario_correo,
      contactoCrm: fila.contact_id,
      papel: fila.papel as Papel,
      casa: casaDeLaFila(fila),
    })),
  );

  const resumen: ResumenDelEnvio = {
    dia,
    tipo,
    casas: new Set(delDia.map((fila) => fila.grupo_id)).size,
    destinatarios: avisos.length,
    yaEstaban: 0,
    correosEnviados: 0,
    whatsappsEncolados: 0,
    fallos: [],
  };

  for (const aviso of avisos) {
    const turno = await reclamarTurno(prisma, aviso, dia, tipo);
    if (!turno) {
      resumen.yaEstaban += 1;
      continue;
    }

    const problemas: string[] = [];
    let correoEnviado = false;
    let whatsappEncolado = false;

    if (aviso.correo) {
      // ⚠️ **Sin `registro`, y es una decisión medida.** Guardar la copia del
      // correo metería ~10 renglones «CORREO» al día en «Actividad del día»
      // —hoy miércoles son 10 destinatarios para 8 casas— y enterraría los
      // movimientos de personas, que es de lo que esa pantalla habla. Y sería
      // redundante: `faith_house_reminder` ya guarda a quién, cuántas casas,
      // si salió y por qué no, que es más de lo que da la copia. Si alguna vez
      // hace falta previsualizar el HTML, se añade este argumento y vuelve.
      const salida = await correoRecordatorioCasaDeFe({
        to: aviso.correo,
        aviso,
        tipo,
      });
      if (salida.enviado) correoEnviado = true;
      else problemas.push(`correo: ${salida.motivo}`);
    } else {
      problemas.push("no tiene correo");
    }

    if (aviso.contactoCrm) {
      const salida = await exportarRecordatorioDeCasaDeFe(
        aviso.contactoCrm,
        variableDeWhatsApp(aviso, tipo),
      );
      if (salida.ok) whatsappEncolado = true;
      else problemas.push(`WhatsApp: ${salida.motivo}`);
    } else {
      problemas.push("no tiene contacto en HighLevel");
    }

    if (correoEnviado) resumen.correosEnviados += 1;
    if (whatsappEncolado) resumen.whatsappsEncolados += 1;
    if (problemas.length > 0) {
      resumen.fallos.push({ nombre: aviso.nombre, motivo: problemas.join(" · ") });
    }

    await prisma.faithHouseReminder
      .update({
        where: { id: turno },
        data: {
          emailSent: correoEnviado,
          whatsappQueued: whatsappEncolado,
          failure: problemas.length > 0 ? problemas.join(" · ") : null,
        },
      })
      .catch((error) => {
        // El aviso ya salió; que no se pueda anotar el resultado no se deshace.
        console.error("No se pudo anotar el resultado del recordatorio", error);
      });
  }

  return resumen;
}

/// Reclama el turno de una persona para ese día y ese envío. Devuelve el id de
/// la fila, o `null` si ya estaba —que es la señal de «a esta ya se le mandó».
///
/// El choque del índice único llega como `P2002`; cualquier otro error sube,
/// porque tragárselo mandaría el aviso sin registro y abriría la puerta al
/// duplicado que esta tabla existe para evitar.
async function reclamarTurno(
  prisma: ClientePrisma,
  aviso: Aviso,
  dia: string,
  tipo: TipoDeEnvio,
): Promise<string | null> {
  try {
    const fila = await prisma.faithHouseReminder.create({
      data: {
        userId: aviso.usuarioId,
        scopeDate: dia,
        kind: tipo,
        // `""` en los dos envíos diarios (uno por persona y día) y el id de la
        // casa en el de una hora antes (uno por casa). El índice único de la
        // tabla es (usuario · día · tipo · casa), así que la misma escritura
        // sirve para las dos idempotencias.
        groupId: aviso.grupoId,
        groups: cuantasCasas(aviso),
        ownGroups: aviso.propias.length,
      },
      select: { id: true },
    });
    return fila.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}
