import assert from "node:assert/strict";
import test from "node:test";
import {
  CallSchedule,
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";
import { esquemaRegistroPublico } from "./registro-publico";

const base = {
  firstName: "Ana",
  lastName: "Pérez",
  gender: Gender.MUJER,
  birthDate: "1990-01-01",
  callPhone: "3001234567",
  whatsappPhone: "",
  email: "ana@ejemplo.com",
  callSchedules: [CallSchedule.MANANA],
  callScheduleNote: "",
  address: "Barrio Centro",
  prayerRequest: "Por mi familia",
  entryPoint: EntryPoint.SERVICIO_DOMINICAL,
  entryPointOther: "",
  churchAttendance: ChurchAttendance.IGLESIA_VIVE,
  invitationKind: InvitationKind.REDES,
  invitedByName: "",
  aceptaPrivacidad: true as const,
  sitioWeb: "",
};

test("acepta un autorregistro completo sin WhatsApp", () => {
  const resultado = esquemaRegistroPublico.parse(base);
  assert.equal(resultado.firstName, "Ana");
  assert.equal(resultado.callPhone, "3001234567");
  assert.equal(resultado.whatsappPhone, null);
});

test("exige todos los campos públicos salvo WhatsApp", () => {
  const casos: [string, unknown][] = [
    ["firstName", ""],
    ["lastName", ""],
    ["gender", null],
    ["birthDate", ""],
    ["callPhone", ""],
    ["email", ""],
    ["address", ""],
    ["prayerRequest", ""],
    ["entryPoint", null],
    ["churchAttendance", null],
    ["invitationKind", null],
  ];

  for (const [campo, valor] of casos) {
    const resultado = esquemaRegistroPublico.safeParse({
      ...base,
      [campo]: valor,
    });
    assert.equal(resultado.success, false, `${campo} debe ser obligatorio`);
  }
});

test("exige un horario seleccionado o escrito", () => {
  assert.equal(
    esquemaRegistroPublico.safeParse({
      ...base,
      callSchedules: [],
      callScheduleNote: "",
    }).success,
    false,
  );
  assert.equal(
    esquemaRegistroPublico.safeParse({
      ...base,
      callSchedules: [],
      callScheduleNote: "Después de las 7",
    }).success,
    true,
  );
});

test("exige el detalle de Otro y el nombre de quien invitó", () => {
  assert.equal(
    esquemaRegistroPublico.safeParse({
      ...base,
      entryPoint: EntryPoint.OTRO,
      entryPointOther: "",
    }).success,
    false,
  );
  assert.equal(
    esquemaRegistroPublico.safeParse({
      ...base,
      invitationKind: InvitationKind.PERSONA,
      invitedByName: "",
    }).success,
    false,
  );
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
