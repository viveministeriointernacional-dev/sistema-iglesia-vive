import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import {
  coincideConLaBusqueda,
  pasaElFiltro,
  resumirTestimonios,
  validarTestimonio,
  type DatosDelTestimonio,
  type FiltroDeTestimonios,
  type ResumenDeTestimonios,
  type TestimonioParaPintar,
} from "@/lib/testimonios-catalogo";

/// **Testimonios de milagros**: lo que toca la base. Las reglas (validación,
/// filtros, recuadros, CSV) viven en `testimonios-catalogo.ts`, con sus pruebas.

/// Cuántos se cargan como mucho. Llegan unos pocos por semana, así que el tope
/// está para que un día de mil no tumbe la pantalla, no porque se espere.
const TOPE = 1000;

/// **Guarda lo que llegó por `/milagros`.** Lo llama la página pública, sin
/// sesión: lo único que autoriza es haber llenado el formulario.
///
/// ⚠️ No busca a la persona en la base ni crea ficha (decisión del usuario,
/// 15-nov-2026). No avisa a nadie: el equipo lo ve en `/testimonios`.
export async function registrarTestimonio(
  datos: DatosDelTestimonio,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const validacion = validarTestimonio(datos);
  if (!validacion.ok) return validacion;
  const { nombre, celular, edad, milagro } = validacion.limpio;

  const prisma = await getPrisma();
  const creado = await prisma.testimony.create({
    data: { name: nombre, phone: celular, age: edad, text: milagro },
    select: { id: true },
  });

  // Sin actor: lo escribió la persona desde su celular, no alguien del equipo.
  // El nombre va en el metadato porque «Actividad del día» no tiene otra forma
  // de saberlo — el testimonio no cuelga de ninguna ficha.
  await auditar(prisma, {
    actorId: null,
    action: "testimonio.recibido",
    entityType: "testimony",
    entityId: creado.id,
    metadata: { nombre },
  });

  return { ok: true };
}

export async function cargarTestimonios(opciones: {
  filtro: FiltroDeTestimonios;
  busqueda: string;
}): Promise<{
  testimonios: TestimonioParaPintar[];
  resumen: ResumenDeTestimonios;
  recortado: boolean;
}> {
  const todos = await cargarTodos();
  const ahora = new Date();

  // ⚠️ Los recuadros se cuentan sobre TODOS, no sobre lo que deja la búsqueda:
  // si no, buscar «Marta» cambiaría la cifra de «sin contactar» y parecería
  // que alguien la llamó.
  const resumen = resumirTestimonios(todos, ahora);
  const testimonios = todos
    .filter((t) => pasaElFiltro(t, opciones.filtro, ahora))
    .filter((t) => coincideConLaBusqueda(t, opciones.busqueda))
    // Los que faltan por llamar, arriba; dentro de cada grupo, el más nuevo
    // primero. En «sin contactar» el primer criterio no cambia nada.
    .sort(
      (a, b) =>
        Number(a.contactadoEl !== null) - Number(b.contactadoEl !== null) ||
        b.recibidoEl.getTime() - a.recibidoEl.getTime(),
    );

  return { testimonios, resumen, recortado: todos.length >= TOPE };
}

/// Todo, del más nuevo al más viejo. Lo usa también la descarga a Excel, que
/// por eso baja exactamente lo mismo que se ve en «Todos».
export async function cargarTodos(): Promise<TestimonioParaPintar[]> {
  const prisma = await getPrisma();
  const filas = await prisma.testimony.findMany({
    orderBy: { createdAt: "desc" },
    take: TOPE,
    select: {
      id: true,
      name: true,
      phone: true,
      age: true,
      text: true,
      createdAt: true,
      contactedAt: true,
      contactedBy: { select: { fullName: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    nombre: f.name,
    celular: f.phone,
    edad: f.age,
    milagro: f.text,
    recibidoEl: f.createdAt,
    contactadoEl: f.contactedAt,
    contactadoPor: f.contactedBy?.fullName ?? null,
  }));
}

/// **«Ya lo contactamos».** Pasa el testimonio al historial; no lo borra.
export async function marcarContactado(datos: {
  testimonioId: string;
  usuarioId: string;
}): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const prisma = await getPrisma();

  // ⚠️ El `contactedAt: null` del `where` es lo que impide pisar a quien llegó
  // primero: si dos personas pulsan a la vez, la segunda no cambia nada y se
  // entera, en vez de quedarse con el crédito de una llamada que no hizo.
  const { count } = await prisma.testimony.updateMany({
    where: { id: datos.testimonioId, contactedAt: null },
    data: { contactedAt: new Date(), contactedById: datos.usuarioId },
  });
  if (count === 0) {
    const existe = await prisma.testimony.findUnique({
      where: { id: datos.testimonioId },
      select: { id: true },
    });
    return {
      ok: false,
      mensaje: existe
        ? "Alguien ya lo marcó como contactado."
        : "Ese testimonio ya no existe.",
    };
  }

  const fila = await prisma.testimony.findUnique({
    where: { id: datos.testimonioId },
    select: { name: true },
  });
  await auditar(prisma, {
    actorId: datos.usuarioId,
    action: "testimonio.contactado",
    entityType: "testimony",
    entityId: datos.testimonioId,
    metadata: { nombre: fila?.name ?? null },
  });

  return { ok: true };
}
