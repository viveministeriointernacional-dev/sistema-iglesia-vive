import assert from "node:assert/strict";
import test from "node:test";
import {
  comoSeLlama,
  GRUPO_VACIO,
  type LoQueTieneElGrupo,
  loQueSeBorra,
  loQueSeQueda,
  nombreCoincide,
} from "./borrar-grupo-catalogo";

function tiene(parcial: Partial<LoQueTieneElGrupo> = {}): LoQueTieneElGrupo {
  return { ...GRUPO_VACIO, ...parcial };
}

// ⚠️ EL CASO QUE DA LA VUELTA AL DISEÑO OBVIO. La única casa que el 22-oct es
// claramente una prueba («Casa de Fe Prueba») TIENE una persona dentro, así que
// un «borrar solo si está vacío» habría rechazado justo la que hay que borrar.
// Lo que protege es decir qué desaparece, no un guarda.
test("con gente dentro se puede borrar, y se dice quién queda fuera", () => {
  const lineas = loQueSeBorra("casa-de-fe", tiene({ personas: ["Juan Felipe Carvajal"] }));
  assert.ok(lineas[0].includes("Juan Felipe Carvajal"));
  assert.ok(lineas[0].startsWith("1 persona"), lineas[0]);
});

test("los nombres van enteros, no como un número", () => {
  const lineas = loQueSeBorra("alpha", tiene({ personas: ["Camila Pascuas", "Camilo Pascuas"] }));
  assert.ok(lineas[0].includes("Camila Pascuas, Camilo Pascuas"));
  assert.ok(lineas[0].includes("2 personas inscritas"));
});

// ⚠️ La consecuencia que no se ve en el esquema: el permiso de revisar el
// taller se lo da al líder la PERTENENCIA al grupo (`puedeRevisarElTaller`).
test("con gente dentro se avisa que el líder pierde la revisión del taller", () => {
  assert.ok(
    loQueSeBorra("casa-de-fe", tiene({ personas: ["Ana"] })).some((l) =>
      l.includes("revisarles el taller"),
    ),
  );
  // En Alpha no, que ahí no hay taller que revisar.
  assert.ok(
    !loQueSeBorra("alpha", tiene({ personas: ["Ana"] })).some((l) =>
      l.includes("revisarles el taller"),
    ),
  );
  // Y sin nadie dentro tampoco: no hay a quién dejar de revisar.
  assert.ok(
    !loQueSeBorra("casa-de-fe", tiene()).some((l) => l.includes("revisarles el taller")),
  );
});

test("un grupo vacío solo pierde su día, su hora y su sitio en la lista", () => {
  const lineas = loQueSeBorra("casa-de-fe", tiene());
  assert.equal(lineas.length, 1);
  assert.ok(lineas[0].includes("El día, la hora y la dirección"));
});

// Lo que quita el miedo, y es lo que está comprobado en las claves ajenas: el
// taller, el código y el enlace cuelgan del APRENDIZ, no del grupo.
test("si hay gente, lo primero que se promete es que el expediente no se toca", () => {
  const queda = loQueSeQueda("casa-de-fe", tiene({ personas: ["Ana López"] }));
  assert.ok(queda[0].includes("expediente"));
  assert.ok(queda[0].includes("taller"));
  // ⚠️ Y en Alpha NO se nombra el taller: los 12 temas son de Casa de Fe, y
  // nombrarlos ahí hace creer que se pierden.
  const alpha = loQueSeQueda("alpha", tiene({ personas: ["Ana López"] }));
  assert.ok(alpha[0].includes("expediente"));
  assert.ok(!alpha[0].includes("taller"));
});

// Las tres faltas que solo se vieron al dibujar la ventana con datos de verdad.
test("concordancia y preposiciones: ni «1 persona quedan» ni «de el Alpha»", () => {
  const una = loQueSeBorra("casa-de-fe", tiene({ personas: ["Juan Felipe Carvajal"] }));
  assert.ok(una[0].includes("1 persona queda fuera"), una[0]);
  for (const clase of ["alpha", "casa-de-fe"] as const) {
    for (const linea of loQueSeBorra(clase, tiene({ personas: ["Ana"], sesiones: 2 }))) {
      assert.ok(!/\bde el\b/.test(linea), linea);
      assert.ok(!/quedan fuera de (esta|este)[^:]*: Ana\./.test(linea), linea);
    }
  }
});

