import type {
  LearnerStatus,
  Operation72Status,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { agruparPorMentor, ramaDe } from "@/lib/procesos-arbol";

/// Lo que la pantalla de Procesos sabe de cada persona. Es una sola fila por
/// expediente: todos los `LEFT JOIN LATERAL` de abajo existen para eso — sin
/// ellos, alguien en dos grupos saldría dos veces y el buscador contaría mal.
export type PersonaDeProcesos = {
  learnerId: string;
  nombre: string;
  fase: Phase;
  estado: LearnerStatus;
  op72: Operation72Status | null;
  /// Quién la invitó, tal como se escribió en el formulario de registro.
  invito: string;
  celular: string;
  consolidador: string;
  mentor: string;
  /// La cuenta del mentor que la acompaña. Es la llave del árbol.
  mentorId: string | null;
  /// Su PROPIA cuenta, si tiene. Con esto la rama sigue bajando: un discípulo
  /// que además acompaña gente cuelga de aquí.
  cuenta: string | null;
  mentorPropuesto: string;
  casaDeFe: string;
  ultimoContacto: Date | null;
  notaProceso: string;
};

export type MentorDeProcesos = {
  id: string;
  nombre: string;
  role: Role;
  /// A cuántos acompaña él mismo.
  directos: number;
  /// Los directos más todos los que cuelgan de ellos, hacia abajo.
  red: number;
  indirectos: number;
  capacidad: number;
};

export type GrupoDeProcesos = {
  id: string;
  tipo: "CASA_DE_FE" | "ALPHA";
  nombre: string;
  lider: string;
  inicio: Date;
  miembros: number;
};

export type Procesos = {
  personas: PersonaDeProcesos[];
  mentores: MentorDeProcesos[];
  grupos: GrupoDeProcesos[];
  porFase: Record<Phase, number>;
  activas: number;
  asistentes: number;
  conMentor: number;
  esperanMentor: number;
  enCasaDeFe: number;
};

type FilaPersona = {
  learner_id: string;
  nombre: string;
  fase: Phase;
  estado: LearnerStatus;
  op72: Operation72Status | null;
  invito: string;
  celular: string;
  consolidador: string;
  mentor: string;
  mentor_id: string | null;
  cuenta: string | null;
  mentor_propuesto: string;
  casa_de_fe: string;
  nota_proceso: string;
  ultimo_contacto: Date | null;
};

type FilaMentor = {
  id: string;
  nombre: string;
  role: Role;
  capacity: number;
};

type FilaGrupo = {
  id: string;
  tipo: "CASA_DE_FE" | "ALPHA";
  nombre: string;
  lider: string;
  inicio: Date;
  miembros: number;
};

export async function cargarProcesos(): Promise<Procesos> {
  const prisma = await getPrisma();

  // Tres viajes a la base, no más: con `PrismaPg max:1` las consultas de una
  // petición se serializan sobre la única conexión, así que cada viaje se paga
  // en latencia del pooler.
  const [filas, filasMentores, filasGrupos] = await Promise.all([
    prisma.$queryRaw<FilaPersona[]>`
      SELECT
        lp.id AS learner_id,
        trim(concat(p.first_name, ' ', p.last_name)) AS nombre,
        lp.phase AS fase,
        lp.status AS estado,
        o.status AS op72,
        coalesce(nullif(trim(lp.line_of_origin), ''), '') AS invito,
        coalesce(p.call_phone, '') AS celular,
        coalesce(nullif(trim(concat(pc.first_name, ' ', pc.last_name)), ''), '') AS consolidador,
        mr.mentor_id,
        coalesce(nullif(trim(concat(pm.first_name, ' ', pm.last_name)), ''), '') AS mentor,
        cuenta.id AS cuenta,
        coalesce(nullif(trim(concat(pp.first_name, ' ', pp.last_name)), ''), '') AS mentor_propuesto,
        coalesce(grupo.name, '') AS casa_de_fe,
        coalesce(o.prior_process_note, '') AS nota_proceso,
        ultimo.occurred_at AS ultimo_contacto
      FROM learner_profile lp
      JOIN person p ON p.id = lp.person_id
      LEFT JOIN operation72 o ON o.learner_id = lp.id
      LEFT JOIN app_user uc ON uc.id = lp.consolidator_id
      LEFT JOIN person pc ON pc.id = uc.person_id
      LEFT JOIN mentor_relationship mr ON mr.learner_id = lp.id AND mr.ended_at IS NULL
      LEFT JOIN app_user um ON um.id = mr.mentor_id
      LEFT JOIN person pm ON pm.id = um.person_id
      LEFT JOIN app_user up ON up.id = o.proposed_mentor_id
      LEFT JOIN person pp ON pp.id = up.person_id
      LEFT JOIN LATERAL (
        SELECT u2.id FROM app_user u2
        WHERE u2.person_id = lp.person_id AND u2.active
        LIMIT 1
      ) cuenta ON true
      LEFT JOIN LATERAL (
        SELECT g.name FROM faith_house_group_member m
        JOIN faith_house_group g ON g.id = m.group_id
        WHERE m.learner_id = lp.id AND g.closed_at IS NULL
        ORDER BY m.joined_at DESC
        LIMIT 1
      ) grupo ON true
      LEFT JOIN LATERAL (
        SELECT ca.occurred_at FROM contact_attempt ca
        WHERE ca.operation72_id = o.id AND ca.annulled_at IS NULL
        ORDER BY ca.occurred_at DESC
        LIMIT 1
      ) ultimo ON true
      WHERE lp.status <> 'RETIRADO'
      ORDER BY p.first_name, p.last_name
    `,

    prisma.$queryRaw<FilaMentor[]>`
      SELECT
        u.id,
        coalesce(nullif(trim(concat(p.first_name, ' ', p.last_name)), ''), u.email) AS nombre,
        u.role,
        u.capacity
      FROM app_user u
      LEFT JOIN person p ON p.id = u.person_id
      WHERE u.active
        AND (
          u.role IN ('MENTOR', 'PASTOR', 'ADMIN')
          OR u.can_mentor
          OR EXISTS (
            SELECT 1 FROM mentor_relationship mr
            WHERE mr.mentor_id = u.id AND mr.ended_at IS NULL
          )
        )
    `,

    prisma.$queryRaw<FilaGrupo[]>`
      SELECT
        g.id,
        'CASA_DE_FE' AS tipo,
        g.name AS nombre,
        coalesce(nullif(trim(concat(p.first_name, ' ', p.last_name)), ''), u.email) AS lider,
        g.start_date AS inicio,
        (
          SELECT count(*) FROM faith_house_group_member m
          JOIN learner_profile lp ON lp.id = m.learner_id
          WHERE m.group_id = g.id AND lp.status <> 'RETIRADO'
        )::int AS miembros
      FROM faith_house_group g
      JOIN app_user u ON u.id = g.leader_id
      LEFT JOIN person p ON p.id = u.person_id
      WHERE g.closed_at IS NULL

      UNION ALL

      SELECT
        a.id,
        'ALPHA' AS tipo,
        a.name AS nombre,
        coalesce(nullif(trim(concat(p.first_name, ' ', p.last_name)), ''), u.email) AS lider,
        a.start_date AS inicio,
        (
          SELECT count(*) FROM alpha_enrollment e
          JOIN learner_profile lp ON lp.id = e.learner_id
          WHERE e.program_id = a.id AND lp.status <> 'RETIRADO'
        )::int AS miembros
      FROM alpha_program a
      JOIN app_user u ON u.id = a.leader_id
      LEFT JOIN person p ON p.id = u.person_id
      WHERE a.closed_at IS NULL

      ORDER BY miembros DESC, nombre
    `,
  ]);

  const personas: PersonaDeProcesos[] = filas.map((f) => ({
    learnerId: f.learner_id,
    nombre: f.nombre,
    fase: f.fase,
    estado: f.estado,
    op72: f.op72,
    invito: f.invito,
    celular: f.celular,
    consolidador: f.consolidador,
    mentor: f.mentor,
    mentorId: f.mentor_id,
    cuenta: f.cuenta,
    mentorPropuesto: f.mentor_propuesto,
    casaDeFe: f.casa_de_fe,
    ultimoContacto: f.ultimo_contacto,
    notaProceso: f.nota_proceso,
  }));

  const porMentor = agruparPorMentor(personas);

  const mentores: MentorDeProcesos[] = filasMentores
    .map((m) => {
      const { directos, total, indirectos } = ramaDe(m.id, porMentor);
      return {
        id: m.id,
        nombre: m.nombre,
        role: m.role,
        directos,
        red: total,
        indirectos,
        capacidad: m.capacity,
      };
    })
    .sort(
      (a, b) =>
        b.red - a.red ||
        b.directos - a.directos ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  const porFase = { GANAR: 0, FORTALECER: 0, ENTRENAR: 0, MULTIPLICAR: 0 } as
    Record<Phase, number>;
  let activas = 0;
  let asistentes = 0;
  let conMentor = 0;
  let esperanMentor = 0;
  let enCasaDeFe = 0;

  for (const persona of personas) {
    if (persona.estado === "ASISTENTE") asistentes += 1;
    else {
      activas += 1;
      porFase[persona.fase] += 1;
    }
    if (persona.mentor) conMentor += 1;
    if (persona.op72 === "LISTA_PARA_ENTREGA") esperanMentor += 1;
    if (persona.casaDeFe) enCasaDeFe += 1;
  }

  return {
    personas,
    mentores,
    grupos: filasGrupos,
    porFase,
    activas,
    asistentes,
    conMentor,
    esperanMentor,
    enCasaDeFe,
  };
}
