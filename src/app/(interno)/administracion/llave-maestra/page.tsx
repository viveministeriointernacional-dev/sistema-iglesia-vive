import Link from "next/link";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { ZONA_HORARIA } from "@/lib/dominio";
import { estadoDeLlaveMaestra } from "@/lib/llave-maestra";
import { getPrisma } from "@/lib/prisma";
import { FormularioLlaveMaestra } from "./formulario";

export const metadata = { title: "Llave maestra · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

export default async function PaginaLlaveMaestra() {
  await requerirRol(ROLES_ADMIN);
  const prisma = await getPrisma();
  const estado = await estadoDeLlaveMaestra(prisma);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[560px]">
        <Link
          href="/administracion"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a administración
        </Link>

        <header className="mt-3">
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Llave maestra
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Con ella entras a cualquier perfil desde la pantalla de ingreso
            normal: escribes el correo de esa persona y la llave maestra en vez
            de su contraseña. Sirve para ver el sistema tal como lo ve cada
            quien, sin pedirle a nadie su clave.
          </p>
        </header>

        <section className="tarjeta mt-5 p-[22px]">
          <p className="etiqueta-seccion">
            {estado.configurada ? "ESTÁ CONFIGURADA" : "TODAVÍA NO HAY LLAVE"}
          </p>

          {estado.configurada ? (
            <div className="mt-3 flex flex-col gap-[6px]">
              <p className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.72)]">
                Cambiada{" "}
                {estado.cambiadaEn ? FECHA_Y_HORA.format(estado.cambiadaEn) : "—"}
                {estado.cambiadaPor ? ` por ${estado.cambiadaPor}` : ""}.
              </p>
              <p className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.72)]">
                {estado.ultimoUso
                  ? `Se usó por última vez el ${FECHA_Y_HORA.format(estado.ultimoUso)}.`
                  : "Todavía no se ha usado."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.72)]">
              Mientras no haya llave maestra, a cada perfil se entra solo con su
              propia contraseña.
            </p>
          )}

          <div className="mt-5 border-t border-[rgba(19,28,36,.09)] pt-5">
            <FormularioLlaveMaestra configurada={estado.configurada} />
          </div>
        </section>

        <section className="aviso-ambar mt-5">
          <p className="text-[10px] leading-none font-bold tracking-[.16em] text-ambar-texto">
            QUÉ TENER EN CUENTA
          </p>
          <ul className="mt-3 flex list-none flex-col gap-[9px] p-0">
            <Punto>
              <strong className="font-bold">No es la contraseña de nadie.</strong>{" "}
              Cambiarla o quitarla no le quita el ingreso a ninguna persona, ni
              cambia la tuya.
            </Punto>
            <Punto>
              <strong className="font-bold">No se puede volver a ver.</strong> Del
              valor solo queda su huella; si se te olvida, se pone una nueva.
            </Punto>
            <Punto>
              <strong className="font-bold">Cada uso queda registrado</strong> en
              «Actividad del día», diciendo a qué perfil se entró y cuándo. Lo que
              el sistema no puede saber es quién la escribió, así que la llave es
              tan privada como la mantengas.
            </Punto>
            <Punto>
              Abre <strong className="font-bold">cualquier</strong> perfil, con lo
              que ese perfil ve: incluidas las notas pastorales de mentores y
              pastores.
            </Punto>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Punto({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-[10px]">
      <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ambar-barra" />
      <span className="text-[12.5px] leading-[1.5] font-medium text-ambar-texto">
        {children}
      </span>
    </li>
  );
}
