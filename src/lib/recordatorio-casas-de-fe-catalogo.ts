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

/// **La hora que parte el día.** Una casa que se reúne antes de esto se avisa
/// la noche anterior, porque el resumen de la mañana le llegaría tarde.
///
/// Está en 9:00 y no en 7:00 a propósito: el envío de la mañana sale a las
/// 6:00, y un margen de tres horas deja al líder tiempo de leerlo, confirmar
/// con alguien y salir. Con el tope en 7:00, la casa de las 7:00 recibiría el
/// aviso **sesenta minutos antes** de empezar.
export const HORA_TOPE_MANANA = "09:00";

/// Los dos envíos del día. `DIA` sale temprano con las reuniones de hoy;
/// `NOCHE_ANTES` sale por la tarde con las de mañana que empiezan de madrugada.
export const TIPOS_DE_ENVIO = ["DIA", "NOCHE_ANTES"] as const;

export type TipoDeEnvio = (typeof TIPOS_DE_ENVIO)[number];

export function tipoValido(valor: string | undefined | null): TipoDeEnvio | null {
  return TIPOS_DE_ENVIO.includes(valor as TipoDeEnvio) ? (valor as TipoDeEnvio) : null;
}

/// **Qué envío le corresponde a una hora.** La función que de verdad impide el
/// doble aviso: cada casa cae en uno de los dos y nunca en los dos, porque la
/// comparación es la misma en ambos lados.
///
/// La hora llega como texto «HH:mm» (así se guarda, §12.1), y el orden
/// alfabético de «HH:mm» es el orden del reloj: «06:00» < «09:00» < «19:30».
/// Por eso se compara con `<` directo y no hay que convertir nada.
export function envioQueLeToca(hora: string): TipoDeEnvio {
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
  const cuando = tipo === "DIA" ? "Hoy" : "Mañana";
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
  const cuando = tipo === "DIA" ? "Hoy" : "Mañana";
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

/// Aplana cualquier espacio en blanco a un solo espacio. Es la garantía de que
/// lo que sale de aquí cabe en una variable de plantilla, escriba lo que escriba
/// quien toque las funciones de arriba.
function enUnaLinea(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}
