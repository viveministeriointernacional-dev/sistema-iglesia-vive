/// **«Cómo va mi línea»: qué grupos se están reuniendo y cuáles no.**
///
/// Es la mitad que el usuario pidió para la mesa directiva: «para que el pastor
/// o el mentor de la organización … puedan ver el historial de eso. O de
/// acuerdo al perfil, de permiso que tenga en el momento».
///
/// ⚠️ **No hay ningún permiso nuevo.** La lista sale de las mismas dos
/// consultas que ya pintan la pantalla de grupos (`cargarGrupos` y
/// `cargarCasasDeFe`), así que cada cuenta ve exactamente lo que ya podía ver:
/// un pastor toda la iglesia, un mentor su línea, un líder lo suyo. Un alcance
/// propio aquí habría sido un tercer sitio donde equivocarse (§12.6).

import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { hoyEnColombia } from "@/lib/dominio";
import { cargarGrupos, puedeVerAlpha } from "@/lib/alpha";
import { cargarCasasDeFe, puedeVerCasaDeFe } from "@/lib/casa-de-fe";
import { diasDeEncuentroDeVariosGrupos } from "@/lib/encuentros";
import {
  avisoDeAbandono,
  cuantoHaceQueNoSeReune,
  ordenarPorAbandono,
  SEMANAS_DE_LA_TIRILLA,
  tirillaDeSemanas,
} from "@/lib/encuentros-catalogo";
import {
  fraseDeLaReunion,
  correrSemana,
  semanaDe,
} from "@/lib/reunion-catalogo";
import { ROTULOS, type ClaveDeSeccion } from "@/lib/tipo-de-grupo";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cómo va mi línea · Iglesia Vive" };

