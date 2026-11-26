import assert from "node:assert/strict";
import test from "node:test";
import {
  claveDeGrupoBorrado,
  fraseDelAlcance,
  fraseDelHueco,
  fraseSoloLaLinea,
  fraseSoloLasQueLleva,
  ROTULOS,
  SECCIONES,
  TIPOS_DE_GRUPO,
  tipoDeGrupoDelFormulario,
  tipoDeLaUrl,
} from "./tipo-de-grupo";

/// **Estas pruebas son de gramática, y por eso existen.** Las frases se arman
/// con «la/el» y «las/los», y un género mal puesto no lo ve ni `tsc` ni
/// `eslint`: sale impreso en la pantalla. Al dibujarlas las cuatro juntas por
/// primera vez apareció «Cuando te asignen **un**, aparecerá aquí», que es el
/// caso en el que la palabra va sola. Cada renglón de aquí es uno de esos.

test("los cuatro bloques tienen rótulos y ninguno se repite", () => {
  assert.equal(SECCIONES.length, 4);
  const urls = SECCIONES.map((c) => ROTULOS[c].enLaUrl);
  assert.equal(new Set(urls).size, 4, "dos tipos comparten el ?tipo= de la URL");
  const colores = SECCIONES.map((c) => ROTULOS[c].punto);
  assert.equal(new Set(colores).size, 4, "dos tipos comparten el color del calendario");
});

test("solo Casa de Fe lleva el taller de los 12 temas", () => {
  const conTaller = SECCIONES.filter((c) => ROTULOS[c].conTaller);
  assert.deepEqual(conTaller, ["CASA_DE_FE"]);
});

test("Alpha no es uno de los que viven en faith_house_group", () => {
  assert.equal(TIPOS_DE_GRUPO.includes("CASA_DE_FE" as never), true);
  assert.equal((TIPOS_DE_GRUPO as string[]).includes("ALPHA"), false);
});

test("el ?tipo= de la URL se lee y lo inventado se descarta", () => {
  assert.equal(tipoDeLaUrl("casa-de-fe"), "CASA_DE_FE");
  assert.equal(tipoDeLaUrl("mentorias"), "MENTORIA");
  assert.equal(tipoDeLaUrl("alpha"), "ALPHA");
  assert.equal(tipoDeLaUrl("restaurados"), "RESTAURADOS");
  assert.equal(tipoDeLaUrl(undefined), null);
  assert.equal(tipoDeLaUrl("todos"), null);
  assert.equal(tipoDeLaUrl("MENTORIA"), null, "la clave de la URL no es la del enum");
});

test("el tipo que llega de un formulario se valida contra la lista", () => {
  assert.equal(tipoDeGrupoDelFormulario("MENTORIA"), "MENTORIA");
  assert.equal(tipoDeGrupoDelFormulario("RESTAURADOS"), "RESTAURADOS");
  // Alpha no se crea por aquí: tiene su propia tabla y su propia acción.
  assert.equal(tipoDeGrupoDelFormulario("ALPHA"), null);
  assert.equal(tipoDeGrupoDelFormulario(""), null);
  assert.equal(tipoDeGrupoDelFormulario(null), null);
  assert.equal(tipoDeGrupoDelFormulario("' or 1=1"), null);
});

test("ninguna frase deja un artículo suelto ni dice «un» a secas", () => {
  for (const clave of SECCIONES) {
    const r = ROTULOS[clave];
    // Los cuatro primeros son **fragmentos** a propósito: se pintan como
    // coletilla a la derecha del título («Solo las que lleva …»), no como
    // frase, y ahí un punto final sobra. Por eso solo se les revisa la
    // gramática, no la puntuación.
    const fragmentos = [
      fraseDelAlcance(r, true),
      fraseDelAlcance(r, false),
      fraseSoloLasQueLleva(r, "Alejandro Facundo"),
      fraseSoloLaLinea(r, "Alejandro Facundo"),
    ];
    const frases = [
      fraseDelHueco(r, { filtro: "sin-linea", puedeCrear: true }),
      fraseDelHueco(r, { filtro: "sin-linea", puedeCrear: false }),
      fraseDelHueco(r, { filtro: "todas", nombre: "Alejandro Facundo" }),
      fraseDelHueco(r, { filtro: "directas", nombre: "Alejandro Facundo" }),
      fraseDelHueco(r, { filtro: "linea" }),
    ];
    for (const frase of [...fragmentos, ...frases]) {
      assert.doesNotMatch(frase, /\bun,/, `«${frase}» dice «un» donde va «uno»`);
      assert.doesNotMatch(frase, /\bde el\b/, `«${frase}» dice «de el» en vez de «del»`);
      assert.doesNotMatch(frase, /\s{2,}/, `«${frase}» tiene espacios de más`);
    }
    for (const frase of frases) {
      assert.match(frase, /\.$/, `«${frase}» no termina en punto`);
    }
  }
});

