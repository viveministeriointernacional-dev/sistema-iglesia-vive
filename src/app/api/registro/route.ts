import { revalidatePath } from "next/cache";
import { procesarRegistroPublico } from "@/lib/registro-publico-servidor";

export async function POST(request: Request) {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return Response.json(
      {
        errores: {},
        mensaje: "No pudimos leer el formulario. Recarga la página e inténtalo nuevamente.",
      },
      { status: 400 },
    );
  }

  const resultado = await procesarRegistroPublico(formulario, request.headers);
  if (resultado.tipo === "rechazado") {
    return Response.json(resultado.estado, { status: resultado.status });
  }

  revalidatePath("/operacion-72");
  return Response.json({ ok: true });
}
