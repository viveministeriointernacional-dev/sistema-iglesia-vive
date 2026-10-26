/// El material de apoyo de cada tema del prematrimonial: las diapositivas que
/// se usaron en la charla, para que la pareja pueda repasar el tema mientras
/// responde.
///
/// **Todo lo de aquí es PURO y sin base de datos**, que es lo que permite
/// probarlo y que lo use el navegador (la regla del 6-sep-2026: lo que toque el
/// cliente va al catálogo).
///
/// ⚠️ **LAS DIAPOSITIVAS SE SIRVEN COMO IMÁGENES, NO COMO UN PDF INCRUSTADO, Y
/// NO ES UN CAPRICHO.** Un `<iframe>` con un PDF no se dibuja en el navegador de
/// la mayoría de los celulares —iPhone y buena parte de Android—: o no enseña
/// nada, o se lo lleva a descargar y **saca a la persona del taller**. Esta
/// pantalla se abre casi siempre desde el celular, así que incrustar el PDF
/// rompería justo donde más se usa. Con imágenes se ve igual en todos los
/// teléfonos, y el PDF entero sigue a un clic en el botón de descarga.
///
/// ⚠️ **El material NO vive en la base, vive en `public/`**, y el catálogo es
/// esta lista. Es deliberado mientras los PDF los entregue el usuario por el
/// chat: una tabla y una pantalla de subida son bastante más trabajo y no
/// cambian nada para quien lee. Si algún día quiere cambiarlos él mismo, esto
/// es lo que hay que mover a una tabla.
///
/// **Para añadir un tema** (son dos pasos y el script escribe el segundo):
/// `python3 -I scripts/diapositivas.py <el.pdf> <numero>` y pegar aquí el
/// renglón que imprime.

export type MaterialDelTema = {
  /// Cuántas páginas tiene el PDF, que son las diapositivas.
  diapositivas: number;
  /// Lo que pesa el PDF, para poder decirlo en el botón **sin pedir el
  /// archivo**: una cabecera `HEAD` por taller abierto sería un viaje de más
  /// para un dato que no cambia nunca.
  bytes: number;
};

/// Por NÚMERO de tema, no por su id. El número es lo que imprime el libro y lo
/// que nombra la carpeta; el id cambia si alguien resiembra los temas.
export const MATERIAL_POR_TEMA: Record<number, MaterialDelTema> = {
  1: { diapositivas: 18, bytes: 270481 },
  2: { diapositivas: 20, bytes: 302866 },
  3: { diapositivas: 21, bytes: 291740 },
  4: { diapositivas: 21, bytes: 281538 },
};

export function materialDelTema(numero: number): MaterialDelTema | null {
  return MATERIAL_POR_TEMA[numero] ?? null;
}

/// ⚠️ **El número va con dos cifras**, igual que la carpeta: `tema-01`, no
/// `tema-1`. Si esto y el script se separan, las imágenes dan 404 y la pantalla
/// se queda con huecos en blanco sin decir por qué.
export function carpetaDelMaterial(numero: number): string {
  return `/prematrimonial/tema-${String(numero).padStart(2, "0")}`;
}

export function rutaDeDiapositiva(numero: number, indice: number): string {
  return `${carpetaDelMaterial(numero)}/diapositiva-${String(indice).padStart(2, "0")}.webp`;
}

export function rutaDelPdf(numero: number): string {
  return `${carpetaDelMaterial(numero)}/material.pdf`;
}

/// «264 KB», «1,2 MB». En español, con coma decimal.
///
/// ⚠️ Por debajo de 1 MB se dice en KB **sin decimales**: «0,3 MB» no le dice
/// nada a nadie, y lo que esta línea tiene que responder es «¿me lo bajo con
/// los datos del celular?».
export function tamanoLegible(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}
