import { auditar, type AccionAuditada } from "@/lib/audit";
import { exportarDatosPersona } from "@/lib/highlevel-salida";
import type { ClientePrisma } from "@/lib/prisma";

/// Datos básicos de una persona tal como los edita el equipo. Es el mismo
/// formulario en administración y en el expediente: cambia quién puede
/// guardarlo (administrador allá; quien acompaña a la persona acá), no qué.
export type DatosPersona = {
  firstName: string;
  lastName: string;
  gender: "MUJER" | "HOMBRE" | "";
  birthDate: string;
  callPhone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  prayerRequest: string;
};

export type ResultadoGuardado = { ok: true } | { ok: false; mensaje: string };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Valida y guarda los datos de la persona, deja auditoría y los refleja en
/// HighLevel. La comprobación de permiso la hace quien llama: aquí solo se
/// escribe lo que ya se decidió que se puede escribir.
export async function actualizarDatosPersona(
  prisma: ClientePrisma,
  personId: string,
  datos: DatosPersona,
  actorId: string,
  accion: AccionAuditada,
): Promise<ResultadoGuardado> {
  if (!datos.firstName.trim()) {
    return { ok: false, mensaje: "El nombre es obligatorio." };
  }
  if (datos.email.trim() && !CORREO.test(datos.email.trim())) {
    return { ok: false, mensaje: "El correo no tiene un formato válido." };
  }
  if (datos.birthDate && Number.isNaN(Date.parse(datos.birthDate))) {
    return { ok: false, mensaje: "La fecha de nacimiento no es válida." };
  }

  const persona = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, learnerProfile: { select: { id: true } } },
  });
  if (!persona) return { ok: false, mensaje: "No se encontró la persona." };

  await prisma.person.update({
    where: { id: personId },
    data: {
      firstName: datos.firstName.trim(),
      lastName: datos.lastName.trim() || null,
      gender: datos.gender || null,
      birthDate: datos.birthDate ? new Date(datos.birthDate) : null,
      callPhone: datos.callPhone.trim() || null,
      whatsappPhone: datos.whatsappPhone.trim() || null,
      email: datos.email.trim() || null,
      address: datos.address.trim() || null,
      prayerRequest: datos.prayerRequest.trim() || null,
    },
  });

  await auditar(prisma, {
    actorId,
    action: accion,
    entityType: "person",
    entityId: personId,
  });

  // Reflejo hacia HighLevel (best-effort, fuera de la edición).
  if (persona.learnerProfile) {
    await exportarDatosPersona(persona.learnerProfile.id);
  }

  return { ok: true };
}
