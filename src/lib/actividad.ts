import type { Phase } from "@iglesia/prisma-client";
import { momentoLegible, nombreCompleto, ZONA_HORARIA } from "@/lib/dominio";
import { HITOS_DEL_RECORRIDO } from "@/lib/expediente";
import { ETIQUETA_LLAMADA } from "@/lib/op72";
import type { ClientePrisma } from "@/lib/prisma";

/// La actividad del día: todo lo que quedó en la bitácora de auditoría (más
/// las llamadas reales del CRM y los correos enviados), traducido a frases que
/// dicen quién hizo qué, a quién y en qué quedó. Solo para administradores.

export type TipoActividad =
  | "op72"
  | "personas"
  | "mentoria"
  | "grupos"
  | "eventos"
  | "accesos"
  | "crm"
  | "llamadas";

export const TIPOS_DE_ACTIVIDAD: { valor: TipoActividad; etiqueta: string }[] = [
  { valor: "op72", etiqueta: "Operación 72" },
  { valor: "personas", etiqueta: "Personas" },
  { valor: "mentoria", etiqueta: "Mentoría y fases" },
  { valor: "grupos", etiqueta: "Grupos (Alpha · Casa de Fe)" },
  { valor: "eventos", etiqueta: "Eventos y Escuela" },
  { valor: "accesos", etiqueta: "Accesos y permisos" },
  { valor: "crm", etiqueta: "HighLevel" },
  { valor: "llamadas", etiqueta: "Llamadas del CRM" },
];

export type Tono = "azul" | "verde" | "ambar" | "rojo" | "gris";

export type Trozo = { texto: string; negrita?: boolean; href?: string };

export type CorreoPrevisualizable = {
  asunto: string;
  para: string;
  enviado: boolean;
  motivo: string | null;
  html: string;
};

export type Movimiento = {
  id: string;
  cuando: string;
  hora: string;
  franja: string;
  tipo: TipoActividad;
  etiqueta: string;
  tono: Tono;
  frase: Trozo[];
  observacion: string | null;
  detalle: {
    titulo: string;
    filas: { k: string; v: string }[];
    correo: CorreoPrevisualizable | null;
  } | null;
  buscable: string;
};

export type ActividadDelDia = {
  dia: string;
  etiquetaDia: string;
  diaAnterior: string;
  diaSiguiente: string;
  esHoy: boolean;
  movimientos: Movimiento[];
  conteos: {
    registros: number;
    llamadas: number;
    contactadas: number;
    visitas: number;
    entregas: number;
    fases: number;
  };
  porTipo: Record<TipoActividad, number>;
  total: number;
};

const FORMATO_DIA_CLAVE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONA_HORARIA,
});
const FORMATO_DIA_LARGO = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: ZONA_HORARIA,
});
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: ZONA_HORARIA,
});
const FORMATO_FRANJA = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  hour12: true,
  timeZone: ZONA_HORARIA,
});

const FASE: Record<Phase, string> = {
  GANAR: "Ganar",
  FORTALECER: "Fortalecer",
  ENTRENAR: "Entrenar",
  MULTIPLICAR: "Multiplicar",
};

export function diaDeHoy(ahora = new Date()) {
  return FORMATO_DIA_CLAVE.format(ahora);
}

function diaValido(valor: string | undefined): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : diaDeHoy();
}

function sumarDias(dia: string, n: number) {
  // Mediodía en Bogotá para que el corrimiento nunca cambie de día.
  const fecha = new Date(`${dia}T12:00:00-05:00`);
  fecha.setUTCDate(fecha.getUTCDate() + n);
  return FORMATO_DIA_CLAVE.format(fecha);
}

function hora(fecha: Date) {
  return FORMATO_HORA.format(fecha).replace(/\.\s?m\./g, ". m.");
}

function franja(fecha: Date) {
  return FORMATO_FRANJA.format(fecha).replace(/\.\s?m\./g, ". M.").toUpperCase();
}

type Meta = Record<string, unknown>;
function meta(valor: unknown): Meta {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Meta) : {};
}
function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

