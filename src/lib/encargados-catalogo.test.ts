import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidatosDisponibles,
  encargadosTrasCambiarLider,
  paraPermiso,
  quienesLoLlevan,
  type GrupoParaPermiso,
} from "./encargados-catalogo";

/// El caso real que motivó todo esto: «Casa de Fe Joiner & Maria Isabel», que
/// la pareja lleva junta y el sistema solo sabía anotar a nombre de uno.
const CASA: GrupoParaPermiso = {
  leaderId: "joiner",
  createdById: "juanfelipe",
  coLeaderIds: ["maria-isabel"],
};

test("quienes la llevan: el líder primero, luego los encargados", () => {
  assert.deepEqual(quienesLoLlevan(CASA), ["joiner", "maria-isabel"]);
});

test("un grupo sin encargados lo lleva solo su líder", () => {
  assert.deepEqual(
    quienesLoLlevan({ leaderId: "lucero", coLeaderIds: [] }),
    ["lucero"],
  );
});

test("al cambiar de líder, el saliente queda de encargado", () => {
  // Decisión del usuario (21-sep-2026): pasar la batuta no le quita la casa a
  // quien la venía llevando.
  const despues = encargadosTrasCambiarLider(CASA, "maria-isabel");
  assert.ok(despues.includes("joiner"), "el líder saliente tiene que quedar");
});

test("⚠️ el líder NUEVO deja de ser encargado, o quedaría dos veces", () => {
  // Si no, la ficha lo pintaría en los dos renglones y el índice único de la
  // base rechazaría el INSERT con un error que no le dice nada a nadie.
  const despues = encargadosTrasCambiarLider(CASA, "maria-isabel");
  assert.ok(
    !despues.includes("maria-isabel"),
    "quien pasa a líder no puede seguir de encargado",
  );
  assert.deepEqual(despues, ["joiner"]);
});

test("⚠️ nadie se repite en la lista de encargados", () => {
  const conRepetido: GrupoParaPermiso = {
    leaderId: "joiner",
    coLeaderIds: ["ana", "ana", "beto"],
  };
  const despues = encargadosTrasCambiarLider(conRepetido, "beto");
  assert.deepEqual(despues, ["ana", "joiner"]);
});

test("cambiar a un líder de fuera conserva a los encargados que ya había", () => {
  const despues = encargadosTrasCambiarLider(CASA, "harold");
  assert.deepEqual(despues, ["maria-isabel", "joiner"]);
});

test("⚠️ el buscador no ofrece a quien ya lleva el grupo", () => {
  // Sin este descarte el botón «Añadir» aparecería sobre alguien que ya está,
  // y el índice único lo rechazaría sin explicar por qué.
  const candidatos = [
    { id: "joiner" },
    { id: "maria-isabel" },
    { id: "harold" },
  ];
  assert.deepEqual(candidatosDisponibles(candidatos, CASA), [{ id: "harold" }]);
});

test("quien ABRIÓ el grupo sí puede ofrecerse como encargado", () => {
  // `createdById` da permiso de administrar, pero no es «llevar el grupo»: si
  // se descartara, Juan Felipe —que abrió 7 de las 16 casas— no podría
  // figurar como encargado de ninguna.
  const candidatos = [{ id: "juanfelipe" }];
  assert.deepEqual(candidatosDisponibles(candidatos, CASA), [{ id: "juanfelipe" }]);
});

test("paraPermiso traduce la fila de la base a lo que pide el permiso", () => {
  const deLaBase = {
    leaderId: "joiner",
    createdById: null,
    coLeaders: [{ userId: "maria-isabel" }, { userId: "harold" }],
  };
  assert.deepEqual(paraPermiso(deLaBase), {
    leaderId: "joiner",
    createdById: null,
    coLeaderIds: ["maria-isabel", "harold"],
  });
});

test("un grupo recién abierto traduce a una lista de encargados vacía", () => {
  assert.deepEqual(paraPermiso({ leaderId: "lucero", coLeaders: [] }).coLeaderIds, []);
});
