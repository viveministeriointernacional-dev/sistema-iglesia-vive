/// **Testimonios de milagros**: las reglas que comparten la página pública
/// (`/milagros`), la pantalla del equipo (`/testimonios`) y la descarga a Excel.
///
/// Vive aparte de `testimonios.ts` por la regla del 6-sep-2026: lo que toca el
/// navegador va en el catálogo, lo que toca la base va en el módulo de datos.
/// Aquí no se importa Prisma ni nada que arrastre `pg`.

// ---------------------------------------------------------------------------
// El formulario público
// ---------------------------------------------------------------------------

/// Los mismos topes que tenía la página que diseñó el usuario en su cuenta
/// personal (nombre 120, celular 40, testimonio 4000). Se conservan tal cual:
/// el diseño ya estaba aprobado y el contador «0 / 4000» los enseña.
export const LARGO_MAXIMO_NOMBRE = 120;
export const LARGO_MAXIMO_CELULAR = 40;
export const LARGO_MAXIMO_TESTIMONIO = 4000;
export const LARGO_MINIMO_TESTIMONIO = 5;
export const EDAD_MINIMA = 1;
export const EDAD_MAXIMA = 120;

export type DatosDelTestimonio = {
  nombre: string;
  celular: string;
  edad: number;
  milagro: string;
};

export type TestimonioLimpio = {
  nombre: string;
  celular: string;
  edad: number;
  milagro: string;
};

const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

/// **La validación, escrita una sola vez.** La usan el navegador (para decir el
/// error sin esperar al servidor) y el servidor (que es el que manda: el
/// navegador se puede saltar).
///
/// Los mensajes son los de la página original, uno por campo y en el orden en
/// que aparecen, para que la persona arregle de arriba abajo.
export function validarTestimonio(
  datos: DatosDelTestimonio,
): { ok: true; limpio: TestimonioLimpio } | { ok: false; mensaje: string } {
  const nombre = (datos.nombre ?? "").trim().replace(/\s+/g, " ");
  const celular = (datos.celular ?? "").trim();
  const milagro = (datos.milagro ?? "").trim();
  const edad = Number(datos.edad);

  if (nombre.length < 2) return { ok: false, mensaje: "Escribe tu nombre." };
  if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    return { ok: false, mensaje: "El nombre quedó muy largo." };
  }
  if (soloDigitos(celular).length < 7 || celular.length > LARGO_MAXIMO_CELULAR) {
    return { ok: false, mensaje: "Escribe un número de celular válido." };
  }
  if (!Number.isInteger(edad) || edad < EDAD_MINIMA || edad > EDAD_MAXIMA) {
    return { ok: false, mensaje: "Escribe tu edad." };
  }
  if (milagro.length < LARGO_MINIMO_TESTIMONIO) {
    return { ok: false, mensaje: "Cuéntanos tu milagro." };
  }
  if (milagro.length > LARGO_MAXIMO_TESTIMONIO) {
    return {
      ok: false,
      mensaje: `Quedó muy largo: escríbelo en ${LARGO_MAXIMO_TESTIMONIO} caracteres o menos.`,
    };
  }
  return { ok: true, limpio: { nombre, celular, edad, milagro } };
}

// ---------------------------------------------------------------------------
// La pantalla del equipo
// ---------------------------------------------------------------------------

export type TestimonioParaPintar = {
  id: string;
  nombre: string;
  celular: string;
  edad: number;
  milagro: string;
  recibidoEl: Date;
  contactadoEl: Date | null;
  /// Nulo si nadie lo ha marcado, o si se borró la cuenta de quien lo marcó.
  contactadoPor: string | null;
};

/// Los tres recuadros de arriba son también los tres filtros de la lista. El
/// recuadro y su lista se cuentan con **la misma función** (`pasaElFiltro`),
/// para que nunca diga 4 arriba y enseñe 5 abajo (§12.6).
export const FILTROS = [
  { id: "pendientes", etiqueta: "Sin contactar" },
  { id: "semana", etiqueta: "Esta semana" },
  { id: "contactados", etiqueta: "Contactados" },
  { id: "todos", etiqueta: "Todos" },
] as const;

export type FiltroDeTestimonios = (typeof FILTROS)[number]["id"];

export function filtroValido(valor: string | undefined): FiltroDeTestimonios {
  return FILTROS.some((f) => f.id === valor)
    ? (valor as FiltroDeTestimonios)
    : "pendientes";
}