export async function cargarActividad(
  prisma: ClientePrisma,
  opciones: { dia?: string; tipo?: string; consulta?: string } = {},
): Promise<ActividadDelDia> {
  const dia = diaValido(opciones.dia);
  const desde = new Date(`${dia}T00:00:00-05:00`);
  const hasta = new Date(`${dia}T23:59:59.999-05:00`);
  const ahora = new Date();

  const [auditoria, llamadasCrm, correos, intentos] = await Promise.all([
    prisma.auditLog.findMany({
      where: { createdAt: { gte: desde, lte: hasta } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
    }),
    prisma.callLog.findMany({
      where: { startedAt: { gte: desde, lte: hasta } },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: {
        id: true,
        startedAt: true,
        callerName: true,
        contactName: true,
        direction: true,
        status: true,
        answered: true,
        durationSeconds: true,
        appUser: { select: { fullName: true } },
      },
    }),
    // La tabla de copias puede no existir todavía (migración pendiente).
    prisma.emailSent
      .findMany({
        where: { createdAt: { gte: desde, lte: hasta } },
        orderBy: { createdAt: "desc" },
        take: 300,
      })
      .catch(() => []),
    prisma.contactAttempt.findMany({
      where: { createdAt: { gte: desde, lte: hasta } },
      select: {
        id: true,
        type: true,
        outcome: true,
        result: true,
        note: true,
        scheduledAt: true,
        place: true,
        isVirtual: true,
        createdAt: true,
        operation72: { select: { id: true, learnerId: true } },
      },
    }),
  ]);

  // ---- Nombres de todo lo que la bitácora menciona por id ----
  const learnerIds = new Set<string>();
  const personIds = new Set<string>();
  const op72Ids = new Set<string>();
  const userIds = new Set<string>();
  const casaIds = new Set<string>();
  const alphaIds = new Set<string>();
  const eventIds = new Set<string>();

  for (const fila of auditoria) {
    const m = meta(fila.metadata);
    if (fila.entityId) {
      if (fila.entityType === "learner_profile") learnerIds.add(fila.entityId);
      else if (fila.entityType === "person") personIds.add(fila.entityId);
      else if (fila.entityType === "operation72") op72Ids.add(fila.entityId);
      else if (fila.entityType === "app_user") userIds.add(fila.entityId);
      else if (fila.entityType === "faith_house_group") casaIds.add(fila.entityId);
      else if (fila.entityType === "alpha_program") alphaIds.add(fila.entityId);
      else if (fila.entityType === "event") eventIds.add(fila.entityId);
    }
    for (const clave of ["learnerId"]) {
      const v = texto(m[clave]);
      if (v) learnerIds.add(v);
    }
    for (const clave of ["personId"]) {
      const v = texto(m[clave]);
      if (v) personIds.add(v);
    }
    for (const clave of ["mentorId", "consolidadorId", "liderId", "porMentor", "consolidadorNuevoId"]) {
      const v = texto(m[clave]);
      if (v) userIds.add(v);
    }
  }
  for (const correo of correos) {
    if (correo.learnerId) learnerIds.add(correo.learnerId);
    if (correo.personId) personIds.add(correo.personId);
  }

  const [aprendices, operaciones, personas, usuarios, casas, alphas, eventos] = await Promise.all([
    learnerIds.size
      ? prisma.learnerProfile.findMany({
          where: { id: { in: [...learnerIds] } },
          select: { id: true, personId: true, person: { select: { firstName: true, lastName: true } } },
        })
      : [],
    op72Ids.size
      ? prisma.operation72.findMany({
          where: { id: { in: [...op72Ids] } },
          select: {
            id: true,
            learnerId: true,
            learner: { select: { personId: true, person: { select: { firstName: true, lastName: true } } } },
          },
        })
      : [],
    personIds.size
      ? prisma.person.findMany({
          where: { id: { in: [...personIds] } },
          select: { id: true, firstName: true, lastName: true, learnerProfile: { select: { id: true } } },
        })
      : [],
    userIds.size
      ? prisma.appUser.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, fullName: true } })
      : [],
    casaIds.size
      ? prisma.faithHouseGroup.findMany({ where: { id: { in: [...casaIds] } }, select: { id: true, name: true } })
      : [],
    alphaIds.size
      ? prisma.alphaProgram.findMany({ where: { id: { in: [...alphaIds] } }, select: { id: true, name: true } })
      : [],
    eventIds.size
      ? prisma.event.findMany({ where: { id: { in: [...eventIds] } }, select: { id: true, title: true } })
      : [],
  ]);

  type Sujeto = { nombre: string; href: string; learnerId: string | null };
  const porLearner = new Map<string, Sujeto>();
  const porPersona = new Map<string, Sujeto>();
  const porOp72 = new Map<string, Sujeto>();
  for (const a of aprendices) {
    const s = { nombre: nombreCompleto(a.person), href: `/expediente/${a.id}`, learnerId: a.id };
    porLearner.set(a.id, s);
    porPersona.set(a.personId, s);
  }
  for (const p of personas) {
    if (!porPersona.has(p.id)) {
      porPersona.set(p.id, {
        nombre: nombreCompleto(p),
        href: p.learnerProfile ? `/expediente/${p.learnerProfile.id}` : `/administracion/${p.id}`,
        learnerId: p.learnerProfile?.id ?? null,
      });
    }
  }
  for (const o of operaciones) {
    const s = { nombre: nombreCompleto(o.learner.person), href: `/expediente/${o.learnerId}`, learnerId: o.learnerId };
    porOp72.set(o.id, s);
    porLearner.set(o.learnerId, s);
  }
  const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.fullName]));
  const nombreCasa = new Map(casas.map((c) => [c.id, c.name]));
  const nombreAlpha = new Map(alphas.map((a) => [a.id, a.name]));
  const tituloEvento = new Map(eventos.map((e) => [e.id, e.title]));

  const correosPorLearner = new Map<string, (typeof correos)[number][]>();
  for (const c of correos) {
    if (!c.learnerId) continue;
    correosPorLearner.set(c.learnerId, [...(correosPorLearner.get(c.learnerId) ?? []), c]);
  }
  const intentosPorLearner = new Map<string, typeof intentos>();
  for (const i of intentos) {
    const k = i.operation72.learnerId;
    intentosPorLearner.set(k, [...(intentosPorLearner.get(k) ?? []), i]);
  }

  const cerca = (a: Date, b: Date, segundos = 120) => Math.abs(a.getTime() - b.getTime()) <= segundos * 1000;

  const movimientos: Movimiento[] = [];
  const correosUsados = new Set<string>();

  for (const fila of auditoria) {
    const m = meta(fila.metadata);
    const sujeto: Sujeto | null =
      (fila.entityType === "learner_profile" && fila.entityId && porLearner.get(fila.entityId)) ||
      (fila.entityType === "person" && fila.entityId && porPersona.get(fila.entityId)) ||
      (fila.entityType === "operation72" && fila.entityId && porOp72.get(fila.entityId)) ||
      (texto(m.learnerId) && porLearner.get(texto(m.learnerId)!)) ||
      (texto(m.personId) && porPersona.get(texto(m.personId)!)) ||
      null;

    const origenCrm = m.origen === "highlevel" || fila.action.startsWith("highlevel.");
    const actor =
      fila.actor?.fullName ?? (origenCrm ? "La línea, desde el CRM" : "El sistema");
    const P = (): Trozo =>
      sujeto ? { texto: sujeto.nombre, negrita: true, href: sujeto.href } : { texto: "una persona", negrita: true };
    const A = (): Trozo => ({ texto: actor, negrita: true });
    const usuario = (clave: string) => {
      const id = texto(m[clave]);
      return id ? (nombreUsuario.get(id) ?? "un usuario") : null;
    };
    const t = (texto: string): Trozo => ({ texto });
    const b = (texto: string): Trozo => ({ texto, negrita: true });

    let tipo: TipoActividad = "personas";
    let etiqueta = "PERSONAS";
    let tono: Tono = "gris";
    let frase: Trozo[] | null = null;
    let observacion: string | null = null;
    const filas: { k: string; v: string }[] = [];
    let correo: CorreoPrevisualizable | null = null;
    let tituloDetalle = "";

    const intentoCercano = () =>
      sujeto?.learnerId
        ? (intentosPorLearner.get(sujeto.learnerId) ?? []).find((i) => cerca(i.createdAt, fila.createdAt))
        : undefined;

    switch (fila.action) {
      case "operacion72.contacto_registrado": {
        tipo = "op72"; etiqueta = origenCrm ? "CRM" : "OP 72"; tono = origenCrm ? "ambar" : "azul";
        const resultado = texto(m.resultado);
        const salida = resultado && resultado in ETIQUETA_LLAMADA ? ETIQUETA_LLAMADA[resultado as keyof typeof ETIQUETA_LLAMADA].toLowerCase() : "llamada registrada";
        const contactada = m.contactada === true;
        frase = [A(), t(" llamó a "), P(), t(` · ${salida} · `), b(contactada ? "pasa a CONTACTADA" : "sigue en SEGUIMIENTO")];
        const i = intentoCercano();
        tituloDetalle = "Lo que se registró en la llamada";
        filas.push({ k: "Cómo salió", v: salida });
        if (i?.note) { observacion = i.note; filas.push({ k: "Observación", v: i.note }); }
        filas.push({ k: "Quedó en", v: contactada ? "CONTACTADA" : "SEGUIMIENTO" });
        break;
      }
      case "operacion72.visita_agendada": {
        tipo = "op72"; etiqueta = origenCrm ? "CRM" : "OP 72"; tono = origenCrm ? "ambar" : "azul";
        const cuando = texto(m.cuando) ?? texto(m.fechaVisita);
        const fecha = cuando ? new Date(cuando) : null;
        const donde = m.virtual === true ? "virtual" : texto(m.lugar);
        frase = [A(), t(" agendó visita a "), P(), t(fecha && !Number.isNaN(fecha.getTime()) ? ` · ${momentoLegible(fecha, ahora)}` : ""), t(donde ? ` · ${donde}` : ""), t(" · "), b("pasa a VISITA PENDIENTE")];
        tituloDetalle = "La visita acordada";
        if (fecha && !Number.isNaN(fecha.getTime())) filas.push({ k: "Cuándo", v: momentoLegible(fecha, ahora) });
        if (donde) filas.push({ k: "Dónde", v: donde });
        const i = intentoCercano();
        if (i?.note) { observacion = i.note; filas.push({ k: "Nota", v: i.note }); }
        break;
      }
      case "operacion72.visita_cerrada": {
        tipo = "op72"; etiqueta = "OP 72"; tono = "azul";
        frase = [A(), t(" cerró la visita de "), P(), t(" · "), b("pasa a LISTA PARA ENTREGA")];
        observacion = texto(m.resumen);
        tituloDetalle = "El resumen de la visita";
        if (observacion) filas.push({ k: "Resumen", v: observacion });
        break;
      }
      case "operacion72.estado_corregido": {
        tipo = "op72"; etiqueta = "OP 72"; tono = "azul";
        const de = texto(m.de);
        const a = texto(m.a);
        frase = [t("Se corrigió la columna de "), P(), t(" · "), b(`${de ?? "?"} → ${a ?? "?"}`)];
        tituloDetalle = "Por qué se corrigió";
        if (de) filas.push({ k: "Estaba en", v: de });
        if (a) filas.push({ k: "Pasa a", v: a });
        observacion = texto(m.motivo);
        if (observacion) filas.push({ k: "Motivo", v: observacion });
        break;
      }
      case "operacion72.entregada": {
        tipo = "mentoria"; etiqueta = "MENTORÍA"; tono = "verde";
        const mentor = usuario("mentorId");
        frase = mentor
          ? [A(), t(" entregó a "), P(), t(" al mentor "), b(mentor)]
          : [A(), t(" cerró la Operación 72 de "), P(), t(" · pasa a Fortalecer")];
        tituloDetalle = "La entrega";
        if (mentor) filas.push({ k: "Mentor", v: mentor });
        const c = sujeto?.learnerId
          ? (correosPorLearner.get(sujeto.learnerId) ?? []).find((x) => x.kind === "entrega_a_mentor" && cerca(x.createdAt, fila.createdAt, 300))
          : undefined;
        if (c) {
          correosUsados.add(c.id);
          correo = { asunto: c.subject, para: c.to, enviado: c.sent, motivo: c.failure, html: c.html };
          frase.push(t(c.sent ? " · correo enviado" : " · el correo no salió"));
        }
        break;
      }
      case "mentor.asignado":
        continue; // va junto con operacion72.entregada
      case "administracion.mentor_asignado": {
        tipo = "mentoria"; etiqueta = "MENTORÍA"; tono = "verde";
        const mentor = usuario("mentorId");
        frase = mentor
          ? [A(), t(" asignó a "), b(mentor), t(" como mentor de "), P()]
          : [A(), t(" quitó el mentor de "), P()];
        tituloDetalle = "La asignación";
        if (mentor) filas.push({ k: "Mentor", v: mentor });
        const c = sujeto?.learnerId
          ? (correosPorLearner.get(sujeto.learnerId) ?? []).find((x) => x.kind === "entrega_a_mentor" && cerca(x.createdAt, fila.createdAt, 300))
          : undefined;
        if (c) {
          correosUsados.add(c.id);
          correo = { asunto: c.subject, para: c.to, enviado: c.sent, motivo: c.failure, html: c.html };
          frase.push(t(c.sent ? " · correo enviado" : " · el correo no salió"));
        }
        break;
      }
      case "fase.cambiada": {
        tipo = "mentoria"; etiqueta = "FASE"; tono = "verde";
        const de = (texto(m.de) ?? texto(m.desde)) as Phase | null;
        const a = (texto(m.a) ?? texto(m.hasta)) as Phase | null;
        frase = [A(), t(" pasó a "), P(), t(" de "), b(de ? FASE[de] ?? de : "?"), t(" a "), b(a ? FASE[a] ?? a : "?")];
        observacion = texto(m.nota);
        tituloDetalle = "El cambio de fase";
        filas.push({ k: "De", v: de ? FASE[de] ?? de : "?" }, { k: "A", v: a ? FASE[a] ?? a : "?" });
        if (observacion) filas.push({ k: "Nota", v: observacion });
        break;
      }
      case "hito.registrado":
      case "administracion.hito_editado": {
        tipo = "mentoria"; etiqueta = "HITO"; tono = "verde";
        const kind = texto(m.hito);
        const nombre = HITOS_DEL_RECORRIDO.find((h) => h.kind === kind)?.etiqueta ?? kind ?? "hito";
        const completado = m.completado === false ? "desmarcó" : "marcó";
        frase = [A(), t(` ${completado} el hito `), b(nombre), t(" de "), P()];
        break;
      }
      case "operacion72.dado_de_baja":
      case "administracion.dado_de_baja": {
        tipo = "personas"; etiqueta = "BAJA"; tono = "rojo";
        const motivo = texto(m.motivo);
        frase = [A(), t(" dio de baja a "), P(), t(motivo ? ` · «${motivo}»` : "")];
        observacion = texto(m.nota);
        tituloDetalle = "El motivo de la baja";
        if (motivo) filas.push({ k: "Motivo", v: motivo });
        if (observacion) filas.push({ k: "Nota", v: observacion });
        break;
      }
      case "administracion.reactivado":
        tipo = "personas"; etiqueta = "PERSONAS"; tono = "verde";
        frase = [A(), t(" reactivó a "), P()];
        break;
      case "persona.registrada": {
        tipo = "personas"; etiqueta = "REGISTRO"; tono = "azul";
        const soloFicha = m.sinOperacion72 === true;
        frase = [A(), t(" registró a "), P(), t(soloFicha ? " · solo la ficha, sin Operación 72" : " · entra a "), ...(soloFicha ? [] : [b("INICIADA")])];
        break;
      }
      case "consolidador.asignado": {
        tipo = "op72"; etiqueta = "OP 72"; tono = "azul";
        const c = usuario("consolidadorId");
        frase = [P(), t(" → consolidador asignado: "), b(c ?? "?"), t(texto(m.criterio) ? ` · ${texto(m.criterio)}` : "")];
        break;
      }
      case "operacion72.iniciada":
        continue; // redundante con persona.registrada
      case "highlevel.registro_importado":
        tipo = "crm"; etiqueta = "CRM"; tono = "ambar";
        frase = [b("HighLevel"), t(" registró a "), P(), t(" desde el formulario de registro")];
        tituloDetalle = "Lo que llegó de HighLevel";
        for (const [k, v] of Object.entries(m)) if (typeof v === "string" || typeof v === "number") filas.push({ k, v: String(v) });
        break;
      case "highlevel.registro_repetido":
        tipo = "crm"; etiqueta = "CRM"; tono = "ambar";
        frase = [b("HighLevel"), t(" volvió a enviar el registro de "), P(), t(" · ya existía; se completaron datos")];
        break;
      case "highlevel.contacto_vinculado":
        tipo = "crm"; etiqueta = "CRM"; tono = "ambar";
        frase = [b("HighLevel"), t(" enlazó su contacto con "), P()];
        break;
      case "highlevel.seguimiento_recibido": {
        tipo = "crm"; etiqueta = "CRM"; tono = "ambar";
        const aplicado = texto(m.aplicado);
        frase = [b("HighLevel"), t(" envió el formulario de la línea sobre "), P(), t(aplicado === "visita" ? " · visita agendada" : aplicado === "llamada" ? " · llamada registrada" : " · sin cambios")];
        tituloDetalle = "Lo que llegó de HighLevel";
        for (const [k, v] of Object.entries(m)) if (typeof v === "string") filas.push({ k, v });
        break;
      }
      case "duplicado.detectado":
        tipo = "personas"; etiqueta = "DUPLICADO"; tono = "ambar";
        frase = [A(), t(" intentó registrar a alguien que ya existía"), t(texto(m.telefono) ? ` · ${texto(m.telefono)}` : "")];
        break;
      case "casa_de_fe.grupo_abierto":
      case "casa_de_fe.grupo_cerrado": {
        tipo = "grupos"; etiqueta = "GRUPOS"; tono = "verde";
        const nombre = (fila.entityId && nombreCasa.get(fila.entityId)) ?? "una Casa de Fe";
        frase = [A(), t(fila.action.endsWith("abierto") ? " abrió la Casa de Fe " : " cerró la Casa de Fe "), b(nombre), ...(usuario("liderId") ? [t(" · líder: "), b(usuario("liderId")!)] : [])];
        break;
      }
      case "casa_de_fe.miembro_inscrito":
      case "casa_de_fe.miembro_retirado": {
        tipo = "grupos"; etiqueta = "GRUPOS"; tono = "verde";
        const nombre = (fila.entityId && nombreCasa.get(fila.entityId)) ?? "una Casa de Fe";
        frase = [A(), t(fila.action.endsWith("inscrito") ? " inscribió a " : " retiró a "), P(), t(fila.action.endsWith("inscrito") ? " en la Casa de Fe " : " de la Casa de Fe "), b(nombre)];
        break;
      }
      case "casa_de_fe.tema_actualizado":
        tipo = "grupos"; etiqueta = "GRUPOS"; tono = "verde";
        frase = [A(), t(" actualizó el tema "), b(`${texto(m.tema) ?? ""} ${texto(m.nombre) ?? ""}`.trim()), t(" de "), P(), t(texto(m.estado) ? ` · ${texto(m.estado)}` : "")];
        break;
      case "alpha.grupo_creado": {
        tipo = "grupos"; etiqueta = "GRUPOS"; tono = "verde";
        const nombre = texto(m.nombre) ?? (fila.entityId && nombreAlpha.get(fila.entityId)) ?? "un grupo";
        frase = [A(), t(" creó el grupo de Alpha "), b(nombre), ...(usuario("liderId") ? [t(" · líder: "), b(usuario("liderId")!)] : [])];
        break;
      }
      case "alpha.focus_day":
        tipo = "grupos"; etiqueta = "ALPHA"; tono = "verde";
        frase = [A(), t(m.completado === false ? " desmarcó el Focus Day de una inscripción a Alpha" : " marcó el Focus Day de una inscripción a Alpha")];
        break;
      case "alpha.validado":
      case "alpha.desvalidado":
        tipo = "grupos"; etiqueta = "ALPHA"; tono = "verde";
        frase = [A(), t(fila.action.endsWith("validado") && !fila.action.startsWith("alpha.des") ? " validó el Alpha de " : " deshizo la validación del Alpha de "), P()];
        observacion = texto(m.razon);
        break;
      case "escuela.inscripcion":
      case "escuela.cerrada":
      case "servicio.registrado":
      case "servicio.estado_cambiado":
        tipo = "eventos"; etiqueta = "ESCUELA"; tono = "verde";
        frase = [A(), t(
          fila.action === "escuela.inscripcion" ? " inscribió en la Escuela a "
          : fila.action === "escuela.cerrada" ? " cerró la Escuela de "
          : fila.action === "servicio.registrado" ? ` registró el servicio ${texto(m.ministerio) ? `«${texto(m.ministerio)}» ` : ""}de `
          : ` cambió el estado del servicio de `), P()];
        break;
      case "evento.creado":
      case "evento.publicado":
      case "evento.despublicado":
      case "evento.cancelado": {
        tipo = "eventos"; etiqueta = "EVENTOS"; tono = "verde";
        const titulo = texto(m.titulo) ?? (fila.entityId && tituloEvento.get(fila.entityId)) ?? "un evento";
        const verbo = fila.action === "evento.creado" ? " creó el evento " : fila.action === "evento.publicado" ? " publicó el evento " : fila.action === "evento.despublicado" ? " despublicó el evento " : " canceló el evento ";
        frase = [A(), t(verbo), b(titulo)];
        break;
      }
      case "evento.inscripcion":
      case "evento.asistencia": {
        tipo = "eventos"; etiqueta = "EVENTOS"; tono = "verde";
        const titulo = (fila.entityId && tituloEvento.get(fila.entityId)) ?? "un evento";
        frase = fila.action === "evento.inscripcion"
          ? [A(), t(" inscribió a "), P(), t(" en "), b(titulo)]
          : [A(), t(" marcó "), b(texto(m.estado) ?? "asistencia"), t(" de "), P(), t(" en "), b(titulo)];
        break;
      }
      case "administracion.acceso_creado":
      case "equipo.acceso_creado":
        tipo = "accesos"; etiqueta = "ACCESOS"; tono = "gris";
        frase = [A(), t(" creó el acceso de "), P(), t(texto(m.role) ? ` · rol ${texto(m.role)}` : texto(m.tipo) ? ` · ${texto(m.tipo)}` : "")];
        break;
      case "administracion.rol_actualizado": {
        tipo = "accesos"; etiqueta = "ACCESOS"; tono = "gris";
        const quien = (fila.entityId && nombreUsuario.get(fila.entityId)) ?? "un usuario";
        frase = [A(), t(" actualizó el rol y permisos de "), b(quien)];
        tituloDetalle = "Lo que cambió";
        for (const [k, v] of Object.entries(m)) if (["string", "number", "boolean"].includes(typeof v)) filas.push({ k, v: String(v) });
        break;
      }
      case "equipo.lider_asignado": {
        tipo = "accesos"; etiqueta = "ACCESOS"; tono = "gris";
        const quien = (fila.entityId && nombreUsuario.get(fila.entityId)) ?? "un usuario";
        frase = [A(), t(m.activo === false ? " quitó el permiso de " : " dio el permiso de "), b(texto(m.tipo) ?? "líder"), t(" a "), b(quien)];
        break;
      }
      case "administracion.contrasena_restablecida":
        tipo = "accesos"; etiqueta = "ACCESOS"; tono = "gris";
        frase = [A(), t(" restableció la contraseña de "), P(), t(m.correoEnviado === true ? " · correo enviado" : m.avisadaPorCorreo === true ? " · el correo no salió" : "")];
        break;
      case "acceso.recuperacion_solicitada":
        tipo = "accesos"; etiqueta = "ACCESOS"; tono = "gris";
        frase = [b(texto(m.email) ?? "Alguien"), t(" pidió recuperar su contraseña"), t(m.correoEnviado === true ? " · correo enviado" : m.correoEnviado === false ? " · el correo no salió" : "")];
        break;
      case "acceso.contrasena_recuperada":
        tipo = "accesos"; etiqueta = "ACCESOS"; tono = "gris";
        frase = [A(), t(" creó su contraseña nueva desde el enlace de recuperación")];
        break;
      case "administracion.datos_actualizados":
      case "expediente.datos_actualizados":
        tipo = "personas"; etiqueta = "PERSONAS"; tono = "gris";
        frase = [A(), t(" actualizó los datos de "), P()];
        break;
      case "notas.reveladas":
        tipo = "personas"; etiqueta = "NOTAS"; tono = "gris";
        frase = [A(), t(" abrió las notas pastorales de "), P()];
        break;
      case "consolidador.reasignado": {
        // Dos formatos conviven: el de las reasignaciones hechas a mano en
        // agosto/septiembre (`consolidadorNuevoId`) y el de la sincronización
        // de doble vía (`origen` + `anterior`/`nuevo`, ver consolidador.ts).
        const deCrm = texto(m.origen) === "highlevel";
        tipo = deCrm ? "crm" : "op72";
        etiqueta = deCrm ? "CRM" : "OP 72";
        tono = deCrm ? "ambar" : "azul";
        const ahora = texto(m.nuevo) ?? usuario("consolidadorNuevoId");
        const antes = texto(m.anterior) ?? usuario("consolidadorAnteriorId");
        frase = antes || texto(m.origen)
          ? [
              P(),
              t(" → cambió de consolidador: "),
              b(antes ?? "sin consolidador"),
              t(" → "),
              b(ahora ?? "sin consolidador"),
              t(deCrm ? " · lo asignó HighLevel" : ""),
            ]
          : [A(), t(" reasignó a "), P(), t(" al consolidador "), b(ahora ?? "?")];
        break;
      }
      case "liderazgo.datos_actualizados": {
        tipo = "personas"; etiqueta = "LIDERAZGO"; tono = "azul";
        const creada = m.creada === true;
        const quien = texto(m.nombre) ?? "Alguien del liderazgo";
        frase = [
          b(quien),
          t(creada
            ? " se registró desde el formulario de liderazgo"
            : " actualizó sus datos desde el formulario de liderazgo"),
        ];
        tituloDetalle = "Lo que llenó";
        const hitos = Array.isArray(m.hitos) ? m.hitos : [];
        if (hitos.length) filas.push({ k: "Hitos", v: hitos.join(" · ") });
        const roles = Array.isArray(m.rolesDeclarados) ? m.rolesDeclarados : [];
        if (roles.length) filas.push({ k: "Dice que sirve en", v: roles.join(", ") });
        if (texto(m.etapaAplicada)) filas.push({ k: "Etapa", v: String(m.etapaAplicada) });
        if (texto(m.etapaPendiente)) filas.push({ k: "Etapa declarada (sin confirmar)", v: String(m.etapaPendiente) });
        const cambios = Array.isArray(m.cambios) ? m.cambios : [];
        if (cambios.length) filas.push({ k: "Cambió", v: cambios.join(", ") });
        break;
      }
      case "liderazgo.declaracion_confirmada":
        tipo = "personas"; etiqueta = "LIDERAZGO"; tono = "verde";
        frase = [A(), t(" confirmó lo que declaró "), P()];
        break;
      case "liderazgo.declaracion_descartada":
        tipo = "personas"; etiqueta = "LIDERAZGO"; tono = "gris";
        frase = [A(), t(" descartó lo que declaró "), P()];
        break;
      case "registro_publico.recibido":
        tipo = "personas"; etiqueta = "REGISTRO"; tono = "azul";
        frase = [b("El formulario público"), t(" recibió un registro"), ...(sujeto ? [t(" de "), P()] : [])];
        break;
      default:
        tipo = "personas"; etiqueta = fila.action.split(".")[0].toUpperCase(); tono = "gris";
        frase = [A(), t(` · ${fila.action}`), ...(sujeto ? [t(" · "), P()] : [])];
    }

    movimientos.push({
      id: fila.id,
      cuando: fila.createdAt.toISOString(),
      hora: hora(fila.createdAt),
      franja: franja(fila.createdAt),
      tipo,
      etiqueta,
      tono,
      frase,
      observacion,
      detalle: filas.length || correo ? { titulo: tituloDetalle || "Detalle", filas, correo } : null,
      buscable: [actor, sujeto?.nombre ?? "", ...frase.map((x) => x.texto)].join(" ").toLowerCase(),
    });
  }

  // Correos que no quedaron pegados a una entrega (credenciales, contraseñas…).
  for (const c of correos) {
    if (correosUsados.has(c.id)) continue;
    const sujeto = (c.learnerId && porLearner.get(c.learnerId)) || (c.personId && porPersona.get(c.personId)) || null;
    movimientos.push({
      id: `correo-${c.id}`,
      cuando: c.createdAt.toISOString(),
      hora: hora(c.createdAt),
      franja: franja(c.createdAt),
      tipo: "accesos",
      etiqueta: "CORREO",
      tono: c.sent ? "gris" : "rojo",
      frase: [{ texto: "El sistema", negrita: true }, { texto: c.sent ? " envió un correo a " : " no pudo enviar un correo a " }, { texto: c.to, negrita: true }, { texto: ` · ${c.subject}` }],
      observacion: c.sent ? null : c.failure,
      detalle: { titulo: "El correo", filas: [], correo: { asunto: c.subject, para: c.to, enviado: c.sent, motivo: c.failure, html: c.html } },
      buscable: [c.to, c.subject, sujeto?.nombre ?? ""].join(" ").toLowerCase(),
    });
  }

  // Llamadas reales del CRM.
  for (const l of llamadasCrm) {
    const quien = l.appUser?.fullName ?? l.callerName ?? "Alguien en el CRM";
    const aQuien = l.contactName ?? "un contacto";
    const minutos = Math.round(l.durationSeconds / 60);
    const duracion = l.durationSeconds ? (minutos >= 1 ? `${minutos} min` : `${l.durationSeconds} s`) : null;
    movimientos.push({
      id: `llamada-${l.id}`,
      cuando: l.startedAt.toISOString(),
      hora: hora(l.startedAt),
      franja: franja(l.startedAt),
      tipo: "llamadas",
      etiqueta: "LLAMADA CRM",
      tono: l.answered ? "azul" : "gris",
      frase: [{ texto: quien, negrita: true }, { texto: l.direction === "inbound" ? " recibió llamada de " : " llamó a " }, { texto: aQuien, negrita: true }, { texto: l.answered ? ` · contestó${duracion ? ` · ${duracion}` : ""}` : " · no contestó" }],
      observacion: null,
      detalle: { titulo: "La llamada", filas: [{ k: "Estado", v: l.status ?? "?" }, { k: "Duración", v: duracion ?? "0 s" }, { k: "Dirección", v: l.direction === "inbound" ? "entrante" : "saliente" }], correo: null },
      buscable: [quien, aQuien].join(" ").toLowerCase(),
    });
  }

  movimientos.sort((a, b) => (a.cuando < b.cuando ? 1 : -1));

  const porTipo = Object.fromEntries(TIPOS_DE_ACTIVIDAD.map((tt) => [tt.valor, 0])) as Record<TipoActividad, number>;
  for (const mv of movimientos) porTipo[mv.tipo] += 1;

  const conteos = {
    registros: auditoria.filter((f) => f.action === "persona.registrada").length,
    llamadas: auditoria.filter((f) => f.action === "operacion72.contacto_registrado").length,
    contactadas: auditoria.filter((f) => f.action === "operacion72.contacto_registrado" && meta(f.metadata).contactada === true).length,
    visitas: auditoria.filter((f) => f.action === "operacion72.visita_agendada" || f.action === "operacion72.visita_cerrada").length,
    entregas: auditoria.filter((f) => f.action === "operacion72.entregada" || f.action === "administracion.mentor_asignado").length,
    fases: auditoria.filter((f) => f.action === "fase.cambiada").length,
  };

  const tipoFiltro = TIPOS_DE_ACTIVIDAD.some((tt) => tt.valor === opciones.tipo) ? (opciones.tipo as TipoActividad) : null;
  const consulta = (opciones.consulta ?? "").trim().toLowerCase();
  const filtrados = movimientos.filter(
    (mv) => (!tipoFiltro || mv.tipo === tipoFiltro) && (!consulta || mv.buscable.includes(consulta)),
  );

  return {
    dia,
    etiquetaDia: FORMATO_DIA_LARGO.format(new Date(`${dia}T12:00:00-05:00`)),
    diaAnterior: sumarDias(dia, -1),
    diaSiguiente: sumarDias(dia, 1),
    esHoy: dia === diaDeHoy(ahora),
    movimientos: filtrados,
    conteos,
    porTipo,
    total: movimientos.length,
  };
}
