/// Genera una contraseña legible para dictarla por teléfono o copiarla de un
/// correo sin equivocarse: sin caracteres que se confundan entre sí (l/1/I,
/// O/0), en dos bloques separados por un guion.
///
/// No pretende ser secreta para siempre: es una clave temporal que la persona
/// cambia después de entrar. Lo importante aquí es que se pueda transcribir.
const LETRAS = "abcdefghjkmnpqrstuvwxyz";
const DIGITOS = "23456789";

function alAzar(alfabeto: string, cantidad: number): string {
  const valores = new Uint32Array(cantidad);
  crypto.getRandomValues(valores);
  return Array.from(
    valores,
    (valor) => alfabeto[valor % alfabeto.length],
  ).join("");
}

export function generarContrasena(): string {
  return `${alAzar(LETRAS, 4)}${alAzar(DIGITOS, 2)}-${alAzar(LETRAS, 4)}`;
}

/// Mínimo que exige Supabase Auth. Se comprueba aquí para dar un mensaje claro
/// en español antes de llamar al proveedor.
export const LARGO_MINIMO_CONTRASENA = 6;
