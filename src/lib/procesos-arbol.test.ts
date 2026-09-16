import assert from "node:assert/strict";
import test from "node:test";
import { agruparPorMentor, ramaDe, type NodoDeLaRama } from "./procesos-arbol";

/// **La forma REAL del árbol de la iglesia el 16-sep-2026**, reducida a lo
/// único que importa: quién acompaña a cuántos, y cuáles de esos tienen cuenta
/// propia (los únicos que hacen que la rama siga bajando).
///
/// Las cifras que se comprueban abajo **no las calculé yo**: salen de correr un
/// `WITH RECURSIVE` contra la base. Esta prueba existe para que el recorrido en
/// memoria de `ramaDe` dé exactamente lo mismo que daría Postgres — si algún
/// día dejan de coincidir, la pantalla estaría mintiendo en la columna «su red»
/// y nadie se daría cuenta mirándola.
const ARBOL: Array<[mentor: string, directos: number, hijosConCuenta: string[]]> = [
  ["admin", 1, ["pastores"]],
  ["pastores", 19, [
    "laura", "jesus", "camilo", "felipe", "ruth",
    "cristina", "otra1", "luisAlberto", "otra2", "jairo",
  ]],
  ["felipe", 19, ["c1", "c2", "c3", "c4", "c5", "c6", "paola"]],
  ["paola", 17, ["p1", "p2"]],
  ["camilo", 10, ["juliana", "x1"]],
  ["jesus", 10, ["j1", "j2", "j3", "j4", "j5", "lucero", "j6"]],
  ["juliana", 7, ["u1", "u2"]],
  ["jairo", 1, ["yuli"]],
  ["yuli", 4, []],
  ["cristina", 3, []],
  ["ruth", 3, []],
];

/// Convierte la forma de arriba en la lista plana de personas que recibe la
/// pantalla: una fila por discípulo, con la cuenta propia cuando la tiene.
function personasDePrueba(): NodoDeLaRama[] {
  const personas: NodoDeLaRama[] = [];
  for (const [mentor, directos, conCuenta] of ARBOL) {
    for (let i = 0; i < directos; i += 1) {
      const cuenta = conCuenta[i] ?? null;
      personas.push({
        // El id del expediente es único aunque la persona tenga cuenta.
        learnerId: cuenta ? `exp-${cuenta}` : `exp-${mentor}-${i}`,
        mentorId: mentor,
        cuenta,
      });
    }
  }
  return personas;
}

test("la rama en memoria da lo mismo que el WITH RECURSIVE de la base", () => {
  const porMentor = agruparPorMentor(personasDePrueba());

  // [cuenta, directos, red, indirectos] — medido en producción el 16-sep-2026.
  const esperado: Array<[string, number, number, number]> = [
    ["admin", 1, 94, 93],
    ["pastores", 19, 93, 74],
    ["felipe", 19, 36, 17],
    ["paola", 17, 17, 0],
    ["camilo", 10, 17, 7],
    ["jesus", 10, 10, 0],
    ["juliana", 7, 7, 0],
    ["jairo", 1, 5, 4],
    ["yuli", 4, 4, 0],
    ["cristina", 3, 3, 0],
    ["ruth", 3, 3, 0],
  ];

  for (const [cuenta, directos, red, indirectos] of esperado) {
    assert.deepEqual(
      ramaDe(cuenta, porMentor),
      { directos, total: red, indirectos },
      `no cuadra la rama de ${cuenta}`,
    );
  }
});

test("quien no acompaña a nadie tiene la rama vacía", () => {
  const porMentor = agruparPorMentor(personasDePrueba());
  assert.deepEqual(ramaDe("lucero", porMentor), {
    directos: 0,
    total: 0,
    indirectos: 0,
  });
});

test("nadie se cuenta dos veces cuando dos ramas se cruzan", () => {
  // Ana acompaña a Beto y a Caro; Beto también acompaña a Caro. Caro es UNA
  // persona, así que la rama de Ana son dos, no tres.
  const porMentor = agruparPorMentor([
    { learnerId: "exp-beto", mentorId: "ana", cuenta: "beto" },
    { learnerId: "exp-caro", mentorId: "ana", cuenta: null },
    { learnerId: "exp-caro", mentorId: "beto", cuenta: null },
  ]);
  assert.deepEqual(ramaDe("ana", porMentor), {
    directos: 2,
    total: 2,
    indirectos: 0,
  });
});

test("un ciclo en los datos no cuelga el recorrido", () => {
  // Si alguien se equivoca y deja a A acompañando a B mientras B acompaña a A,
  // la pantalla tiene que seguir cargando. Sin `vistos` esto no termina nunca.
  const porMentor = agruparPorMentor([
    { learnerId: "exp-b", mentorId: "a", cuenta: "b" },
    { learnerId: "exp-a", mentorId: "b", cuenta: "a" },
  ]);
  assert.deepEqual(ramaDe("a", porMentor), {
    directos: 1,
    total: 2,
    indirectos: 1,
  });
});
