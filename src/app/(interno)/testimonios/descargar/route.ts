import { obtenerUsuarioActual, tieneVista } from "@/lib/auth";
import { momentoLargo } from "@/lib/dominio";
import { cargarTodos } from "@/lib/testimonios";
import { armarCsv } from "@/lib/testimonios-catalogo";

export const dynamic = "force-dynamic";

/// **«Descargar Excel»**: todos los testimonios en un CSV que Excel y Google
/// Sheets abren directamente.
///
/// ⚠️ El guardia va aquí también: el middleware solo comprueba que hay sesión,
/// no que la persona tenga la vista. Sin esto, cualquier cuenta de la
/// plataforma —un consolidador, un líder de Alpha— podría bajarse los
/// celulares tecleando la dirección (§12.6).
export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !tieneVista(usuario, "testimonios")) {
    return new Response("No tienes permiso para descargar los testimonios.", {
      status: 403,
    });
  }

  const testimonios = await cargarTodos();
  const csv = armarCsv(
    testimonios.map((t) => ({
      fecha: momentoLargo(t.recibidoEl),
      nombre: t.nombre,
      celular: t.celular,
      edad: t.edad,
      milagro: t.milagro,
      contactado: t.contactadoEl ? momentoLargo(t.contactadoEl) : "No",
      contactadoPor: t.contactadoPor ?? "",
    })),
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="testimonios_milagros.csv"',
      "cache-control": "no-store",
    },
  });
}
