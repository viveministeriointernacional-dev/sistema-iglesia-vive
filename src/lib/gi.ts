import { LearnerStatus } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { veTodoGi, type UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import { edadDesde } from "@/lib/op72";
import { diaISO } from "@/lib/reunion-catalogo";
import { nivelEnLaRamaDe, ramaDeLaRed } from "@/lib/red";
import {
  correrMes,
  diasDelMes,
  diasSinMarcar,
  mesDe,
  rachaAlDia,
  resumenDeDevocionales,
} from "@/lib/gi-catalogo";

/// **GI · Generación Imparable**: quién acompaña a quién, y el devocional.
///
/// Este módulo es el que toca la base. Lo puro —las fechas, las rachas, la
/// rejilla del mes— vive en `gi-catalogo.ts`.
///
/// ⚠️ **GI no cambia la línea de mentoría de nadie, y esa es la regla que
/// sostiene todo lo demás.** Mariana Valentina Narváez es líder de GI y sigue
/// siendo discípula de Paola Viveros. Por eso quien lleva GI y quien acompaña
/// como mentor son dos preguntas distintas, y las dos se contestan aquí sin
/// mezclarse.

/// Una fecha civil desde una columna `@db.Date`. Prisma la trae a medianoche
/// UTC, así que se leen los componentes UTC: con los locales se correría un día
/// hacia atrás en Colombia (la trampa del 8-sep-2026).
const comoDia = diaISO;

// ------------------------------------------------------------- el alcance

/// **Quién puede ver y marcar el GI de un joven.**
///
/// Tres caminos, y los tres son los que pidió el usuario:
/// - los **pastores de GI** (y la administración), que ven el movimiento entero;
/// - su **líder de GI**, que es quien marca;
/// - su **mentor o pastor de línea**, hacia arriba y en cascada — que ve, pero
///   no marca.
///
/// ⚠️ La tercera puerta usa `nivelEnLaRamaDe`, que **sube** por la cadena de
/// mentores en vez de bajar: para autorizar UN expediente sobra traer la rama
/// entera del líder, y la cadena hacia arriba tiene tantos pasos como niveles
/// tenga la iglesia (hoy 4), no tantos como personas (11-sep-2026).
export type AccesoAGi = {
  puedeVer: boolean;
  /// Marcar el devocional y escribir observaciones. **Solo su líder de GI**
  /// (decisión del usuario): el mentor mira, no registra.
  puedeMarcar: boolean;
};

export async function accesoAGi(
  usuario: UsuarioSesion,
  learnerId: string,
): Promise<AccesoAGi> {
  const prisma = await getPrisma();
  const asignacion = await prisma.giAssignment.findFirst({
    where: { learnerId, endedAt: null },
    select: { leaderId: true },
  });

  if (asignacion?.leaderId === usuario.id) {
    return { puedeVer: true, puedeMarcar: true };
  }
  if (veTodoGi(usuario)) return { puedeVer: true, puedeMarcar: false };

  const nivel = await nivelEnLaRamaDe(usuario.id, learnerId);
  return { puedeVer: nivel !== null, puedeMarcar: false };
}

/// Los `learnerId` de GI que esta cuenta alcanza a ver, o `null` cuando ve
/// todo el movimiento (para no arrastrar una lista de ids que no hace falta).
async function alcanceDeGi(
  usuario: UsuarioSesion,
  propios: string[],
): Promise<string[] | null> {
  if (veTodoGi(usuario)) return null;

  const rama = await ramaDeLaRed(usuario.id);

  // ⚠️ Los suyos entran aunque NO cuelguen de su rama, y esto no es un detalle:
  // **un líder de GI acompaña a jóvenes de otras líneas**. Es el caso de
  // Mariana, que está en la línea de Paola Viveros y lleva jóvenes que no. Si
  // el alcance fuera solo la rama, no vería a la mitad de su propio grupo.
  return [...new Set([...rama.keys(), ...propios])];
}

// -------------------------------------------------------- la semana de un líder

export type ObservacionDeGi = {
  dia: string;
  texto: string;
  autor: string;
};

export type JovenDeGi = {
  learnerId: string;
  nombre: string;
  edad: number | null;
  /// Su línea de mentoría, que **no es la de GI**: se enseña en la ficha
  /// porque es lo que recuerda que las dos estructuras conviven.
  mentor: string | null;
  liderDeGi: { id: string; nombre: string } | null;
  /// Los días del tramo pedido que quedaron marcados.
  marcados: string[];
  /// Desde la última marca, contando cualquier día. `null` = nunca se marcó.
  diasSinMarcar: number | null;
  ultimaObservacion: ObservacionDeGi | null;
};

/// El bloque común: los jóvenes de un alcance, con lo marcado en un tramo.
///
/// `alcance` nulo significa «todo el movimiento». Va en una sola `findMany`
/// con relaciones en vez de una consulta por joven: con `PrismaPg max: 1` cada
/// viaje de más es una latencia de más.
async function cargarJovenes(
  alcance: string[] | null,
  dias: readonly string[],
  hoy: string,
): Promise<JovenDeGi[]> {
  const prisma = await getPrisma();

  const asignaciones = await prisma.giAssignment.findMany({
    where: {
      endedAt: null,
      ...(alcance ? { learnerId: { in: alcance } } : {}),
      learner: { status: { not: LearnerStatus.RETIRADO } },
    },
    select: {
      learnerId: true,
      leader: { select: { id: true, fullName: true } },
      learner: {
        select: {
          id: true,
          person: {
            select: { firstName: true, lastName: true, birthDate: true },
          },
          mentorRelationships: {
            where: { endedAt: null },
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { mentor: { select: { fullName: true } } },
          },
          giDevotionals: { select: { day: true } },
          giNotes: {
            orderBy: [{ day: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              day: true,
              body: true,
              author: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  const enElTramo = new Set(dias);

  return asignaciones
    .map((asignacion) => {
      const aprendiz = asignacion.learner;
      const todos = aprendiz.giDevotionals.map((d) => comoDia(d.day));
      const observacion = aprendiz.giNotes[0];

      return {
        learnerId: aprendiz.id,
        nombre: nombreCompleto(aprendiz.person),
        edad: edadDesde(aprendiz.person.birthDate),
        mentor: aprendiz.mentorRelationships[0]?.mentor.fullName ?? null,
        liderDeGi: {
          id: asignacion.leader.id,
          nombre: asignacion.leader.fullName,
        },
        marcados: todos.filter((dia) => enElTramo.has(dia)),
        diasSinMarcar: diasSinMarcar(todos, hoy),
        ultimaObservacion: observacion
          ? {
              dia: comoDia(observacion.day),
              texto: observacion.body,
              autor: observacion.author.fullName,
            }
          : null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// --------------------------------------------------------- el mes de un joven

export type MesDeGi = {
  nombre: string;
  edad: number | null;
  mentor: string | null;
  liderDeGi: string | null;
  /// Los días del mes que quedaron marcados.
  marcados: string[];
  esteMes: { hechos: number; posibles: number };
  mesAnterior: { hechos: number; posibles: number };
  racha: number;
  observaciones: ObservacionDeGi[];
};

export async function cargarMesDeGi(
  learnerId: string,
  mes: string,
  hoy: string,
): Promise<MesDeGi | null> {
  const prisma = await getPrisma();

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: {
      person: { select: { firstName: true, lastName: true, birthDate: true } },
      mentorRelationships: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { mentor: { select: { fullName: true } } },
      },
      giAssignments: {
        where: { endedAt: null },
        select: { leader: { select: { fullName: true } } },
      },
      // Todos los días marcados, no solo los del mes: la racha se cuenta hacia
      // atrás y puede cruzar el cambio de mes, y el mes anterior se compara al
      // lado. Son unos cientos de filas por persona en el peor caso.
      giDevotionals: { select: { day: true } },
      giNotes: {
        orderBy: [{ day: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          day: true,
          body: true,
          author: { select: { fullName: true } },
        },
      },
    },
  });

  if (!aprendiz) return null;

  const todos = aprendiz.giDevotionals.map((d) => comoDia(d.day));
  const marcados = new Set(todos);

  return {
    nombre: nombreCompleto(aprendiz.person),
    edad: edadDesde(aprendiz.person.birthDate),
    mentor: aprendiz.mentorRelationships[0]?.mentor.fullName ?? null,
    liderDeGi: aprendiz.giAssignments[0]?.leader.fullName ?? null,
    marcados: todos.filter((dia) => mesDe(dia) === mes),
    esteMes: resumenDelMes(mes, marcados, hoy),
    mesAnterior: resumenDelMes(correrMes(mes, -1), marcados, hoy),
    racha: rachaAlDia(marcados, hoy),
    observaciones: aprendiz.giNotes.map((nota) => ({
      dia: comoDia(nota.day),
      texto: nota.body,
      autor: nota.author.fullName,
    })),
  };
}

function resumenDelMes(
  mes: string,
  marcados: ReadonlySet<string>,
  hoy: string,
) {
  // Se arma con las fechas del catálogo para no duplicar la matemática del
  // mes, que ya tiene sus pruebas.
  return resumenDeDevocionales(diasDelMes(mes), marcados, hoy);
}

// ---------------------------------------------------------- el movimiento

export type LiderDeGi = {
  id: string;
  nombre: string;
  jovenes: number;
  hechos: number;
  posibles: number;
  ultimaObservacion: ObservacionDeGi | null;
  /// Jóvenes suyos que llevan demasiados días sin una sola marca.
  enSilencio: number;
};

export type TableroDeGi = {
  /// Los jóvenes que le toca marcar a quien mira. Si no lleva ninguno, son los
  /// de su alcance y solo puede mirarlos.
  mios: JovenDeGi[];
  puedeMarcar: boolean;
  hechosMios: number;
  posiblesMios: number;
  movimiento: MovimientoDeGi;
};

export type MovimientoDeGi = {
  lideres: LiderDeGi[];
  jovenes: number;
  hechos: number;
  posibles: number;
  enSilencio: number;
  /// Los mismos jóvenes, repartidos por su línea de mentoría. Es lo que hace
  /// visible que GI no le cambia la línea a nadie.
  porLinea: { mentor: string; jovenes: number }[];
};

/// **Todo lo que pinta la pantalla de GI, con una sola pasada por la base.**
///
/// ⚠️ Los jóvenes se traen **una vez** y de ahí salen las dos cosas: el tablero
/// de quien marca y la tabla del movimiento. Pedirlos dos veces sería, con
/// `PrismaPg max: 1`, una latencia entera de más — y las dos listas podrían
/// además discrepar si una se cargara un segundo después de la otra.
export async function cargarGi(
  usuario: UsuarioSesion,
  dias: readonly string[],
  hoy: string,
  diasParaSilencio: number,
): Promise<TableroDeGi> {
  const prisma = await getPrisma();

  const propias = await prisma.giAssignment.findMany({
    where: { leaderId: usuario.id, endedAt: null },
    select: { learnerId: true },
  });
  const puedeMarcar = propias.length > 0;

  const alcance = await alcanceDeGi(usuario, propias.map((p) => p.learnerId));
  const jovenes = await cargarJovenes(alcance, dias, hoy);

  // Quien lleva GI abre en SU grupo, no en el de todos: es la pantalla donde
  // marca todos los días, y empezar con 18 nombres cuando acompaña a 5 le
  // pondría el trabajo propio en medio de lo ajeno.
  const mios = puedeMarcar
    ? jovenes.filter((j) => j.liderDeGi?.id === usuario.id)
    : jovenes;

  const porLider = new Map<string, LiderDeGi>();
  const porLinea = new Map<string, number>();
  let hechos = 0;
  let posibles = 0;
  let enSilencio = 0;

  for (const joven of jovenes) {
    const resumen = resumenDeDevocionales(dias, new Set(joven.marcados), hoy);
    hechos += resumen.hechos;
    posibles += resumen.posibles;

    // Sin ninguna marca también cuenta como silencio: no es que se le haya
    // marcado hace mucho, es que no consta que se le haya marcado nunca.
    const callado =
      joven.diasSinMarcar === null || joven.diasSinMarcar >= diasParaSilencio;
    if (callado) enSilencio += 1;

    const linea = joven.mentor ?? "Sin mentor";
    porLinea.set(linea, (porLinea.get(linea) ?? 0) + 1);

    const lider = joven.liderDeGi;
    if (!lider) continue;

    const fila = porLider.get(lider.id) ?? {
      id: lider.id,
      nombre: lider.nombre,
      jovenes: 0,
      hechos: 0,
      posibles: 0,
      ultimaObservacion: null,
      enSilencio: 0,
    };
    fila.jovenes += 1;
    fila.hechos += resumen.hechos;
    fila.posibles += resumen.posibles;
    if (callado) fila.enSilencio += 1;
    if (
      joven.ultimaObservacion &&
      (!fila.ultimaObservacion ||
        joven.ultimaObservacion.dia > fila.ultimaObservacion.dia)
    ) {
      fila.ultimaObservacion = joven.ultimaObservacion;
    }
    porLider.set(lider.id, fila);
  }

  const deLosMios = mios.reduce(
    (suma, joven) => {
      const resumen = resumenDeDevocionales(dias, new Set(joven.marcados), hoy);
      return {
        hechos: suma.hechos + resumen.hechos,
        posibles: suma.posibles + resumen.posibles,
      };
    },
    { hechos: 0, posibles: 0 },
  );

  return {
    mios,
    puedeMarcar,
    hechosMios: deLosMios.hechos,
    posiblesMios: deLosMios.posibles,
    movimiento: {
      lideres: [...porLider.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es"),
      ),
      jovenes: jovenes.length,
      hechos,
      posibles,
      enSilencio,
      porLinea: [...porLinea.entries()]
        .map(([mentor, cuantos]) => ({ mentor, jovenes: cuantos }))
        .sort(
          (a, b) => b.jovenes - a.jovenes || a.mentor.localeCompare(b.mentor, "es"),
        ),
    },
  };
}
