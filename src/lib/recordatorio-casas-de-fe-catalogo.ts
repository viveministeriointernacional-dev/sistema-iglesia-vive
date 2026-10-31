/// **El recordatorio de las Casas de Fe: a quién le toca y qué dice.**
///
/// Aparte de `recordatorio-casas-de-fe.ts` por la regla del 6-sep: ese módulo
/// consulta la base y manda correos, así que lo que sea puro vive aquí y se
/// puede probar sin levantar nada (§12.4).
///
/// ## Las tres decisiones que lo sostienen, y están medidas
///
/// **1. Un mensaje por PERSONA y DÍA, no por casa.** Medido el 20-oct sobre las
/// 46 casas abiertas: son **45 reuniones a la semana repartidas entre 16
/// líderes**, y el que más lleva tiene **7 casas**. Uno por casa le mandaría
/// siete avisos semanales, y al mentor con la línea más grande **19**. Un aviso
/// que sale demasiado se deja de leer (§12.6), y entonces no sirve para nada:
/// se junta todo lo del día en un solo mensaje.
///
/// **2. Si la casa se reúne antes de las 9:00 a. m., el aviso sale la noche
/// anterior.** No es un ajuste por grupo: es una sola regla. Sin ella, tres
/// casas reales recibirían el recordatorio **después** de haberse reunido —
/// lunes 06:00, lunes 07:00 y sábado 08:34.
///
/// **3. La misma persona recibe UN mensaje aunque lleve casas y acompañe otras.**
/// Un mentor puede además liderar: si se agrupara por papel recibiría dos
/// correos el mismo día. Se agrupa por persona y el texto distingue las suyas
/// de las de su línea.

import { horaLegible } from "@/lib/reunion-catalogo";
import { enUnaLinea } from "@/lib/whatsapp-variable";

/// **La hora que parte el día.** Una casa que se reúne antes de esto se avisa
/// la noche anterior, porque el resumen de la mañana le llegaría tarde.
///
/// Está en 9:00 y no en 7:00 a propósito: el envío de la mañana sale a las
/// 6:00, y un margen de tres horas deja al líder tiempo de leerlo, confirmar
/// con alguien y salir. Con el tope en 7:00, la casa de las 7:00 recibiría el
/// aviso **sesenta minutos antes** de empezar.
export const HORA_TOPE_MANANA = "09:00";

/// **Los TRES envíos.** Los dos primeros son el resumen del día; el tercero es
/// el empujón justo antes de la reunión.
///
/// - `DIA` sale a las **6:00 a. m.** con las reuniones de hoy desde las 9:00.
/// - `NOCHE_ANTES` sale a las **6:00 p. m.** con las de mañana antes de las 9:00.
/// - `UNA_HORA_ANTES` sale **una hora antes de cada casa**, una por casa.
///
/// ⚠️ **Los dos primeros son un resumen POR PERSONA Y DÍA; el tercero es UNO
/// POR CASA, y van a gente distinta a propósito.** Medido el 23-oct sobre las
/// 58 casas con horario: si el aviso de una hora antes fuera también al mentor
/// de la línea serían **117 avisos por semana y una persona recibiría 11 en un
/// solo día**; yendo solo a quien tiene que estar allí —líder y encargados— son
/// **59 por semana y 4 en el peor día**, y esos 4 son casas que de verdad lleva.
/// Un aviso que llega 11 veces al día se silencia, y con él se pierden los
/// otros. El mentor sigue recibiendo su resumen de las 6.
export const TIPOS_DE_ENVIO = ["DIA", "NOCHE_ANTES", "UNA_HORA_ANTES"] as const;

export type TipoDeEnvio = (typeof TIPOS_DE_ENVIO)[number];

/// Los dos que resumen un día entero. `envioQueLeToca` solo puede devolver uno
/// de estos: `UNA_HORA_ANTES` no depende de la hora de la casa sino del reloj.
export type TipoDiario = Exclude<TipoDeEnvio, "UNA_HORA_ANTES">;

