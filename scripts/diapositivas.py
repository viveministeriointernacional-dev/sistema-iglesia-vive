"""Convierte el PDF de las diapositivas de un tema a imágenes para la web.

    python3 -I scripts/diapositivas.py <pdf> <numero-de-tema>

Deja en `public/prematrimonial/tema-NN/` una imagen por página
(`diapositiva-01.webp`…) y el PDF entero como `material.pdf`, y escribe por
pantalla el renglón que hay que pegar en `src/lib/prematrimonial-material.ts`.

⚠️ **Las diapositivas van como IMÁGENES y no como un PDF incrustado a
propósito.** Un `<iframe>` con un PDF no se dibuja en el navegador de la mayoría
de los celulares (iPhone y buena parte de Android): o no enseña nada, o se lo
lleva a descargar y saca a la persona del taller. Y esta pantalla se abre casi
siempre desde el celular. Con imágenes se ve igual en todos los teléfonos y solo
se baja la diapositiva que se está mirando; el PDF entero sigue disponible en el
botón de descarga.

⚠️ **En este contenedor `pdftoppm`, `pypdf` y `pdfminer` fallan** (el
`cryptography` de Debian está roto). Lo que sirve es `pypdfium2` + `pillow`.

Medido con el tema 1 (18 diapositivas de 960×540 pt): 632 KB de imágenes a 1440
px de ancho, unos 35 KB cada una. A calidad 82 el texto sigue limpio; por debajo
de 75 se nota en los títulos finos.
"""

import sys
from pathlib import Path

import pypdfium2 as pdfium

#: Ancho de la imagen en píxeles. 1440 cubre un celular con pantalla densa sin
#: pasar de ~35 KB por diapositiva.
ANCHO = 1440

#: Calidad del WEBP. Ver la nota de arriba antes de bajarla.
CALIDAD = 82


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    origen = Path(sys.argv[1])
    numero = int(sys.argv[2])
    if not origen.is_file():
        print(f"No existe {origen}")
        return 1

    carpeta = Path("public") / "prematrimonial" / f"tema-{numero:02d}"
    carpeta.mkdir(parents=True, exist_ok=True)

    # Lo que hubiera de una vez anterior se borra: un tema con 18 diapositivas
    # que pasa a tener 12 dejaría seis huérfanas, y el catálogo diría 12
    # mientras la carpeta tiene 18.
    for viejo in carpeta.glob("diapositiva-*.webp"):
        viejo.unlink()

    doc = pdfium.PdfDocument(str(origen))
    for i, pagina in enumerate(doc, start=1):
        escala = ANCHO / pagina.get_width()
        imagen = pagina.render(scale=escala).to_pil().convert("RGB")
        imagen.save(carpeta / f"diapositiva-{i:02d}.webp", "WEBP",
                    quality=CALIDAD, method=6)

    destino_pdf = carpeta / "material.pdf"
    destino_pdf.write_bytes(origen.read_bytes())

    print(f"{len(doc)} diapositivas en {carpeta}")
    print("Pega esto en src/lib/prematrimonial-material.ts:")
    print(f"  {numero}: {{ diapositivas: {len(doc)}, "
          f"bytes: {destino_pdf.stat().st_size} }},")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
