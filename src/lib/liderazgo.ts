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

  const CAMPOS_FICHA = {
    id: true,
    firstName: true,
    lastName: true,
    gender: true,
    birthDate: true,
    whatsappPhone: true,
    email: true,
    address: true,
    learnerProfile: { select: { id: true, phase: true } },
  } as const;

  // **Primero por el celular**, que es la llave de siempre.
  let candidatas = await prisma.person.findMany({
    where: {
      OR: [
        { callPhone: { endsWith: cola } },
        { whatsappPhone: { endsWith: cola } },
      ],
    },
    select: CAMPOS_FICHA,
  });
  let porCorreo = false;

  // **Si el celular no la encuentra, por CORREO + FECHA DE NACIMIENTO**
  // (decisión del usuario, 7-sep-2026). Nació de un caso real: Emelin Parra
  // escribió un celular distinto al que tenía registrado y el formulario le
  // creó una ficha nueva en vez de actualizar la suya — el correo que puso era
  // justo el de su cuenta.
  //
  // **Los DOS datos son obligatorios, y ese es el punto.** Solo por correo sería
  // peligroso: hay fichas con el correo de otra persona (la de Cristina Ramírez
  // tiene el de Nini Guerrón, ver CLAUDE.md §8), así que Nini llenando el
  // formulario habría escrito encima de la ficha de Cristina. Que además
  // coincida la fecha de nacimiento hace eso prácticamente imposible.
  if (candidatas.length === 0 && correo && datos.birthDate) {
    const nacimiento = new Date(datos.birthDate);
    candidatas = await prisma.person.findMany({
      where: {
        email: { equals: correo, mode: "insensitive" },
        birthDate: nacimiento,
      },
      select: CAMPOS_FICHA,
    });
    porCorreo = candidatas.length > 0;
  }

  // Dos fichas que casan: no se adivina cuál es. Antes que escribir sobre la
  // persona equivocada, se para y se avisa.
  if (candidatas.length > 1) {
    return {
      ok: false,
      mensaje: porCorreo
        ? "Encontramos más de una ficha con ese correo. Avísale al equipo de la iglesia para que lo revisen: no queremos escribir sobre los datos de otra persona."
        : "Encontramos más de una ficha con ese celular. Avísale al equipo de la iglesia para que lo revisen: no queremos escribir sobre los datos de otra persona.",
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
        // Si la encontramos por correo, el celular que escribió es distinto al
        // que tenía la ficha. Manda el que acaba de escribir: es con el que
        // pide que la llamen hoy.
        if (porCorreo) {
          datosNuevos.callPhone = datos.callPhone.trim();
          apunta("CELULAR", datos.callPhone.trim());
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

      // **Los hitos ya NO se escriben solos** (cambio del 7-sep-2026, pedido por
      // el usuario). Antes un «me gradué de la Escuela» entraba al expediente
      // sin que nadie lo revisara, que es justo lo que la regla 3 de arriba
      // dice que el formulario no debe hacer. Ahora esperan como renglones.
      const hitosGuardados: HitoGuardado[] = [];
      const hitosPendientes: { kind: MilestoneKind; achievedAt: Date | null }[] = [];
      for (const hito of hitos) {
        const anterior = await tx.milestone.findUnique({
          where: { learnerId_kind: { learnerId, kind: hito.kind } },
          select: { achievedAt: true, status: true },
        });

        // Nada que revisar cuando el hito ya está completo y la persona no
        // aporta una fecha mejor: el dato más preciso ya está guardado.
        if (
          anterior &&
          anterior.status === MilestoneStatus.COMPLETADO &&
          (!hito.achievedAt ||
            anterior.achievedAt?.getTime() === hito.achievedAt.getTime())
        ) {
          continue;
        }

        hitosPendientes.push(hito);
        hitosGuardados.push({
          etiqueta: ETIQUETA_HITO[hito.kind] ?? hito.kind,
          cuando: hito.achievedAt ? mesYAnoLegible(hito.achievedAt) : null,
        });
      }

      // Lo que dice que hace, la etapa que no se pudo aplicar sola y los hitos
      // quedan pendientes de que un administrador los confirme —
      // **cada uno por su cuenta**, en `items`.
      if (roles.length || etapaPendiente || hitosPendientes.length) {
        // Lo que dice hoy manda sobre lo que dijo el mes pasado: la anterior
        // deja de esperar. Si no, se quedaría pendiente para siempre — la
        // pantalla solo muestra la más reciente.
        await tx.leadershipDeclaration.updateMany({
          where: { personId, status: "PENDIENTE" },
          data: { status: "REEMPLAZADA" },
        });
        await tx.leadershipDeclaration.create({
          data: {
            personId,
            roles,
            declaredPhase: etapaPendiente ? fase : null,
            note: datos.prayerRequest.trim() || null,
            items: {
              create: [
                ...roles.map((rol) => ({ kind: "ROL", value: rol })),
                ...(etapaPendiente ? [{ kind: "ETAPA", value: fase }] : []),
                ...hitosPendientes.map((hito) => ({
                  kind: "HITO",
                  value: hito.kind as string,
                  achievedAt: hito.achievedAt,
                })),
              ],
            },
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
          reconocidaPor: existente ? (porCorreo ? "correo+nacimiento" : "celular") : null,
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
  | { ok: true; aplicado: string[]; sinCuenta: boolean }
  | { ok: false; mensaje: string };

export type ClaseDeItem = "ROL" | "ETAPA" | "HITO";

/// Un renglón de la declaración, listo para pintar: qué dijo la persona, qué
/// pasa si se confirma, y cómo quedó si ya se resolvió.
export type ItemDeclarado = {
  id: string;
  clase: ClaseDeItem;
  titulo: string;
  /// La consecuencia («le activa el permiso de mentor») o el dato («Marzo
  /// 2019»). Es lo que hay que leer antes de decidir.
  detalle: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "DESCARTADO";
  /// Quién lo resolvió y cuándo. Nulos mientras esté pendiente.
  resueltoPor: string | null;
  resueltoEl: Date | null;
};

export type DeclaracionConItems = {
  id: string;
  creada: Date;
  items: ItemDeclarado[];
  pendientes: number;
};

const ORDEN_CLASE: Record<ClaseDeItem, number> = { ROL: 0, ETAPA: 1, HITO: 2 };

function describirItem(
  clase: ClaseDeItem,
  valor: string,
  achievedAt: Date | null,
  faseActual: Phase | null,
): { titulo: string; detalle: string } {
  if (clase === "ROL") {
    const rol = ROLES_DECLARABLES.find((r) => r.valor === valor);
    return {
      titulo: rol?.etiqueta ?? valor,
      // Decir qué hace cada uno es el punto: activar un permiso no es lo mismo
      // que dejar una nota en el expediente.
      detalle: rol?.permiso
        ? ETIQUETA_PERMISO[rol.permiso]
        : "Queda como información del expediente",
    };
  }
  if (clase === "ETAPA") {
    return {
      titulo: ETIQUETA_ETAPA[valor] ?? valor,
      detalle: faseActual
        ? `Hoy está en ${ETIQUETA_ETAPA[faseActual] ?? faseActual}`
        : "Todavía no tiene etapa registrada",
    };
  }
  return {
    titulo: ETIQUETA_HITO[valor] ?? valor,
    detalle: achievedAt ? mesYAnoLegible(achievedAt) : "No recordaba la fecha",
  };
}

const ETIQUETA_PERMISO: Record<string, string> = {
  canMentor: "Le activa el permiso de mentor",
  canLeadAlpha: "Le activa el permiso de líder de Alpha",
  canLeadFaithHouse: "Le activa el permiso de líder de Casa de Fe",
};

/// La declaración que esta persona tiene esperando, con sus renglones. Si llenó
/// el formulario dos veces vale la última: lo que dijo hoy manda sobre lo que
/// dijo el mes pasado.
export async function cargarDeclaracionPendiente(
  prisma: ClientePrisma,
  personId: string,
  faseActual: Phase | null,
): Promise<DeclaracionConItems | null> {
  const declaracion = await prisma.leadershipDeclaration.findFirst({
    where: { personId, status: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          kind: true,
          value: true,
          achievedAt: true,
          status: true,
          resolvedAt: true,
          resolvedBy: {
            select: { person: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (!declaracion || declaracion.items.length === 0) return null;

  const items = declaracion.items
    .map((item) => {
      const clase = item.kind as ClaseDeItem;
      const { titulo, detalle } = describirItem(
        clase,
        item.value,
        item.achievedAt,
        faseActual,
      );
      return {
        id: item.id,
        clase,
        titulo,
        detalle,
        estado: item.status as ItemDeclarado["estado"],
        resueltoPor: item.resolvedBy?.person
          ? nombreCompleto(item.resolvedBy.person)
          : null,
        resueltoEl: item.resolvedAt,
      };
    })
    .sort(
      (a, b) =>
        ORDEN_CLASE[a.clase] - ORDEN_CLASE[b.clase] ||
        a.titulo.localeCompare(b.titulo, "es"),
    );

  return {
    id: declaracion.id,
    creada: declaracion.createdAt,
    items,
    pendientes: items.filter((item) => item.estado === "PENDIENTE").length,
  };
}

type ItemParaAplicar = {
  id: string;
  kind: string;
  value: string;
  achievedAt: Date | null;
};

type Destino = {
  personId: string;
  userId: string | null;
  learnerId: string | null;
  fase: Phase | null;
};

/// Aplica UN renglón. Devuelve qué se hizo, o `sin_cuenta` cuando el permiso no
/// tiene dónde ponerse porque la persona todavía no entra al sistema.
async function aplicarItem(
  prisma: ClientePrisma,
  item: ItemParaAplicar,
  destino: Destino,
  actorId: string,
): Promise<string> {
  if (item.kind === "ROL") {
    const permiso = ROLES_DECLARABLES.find((r) => r.valor === item.value)?.permiso;
    // Un rol sin permiso (consolidación, ministerio) no cambia nada: queda
    // confirmado como información del expediente, que es lo que es.
    if (!permiso) return `rol:${item.value}`;
    if (!destino.userId) return "sin_cuenta";
    await prisma.appUser.update({
      where: { id: destino.userId },
      data: { [permiso]: true },
    });
    return permiso;
  }

  if (item.kind === "ETAPA") {
    const fase = item.value as Phase;
    // Sin expediente no hay etapa que mover, y `phase_change` exige de dónde
    // venía: un perfil siempre trae fase, así que aquí nunca es nula.
    if (!destino.learnerId || !destino.fase || destino.fase === fase) {
      return `etapa:${fase}`;
    }
    await prisma.phaseChange.create({
      data: {
        learnerId: destino.learnerId,
        fromPhase: destino.fase,
        toPhase: fase,
        decidedById: actorId,
        note: "Confirmado desde el formulario de liderazgo",
      },
    });
    await prisma.learnerProfile.update({
      where: { id: destino.learnerId },
      data: { phase: fase, phaseStartedAt: new Date() },
    });
    destino.fase = fase;
    return `etapa:${fase}`;
  }

  if (!destino.learnerId) return `hito:${item.value}`;
  const kind = item.value as MilestoneKind;
  await prisma.milestone.upsert({
    where: { learnerId_kind: { learnerId: destino.learnerId, kind } },
    create: {
      learnerId: destino.learnerId,
      kind,
      status: MilestoneStatus.COMPLETADO,
      achievedAt: item.achievedAt,
      detail: item.achievedAt
        ? "Lo declaró la persona · confirmado"
        : "Lo declaró la persona · no recordaba la fecha · confirmado",
    },
    update: {
      status: MilestoneStatus.COMPLETADO,
      achievedAt: item.achievedAt,
      detail: item.achievedAt
        ? "Lo declaró la persona · confirmado"
        : "Lo declaró la persona · no recordaba la fecha · confirmado",
    },
  });
  return `hito:${kind}`;
}

/// Un administrador resuelve renglones de una declaración: **confirmar** aplica
/// de verdad lo que la persona dijo, **descartar** lo archiva sin tocar nada.
///
/// `itemId` resuelve uno solo; sin él se resuelven **todos los que sigan
/// pendientes** (los botones «todo» del pie). Lo ya resuelto no se vuelve a
/// tocar: cada renglón se decide una vez.
///
/// Al confirmar se hacen las dos cosas que el formulario no podía hacer solo:
/// 1. **Los permisos** (`can_lead_alpha`, `can_lead_faith_house`, `can_mentor`),
///    y solo si la persona tiene cuenta: sin cuenta no hay a qué ponérselos, y
///    se avisa.
/// 2. **La etapa**, con su `PhaseChange` — ahora sí hay un responsable humano
///    que lo respalda, que es justo lo que faltaba para poder aplicarla.
/// Y desde el 7-sep, 3. **los hitos**, que antes se aplicaban solos.
export async function resolverDeclaracion(
  prisma: ClientePrisma,
  entrada: {
    declaracionId: string;
    actorId: string;
    confirmar: boolean;
    itemId?: string;
  },
): Promise<ResultadoResolucion> {
  const declaracion = await prisma.leadershipDeclaration.findUnique({
    where: { id: entrada.declaracionId },
    select: {
      id: true,
      status: true,
      person: {
        select: {
          id: true,
          user: { select: { id: true } },
          learnerProfile: { select: { id: true, phase: true } },
        },
      },
      items: {
        where: { status: "PENDIENTE" },
        select: { id: true, kind: true, value: true, achievedAt: true },
      },
    },
  });
  if (!declaracion) {
    return { ok: false, mensaje: "Esa declaración ya no existe." };
  }

  const objetivo = entrada.itemId
    ? declaracion.items.filter((item) => item.id === entrada.itemId)
    : declaracion.items;

  if (objetivo.length === 0) {
    return {
      ok: false,
      mensaje: entrada.itemId
        ? "Eso ya lo resolvió alguien."
        : "Ya no queda nada por resolver en esa declaración.",
    };
  }

  const destino: Destino = {
    personId: declaracion.person.id,
    userId: declaracion.person.user?.id ?? null,
    learnerId: declaracion.person.learnerProfile?.id ?? null,
    fase: declaracion.person.learnerProfile?.phase ?? null,
  };

  const aplicado: string[] = [];
  let sinCuenta = false;

  if (entrada.confirmar) {
    for (const item of objetivo) {
      const resultado = await aplicarItem(prisma, item, destino, entrada.actorId);
      // Sin cuenta no es un fallo: el renglón se confirma igual y se avisa,
      // para que quien administra le cree el acceso.
      if (resultado === "sin_cuenta") sinCuenta = true;
      else aplicado.push(resultado);
    }
  }

  const ahora = new Date();
  await prisma.leadershipDeclarationItem.updateMany({
    where: { id: { in: objetivo.map((item) => item.id) } },
    data: {
      status: entrada.confirmar ? "CONFIRMADO" : "DESCARTADO",
      resolvedById: entrada.actorId,
      resolvedAt: ahora,
    },
  });

  // La declaración se cierra cuando ya no le queda ningún renglón esperando.
  const quedan = declaracion.items.length - objetivo.length;
  if (quedan === 0) {
    await prisma.leadershipDeclaration.update({
      where: { id: declaracion.id },
      data: {
        status: "RESUELTA",
        reviewedById: entrada.actorId,
        reviewedAt: ahora,
      },
    });
  }

  await auditar(prisma, {
    actorId: entrada.actorId,
    action: entrada.confirmar
      ? "liderazgo.declaracion_confirmada"
      : "liderazgo.declaracion_descartada",
    entityType: "person",
    entityId: declaracion.person.id,
    metadata: {
      cuantos: objetivo.length,
      que: objetivo.map((item) => `${item.kind}:${item.value}`),
      aplicado,
      sinCuenta,
      quedanPendientes: quedan,
    },
  });

  return { ok: true, aplicado, sinCuenta };
}
