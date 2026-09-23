import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@iglesia/prisma-client";
import {
  porDefecto,
  vistaHabilitada,
  vistasHabilitadas,
  SIN_CONFIGURAR,
  type PerfilParaVistas,
} from "./vistas";
import { VISTAS, type VistaId } from "./vistas-catalogo";

function perfil(role: Role, extra: Partial<PerfilParaVistas> = {}): PerfilParaVistas {
  return {
    role,
    canLeadAlpha: false,
    canLeadFaithHouse: false,
    canMentor: false,
    coordinaConsolidacion: false,
    veTodosLosGrupos: false,
    llevaGi: false,
    coordinaGi: false,
    ...extra,
  };
}

/// **La promesa que hay que poder demostrar**: desplegar el configurador sin
/// tocar un solo interruptor deja a cada rol viendo exactamente lo que veía.
///
/// Esta tabla NO la derivé del catálogo —eso sería comprobar que una constante
/// es igual a sí misma—, sino de leer los predicados que gobernaban el menú
/// antes del cambio: `tieneRed`, `puedeOperarOperacion72`, `ROLES_CONSOLIDACION`,
/// `puedeVerAlpha`/`puedeVerCasaDeFe`, `ROLES_ENTRENAR`, `ROLES_OPERAN_EVENTOS`,
/// `puedeVerProcesos` y `ROLES_ADMIN`.
///
/// ⚠️ **«gi» es la única excepción, y hay que decirlo: no reconstruye nada.**
/// GI no existía en la plataforma antes del 23-sep-2026, así que su renglón es
/// una decisión (quien acompaña una línea la ve) y no una foto del pasado. Lo
/// demás de esta tabla sí sale de leer los predicados viejos.
const LO_QUE_VEIA_CADA_ROL: Record<Role, VistaId[]> = {
  [Role.APRENDIZ]: ["mi-proceso"],
  [Role.CONSOLIDADOR]: ["operacion-72", "registro-interno", "eventos"],
  [Role.LIDER_ALPHA]: ["eventos"],
  [Role.MENTOR]: ["mi-red", "gi", "grupos", "escuela", "eventos"],
  [Role.PASTOR]: [
    "mi-red",
    "gi",
    "registro-interno",
    "grupos",
    "escuela",
    "eventos",
    "procesos",
  ],
  [Role.ADMIN]: [
    "mi-red",
    "gi",
    "operacion-72",
    "registro-interno",
    "grupos",
    "escuela",
    "eventos",
    "procesos",
    "informe",
    "actividad",
    "llamadas",
    "asistentes",
    "bajas",
  ],
};

test("sin configurar nada, cada rol ve lo mismo que antes del configurador", () => {
  for (const role of Object.values(Role)) {
    assert.deepEqual(
      vistasHabilitadas(perfil(role), SIN_CONFIGURAR).sort(),
      [...LO_QUE_VEIA_CADA_ROL[role]].sort(),
      `cambió lo que ve ${role}`,
    );
  }
});

test("los permisos acumulables siguen abriendo pantallas mientras nadie configure", () => {
  // 10 de los 11 consolidadores ven Alpha por esta casilla y no por su rol.
  // Si esto dejara de valer, perderían la pantalla el día del despliegue.
  assert.equal(
    porDefecto("grupos", perfil(Role.CONSOLIDADOR, { canLeadAlpha: true })),
    true,
  );
  assert.equal(porDefecto("grupos", perfil(Role.CONSOLIDADOR)), false);

  // Quien coordina la consolidación conserva el tablero, sea cual sea su rol.
  assert.equal(
    porDefecto("operacion-72", perfil(Role.PASTOR, { coordinaConsolidacion: true })),
    true,
  );
  assert.equal(porDefecto("operacion-72", perfil(Role.PASTOR)), false);

  // El permiso de mentor abre «Mi red» a un consolidador.
  assert.equal(porDefecto("mi-red", perfil(Role.CONSOLIDADOR, { canMentor: true })), true);
});

