/**
 * Datos de arranque para desarrollo.
 *
 * Crea el equipo, los consolidadores y mentores necesarios para que la
 * asignación por género y carga funcione, los 12 temas de Casa de Fe y unas
 * personas nuevas en Operación 72 con distintos niveles de urgencia.
 *
 * Los usuarios se crean en `app_user` con su rol; la credencial vive en
 * Supabase Auth y se enlaza en el primer inicio de sesión (ver README).
 */
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CallSchedule,
  EntryPoint,
  Gender,
  InvitationKind,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  PrismaClient,
  Role,
} from "../src/generated/prisma";
import { TEMAS_CASA_DE_FE } from "../src/lib/dominio";

for (const archivo of [".env.local", ".env"]) {
  if (fs.existsSync(archivo)) process.loadEnvFile(archivo);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL: copia .env.example a .env.local.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const HORA = 3_600_000;

async function crearUsuario(datos: {
  email: string;
  fullName: string;
  role: Role;
  gender: Gender;
  teamId?: string;
  capacity?: number;
}) {
  const existente = await prisma.appUser.findUnique({
    where: { email: datos.email },
    select: { id: true },
  });
  if (existente) return existente;

  const [firstName, ...resto] = datos.fullName.split(" ");
  const persona = await prisma.person.create({
    data: {
      firstName,
      lastName: resto.join(" ") || firstName,
      gender: datos.gender,
    },
    select: { id: true },
  });

  return prisma.appUser.create({
    data: {
      email: datos.email,
      fullName: datos.fullName,
      role: datos.role,
      personId: persona.id,
      teamId: datos.teamId,
      capacity: datos.capacity ?? 12,
    },
    select: { id: true },
  });
}

async function main() {
  const equipo = await prisma.team.upsert({
    where: { name: "Equipo 12 Norte" },
    update: {},
    create: { name: "Equipo 12 Norte" },
    select: { id: true },
  });

  await crearUsuario({
    email: "viveministeriointernacional@gmail.com",
    fullName: "Administración Iglesia Vive",
    role: Role.ADMIN,
    gender: Gender.HOMBRE,
    teamId: equipo.id,
  });

  await crearUsuario({
    email: "pastor@iglesiavive.co",
    fullName: "Alejandro Ruiz",
    role: Role.PASTOR,
    gender: Gender.HOMBRE,
    teamId: equipo.id,
  });

  const consolidadora = await crearUsuario({
    email: "diana.consolidadora@iglesiavive.co",
    fullName: "Diana Marín",
    role: Role.CONSOLIDADOR,
    gender: Gender.MUJER,
    teamId: equipo.id,
  });

  const consolidador = await crearUsuario({
    email: "diego.consolidador@iglesiavive.co",
    fullName: "Diego Marín",
    role: Role.CONSOLIDADOR,
    gender: Gender.HOMBRE,
    teamId: equipo.id,
  });

  const mentora = await crearUsuario({
    email: "marta.mentora@iglesiavive.co",
    fullName: "Marta Solís",
    role: Role.MENTOR,
    gender: Gender.MUJER,
    teamId: equipo.id,
  });

  await crearUsuario({
    email: "felipe.mentor@iglesiavive.co",
    fullName: "Felipe Carvajal",
    role: Role.MENTOR,
    gender: Gender.HOMBRE,
    teamId: equipo.id,
  });

  for (const [indice, nombre] of TEMAS_CASA_DE_FE.entries()) {
    await prisma.faithHouseTopic.upsert({
      where: { number: indice + 1 },
      update: { name: nombre },
      create: { number: indice + 1, name: nombre },
    });
  }

  const mentoraPersona = await prisma.appUser.findUniqueOrThrow({
    where: { id: mentora.id },
    select: { personId: true },
  });

  const ahora = Date.now();

  const nuevas = [
    {
      firstName: "Laura",
      lastName: "Beltrán",
      gender: Gender.MUJER,
      edad: 26,
      entryPoint: EntryPoint.SERVICIO_DOMINICAL,
      invitationKind: InvitationKind.DESCONOCIDO,
      consolidatorId: consolidadora.id,
      horasRestantes: -6,
      status: Operation72Status.INICIADA,
      detail: "Sin contacto registrado · 2 intentos de llamada",
    },
    {
      firstName: "Camilo",
      lastName: "Ospina",
      gender: Gender.HOMBRE,
      edad: 31,
      entryPoint: EntryPoint.UNO_A_UNO,
      invitationKind: InvitationKind.REDES,
      consolidatorId: consolidador.id,
      horasRestantes: 56,
      status: Operation72Status.INICIADA,
      detail: "Prefiere llamadas después de 6 pm",
    },
    {
      firstName: "Yesenia",
      lastName: "Cruz",
      gender: Gender.MUJER,
      edad: 22,
      entryPoint: EntryPoint.ALPHA_CASA_DE_FE,
      invitationKind: InvitationKind.REDES,
      consolidatorId: consolidadora.id,
      horasRestantes: 9,
      status: Operation72Status.CONTACTADA,
      detail: "Llamada de 12 min · quiere visita en casa",
    },
    {
      firstName: "Marcela",
      lastName: "Ortiz",
      gender: Gender.MUJER,
      edad: 38,
      entryPoint: EntryPoint.SERVICIO_MIERCOLES,
      invitationKind: InvitationKind.DESCONOCIDO,
      consolidatorId: consolidadora.id,
      horasRestantes: 27,
      status: Operation72Status.VISITA_PENDIENTE,
      detail: "Visita mañana 5:00 pm con Diego y Marta",
    },
    {
      firstName: "Natalia",
      lastName: "Gómez",
      gender: Gender.MUJER,
      edad: 27,
      entryPoint: EntryPoint.SERVICIO_DOMINICAL,
      invitationKind: InvitationKind.PERSONA,
      invitedByPersonId: mentoraPersona.personId,
      consolidatorId: consolidadora.id,
      horasRestantes: 18,
      status: Operation72Status.LISTA_PARA_ENTREGA,
      detail: "2 llamadas · 1 visita · lista para entrega",
      proposedMentorId: mentora.id,
      proposedMentorNote: "carga 1 de 12",
    },
  ];

  for (const nueva of nuevas) {
    const yaExiste = await prisma.person.findFirst({
      where: { firstName: nueva.firstName, lastName: nueva.lastName },
      select: { id: true },
    });
    if (yaExiste) continue;

    const nacimiento = new Date();
    nacimiento.setFullYear(nacimiento.getFullYear() - nueva.edad);

    const persona = await prisma.person.create({
      data: {
        firstName: nueva.firstName,
        lastName: nueva.lastName,
        gender: nueva.gender,
        birthDate: nacimiento,
        callPhone: `+57 300 ${Math.floor(1000000 + Math.random() * 8999999)}`,
        callSchedule: CallSchedule.TARDE,
      },
      select: { id: true },
    });

    const aprendiz = await prisma.learnerProfile.create({
      data: {
        personId: persona.id,
        entryPoint: nueva.entryPoint,
        invitationKind: nueva.invitationKind,
        invitedByPersonId: nueva.invitedByPersonId ?? null,
        lineOfOrigin:
          nueva.invitationKind === InvitationKind.PERSONA ? "Marta Solís" : null,
        consolidatorId: nueva.consolidatorId,
        teamId: equipo.id,
      },
      select: { id: true },
    });

    const deadlineAt = new Date(ahora + nueva.horasRestantes * HORA);

    await prisma.operation72.create({
      data: {
        learnerId: aprendiz.id,
        status: nueva.status,
        startedAt: new Date(deadlineAt.getTime() - 72 * HORA),
        deadlineAt,
        detail: nueva.detail,
        lineKnown: nueva.invitationKind === InvitationKind.PERSONA,
        proposedMentorId: nueva.proposedMentorId ?? null,
        proposedMentorNote: nueva.proposedMentorNote ?? null,
      },
    });

    await prisma.milestone.createMany({
      data: [
        {
          learnerId: aprendiz.id,
          kind: MilestoneKind.REGISTRO,
          status: MilestoneStatus.COMPLETADO,
          achievedAt: new Date(),
        },
        {
          learnerId: aprendiz.id,
          kind: MilestoneKind.OPERACION_72,
          status: MilestoneStatus.EN_CURSO,
        },
      ],
    });
  }

  console.log("Datos de arranque listos.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
