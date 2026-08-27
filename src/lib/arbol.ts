import {
  LearnerStatus,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import { urgenciaDe } from "@/lib/op72";
import { DIAS_SIN_CONTACTO } from "@/lib/red";

/// Días recientes que cuentan como «nuevo» en los indicadores de red.
export const DIAS_NUEVO = 30;

export type IndicadoresDeRed = {
  personas: number;
  porFase: Record<Phase, number>;
  activas: number;
  estancadas: number;
  operacion72Vencida: number;
  bautismos: number;
  encuentros: number;
  graduaciones: number;
  multiplicadores: number;
  nuevas: number;
};

export type NodoDeRed = {
  /// `learnerId` cuando la persona tiene expediente; nulo para un líder que
  /// nunca fue registrado como aprendiz (el pastor fundador, por ejemplo).
  learnerId: string | null;
  userId: string | null;
  nombre: string;
  rol: Role | null;
  fase: Phase | null;
  estado: LearnerStatus | null;
  alertas: string[];
  /// Personas que acompaña directamente.
  aCargo: number;
  /// Todo lo que cuelga de esta persona, sin contarla a ella.
  enLaRed: number;
  indicadores: IndicadoresDeRed;
  hijos: NodoDeRed[];
};

function faseVacia(): Record<Phase, number> {
  return { GANAR: 0, FORTALECER: 0, ENTRENAR: 0, MULTIPLICAR: 0 };
}

function indicadoresVacios(): IndicadoresDeRed {
  return {
    personas: 0,
    porFase: faseVacia(),
    activas: 0,
    estancadas: 0,
    operacion72Vencida: 0,
    bautismos: 0,
    encuentros: 0,
    graduaciones: 0,
    multiplicadores: 0,
    nuevas: 0,
  };
}

function sumar(destino: IndicadoresDeRed, origen: IndicadoresDeRed) {
  destino.personas += origen.personas;
  for (const fase of Object.keys(destino.porFase) as Phase[]) {
    destino.porFase[fase] += origen.porFase[fase];
  }
  destino.activas += origen.activas;
  destino.estancadas += origen.estancadas;
  destino.operacion72Vencida += origen.operacion72Vencida;
  destino.bautismos += origen.bautismos;
  destino.encuentros += origen.encuentros;
  destino.graduaciones += origen.graduaciones;
  destino.multiplicadores += origen.multiplicadores;
  destino.nuevas += origen.nuevas;
}

/// El árbol de discipulado (§9).
///
/// La jerarquía no es un campo: sale de `MentorRelationship`, que es la
/// relación viva entre un líder y quien acompaña. Un aprendiz que ya lidera
/// aparece dos veces en el mismo nodo —su fase como discípulo y su rol como
/// líder— porque es la misma persona.
///
/// Se arma completo en el servidor y luego se recorta a la rama de quien mira:
/// nadie recibe en el navegador una rama que no le corresponde (§9.2).
export async function cargarArbol(usuario: UsuarioSesion, ahora = new Date()) {
  const prisma = await getPrisma();

  const [usuarios, aprendices, contactos, operaciones] = await Promise.all([
    prisma.appUser.findMany({
      where: { active: true },
      select: { id: true, fullName: true, role: true, personId: true },
    }),
    prisma.learnerProfile.findMany({
      // Los dados de baja (Retirado) no salen en el árbol de la red.
      where: { status: { not: LearnerStatus.RETIRADO } },
      select: {
        id: true,
        personId: true,
        phase: true,
        status: true,
        createdAt: true,
        person: { select: { firstName: true, lastName: true } },
        operation72: { select: { status: true, deadlineAt: true } },
        milestones: {
          where: { status: MilestoneStatus.COMPLETADO },
          select: { kind: true },
        },
        faithHouseProgress: { select: { completedAt: true } },
        privateNotes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        mentorRelationships: {
          where: { endedAt: null },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { mentorId: true },
        },
      },
    }),
    prisma.contactAttempt.groupBy({
      by: ["operation72Id"],
      _max: { occurredAt: true },
    }),
    prisma.operation72.findMany({ select: { id: true, learnerId: true } }),
  ]);

  const op72PorAprendiz = new Map(operaciones.map((o) => [o.learnerId, o.id]));
  const ultimoIntento = new Map(contactos.map((c) => [c.operation72Id, c._max.occurredAt]));
  const usuarioPorPersona = new Map(
    usuarios.filter((u) => u.personId).map((u) => [u.personId!, u]),
  );

  // Quién acompaña a quién, en un solo paso.
  const hijosPorMentor = new Map<string, typeof aprendices>();
  for (const aprendiz of aprendices) {
    const mentorId = aprendiz.mentorRelationships[0]?.mentorId;
    if (!mentorId) continue;
    const lista = hijosPorMentor.get(mentorId) ?? [];
    lista.push(aprendiz);
    hijosPorMentor.set(mentorId, lista);
  }

  type Aprendiz = (typeof aprendices)[number];

  /// Todo expediente que ya quedó dibujado en alguna rama. Lo que no esté aquí
  /// al final no cuelga de nadie, y hay que mostrarlo igual: una persona que
  /// desaparece del árbol es una persona que nadie va a buscar.
  const emitidos = new Set<string>();

  function propios(aprendiz: Aprendiz): IndicadoresDeRed {
    const propio = indicadoresVacios();
    propio.personas = 1;
    propio.porFase[aprendiz.phase] += 1;

    if (aprendiz.status === LearnerStatus.ACTIVO) propio.activas += 1;
    if (aprendiz.phase === Phase.MULTIPLICAR) propio.multiplicadores += 1;

    const kinds = new Set(aprendiz.milestones.map((h) => h.kind));
    // La graduación es el hito formal del §8.4, no un estado suelto.
    if (kinds.has(MilestoneKind.GRADUACION)) propio.graduaciones += 1;
    if (kinds.has(MilestoneKind.BAUTISMO)) propio.bautismos += 1;
    if (kinds.has(MilestoneKind.ENCUENTRO)) propio.encuentros += 1;

    const dias = (ahora.getTime() - aprendiz.createdAt.getTime()) / 86_400_000;
    if (dias <= DIAS_NUEVO) propio.nuevas += 1;

    const op72 = aprendiz.operation72;
    const enOperacion72 =
      op72 &&
      op72.status !== Operation72Status.ENTREGADA &&
      op72.status !== Operation72Status.CERRADA;
    if (enOperacion72 && urgenciaDe(op72.deadlineAt, ahora) === "vencida") {
      propio.operacion72Vencida += 1;
    }

    if (diasSinRegistro(aprendiz) >= DIAS_SIN_CONTACTO) propio.estancadas += 1;

    return propio;
  }

  function diasSinRegistro(aprendiz: Aprendiz): number {
    const fechas = [
      aprendiz.privateNotes[0]?.createdAt ?? null,
      ultimoIntento.get(op72PorAprendiz.get(aprendiz.id) ?? "") ?? null,
      ...aprendiz.faithHouseProgress.map((a) => a.completedAt),
    ].filter((f): f is Date => f instanceof Date);

    const ultima = fechas.length
      ? new Date(Math.max(...fechas.map((f) => f.getTime())))
      : aprendiz.createdAt;

    return Math.floor((ahora.getTime() - ultima.getTime()) / 86_400_000);
  }

  function alertasDe(aprendiz: Aprendiz): string[] {
    const alertas: string[] = [];
    const op72 = aprendiz.operation72;
    const enOperacion72 =
      op72 &&
      op72.status !== Operation72Status.ENTREGADA &&
      op72.status !== Operation72Status.CERRADA;

    if (enOperacion72 && urgenciaDe(op72.deadlineAt, ahora) === "vencida") {
      alertas.push("Operación 72 vencida");
    }
    const dias = diasSinRegistro(aprendiz);
    if (dias >= DIAS_SIN_CONTACTO) alertas.push(`${dias} días sin registro`);
    if (aprendiz.status === LearnerStatus.PAUSADO) alertas.push("En pausa");

    return alertas;
  }

  /// `visitados` corta cualquier ciclo: si por un error de datos A acompaña a B
  /// y B a A, el recorrido termina en vez de colgarse.
  function construirDesdeUsuario(
    usuarioId: string,
    nombre: string,
    rol: Role,
    aprendiz: Aprendiz | null,
    visitados: Set<string>,
  ): NodoDeRed {
    const hijos: NodoDeRed[] = [];
    if (!visitados.has(usuarioId)) {
      visitados.add(usuarioId);
      for (const hijo of hijosPorMentor.get(usuarioId) ?? []) {
        hijos.push(construirDesdeAprendiz(hijo, visitados));
      }
    }

    if (aprendiz) emitidos.add(aprendiz.id);

    return armar(
      {
        learnerId: aprendiz?.id ?? null,
        userId: usuarioId,
        nombre,
        rol,
        fase: aprendiz?.phase ?? null,
        estado: aprendiz?.status ?? null,
        alertas: aprendiz ? alertasDe(aprendiz) : [],
      },
      aprendiz ? propios(aprendiz) : indicadoresVacios(),
      hijos,
    );
  }

  function construirDesdeAprendiz(aprendiz: Aprendiz, visitados: Set<string>): NodoDeRed {
    const comoLider = usuarioPorPersona.get(aprendiz.personId);

    if (comoLider) {
      return construirDesdeUsuario(
        comoLider.id,
        comoLider.fullName,
        comoLider.role,
        aprendiz,
        visitados,
      );
    }

    emitidos.add(aprendiz.id);

    return armar(
      {
        learnerId: aprendiz.id,
        userId: null,
        nombre: nombreCompleto(aprendiz.person),
        rol: null,
        fase: aprendiz.phase,
        estado: aprendiz.status,
        alertas: alertasDe(aprendiz),
      },
      propios(aprendiz),
      [],
    );
  }

  function armar(
    base: Omit<NodoDeRed, "aCargo" | "enLaRed" | "indicadores" | "hijos">,
    propio: IndicadoresDeRed,
    hijos: NodoDeRed[],
  ): NodoDeRed {
    const indicadores = indicadoresVacios();
    sumar(indicadores, propio);
    let enLaRed = 0;
    for (const hijo of hijos) {
      sumar(indicadores, hijo.indicadores);
      enLaRed += 1 + hijo.enLaRed;
    }
    return { ...base, aCargo: hijos.length, enLaRed, indicadores, hijos };
  }

  const aprendizPorUsuario = new Map<string, Aprendiz>();
  for (const aprendiz of aprendices) {
    const comoLider = usuarioPorPersona.get(aprendiz.personId);
    if (comoLider) aprendizPorUsuario.set(comoLider.id, aprendiz);
  }

  // El pastor y la administración ven todo: las raíces son los líderes que no
  // cuelgan de nadie. Cualquier otro ve su propia rama y nada más (§9.2).
  const esVistaCompleta = usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;

  if (!esVistaCompleta) {
    const propio = aprendizPorUsuario.get(usuario.id) ?? null;
    return {
      raices: [
        construirDesdeUsuario(
          usuario.id,
          usuario.fullName,
          usuario.role,
          propio,
          new Set(),
        ),
      ],
      esVistaCompleta,
    };
  }

  const visitados = new Set<string>();
  const raices: NodoDeRed[] = [];

  const ordenados = [...usuarios].sort(
    (a, b) => ORDEN_DE_ROL.indexOf(a.role) - ORDEN_DE_ROL.indexOf(b.role),
  );

  for (const candidato of ordenados) {
    if (candidato.role === Role.APRENDIZ) continue;
    if (visitados.has(candidato.id)) continue;

    // Si esta persona es acompañada por alguien más, no es raíz: colgará de su
    // propio mentor cuando se recorra esa rama.
    const comoAprendiz = aprendizPorUsuario.get(candidato.id);
    if (comoAprendiz?.mentorRelationships.length) continue;

    raices.push(
      construirDesdeUsuario(
        candidato.id,
        candidato.fullName,
        candidato.role,
        comoAprendiz ?? null,
        visitados,
      ),
    );
  }

  // Segunda pasada: un líder cuyo propio mentor está inactivo no fue alcanzado
  // por ninguna rama. Se cuelga como raíz antes que desaparecer del árbol.
  for (const candidato of ordenados) {
    if (candidato.role === Role.APRENDIZ) continue;
    if (visitados.has(candidato.id)) continue;
    raices.push(
      construirDesdeUsuario(
        candidato.id,
        candidato.fullName,
        candidato.role,
        aprendizPorUsuario.get(candidato.id) ?? null,
        visitados,
      ),
    );
  }

  // Quien no quedó en ninguna rama: sin mentor, o colgando de un líder
  // inactivo. Se listan aparte en vez de desaparecer.
  const huerfanos = aprendices.filter((aprendiz) => !emitidos.has(aprendiz.id));

  return {
    raices,
    sinMentor: huerfanos.map((aprendiz) => construirDesdeAprendiz(aprendiz, new Set())),
    esVistaCompleta,
  };
}

const ORDEN_DE_ROL: Role[] = [
  Role.ADMIN,
  Role.PASTOR,
  Role.MENTOR,
  Role.LIDER_ALPHA,
  Role.CONSOLIDADOR,
  Role.APRENDIZ,
];

export type ArbolDeRed = Awaited<ReturnType<typeof cargarArbol>>;
