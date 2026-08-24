import assert from "node:assert/strict";
import test from "node:test";
import { esquemaRegistroPublico } from "./registro-publico";

const base = {
  firstName: "Ana",
  lastName: "Pérez",
  callPhone: "3001234567",
  whatsappPhone: "",
  email: "",
  callSchedules: [],
  aceptaPrivacidad: true as const,
  sitioWeb: "",
};

test("acepta un autorregistro con un medio de contacto", () => {
  const resultado = esquemaRegistroPublico.parse(base);
  assert.equal(resultado.firstName, "Ana");
  assert.equal(resultado.callPhone, "3001234567");
});

test("exige un medio de contacto", () => {
  const resultado = esquemaRegistroPublico.safeParse({
    ...base,
    callPhone: "",
  });
  assert.equal(resultado.success, false);
});

test("exige consentimiento y rechaza el campo trampa", () => {
  assert.equal(
    esquemaRegistroPublico.safeParse({ ...base, aceptaPrivacidad: false })
      .success,
    false,
  );
  assert.equal(
    esquemaRegistroPublico.safeParse({ ...base, sitioWeb: "spam.example" })
      .success,
    false,
  );
});