const DIA = 24 * 60 * 60 * 1000;

/// **«Esta semana» son los últimos 7 días**, no la semana del calendario: la
/// pregunta es «cuánto está entrando últimamente», igual que en Oración.
export const DIAS_DE_LA_SEMANA = 7;

export function pasaElFiltro(
  t: Pick<TestimonioParaPintar, "recibidoEl" | "contactadoEl">,
  filtro: FiltroDeTestimonios,
  ahora: Date,
): boolean {
  switch (filtro) {
    case "pendientes":
      return t.contactadoEl === null;
    case "contactados":
      return t.contactadoEl !== null;
    case "semana":
      return t.recibidoEl.getTime() >= ahora.getTime() - DIAS_DE_LA_SEMANA * DIA;
    case "todos":
      return true;
  }
}

export type ResumenDeTestimonios = {
  pendientes: number;
  estaSemana: number;
  recibidos: number;
};

export function resumirTestimonios(
  testimonios: readonly Pick<TestimonioParaPintar, "recibidoEl" | "contactadoEl">[],
  ahora: Date,
): ResumenDeTestimonios {
  return {
    pendientes: testimonios.filter((t) => pasaElFiltro(t, "pendientes", ahora)).length,
    estaSemana: testimonios.filter((t) => pasaElFiltro(t, "semana", ahora)).length,
    recibidos: testimonios.length,
  };
}

/// Lo que se lee cuando la lista sale vacía: cada filtro dice lo suyo, para que
/// «sin contactar» vacío no parezca que el módulo no tiene nada.
export const VACIO: Record<FiltroDeTestimonios, string> = {
  pendientes: "No queda nadie por contactar. Ya se habló con todos.",
  semana: "No llegó ningún testimonio en los últimos 7 días.",
  contactados: "Todavía no se ha marcado a nadie como contactado.",
  todos: "Todavía no ha llegado ningún testimonio.",
};

/// La búsqueda mira el nombre y el celular, **sin tildes ni mayúsculas**, y en
/// el celular solo los dígitos: el equipo teclea «310 555» y en la base está
/// «3105550182».
export function coincideConLaBusqueda(
  t: Pick<TestimonioParaPintar, "nombre" | "celular">,
  busqueda: string,
): boolean {
  const q = aplanar(busqueda);
  if (!q) return true;
  if (aplanar(t.nombre).includes(q)) return true;
  const digitos = soloDigitos(busqueda);
  return digitos.length >= 3 && soloDigitos(t.celular).includes(digitos);
}

function aplanar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// La descarga
// ---------------------------------------------------------------------------

/// Un campo de CSV, entre comillas y con las comillas de dentro dobladas.
///
/// ⚠️ **Y con un apóstrofo delante si empieza por `=`, `+`, `-` o `@`.** El
/// testimonio lo escribe cualquiera desde un enlace público, y Excel ejecuta
/// como fórmula una celda que empieza así: alguien podría escribir
/// `=HYPERLINK(...)` y quien abra el archivo lo vería como un enlace activo. El
/// apóstrofo lo deja como texto. Un celular escrito «+57…» también lo lleva y
/// se verá «'+57…»: es el precio de no dejar pasar ninguna fórmula.
export function campoCsv(valor: string | number | null): string {
  let texto = valor === null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export const COLUMNAS_CSV = [
  "Fecha",
  "Nombre",
  "Celular",
  "Edad",
  "Milagro",
  "Contactado",
  "Contactado por",
] as const;

/// El archivo entero. Las fechas llegan **ya escritas en hora de Colombia**
/// desde el servidor (§12.1): aquí no se formatea nada.
///
/// Lleva el BOM de UTF-8 al principio porque sin él Excel abre el archivo como
/// Latin-1 y las tildes salen como «Ã³».
export function armarCsv(
  filas: readonly {
    fecha: string;
    nombre: string;
    celular: string;
    edad: number;
    milagro: string;
    contactado: string;
    contactadoPor: string;
  }[],
): string {
  const lineas = [COLUMNAS_CSV.map(campoCsv).join(",")];
  for (const f of filas) {
    lineas.push(
      [f.fecha, f.nombre, f.celular, f.edad, f.milagro, f.contactado, f.contactadoPor]
        .map(campoCsv)
        .join(","),
    );
  }
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
