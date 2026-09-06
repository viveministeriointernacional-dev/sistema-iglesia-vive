import {
  Gender,
  MilestoneKind,
  MilestoneStatus,
  Phase,
  Prisma,
} from "@iglesia/prisma-client";
import {
  ETIQUETA_ETAPA,
  ETIQUETA_HITO,
  ETIQUETA_ROL,
  fechaDeMesYAno,
  HITOS_DECLARABLES,
  mesYAnoLegible,
  ROLES_DECLARABLES,
  type DatosLiderazgo,
} from "@/lib/liderazgo-catalogo";
import { auditar } from "@/lib/audit";
import { exportarDatosPersona } from "@/lib/highlevel-salida";
import { colaDeTelefono, nombreCompleto } from "@/lib/dominio";
import type { ClientePrisma } from "@/lib/prisma";

export * from "@/lib/liderazgo-catalogo";

/// Formulario público «Actualiza tus datos», para el liderazgo de la iglesia.
///
/// Tres reglas de fondo, decididas con el usuario el 4-sep-2026:
///
/// 1. **La llave es el celular.** Con él se busca la ficha: si existe se
///    actualiza, si no existe se crea. Sin código de verificación (el usuario
///    lo consideró innecesario), igual que los otros tres formularios públicos.
/// 2. **Quien llega nuevo NO entra a consolidación.** Un líder no es una
///    persona por consolidar: su ficha nace sin Operación 72 y sin
///    consolidador, directamente en la etapa que declaró.
/// 3. **El formulario no otorga nada.** Lo que la persona dice que hace, y un
///    cambio de etapa sobre una ficha que ya existía, quedan como
///    `LeadershipDeclaration` en PENDIENTE hasta que un administrador lo
///    confirme. Si no fuera así, cualquiera con el enlace se haría pastor.

export type HitoGuardado = { etiqueta: string; cuando: string | null };

export type ResultadoLiderazgo =
  | {
      ok: true;
      creada: boolean;
      nombre: string;
      cambios: { rotulo: string; valor: string }[];
      hitos: HitoGuardado[];
      rolesDeclarados: string[];
      etapaPendiente: string | null;
      etapaAplicada: string | null;
    }
  | { ok: false; mensaje: string };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Guarda lo que llenó una persona del liderazgo. Todo dentro de una sola
