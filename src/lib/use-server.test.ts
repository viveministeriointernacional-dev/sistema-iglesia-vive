import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/// **Un archivo `"use server"` solo puede exportar funciones `async`.**
///
/// Esta prueba existe porque el mismo error nos costó producción el 12-sep:
/// `DESTINOS_REASIGNABLES` se exportó desde `operacion-72/acciones.ts`, un
/// módulo `"use server"`, y el componente de cliente la importaba de ahí. La
/// pantalla del tablero se caía con «This page couldn't load».
///
/// **Lo grave es que NADA lo avisaba**: `tsc --noEmit`, `eslint` y
/// `npm run cf:build` pasaron los tres en verde. Es un fallo de EJECUCIÓN, así
/// que solo se ve abriendo la pantalla — y ya había pasado el 3-sep con
/// `ROLES_REGISTRO_SOLO_FICHA`. Dos veces es una regla que necesita guardián.
///
/// Los `export type` y `export interface` SÍ valen: los tipos se borran al
/// compilar, así que no producen ninguna exportación en ejecución.

function archivosDeCodigo(raiz: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(raiz)) {
    const ruta = join(raiz, entrada);
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...archivosDeCodigo(ruta));
    } else if (/\.(ts|tsx)$/.test(entrada) && !entrada.endsWith(".test.ts")) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

test('ningún archivo "use server" exporta algo que no sea una función', () => {
  const culpables: string[] = [];

  for (const ruta of archivosDeCodigo("src")) {
    const contenido = readFileSync(ruta, "utf8");
    // La directiva tiene que ser lo primero del archivo para valer.
    if (!/^\s*["']use server["']/.test(contenido)) continue;

    for (const [numero, linea] of contenido.split("\n").entries()) {
      // `export type` y `export interface` se borran al compilar: no cuentan.
      const prohibido = /^export\s+(const|let|var|class|enum|default)\b/.exec(linea);
      if (prohibido) {
        culpables.push(`${ruta}:${numero + 1} → export ${prohibido[1]}`);
      }
    }
  }

  assert.deepEqual(
    culpables,
    [],
    'Un archivo "use server" solo puede exportar funciones async. ' +
      "Mueve estas constantes a un catálogo (por ejemplo src/lib/op72.ts):\n" +
      culpables.join("\n"),
  );
});
