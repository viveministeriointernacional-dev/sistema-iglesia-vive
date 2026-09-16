import Link from "next/link";
import { Role } from "@iglesia/prisma-client";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { porDefecto } from "@/lib/vistas";
import {
  VISTAS,
  VISTAS_FUERA_DEL_CONFIGURADOR,
} from "@/lib/vistas-catalogo";
import { MatrizDeVistas, type EstadoInicial } from "./matriz";

export const metadata = { title: "Vistas de la plataforma · Iglesia Vive" };
export const dynamic = "force-dynamic";

const ORDEN_ROLES: Role[] = [
  Role.APRENDIZ,
  Role.CONSOLIDADOR,
  Role.LIDER_ALPHA,
  Role.MENTOR,
  Role.PASTOR,
  Role.ADMIN,
];

export default async function PaginaVistas() {
  await requerirRol(ROLES_ADMIN);
  const prisma = await getPrisma();

  const [filas, cuentas] = await Promise.all([
    prisma.viewRoleAccess.findMany({ select: { view: true, role: true, enabled: true } }),
    prisma.appUser.groupBy({
      by: ["role"],
      where: { active: true },
      _count: { _all: true },
    }),
  ]);

  const porRol = new Map(filas.map((f) => [`${f.view}|${f.role}`, f.enabled]));
  const cuentasPorRol = new Map(cuentas.map((c) => [c.role, c._count._all]));

  // El valor de cada casilla: la fila guardada si existe, y si no el defecto —
  // lo que ese rol veía antes de que existiera esta pantalla.
  //
  // ⚠️ El defecto se calcula sobre un perfil SIN permisos acumulables, así que
  // es «lo que da el rol por sí solo». Una persona con la casilla de líder de
  // Alpha puede ver esa pantalla aunque aquí salga apagada — y eso se dice en
  // el aviso de abajo, porque si no la tabla parecería mentir.
  const inicial: EstadoInicial = {};
  for (const vista of VISTAS) {
    inicial[vista.id] = {};
    for (const rol of ORDEN_ROLES) {
      inicial[vista.id][rol] =
        porRol.get(`${vista.id}|${rol}`) ??
        porDefecto(vista.id, {
          role: rol,
          canLeadAlpha: false,
          canLeadFaithHouse: false,
          canMentor: false,
          coordinaConsolidacion: false,
          veTodosLosGrupos: false,
        });
    }
  }

  const roles = ORDEN_ROLES.map((id) => ({
    id,
    cuentas: cuentasPorRol.get(id) ?? 0,
  }));

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
        <header>
          <Link
            href="/administracion"
            className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline hover:text-tinta"
          >
            ← Administración
          </Link>
          <h1 className="mt-3 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Vistas de la plataforma
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Qué menús ve cada perfil. Lo que aquí se apaga desaparece de la barra
            superior <strong>y se cierra por dirección web</strong>: esconder la
            pestaña sin cerrar la página sería solo cosmético.
          </p>
        </header>

        <div className="rounded-r-[10px] border-l-[3px] border-ambar-barra bg-ambar-fondo px-4 py-[14px] text-[12.5px] leading-[1.6] text-ambar-texto">
          <strong>Encender una vista no decide cuánta gente muestra.</strong> La
          columna abre la puerta; la etiqueta de color de cada renglón dice qué
          se ve al entrar. A un mentor con «Procesos» encendida le sale{" "}
          <strong>toda la iglesia</strong>; con «Mi red», <strong>solo su rama</strong>.
          <br />
          Los permisos de la ficha de cada cuenta —líder de Alpha, líder de Casa
          de Fe, coordina la consolidación— <strong>también abren pantallas</strong>{" "}
          mientras el interruptor de su rol no se haya tocado nunca.
        </div>

        <MatrizDeVistas roles={roles} inicial={inicial} />

        <section className="tarjeta p-5">
          <h2 className="etiqueta-seccion">FUERA DEL CONFIGURADOR, A PROPÓSITO</h2>
          <div className="mt-4 flex flex-col gap-[10px]">
            <Fija
              nombre="Administración"
              ruta={VISTAS_FUERA_DEL_CONFIGURADOR[0]}
              candado="SOLO ADMINISTRADOR"
              porQue="Es la pantalla desde la que se crean accesos, se cambian roles y se configura esta misma tabla. Si se pudiera encender desde aquí, cualquiera con ella encendida podría encenderse todo lo demás."
            />
            <Fija
              nombre="Llave maestra"
              ruta={VISTAS_FUERA_DEL_CONFIGURADOR[1]}
              candado="SOLO ADMIN PRINCIPAL"
              porQue="Abre el perfil de cualquier persona de la iglesia, notas pastorales incluidas."
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Fija({
  nombre,
  ruta,
  candado,
  porQue,
}: {
  nombre: string;
  ruta: string;
  candado: string;
  porQue: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[10px] border border-dashed border-[rgba(19,28,36,.18)] bg-papel px-[14px] py-3">
      <div>
        <div className="text-[13.5px] leading-[1.25] font-semibold text-tinta">
          {nombre}
        </div>
        <div className="mt-[3px] font-mono text-[11px] text-[rgba(19,28,36,.42)]">
          {ruta}
        </div>
        <p className="mt-[7px] max-w-[520px] text-[11.5px] leading-[1.5] text-[rgba(19,28,36,.55)]">
          {porQue}
        </p>
      </div>
      <span className="rounded-[20px] border border-[rgba(19,28,36,.09)] bg-white px-[9px] py-[5px] text-[10px] leading-none font-bold tracking-[.06em] whitespace-nowrap text-[rgba(19,28,36,.42)]">
        {candado}
      </span>
    </div>
  );
}
