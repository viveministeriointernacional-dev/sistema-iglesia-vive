import assert from "node:assert/strict";
import test from "node:test";
import {
  CallSchedule,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";
import { normalizarPayloadHighLevel } from "./highlevel";

test("normaliza el cuerpo canónico del webhook", () => {
  const resultado = normalizarPayloadHighLevel({
    contactId: "contacto-1",
    locationId: "ubicacion-1",
    formId: "formulario-1",
    submissionId: "envio-1",
    firstName: "Ana María",
    lastName: "Pérez",
    email: "ANA@EJEMPLO.COM",
    phone: "+57 311 555 4433",
    gender: "Mujer",
    callSchedules: "mañana,noche",
    entryPoint: "Servicio dominical",
    invitationKind: "Persona",
  });

  assert.equal(resultado.contexto.contactId, "contacto-1");
  assert.equal(resultado.datos.firstName, "Ana María");
  assert.equal(resultado.datos.email, "ana@ejemplo.com");
  assert.equal(resultado.datos.gender, Gender.MUJER);
  assert.deepEqual(resultado.datos.callSchedules, [
    CallSchedule.MANANA,
    CallSchedule.NOCHE,
  ]);
  assert.equal(resultado.datos.entryPoint, EntryPoint.SERVICIO_DOMINICAL);
  assert.equal(resultado.datos.invitationKind, InvitationKind.PERSONA);
});

test("acepta campos personalizados habituales en español", () => {
  const resultado = normalizarPayloadHighLevel({
    contact: {
      id: "ignorado-como-id-generico",
      customFields: [
        { name: "Petición de oración", value: "Por mi familia" },
        { key: "¿Cómo llegó?", field_value: "Redes sociales" },
      ],
    },
    customData: {
      contact_id: "contacto-2",
      location_id: "ubicacion-1",
      nombre: "Luis",
      telefono: "3001234567",
    },
  });

  assert.equal(resultado.contexto.contactId, "contacto-2");
  assert.equal(resultado.datos.firstName, "Luis");
  assert.equal(resultado.datos.prayerRequest, "Por mi familia");
  assert.equal(resultado.datos.entryPoint, EntryPoint.REDES_SOCIALES);
});

test("rechaza envíos sin identidad estable de HighLevel", () => {
  assert.throws(() =>
    normalizarPayloadHighLevel({
      locationId: "ubicacion-1",
      firstName: "Sin contacto",
    }),
  );
});
