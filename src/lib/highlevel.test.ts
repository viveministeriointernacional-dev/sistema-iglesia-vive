import assert from "node:assert/strict";
import test from "node:test";
import {
  CallOutcome,
  CallSchedule,
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";
import {
  normalizarPayloadHighLevel,
  normalizarSeguimientoHighLevel,
} from "./highlevel";

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
    churchAttendance: "Sí, asisto a la iglesia Vive",
    churchName: "Iglesia Vive",
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
  assert.equal(
    resultado.datos.churchAttendance,
    ChurchAttendance.IGLESIA_VIVE,
  );
  assert.equal(resultado.datos.churchName, "Iglesia Vive");
  assert.equal(resultado.datos.invitationKind, InvitationKind.PERSONA);
});

test("acepta campos personalizados habituales en español", () => {
  const resultado = normalizarPayloadHighLevel({
    contact: {
      id: "ignorado-como-id-generico",
      customFields: [
        { name: "Petición de oración", value: "Por mi familia" },
        { key: "Punto de encuentro", field_value: "Servicio Juvenil" },
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
  assert.equal(resultado.datos.entryPoint, EntryPoint.SERVICIO_JUVENIL);
});

test("rechaza envíos sin identidad estable de HighLevel", () => {
  assert.throws(() =>
    normalizarPayloadHighLevel({
      locationId: "ubicacion-1",
      firstName: "Sin contacto",
    }),
  );
});

test("el seguimiento de la línea reconoce la visita confirmada y la llamada", () => {
  const resultado = normalizarSeguimientoHighLevel({
    contactId: "contacto-9",
    locationId: "ubicacion-1",
    formName: "Registro Visita",
    phone: "+57 313 452 1673",
    email: "{{contact.email}}",
    "Confirmación de visita": "Sí, confirmada",
    "Fecha visita": "2026-08-29T16:00:00-05:00",
    "Estado Primera Llamada Linea": "Contestó bien",
    "Observación Primera LLamada Linea": "Quedó en venir el sábado.",
  });

  assert.equal(resultado.contexto.contactId, "contacto-9");
  assert.equal(resultado.contexto.phone, "+57 313 452 1673");
  // Un merge-tag sin resolver no es un correo.
  assert.equal(resultado.contexto.email, null);
  assert.equal(resultado.visita.confirmacion, "confirmada");
  assert.equal(resultado.visita.estadoLinea, CallOutcome.CONTESTO_BIEN);
  assert.equal(resultado.visita.observacionLinea, "Quedó en venir el sábado.");
});

test("el seguimiento exige saber de qué contacto se trata", () => {
  assert.throws(() =>
    normalizarSeguimientoHighLevel({ "Confirmación de visita": "Sí" }),
  );
});
