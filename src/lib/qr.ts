import qrcode from "qrcode-generator";

/// El QR de un taller, como SVG.
///
/// ⚠️ **Se dibuja con UN solo `<path>`, no con un `<rect>` por celda.** Un QR
/// de 29×29 tiene 841 celdas: la versión con rectángulos pesa ~11 kB y la de
/// un camino ~1,5 kB. Se imprimen doce en una hoja, así que la diferencia es
/// real, no cosmética.
///
/// Corrección de errores **M**: aguanta manchas y dobleces de una hoja que va a
/// vivir en una casa, sin inflar el código como haría **H**.
export function qrComoSvg(texto: string, opciones?: { celda?: number; margen?: number }): string {
  const celda = opciones?.celda ?? 4;
  const margen = opciones?.margen ?? 2;

  // Tipo 0 = que la librería elija el tamaño mínimo que quepa el texto.
  const codigo = qrcode(0, "M");
  codigo.addData(texto);
  codigo.make();

  const modulos = codigo.getModuleCount();
  const lado = (modulos + margen * 2) * celda;

  const trazos: string[] = [];
  for (let fila = 0; fila < modulos; fila += 1) {
    for (let col = 0; col < modulos; col += 1) {
      if (!codigo.isDark(fila, col)) continue;
      const x = (col + margen) * celda;
      const y = (fila + margen) * celda;
      trazos.push(`M${x} ${y}h${celda}v${celda}h-${celda}z`);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}" shape-rendering="crispEdges" role="img">`,
    `<rect width="${lado}" height="${lado}" fill="#ffffff"/>`,
    `<path fill="#111827" d="${trazos.join("")}"/>`,
    `</svg>`,
  ].join("");
}

/// La dirección que abre el QR.
///
/// ⚠️ **El dominio sale de la petición, no de una constante.** El sistema vive
/// en el worker de Cloudflare y se abre por varias direcciones (producción y la
/// vista previa de cada rama); un dominio fijo haría que los QR impresos desde
/// una vista previa llevaran a la otra.
export function enlaceDelTaller(origen: string, qrCode: string): string {
  return `${origen.replace(/\/+$/, "")}/taller/${qrCode}`;
}
