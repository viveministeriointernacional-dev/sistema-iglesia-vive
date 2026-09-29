/// `qrcode-generator` no trae tipos propios. Se declara solo lo que usa
/// `src/lib/qr.ts`: crear el código, meterle el texto, calcularlo y preguntar
/// celda por celda si está pintada.
declare module "qrcode-generator" {
  type NivelDeCorreccion = "L" | "M" | "Q" | "H";

  type CodigoQr = {
    addData(texto: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(fila: number, columna: number): boolean;
  };

  /// `tipo` 0 = que elija el tamaño mínimo que quepa el texto.
  function qrcode(tipo: number, correccion: NivelDeCorreccion): CodigoQr;

  export = qrcode;
}