test("el hueco con «directas» no manda a cambiar de línea", () => {
  // ⚠️ Con «directas» puesto el hueco es frecuente y NO es raro: el 27-oct
  // Alejandro Facundo tenía 4 Alpha en su línea y no llevaba ninguno. Decirle
  // «en esta línea no hay ningún Alpha» sería falso.
  const alpha = fraseDelHueco(ROTULOS.ALPHA, {
    filtro: "directas",
    nombre: "Alejandro Facundo",
  });
  assert.match(alpha, /no lleva ningún Alpha/);
  assert.doesNotMatch(alpha, /Cambia de línea/);
});

test("Restaurados y Mentorías no prometen temas que no existen", () => {
  assert.doesNotMatch(ROTULOS.RESTAURADOS.referencia, /tema/i);
  assert.doesNotMatch(ROTULOS.MENTORIA.referencia, /tema/i);
  assert.match(ROTULOS.CASA_DE_FE.referencia, /12 temas/);
});

// ⚠️ **Los TRES tipos de `faith_house_group` se auditan con la MISMA acción**,
// así que el nombre de la acción no dice de qué tipo era el grupo borrado. Se
// vio el 26-nov al borrar un duplicado de Restaurados: su línea en «Actividad
// del día» iba a decir «borró la Casa de Fe Restaura2 - Julian & Claudia».
test("el tipo del grupo borrado sale del metadato, no de la acción", () => {
  // Lo que importa: el metadato manda, aunque la acción diga «casa_de_fe».
  assert.equal(
    claveDeGrupoBorrado("RESTAURADOS", "casa_de_fe.grupo_borrado"),
    "RESTAURADOS",
  );
  assert.equal(claveDeGrupoBorrado("MENTORIA", "casa_de_fe.grupo_borrado"), "MENTORIA");
  assert.equal(claveDeGrupoBorrado("CASA_DE_FE", "casa_de_fe.grupo_borrado"), "CASA_DE_FE");
  assert.equal(claveDeGrupoBorrado("ALPHA", "alpha.grupo_borrado"), "ALPHA");

  // ⚠️ Las filas de antes del 26-nov NO llevan el tipo: se cae al nombre de la
  // acción, que es lo que decían antes — ninguna línea vieja cambia de
  // significado al desplegar esto.
  assert.equal(claveDeGrupoBorrado(undefined, "casa_de_fe.grupo_borrado"), "CASA_DE_FE");
  assert.equal(claveDeGrupoBorrado(undefined, "alpha.grupo_borrado"), "ALPHA");
  assert.equal(claveDeGrupoBorrado(null, "alpha.grupo_borrado"), "ALPHA");

  // Y un metadato con basura no revienta ni inventa un tipo.
  assert.equal(claveDeGrupoBorrado("CUALQUIERA", "casa_de_fe.grupo_borrado"), "CASA_DE_FE");
  assert.equal(claveDeGrupoBorrado(42, "casa_de_fe.grupo_borrado"), "CASA_DE_FE");
});

// Y la frase que de verdad se pinta, para los cuatro tipos.
test("la frase del borrado nombra bien cada tipo", () => {
  const frase = (tipo: unknown, action: string) => {
    const r = ROTULOS[claveDeGrupoBorrado(tipo, action)];
    return `borró ${r.articulo} ${r.singular}`;
  };
  assert.equal(frase("CASA_DE_FE", "casa_de_fe.grupo_borrado"), "borró la Casa de Fe");
  assert.equal(
    frase("RESTAURADOS", "casa_de_fe.grupo_borrado"),
    "borró el grupo de Restaurados",
  );
  assert.equal(frase("MENTORIA", "casa_de_fe.grupo_borrado"), "borró la mentoría");
  assert.equal(frase("ALPHA", "alpha.grupo_borrado"), "borró el Alpha");
});