test("en Alpha se dice además que el Focus Day y la validación siguen como hito", () => {
  const queda = loQueSeQueda("alpha", tiene({ personas: ["Ana López"] }));
  assert.ok(queda.some((l) => l.includes("Focus Day")));
  // Y en Casa de Fe no se nombra, que ahí no existe.
  assert.ok(!loQueSeQueda("casa-de-fe", tiene({ personas: ["Ana"] })).some((l) => l.includes("Focus Day")));
});

test("la auditoría se promete siempre, también con el grupo vacío", () => {
  for (const clase of ["alpha", "casa-de-fe"] as const) {
    assert.ok(loQueSeQueda(clase, tiene()).some((l) => l.includes("auditoría")));
  }
});

// La nota de validación es lo ÚNICO del recorrido de Alpha que no está también
// en el hito del expediente, así que es lo único que de verdad se pierde: tiene
// que decirse, y no decirse cuando no hay ninguna.
test("la nota del líder se avisa solo si existe", () => {
  assert.ok(
    loQueSeBorra("alpha", tiene({ personas: ["Ana"], notasDeValidacion: 1 })).some((l) =>
      l.includes("la nota no"),
    ),
  );
  assert.ok(
    !loQueSeBorra("alpha", tiene({ personas: ["Ana"] })).some((l) => l.includes("la nota no")),
  );
});

test("las sesiones y la asistencia se cuentan juntas, y la asistencia sola también se dice", () => {
  assert.ok(
    loQueSeBorra("alpha", tiene({ sesiones: 2, asistencias: 4 })).some(
      (l) => l.includes("2 sesiones") && l.includes("4 marcas"),
    ),
  );
  // Hay 4 asistencias en un Alpha con 2 sesiones (Alpha Norte) y 0 sesiones en
  // otros cuatro: las dos ramas pasan de verdad.
  assert.ok(
    loQueSeBorra("alpha", tiene({ asistencias: 4 })).some((l) =>
      l.startsWith("La asistencia tomada"),
    ),
  );
});

// ⚠️ Los nombres los teclea el equipo: hay «Casa de Fe -  Saira Leyton» con dos
// espacios seguidos y «casa de fe Jesica Paula Lopez» en minúscula. Exigir el
// byte exacto sería pedirle al líder que adivine un espacio que no se ve.
test("el nombre se compara sin tildes, sin mayúsculas y sin espacios de más", () => {
  assert.ok(nombreCoincide("casa de fe prueba", "Casa de Fe Prueba"));
  assert.ok(nombreCoincide("  Casa de Fe   Prueba ", "Casa de Fe Prueba"));
  assert.ok(nombreCoincide("Casa de Fe -  Saira Leyton", "Casa de Fe -  Saira Leyton"));
  assert.ok(nombreCoincide("Casa de Fe - Saira Leyton", "Casa de Fe -  Saira Leyton"));
  assert.ok(nombreCoincide("CASA DE FE GRUPAL SUR", "Casa de Fe Grupal Sur"));
});

// Y lo que NO puede pasar: que escribir cualquier cosa borre el grupo. Probar
// al revés es lo que hace valer la prueba (§12.8).
test("un nombre que no es el del grupo no confirma nada", () => {
  assert.ok(!nombreCoincide("", "Casa de Fe Prueba"));
  assert.ok(!nombreCoincide("   ", "Casa de Fe Prueba"));
  assert.ok(!nombreCoincide("Casa de Fe", "Casa de Fe Prueba"));
  assert.ok(!nombreCoincide("Casa de Fe Prueba 2", "Casa de Fe Prueba"));
  // El de al lado, que es el error de verdad.
  assert.ok(!nombreCoincide("JULIAN LOPEZ", "DIANA MONJE"));
  // Y un grupo sin nombre no se borra escribiendo nada.
  assert.ok(!nombreCoincide("", ""));
});

test("cada clase se nombra como la nombra el equipo", () => {
  assert.equal(comoSeLlama("casa-de-fe").el, "la Casa de Fe");
  assert.equal(comoSeLlama("alpha").el, "el Alpha");
  assert.equal(comoSeLlama("alpha").miembros.varios, "personas inscritas");
});