test("la fila del rol manda sobre el defecto, incluso sobre un permiso acumulable", () => {
  // Es la regla que hace que el interruptor no mienta: si un administrador
  // apaga «Alpha y Casa de Fe» para los consolidadores, se apaga también para
  // los que tienen la casilla de líder puesta.
  const conCasilla = perfil(Role.CONSOLIDADOR, { canLeadAlpha: true });
  assert.equal(porDefecto("grupos", conCasilla), true);
  assert.equal(
    vistaHabilitada("grupos", conCasilla, {
      porRol: [{ view: "grupos", role: Role.CONSOLIDADOR, enabled: false }],
      porCuenta: [],
    }),
    false,
  );
});

test("la excepción de la cuenta manda sobre la fila de su rol", () => {
  // El caso del líder de intercesión: su rol no le da la pantalla y aun así la ve.
  const pastor = perfil(Role.PASTOR);
  assert.equal(
    vistaHabilitada("llamadas", pastor, {
      porRol: [{ view: "llamadas", role: Role.PASTOR, enabled: false }],
      porCuenta: [{ view: "llamadas", enabled: true }],
    }),
    true,
  );
  // Y al revés: se le puede apagar algo que su rol sí le daba.
  assert.equal(
    vistaHabilitada("escuela", pastor, {
      porRol: [{ view: "escuela", role: Role.PASTOR, enabled: true }],
      porCuenta: [{ view: "escuela", enabled: false }],
    }),
    false,
  );
});

test("la fila de OTRO rol no se aplica por error", () => {
  // `porRol` llega filtrado por el rol de la sesión, pero si alguna vez se
  // cargara entera, una fila ajena no puede decidir por esta cuenta.
  assert.equal(
    vistaHabilitada("escuela", perfil(Role.MENTOR), {
      porRol: [{ view: "escuela", role: Role.APRENDIZ, enabled: false }],
      porCuenta: [],
    }),
    true,
  );
});

test("las vistas salen en el orden del catálogo, que es el de la barra", () => {
  const encendidas = vistasHabilitadas(perfil(Role.ADMIN), SIN_CONFIGURAR);
  const orden = VISTAS.map((v) => v.id).filter((id) => encendidas.includes(id));
  assert.deepEqual(encendidas, orden);
});

test("apagarlo todo deja la barra vacía, sin reventar", () => {
  const todoApagado = VISTAS.map((v) => ({
    view: v.id,
    role: Role.APRENDIZ,
    enabled: false,
  }));
  assert.deepEqual(
    vistasHabilitadas(perfil(Role.APRENDIZ), {
      porRol: todoApagado,
      porCuenta: [],
    }),
    [],
  );
});

test("⚠️ GI la abre el permiso, no el rol: su líder es una joven con cuenta de Alpha", () => {
  // El caso real: Mariana Valentina Narváez, 14 años, líder de GI y con cuenta
  // de LÍDER DE ALPHA. Si GI dependiera del rol, la persona que marca el
  // devocional de cinco jóvenes no vería la pantalla donde se marca.
  assert.equal(porDefecto("gi", perfil(Role.LIDER_ALPHA)), false);
  assert.equal(porDefecto("gi", perfil(Role.LIDER_ALPHA, { llevaGi: true })), true);
  assert.equal(
    porDefecto("gi", perfil(Role.CONSOLIDADOR, { coordinaGi: true })),
    true,
  );
});

test("GI se puede apagar desde el configurador aunque lleve el permiso", () => {
  // Es la regla de siempre: en cuanto hay una fila configurada, manda la fila.
  // Si el permiso la abriera igual, el interruptor estaría mintiendo.
  assert.equal(
    vistaHabilitada("gi", perfil(Role.LIDER_ALPHA, { llevaGi: true }), {
      porRol: [{ view: "gi", role: Role.LIDER_ALPHA, enabled: false }],
      porCuenta: [],
    }),
    false,
  );
});
