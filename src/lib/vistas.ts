import type { Role } from "@iglesia/prisma-client";
import {
  PERMISOS_QUE_ABREN,
  POR_DEFECTO_SEGUN_ROL,
  VISTAS,
  type VistaId,
} from "@/lib/vistas-catalogo";

/// **Quién ve qué pantalla.** Es la regla que sustituye a los predicados de rol
/// que había repartidos por `auth.ts`, `alpha.ts`, `entrenar.ts` y `eventos.ts`.
///
/// Este módulo es **puro**: no toca la base. Recibe las filas ya cargadas y
/// decide. Así se puede probar sin conexión (`vistas.test.ts`), que es lo que
/// permite comprobar la promesa que más importa — que sin configurar nada, cada
/// rol ve exactamente lo que veía antes.

/// Lo que hace falta saber de una cuenta para resolver sus vistas. Es un
/// subconjunto de `UsuarioSesion`, escrito aparte para que este módulo no
/// dependa de `auth.ts` (que sí importa Prisma).
export type PerfilParaVistas = {
  role: Role;
  canLeadAlpha: boolean;
  canLeadFaithHouse: boolean;
  canMentor: boolean;
  coordinaConsolidacion: boolean;
  veTodosLosGrupos: boolean;
};

export type FilaDeVistaPorRol = { view: string; role: Role; enabled: boolean };
export type FilaDeVistaPorCuenta = { view: string; enabled: boolean };

export type ConfiguracionDeVistas = {
  porRol: readonly FilaDeVistaPorRol[];
  porCuenta: readonly FilaDeVistaPorCuenta[];
};

export const SIN_CONFIGURAR: ConfiguracionDeVistas = {
  porRol: [],
  porCuenta: [],
};

/// **El valor de fábrica de una vista para una cuenta**: lo que veía antes de
/// que existiera el configurador.
///
/// ⚠️ Mira el rol **y los permisos acumulables**, y esa segunda mitad es la que
/// evita una regresión el día del despliegue: hoy 10 de los 11 consolidadores
/// ven «Alpha y Casa de Fe» por la casilla «Líder de Alpha», no por su rol. Con
/// un defecto que mirara solo el rol, esas diez personas perderían la pantalla
/// en el momento en que esto entrara en producción.
export function porDefecto(
  vista: VistaId,
  perfil: PerfilParaVistas,
): boolean {
  if (POR_DEFECTO_SEGUN_ROL[vista].includes(perfil.role)) return true;

  for (const permiso of PERMISOS_QUE_ABREN[vista] ?? []) {
    if (perfil[permiso]) return true;
  }
  return false;
}

/// La decisión final para UNA vista, en el orden que importa:
///
/// 1. **La excepción de la cuenta**, si la hay. Es lo más específico: alguien
///    se sentó a decidir sobre esta persona.
/// 2. **La fila de su rol**, si la hay.
/// 3. **El defecto del catálogo** — el comportamiento de siempre.
///
/// ⚠️ Los permisos acumulables entran **solo en el paso 3**. En cuanto hay una
/// fila configurada para ese rol, manda la fila: si no fuera así, apagar una
/// vista desde la pantalla no surtiría efecto en quien tuviera la casilla
/// puesta, y el interruptor estaría mintiendo.
export function vistaHabilitada(
  vista: VistaId,
  perfil: PerfilParaVistas,
  configuracion: ConfiguracionDeVistas,
): boolean {
  const excepcion = configuracion.porCuenta.find((f) => f.view === vista);
  if (excepcion) return excepcion.enabled;

  const deSuRol = configuracion.porRol.find(
    (f) => f.view === vista && f.role === perfil.role,
  );
  if (deSuRol) return deSuRol.enabled;

  return porDefecto(vista, perfil);
}

/// Todas las vistas encendidas de una cuenta, en el orden del catálogo (que es
/// el orden en que salen en la barra superior).
export function vistasHabilitadas(
  perfil: PerfilParaVistas,
  configuracion: ConfiguracionDeVistas,
): VistaId[] {
  return VISTAS.filter((v) => vistaHabilitada(v.id, perfil, configuracion)).map(
    (v) => v.id,
  );
}