export function tipoValido(valor: string | undefined | null): TipoDeEnvio | null {
  return TIPOS_DE_ENVIO.includes(valor as TipoDeEnvio) ? (valor as TipoDeEnvio) : null;
}

/// **La ventana del aviso de una hora antes**, en minutos antes de la reunión.
///
/// ⚠️ **Es ancha (15 minutos) aunque el cron corra cada 5, y eso es lo que lo
/// hace resistente.** Con una ventana de 5 minutos, un disparo que Cloudflare
/// retrase o se salte deja la casa **sin aviso ninguno**. Con 15 minutos de
/// ventana y un disparo cada 5, cada casa tiene **tres oportunidades** y el
/// índice único de `faith_house_reminder` (usuario · día · tipo · casa) hace
/// que solo la primera escriba. En la práctica el aviso sale entre **55 y 60
/// minutos antes**; si algo falla, sale hasta 15 minutos más tarde en vez de no
/// salir.
export const MINUTOS_ANTES_MAX = 60;
export const MINUTOS_ANTES_MIN = 45;

/// «HH:mm» → minutos desde medianoche. `null` si no es una hora.
export function minutosDeHHmm(hora: string): number | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!partes) return null;
  const h = Number(partes[1]);
  const m = Number(partes[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/// **¿Le falta una hora a esta casa?** Las dos horas son «HH:mm» de Colombia.
///
/// ⚠️ **No cruza la medianoche, y es una limitación consciente, no un olvido.**
/// Una casa a las 00:30 tendría su marca de «una hora antes» a las 23:30 del día
/// anterior, y aquí la resta saldría negativa: no recibiría el aviso. Hoy la
/// casa más temprana de las 58 empieza a las **06:00**, así que la marca más
/// madrugadora son las 05:00 y el caso no existe. Si algún día alguien pone una
/// casa entre medianoche y la 1:00, **no fallará: simplemente no le saldrá este
/// aviso**, y seguirá recibiendo el de la noche anterior (que cubre todo lo de
/// antes de las 9:00). Hay una prueba que lo deja escrito.
export function faltaUnaHora(horaDeLaCasa: string, ahora: string): boolean {
  const casa = minutosDeHHmm(horaDeLaCasa);
  const reloj = minutosDeHHmm(ahora);
  if (casa === null || reloj === null) return false;
  const faltan = casa - reloj;
  return faltan > MINUTOS_ANTES_MIN && faltan <= MINUTOS_ANTES_MAX;
}

/// **Cómo se nombra el momento en los tres sitios que lo escriben**: el asunto
/// del correo, el cuerpo del correo y la variable del WhatsApp.
///
/// ⚠️ Vive aquí y no repetido en cada sitio porque ya pasó una vez en este mismo
/// archivo: dos sitios armando la misma cosa es lo que se desincroniza sin que
/// nada avise (§12.6). Encaja en las tres frases: «Hoy tienes Casa de Fe», «En
/// una hora te reúnes con tu Casa de Fe», «Mañana tienes 2 Casas de Fe».
export function cuandoDelEnvio(tipo: TipoDeEnvio): string {
  if (tipo === "DIA") return "Hoy";
  if (tipo === "NOCHE_ANTES") return "Mañana";
  return "En una hora";
}

/// **Qué envío le corresponde a una hora.** La función que de verdad impide el
/// doble aviso: cada casa cae en uno de los dos y nunca en los dos, porque la
/// comparación es la misma en ambos lados.
///
/// La hora llega como texto «HH:mm» (así se guarda, §12.1), y el orden
/// alfabético de «HH:mm» es el orden del reloj: «06:00» < «09:00» < «19:30».
/// Por eso se compara con `<` directo y no hay que convertir nada.
export function envioQueLeToca(hora: string): TipoDiario {
  return hora < HORA_TOPE_MANANA ? "NOCHE_ANTES" : "DIA";
}

/// Una casa que se reúne en el día del aviso.
export type CasaDelAviso = {
  id: string;
  nombre: string;
  /// «HH:mm», hora de Colombia.
  hora: string;
  miembros: number;
  direccion: string | null;
  /// «Cómo llegar», ya resuelto: el punto del mapa si lo tiene, si no la
  /// dirección. Nulo cuando no hay ni una cosa ni la otra.
  comoLlegar: string | null;
  /// Quién la lleva. Va en el aviso del mentor, que necesita saber a quién
  /// preguntarle; en el del propio líder sobra y no se pinta.
  lider: string;
};

export type Papel = "LIDER" | "ENCARGADO" | "MENTOR";

/// Lo que se le manda a una persona en un envío.
export type Aviso = {
  usuarioId: string;
  nombre: string;
  correo: string | null;
  /// El contacto en HighLevel, que es lo que hace posible el WhatsApp.
  contactoCrm: string | null;
  /// Las casas que lleva ella (como líder o como encargada).
  propias: CasaDelAviso[];
  /// Las de su línea, que llevan otros. Solo para mentores.
  deLinea: CasaDelAviso[];
  /// **La casa a la que pertenece este aviso, o `""` si resume el día entero.**
  ///
  /// Es la cuarta parte de la clave única de `faith_house_reminder`
  /// (usuario · día · tipo · casa), y es lo que permite que los dos envíos
  /// diarios sigan siendo **uno por persona y día** mientras el de una hora
  /// antes es **uno por casa**. Los diarios escriben `""` —el valor por defecto
  /// de la columna— así que su idempotencia es la de siempre.
  grupoId: string;
};

/// El primer nombre, que es con el que se saluda.
export function nombreDePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

type FilaDeAviso = {
  usuarioId: string;
  nombre: string;
  correo: string | null;
  contactoCrm: string | null;
  papel: Papel;
  casa: CasaDelAviso;
};

/// **Junta las filas en un aviso por persona.**
///
/// Las casas quedan ordenadas por hora, que es el orden en que la persona va a
/// vivir el día. Y si alguien aparece como líder de una casa y como mentor de
/// otra, sale **un solo aviso** con las dos listas separadas.
///
/// Una casa no se repite dentro del mismo aviso: quien es líder *y* encargado
/// del mismo grupo la vería dos veces.
export function armarAvisos(filas: FilaDeAviso[]): Aviso[] {
  const porPersona = new Map<string, Aviso>();

  for (const fila of filas) {
    let aviso = porPersona.get(fila.usuarioId);
    if (!aviso) {
      aviso = {
        usuarioId: fila.usuarioId,
        nombre: fila.nombre,
        correo: fila.correo,
        contactoCrm: fila.contactoCrm,
        propias: [],
        deLinea: [],
        grupoId: "",
      };
      porPersona.set(fila.usuarioId, aviso);
    }

    const esSuya = fila.papel === "LIDER" || fila.papel === "ENCARGADO";
    const destino = esSuya ? aviso.propias : aviso.deLinea;
    const yaEsta =
      aviso.propias.some((c) => c.id === fila.casa.id) ||
      aviso.deLinea.some((c) => c.id === fila.casa.id);
    if (!yaEsta) destino.push(fila.casa);
  }

  const porHora = (a: CasaDelAviso, b: CasaDelAviso) =>
    a.hora.localeCompare(b.hora) || a.nombre.localeCompare(b.nombre);

  return [...porPersona.values()]
    .map((aviso) => ({
      ...aviso,
      propias: [...aviso.propias].sort(porHora),
      deLinea: [...aviso.deLinea].sort(porHora),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/// **Un aviso por PERSONA Y HORA DE REUNIÓN**, para el envío de una hora antes.
///
/// `armarAvisos` junta todas las casas del día de una persona en un solo
/// mensaje, que es lo que quiere un resumen. Aquí se agrupa más fino: por la
/// hora a la que empieza la reunión, así que quien lleva una casa a las 10:00 y
/// otra a las 14:30 recibe **dos avisos, cada uno a su hora**.
///
/// ⚠️ **Y por hora, NO por casa, y eso lo descubrió dibujarlo con los datos de
/// verdad** (§12.5). Agrupando por casa, Alejandro Facundo —que los lunes lleva
/// **dos casas a las 7:00 p. m.**, «Sur Casa Cristian» y «CASA DE FE GRUPAL
/// SUR»— recibiría **dos WhatsApps en el mismo minuto**. Eso no se lee como un
/// recordatorio: se lee como un sistema roto. Agrupado por hora, recibe uno que
/// nombra las dos. Hoy pasa en 1 de las 58 casas con horario, pero es el peor
/// día del líder que más casas lleva.
///
/// ⚠️ **`deLinea` queda siempre vacío**: este envío no va al mentor (la medida
/// está arriba, en `TIPOS_DE_ENVIO`). Si llegara una fila con papel `MENTOR` se
/// descarta aquí, para que la regla no dependa solo de quien llame.
export function armarAvisosPorHora(filas: FilaDeAviso[]): Aviso[] {
  const porPersonaYHora = new Map<string, Aviso>();

  for (const fila of filas) {
    if (fila.papel === "MENTOR") continue;
    const clave = `${fila.usuarioId}\u0000${fila.casa.hora}`;
    const aviso = porPersonaYHora.get(clave);
    if (!aviso) {
      porPersonaYHora.set(clave, {
        usuarioId: fila.usuarioId,
        nombre: fila.nombre,
        correo: fila.correo,
        contactoCrm: fila.contactoCrm,
        propias: [fila.casa],
        deLinea: [],
        grupoId: fila.casa.id,
      });
      continue;
    }
    if (aviso.propias.some((c) => c.id === fila.casa.id)) continue;
    aviso.propias.push(fila.casa);
  }

  return [...porPersonaYHora.values()]
    .map((aviso) => {
      const propias = [...aviso.propias].sort((a, b) => a.id.localeCompare(b.id));
      return {
        ...aviso,
        propias,
        // ⚠️ **La clave de idempotencia es el id MÁS BAJO de las casas de este
        // aviso, no «la primera que llegó».** Tiene que ser la misma en los tres
        // disparos de la ventana (§`MINUTOS_ANTES_*`), y el orden en que la base
        // devuelve las filas no está garantizado: si cambiara entre un disparo y
        // el siguiente, la clave cambiaría, el índice único no reconocería el
        // aviso ya mandado y saldría dos veces.
        grupoId: propias[0].id,
      };
    })
    .sort(
      (a, b) =>
        a.propias[0].hora.localeCompare(b.propias[0].hora) ||
        a.nombre.localeCompare(b.nombre),
    );
}

/// **Qué armador le toca a cada envío.**
///
/// ⚠️ Vive aquí y no como un ternario dentro del motor de envío **porque allí no
/// lo cubría ninguna prueba**: al romperlo a propósito el 23-oct (cambiar
/// `armarAvisosPorCasa` por `armarAvisos` en el camino de `UNA_HORA_ANTES`),
/// `tsc` pasaba, las 32 pruebas pasaban, y el fallo habría sido silencioso y
/// grave — el aviso de una hora antes se agruparía por persona, escribiría
/// `grupoId: ""`, y el índice único dejaría a quien lleva dos casas con **un
/// solo aviso al día** en vez de uno por casa. Aquí sí tiene prueba.
export function armadorDelEnvio(tipo: TipoDeEnvio): (filas: FilaDeAviso[]) => Aviso[] {
  return tipo === "UNA_HORA_ANTES" ? armarAvisosPorHora : armarAvisos;
}

/// Cuántas casas lleva el aviso en total.
export function cuantasCasas(aviso: Aviso): number {
  return aviso.propias.length + aviso.deLinea.length;
}

function plural(n: number, una: string, varias: string): string {
  return n === 1 ? una : varias;
}

/// **El asunto del correo.** Dice el número desde el principio porque es lo
/// único que se ve en la lista del celular antes de abrir.
export function asuntoDelCorreo(aviso: Aviso, tipo: TipoDeEnvio): string {
  const cuando = cuandoDelEnvio(tipo);
  const propias = aviso.propias.length;

  if (propias > 0) {
    return propias === 1
      ? `${cuando} tienes Casa de Fe · ${horaLegible(aviso.propias[0].hora)}`
      : `${cuando} tienes ${propias} Casas de Fe`;
  }

  const n = aviso.deLinea.length;
  return `Tu línea ${plural(n, "tiene una Casa de Fe", `tiene ${n} Casas de Fe`)} ${cuando.toLowerCase()}`;
}

/// **El valor de la variable `{{2}}` de la plantilla de WhatsApp.**
///
/// ⚠️ **NO es el mensaje: es UN TROZO del mensaje, y tiene que caber en UNA
/// SOLA LÍNEA.** El WhatsApp de este CRM va por la API de WhatsApp Business, que
/// **solo manda plantillas aprobadas por Meta**, no texto libre. La plantilla
/// `recordatorio_casa_de_fe` lleva el saludo y el cierre escritos y fijos; lo
/// único que viaja desde el sistema es el centro — y **Meta rechaza un valor de
/// variable que lleve saltos de línea, tabuladores o cuatro espacios seguidos**.
///
/// Esto lo descubrimos tarde, el 22-oct, al ir a crear el flujo: el diseño
/// original escribía el mensaje entero con sus saltos de línea, dando por hecho
/// que se podía mandar texto libre. **No se puede.** Y la misma trampa llevaba
/// tres semanas tumbando el WhatsApp del acceso al taller sin que nadie lo
/// supiera: 56 envíos en los que el sistema hizo su parte y Meta nunca mandó
/// nada.
///
/// Por eso lo último que hace es `enUnaLinea`: si alguien mete un `\n` en
/// cualquiera de los trozos, **se aplana aquí** en vez de llegar a Meta y hacer
/// que el envío falle sin explicación.
///
/// El correo sí lleva el mensaje completo, con direcciones y «cómo llegar».
/// Esto es el resumen que cabe en un WhatsApp.
export function variableDeWhatsApp(aviso: Aviso, tipo: TipoDeEnvio): string {
  const cuando = cuandoDelEnvio(tipo);
  const partes: string[] = [];

  if (aviso.propias.length > 0) {
    const n = aviso.propias.length;
    const casas = aviso.propias
      .map(
        (casa) =>
          `${horaLegible(casa.hora)} - ${casa.nombre} (${casa.miembros} ${plural(casa.miembros, "miembro", "miembros")})`,
      )
      .join(" · ");
    partes.push(
      `${cuando} tienes ${n === 1 ? "Casa de Fe" : `${n} Casas de Fe`}: ${casas}`,
    );
  }

  if (aviso.deLinea.length > 0) {
    const n = aviso.deLinea.length;
    // Para el mentor, lo que importa de cada casa es QUIÉN la lleva: es a quien
    // le va a preguntar. Los miembros son cosa del líder.
    const casas = aviso.deLinea
      .map((casa) => `${horaLegible(casa.hora)} - ${casa.nombre} (lidera ${casa.lider})`)
      .join(" · ");
    const encabezado =
      aviso.propias.length > 0
        ? "De tu línea:"
        : n === 1
          ? `${cuando} se reúne una casa de tu línea:`
          : `${cuando} se reúnen ${n} casas de tu línea:`;
    partes.push(`${encabezado} ${casas}`);
  }

  return enUnaLinea(partes.join(" — "));
}