/// transacción: o queda completo, o no queda nada.
export async function guardarActualizacionDeLiderazgo(
  prisma: ClientePrisma,
  datos: DatosLiderazgo,
): Promise<ResultadoLiderazgo> {
  const cola = colaDeTelefono(datos.callPhone);
  if (!cola || cola.length < 10) {
    return {
      ok: false,
      mensaje: "Escribe tu celular completo, con los 10 dígitos.",
    };
  }
  if (!datos.firstName.trim()) {
    return { ok: false, mensaje: "Necesitamos al menos tu nombre." };
  }
  const correo = datos.email.trim();
  if (correo && !CORREO.test(correo)) {
    return { ok: false, mensaje: "Ese correo no parece estar bien escrito." };
  }
  if (datos.birthDate && Number.isNaN(Date.parse(datos.birthDate))) {
    return { ok: false, mensaje: "La fecha de nacimiento no es válida." };
  }
  if (!datos.phase) {
    return { ok: false, mensaje: "Dinos en qué etapa estás." };
  }
  const fase: Phase = datos.phase;

  const roles = datos.roles.filter((rol) =>
    ROLES_DECLARABLES.some((r) => r.valor === rol),
  );

  // Cada hito marcado, con su fecha si la recordó. Un hito sin fecha se guarda
  // igual: saber que la persona ya hizo el Encuentro vale, aunque no sepamos
  // cuándo.
  const hitos = datos.hitos
    .filter((hito) =>
      HITOS_DECLARABLES.some((h) => h.kind === hito.kind && hito.hecho),
    )
    .map((hito) => ({
      kind: hito.kind,
      achievedAt: fechaDeMesYAno(hito.mes, hito.ano),
    }));

  const candidatas = await prisma.person.findMany({
    where: {
      OR: [
        { callPhone: { endsWith: cola } },
        { whatsappPhone: { endsWith: cola } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthDate: true,
      whatsappPhone: true,
      email: true,
      address: true,
      learnerProfile: { select: { id: true, phase: true } },
    },
  });

  // Dos fichas con el mismo número: no se adivina cuál es. Antes que escribir
  // sobre la persona equivocada, se para y se avisa.
  if (candidatas.length > 1) {
    return {
      ok: false,
      mensaje:
        "Encontramos más de una ficha con ese celular. Avísale al equipo de la iglesia para que lo revisen: no queremos escribir sobre los datos de otra persona.",
    };
  }

  const existente = candidatas[0] ?? null;
  const cambios: { rotulo: string; valor: string }[] = [];

  const guardado = await prisma.$transaction(
    async (tx) => {
      let personId: string;
      let learnerId: string;
      let etapaAplicada: string | null = null;
      let etapaPendiente: string | null = null;

      if (existente) {
        // Ficha que ya existía: solo se pisa lo que la persona escribió. Un
        // campo que dejó en blanco NO borra lo que ya estaba.
        const datosNuevos: Prisma.PersonUpdateInput = {};
        const apunta = (rotulo: string, valor: string) =>
          cambios.push({ rotulo, valor });

        const nombre = datos.firstName.trim();
        const apellido = datos.lastName.trim();
        if (nombre && nombre !== existente.firstName) {
          datosNuevos.firstName = nombre;
          apunta("NOMBRE", nombre);
        }
        if (apellido && apellido !== (existente.lastName ?? "")) {
          datosNuevos.lastName = apellido;
          apunta("APELLIDOS", apellido);
        }
        if (datos.gender && datos.gender !== existente.gender) {
          datosNuevos.gender = datos.gender as Gender;
        }
        if (datos.birthDate) {
          const fecha = new Date(datos.birthDate);
          if (existente.birthDate?.getTime() !== fecha.getTime()) {
            datosNuevos.birthDate = fecha;
            apunta("NACIMIENTO", datos.birthDate);
          }
        }
        const whatsapp = datos.whatsappPhone.trim();
        if (whatsapp && whatsapp !== (existente.whatsappPhone ?? "")) {
          datosNuevos.whatsappPhone = whatsapp;
          apunta("WHATSAPP", whatsapp);
        }
        if (correo && correo !== (existente.email ?? "")) {
          datosNuevos.email = correo;
          apunta("CORREO", correo);
        }
        const direccion = datos.address.trim();
        if (direccion && direccion !== (existente.address ?? "")) {
          datosNuevos.address = direccion;
          apunta("DIRECCIÓN", direccion);
        }
        if (Object.keys(datosNuevos).length) {
          await tx.person.update({
            where: { id: existente.id },
            data: datosNuevos,
          });
        }

        personId = existente.id;

        // Alguien del equipo puede tener ficha sin expediente. Se le crea uno
        // para que sus hitos tengan dónde vivir.
        if (existente.learnerProfile) {
          learnerId = existente.learnerProfile.id;
          // Cambiar de fase deja rastro en `phase_change`, que exige un
          // responsable humano. Así que aquí no se cambia sola: espera a que un
          // administrador la confirme.
          if (existente.learnerProfile.phase !== fase) {
            etapaPendiente = ETIQUETA_ETAPA[fase] ?? fase;
          }
        } else {
          const perfil = await tx.learnerProfile.create({
            data: { personId, phase: fase },
            select: { id: true },
          });
          learnerId = perfil.id;
          etapaAplicada = ETIQUETA_ETAPA[fase] ?? fase;
        }
      } else {
        // Nadie con ese número: se le crea la ficha. Sin Operación 72 y sin
        // consolidador — un líder no entra a consolidación.
        const persona = await tx.person.create({
          data: {
            firstName: datos.firstName.trim(),
            lastName: datos.lastName.trim() || null,
            gender: (datos.gender || null) as Gender | null,
            birthDate: datos.birthDate ? new Date(datos.birthDate) : null,
            callPhone: datos.callPhone.trim(),
            whatsappPhone: datos.whatsappPhone.trim() || null,
            email: correo || null,
            address: datos.address.trim() || null,
            prayerRequest: datos.prayerRequest.trim() || null,
          },
          select: { id: true },
        });
        const perfil = await tx.learnerProfile.create({
          data: { personId: persona.id, phase: fase },
          select: { id: true },
        });
        personId = persona.id;
        learnerId = perfil.id;
        etapaAplicada = ETIQUETA_ETAPA[fase] ?? fase;

        await tx.milestone.create({
          data: {
            learnerId,
            kind: MilestoneKind.REGISTRO,
            status: MilestoneStatus.COMPLETADO,
            achievedAt: new Date(),
            detail: "Se registró desde el formulario de liderazgo",
          },
        });
      }

      // La petición de oración se suma, no reemplaza: lo que escribió hoy no
      // borra lo que pidió hace un año.
      const peticion = datos.prayerRequest.trim();
      if (peticion && existente) {
        await tx.person.update({
          where: { id: personId },
          data: { prayerRequest: peticion },
        });
        cambios.push({ rotulo: "PETICIÓN DE ORACIÓN", valor: peticion });
      }

      const hitosGuardados: HitoGuardado[] = [];
      for (const hito of hitos) {
        const anterior = await tx.milestone.findUnique({
          where: { learnerId_kind: { learnerId, kind: hito.kind } },
          select: { id: true, achievedAt: true, status: true },
        });

        // Un hito que ya estaba con fecha no se pisa con uno sin fecha: el dato
        // más preciso gana.
        if (
          anterior &&
          anterior.status === MilestoneStatus.COMPLETADO &&
          anterior.achievedAt &&
          !hito.achievedAt
        ) {
          continue;
        }

        await tx.milestone.upsert({
          where: { learnerId_kind: { learnerId, kind: hito.kind } },
          create: {
            learnerId,
            kind: hito.kind,
            status: MilestoneStatus.COMPLETADO,
            achievedAt: hito.achievedAt,
            detail: hito.achievedAt
              ? "Lo declaró la persona"
              : "Lo declaró la persona · no recordaba la fecha",
          },
          update: {
            status: MilestoneStatus.COMPLETADO,
            achievedAt: hito.achievedAt,
            detail: hito.achievedAt
              ? "Lo declaró la persona"
              : "Lo declaró la persona · no recordaba la fecha",
          },
        });

        hitosGuardados.push({
          etiqueta: ETIQUETA_HITO[hito.kind] ?? hito.kind,
          cuando: hito.achievedAt ? mesYAnoLegible(hito.achievedAt) : null,
        });
      }

      // Lo que dice que hace, y la etapa que no se pudo aplicar sola, quedan
      // pendientes de que un administrador los confirme.
      if (roles.length || etapaPendiente) {
        await tx.leadershipDeclaration.create({
          data: {
            personId,
            roles,
            declaredPhase: etapaPendiente ? fase : null,
            note: datos.prayerRequest.trim() || null,
          },
        });
      }

      const nombre = nombreCompleto({
        firstName: datos.firstName.trim(),
        lastName: datos.lastName.trim() || null,
      });

      await auditar(tx, {
        actorId: null,
        action: "liderazgo.datos_actualizados",
        entityType: "person",
        entityId: personId,
        metadata: {
          creada: !existente,
          nombre,
          cambios: cambios.map((c) => c.rotulo),
          hitos: hitosGuardados.map((h) =>
            h.cuando ? `${h.etiqueta} · ${h.cuando}` : `${h.etiqueta} · sin fecha`,
          ),
          rolesDeclarados: roles,
          etapaAplicada,
          etapaPendiente,
        },
      });

      return {
        ok: true as const,
        creada: !existente,
        nombre,
        cambios,
        hitos: hitosGuardados,
        rolesDeclarados: roles.map((rol) => ETIQUETA_ROL[rol] ?? rol),
        etapaPendiente,
        etapaAplicada,
        learnerId,
      };
    },
    { timeout: 30_000, maxWait: 15_000 },
  );

  // El liderazgo también entra al CRM (decisión del usuario, 5-sep-2026): si la
  // persona ya tiene contacto se le actualizan los datos, y si no lo tiene se le
  // crea. `exportarDatosPersona` hace las dos cosas — crea el contacto cuando no
  // hay enlace todavía.
  //
  // Va **fuera** de la transacción a propósito: es una llamada de red, y
  // sostenerla dentro dejaría ocupada la única conexión de base de datos que
  // tiene la petición. Y es best-effort, como todas las exportaciones: si el CRM
  // falla, lo que se guardó en el sistema queda igual.
  //
  // Los hitos y la etapa NO se exportan: no existen en HighLevel.
  const { learnerId: _learnerId, ...resultado } = guardado;
  await exportarDatosPersona(_learnerId).catch((error) => {
    console.error("No se pudo reflejar el registro de liderazgo en HighLevel", error);
  });

  return resultado;
}

export type ResultadoResolucion =
  | { ok: true; aplicado: string[] }
  | { ok: false; mensaje: string };

/// Un administrador resuelve una declaración pendiente: **confirmar** aplica de
/// verdad lo que la persona dijo, **descartar** la archiva sin tocar nada.
///
/// Al confirmar se hacen dos cosas que el formulario no podía hacer solo:
/// 1. **Los permisos** (`can_lead_alpha`, `can_lead_faith_house`, `can_mentor`),
///    y solo si la persona tiene cuenta en el sistema: sin cuenta no hay a qué
///    ponérselos, y se avisa.
/// 2. **La etapa**, con su `PhaseChange` — ahora sí hay un responsable humano
///    que lo respalda, que es justo lo que faltaba para poder aplicarla.
export async function resolverDeclaracion(
  prisma: ClientePrisma,
  entrada: { declaracionId: string; actorId: string; confirmar: boolean },
): Promise<ResultadoResolucion> {
  const declaracion = await prisma.leadershipDeclaration.findUnique({
    where: { id: entrada.declaracionId },
    select: {
      id: true,
      status: true,
      roles: true,
      declaredPhase: true,
      person: {
        select: {
          id: true,
          user: { select: { id: true } },
          learnerProfile: { select: { id: true, phase: true } },
        },
      },
    },
  });
  if (!declaracion) {
    return { ok: false, mensaje: "Esa declaración ya no existe." };
  }
  if (declaracion.status !== "PENDIENTE") {
    return { ok: false, mensaje: "Esa declaración ya fue resuelta." };
  }

  if (!entrada.confirmar) {
    await prisma.leadershipDeclaration.update({
      where: { id: declaracion.id },
      data: {
        status: "DESCARTADA",
        reviewedById: entrada.actorId,
        reviewedAt: new Date(),
      },
    });
    await auditar(prisma, {
      actorId: entrada.actorId,
      action: "liderazgo.declaracion_descartada",
      entityType: "person",
      entityId: declaracion.person.id,
      metadata: { roles: declaracion.roles },
    });
    return { ok: true, aplicado: [] };
  }

  const aplicado: string[] = [];

  const permisos = declaracion.roles
    .map((rol) => ROLES_DECLARABLES.find((r) => r.valor === rol)?.permiso)
    .filter((permiso): permiso is NonNullable<typeof permiso> =>
      Boolean(permiso),
    );

  if (permisos.length) {
    if (declaracion.person.user) {
      await prisma.appUser.update({
        where: { id: declaracion.person.user.id },
        data: Object.fromEntries(permisos.map((permiso) => [permiso, true])),
      });
      aplicado.push(...permisos);
    } else {
      // Sin cuenta no hay dónde poner los permisos. No es un fallo: se confirma
      // lo demás y se avisa, para que quien administra le cree el acceso.
      aplicado.push("sin_cuenta");
    }
  }

  const aprendiz = declaracion.person.learnerProfile;
  if (
    declaracion.declaredPhase &&
    aprendiz &&
    aprendiz.phase !== declaracion.declaredPhase
  ) {
    await prisma.phaseChange.create({
      data: {
        learnerId: aprendiz.id,
        fromPhase: aprendiz.phase,
        toPhase: declaracion.declaredPhase,
        decidedById: entrada.actorId,
        note: "Confirmado desde el formulario de liderazgo",
      },
    });
    await prisma.learnerProfile.update({
      where: { id: aprendiz.id },
      data: { phase: declaracion.declaredPhase, phaseStartedAt: new Date() },
    });
    aplicado.push(`etapa:${declaracion.declaredPhase}`);
  }

  await prisma.leadershipDeclaration.update({
    where: { id: declaracion.id },
    data: {
      status: "CONFIRMADA",
      reviewedById: entrada.actorId,
      reviewedAt: new Date(),
    },
  });

  await auditar(prisma, {
    actorId: entrada.actorId,
    action: "liderazgo.declaracion_confirmada",
    entityType: "person",
    entityId: declaracion.person.id,
    metadata: { roles: declaracion.roles, aplicado },
  });

  return { ok: true, aplicado };
}