export default async function PaginaDeEncuentros() {
  const usuario = await requerirVista("grupos");
  const hoy = hoyEnColombia();

  const alpha = puedeVerAlpha(usuario) ? await cargarGrupos(usuario) : [];
  const casas = puedeVerCasaDeFe(usuario) ? await cargarCasasDeFe(usuario) : [];

  // Solo los abiertos: un grupo cerrado no se reúne, así que decir que lleva
  // seis semanas sin encuentro sería acusarlo de algo que ya no le toca.
  const abiertosAlpha = alpha.filter((g) => g.closedAt === null);
  const abiertasCasas = casas.filter((g) => g.closedAt === null);

  // La ventana que de verdad se pinta, para no traerse el historial entero.
  const desde = correrSemana(semanaDe(hoy).inicio, -(SEMANAS_DE_LA_TIRILLA - 1));

  const dias = await diasDeEncuentroDeVariosGrupos(
    abiertasCasas.map((g) => g.id),
    abiertosAlpha.map((g) => g.id),
    desde,
  );

  type Fila = {
    id: string;
    clave: ClaveDeSeccion;
    nombre: string;
    pie: string;
    ruta: string;
    ultimoDia: string | null;
    tirilla: { hubo: boolean; desde: string }[];
  };

  function armar(
    grupo: {
      id: string;
      name: string;
      weekday: number | null;
      meetingTime: string | null;
      everyNWeeks: number;
      durationMinutes: number;
      leader: { fullName: string };
      _count: { members: number } | { enrollments: number; sessions: number };
    },
    clave: ClaveDeSeccion,
  ): Fila {
    const suyos = dias.get(grupo.id) ?? [];
    const cuantos =
      "members" in grupo._count ? grupo._count.members : grupo._count.enrollments;
    const cuando = fraseDeLaReunion(grupo);
    return {
      id: grupo.id,
      clave,
      nombre: grupo.name,
      pie: [
        grupo.leader.fullName,
        cuando,
        `${cuantos} ${cuantos === 1 ? "persona" : "personas"}`,
      ]
        .filter((trozo) => trozo && trozo.length > 0)
        .join(" · "),
      ruta: `${ROTULOS[clave].ruta}/${grupo.id}`,
      ultimoDia: suyos.length ? suyos[suyos.length - 1] : null,
      tirilla: tirillaDeSemanas(suyos, hoy).map((s) => ({
        hubo: s.hubo,
        desde: s.semana.inicio,
      })),
    };
  }

  const filas = ordenarPorAbandono([
    ...abiertasCasas.map((grupo) => armar(grupo, grupo.kind)),
    ...abiertosAlpha.map((grupo) => armar(grupo, "ALPHA")),
  ]);

  const atrasados = filas.filter(
    (fila) => cuantoHaceQueNoSeReune(fila.ultimoDia, hoy).atrasado,
  ).length;
  const aviso = avisoDeAbandono(atrasados);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Cómo va mi línea
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            Las últimas {SEMANAS_DE_LA_TIRILLA} semanas · {filas.length}{" "}
            {filas.length === 1 ? "grupo abierto" : "grupos abiertos"} · arriba los que
            llevan más tiempo sin reunirse
          </p>
          <p className="mt-3">
            <Link
              href="/alpha"
              className="text-[12px] leading-none font-semibold text-azul-700 underline"
            >
              ← Volver a los grupos
            </Link>
          </p>
        </header>

        {aviso ? (
          <p className="aviso-ambar mt-5 text-[12.5px] leading-[1.55] font-semibold text-ambar-texto">
            {aviso}
          </p>
        ) : null}

        {filas.length === 0 ? (
          <p className="tarjeta mt-5 p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
            No hay ningún grupo abierto en tu línea.
          </p>
        ) : (
          <ul className="tarjeta mt-5 flex flex-col py-1">
            {filas.map((fila) => {
              const cuanto = cuantoHaceQueNoSeReune(fila.ultimoDia, hoy);
              const r = ROTULOS[fila.clave];
              return (
                <li
                  key={fila.id}
                  className="border-b border-[rgba(19,28,36,.07)] last:border-b-0"
                >
                  <Link
                    href={fila.ruta}
                    className="flex min-h-11 flex-wrap items-center gap-3.5 px-[22px] py-3"
                  >
                    <span className="flex min-w-[240px] flex-1 flex-col gap-[3px]">
                      <span className="flex flex-wrap items-center gap-[7px]">
                        <span
                          className={`inline-flex h-[18px] items-center rounded-[20px] px-[7px] text-[9.5px] leading-none font-bold tracking-[.05em] text-white ${r.punto}`}
                        >
                          {r.chip.toUpperCase()}
                        </span>
                        <span className="text-[13.5px] leading-tight font-semibold text-tinta">
                          {fila.nombre}
                        </span>
                      </span>
                      <span className="text-[11px] leading-tight font-medium text-[rgba(19,28,36,.5)]">
                        {fila.pie}
                      </span>
                    </span>

                    <span className="flex shrink-0 gap-[5px]">
                      {fila.tirilla.map((semana) => (
                        <span
                          key={semana.desde}
                          role="img"
                          aria-label={`Semana del ${semana.desde}: ${semana.hubo ? "hubo encuentro" : "sin encuentro"}`}
                          className={`h-[26px] w-[15px] rounded-[5px] ${
                            semana.hubo ? "bg-verde-500" : "bg-[rgba(19,28,36,.1)]"
                          }`}
                        />
                      ))}
                    </span>

                    <span
                      className={`w-[152px] shrink-0 text-right text-[12px] leading-tight font-bold ${
                        cuanto.atrasado
                          ? "text-rojo"
                          : "text-[rgba(19,28,36,.5)]"
                      }`}
                    >
                      {cuanto.frase}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
          Cada barrita es una semana: verde si hay algún encuentro apuntado.
          Entrar a un grupo abre su rejilla y sus observaciones. Ves lo mismo que
          ves en la pantalla de grupos: no hay ningún permiso aparte.
        </p>
      </div>
    </main>
  );
}
