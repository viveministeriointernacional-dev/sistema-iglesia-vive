import Link from "next/link";
import { cookies } from "next/headers";

import { momentoCorto } from "@/lib/dominio";
import { cargarMisTalleres, learnerPorToken, type TemaEnMisTalleres } from "@/lib/taller";
import {
  COOKIE_TALLER,
  ETIQUETA_TEMA,
  pideAtencion,
  type EstadoDelTema,
} from "@/lib/taller-catalogo";

import { Identificarme } from "../[codigo]/identificarme";

export const metadata = {
  title: "Mis talleres · Casa de Fe · Iglesia Vive",
};

/// «Mis talleres»: los 12 temas de una persona, con el estado de cada uno.
///
/// Es la pantalla a la que lleva el enlace que recibe por WhatsApp o correo al
/// entrar a una Casa de Fe (`/taller/mis/<token>` deja la cookie y redirige
/// aquí).
///
/// ⚠️ **Todo se pinta en el SERVIDOR: no hay una sola línea de JavaScript.**
/// Es un tablero de lectura con doce enlaces, y la gente lo abre desde el
/// celular con el dato que tenga — cargarle un paquete de JS para enseñar doce
/// renglones sería pagar por nada.
export default async function MisTalleres() {
  const token = (await cookies()).get(COOKIE_TALLER)?.value;
  const persona = token ? await learnerPorToken(token) : null;

  // Sin cookie (venció, o la perdió al cambiar de teléfono) se le ofrece
  // entrar con su código. Es el mismo formulario del QR, sin tema: así no se
  // queda fuera quien perdió el mensaje de WhatsApp.
  if (!persona) {
    return <Identificarme codigo={null} titulo="Tus talleres de casa de fe" />;
  }

  const mis = await cargarMisTalleres(persona.learnerId);
  if (!mis) {
    return <Identificarme codigo={null} titulo="Tus talleres de casa de fe" />;
  }

  const porCorregir = mis.temas.filter((t) => pideAtencion(t.estado));
  const resto = mis.temas.filter((t) => !pideAtencion(t.estado));
  const nombreDePila = mis.nombre.split(" ")[0] ?? mis.nombre;

  return (
    <main className="min-h-dvh bg-[#faf8f1] text-[#1a1917]">
      <div className="mx-auto max-w-[520px]">
        <header className="bg-[#1a1917] px-5 py-6 text-[#faf8f1]">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c8c0ac] uppercase">
            Iglesia Vive · Casa de Fe
          </p>
          <h1 className="mt-3.5 font-serif text-[26px] leading-[1.12]">
            Mis talleres
          </h1>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-[#d8d1bf]">
            Hola, {nombreDePila}.
            {mis.casas.length > 0 ? ` ${mis.casas.join(" · ")}.` : ""}
          </p>

          {/* El código se enseña grande aunque haya entrado sin escribirlo: es
              lo que va a necesitar si abre un QR en otro teléfono o si pierde
              este mensaje. */}
          <div className="mt-[18px] flex items-baseline justify-between gap-3 rounded-xl border border-[#3a3733] px-3.5 py-3">
            <div>
              <p className="mb-1 text-[9.5px] font-bold tracking-[0.14em] text-[#b8b0a0] uppercase">
                Tu código
              </p>
              <p className="text-[27px] font-medium tracking-[0.14em] tabular-nums">
                {mis.codigo.slice(0, 3)} {mis.codigo.slice(3)}
              </p>
            </div>
            <p className="max-w-[130px] text-right text-[10.5px] leading-[1.4] text-[#b8b0a0]">
              Con estos 6 números entras desde cualquier teléfono. Es solo tuyo.
            </p>
          </div>
        </header>

        <section className="px-5 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-[19px] font-semibold">
              {mis.aprobados} de {mis.total} temas aprobados
            </strong>
            <span className="text-[11.5px] font-medium text-[#5c5648]">
              {mis.total - mis.aprobados === 0
                ? "¡Terminaste!"
                : `Te faltan ${mis.total - mis.aprobados}`}
            </span>
          </div>
          <div
            className="mt-2 flex gap-[2px] overflow-hidden rounded-full"
            role="img"
            aria-label={`${mis.aprobados} de ${mis.total} temas aprobados`}
          >
            {mis.temas.map((tema) => (
              <i
                key={tema.number}
                className={`h-2 flex-1 ${COLOR_BARRA[tema.estado]}`}
              />
            ))}
          </div>
        </section>

        {porCorregir.length > 0 ? (
          <section className="px-5 pt-6">
            <h2 className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-[#5c5648] uppercase">
              Primero, lo que hay que corregir
            </h2>
            {porCorregir.map((tema) => (
              <Renglon key={tema.number} tema={tema} />
            ))}
          </section>
        ) : null}

        <section className="px-5 pt-6 pb-7">
          <h2 className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-[#5c5648] uppercase">
            {porCorregir.length > 0 ? "Los demás temas" : "Los 12 temas del libro"}
          </h2>
          {resto.map((tema) => (
            <Renglon key={tema.number} tema={tema} />
          ))}
        </section>

        <footer className="border-t border-[#e3ddcd] px-5 pt-5 pb-9 text-[11.5px] leading-[1.55] text-[#5c5648]">
          <p className="mb-2.5">
            <strong className="text-[#1a1917]">No necesitas contraseña.</strong>{" "}
            Este enlace es tuyo: guárdalo y vuelve cuando quieras.
          </p>
          <p>
            Cada taller se va guardando mientras lo llenas, así que puedes
            hacerlo en varios días.
          </p>
        </footer>
      </div>
    </main>
  );
}

const COLOR_BARRA: Record<EstadoDelTema, string> = {
  APROBADO: "bg-[#2f6f53]",
  ESPERANDO: "bg-[#8a5a12]",
  DEVUELTO: "bg-[#a63d2f]",
  EMPEZADO: "bg-[#cfc6ae]",
  SIN_EMPEZAR: "bg-[#e8e2d2]",
};

const MARCO: Record<EstadoDelTema, string> = {
  APROBADO: "border-[#cfe3d8] bg-[#edf5f0]",
  ESPERANDO: "border-[#e8d7a8] bg-[#fbf4dc]",
  DEVUELTO: "border-[1.5px] border-[#e0b4ac] bg-[#fdf1ee]",
  EMPEZADO: "border-[#e3ddcd] bg-white",
  SIN_EMPEZAR: "border-[#e3ddcd] bg-white",
};

const NUMERO: Record<EstadoDelTema, string> = {
  APROBADO: "bg-[#2f6f53] text-white",
  ESPERANDO: "bg-[#8a5a12] text-white",
  DEVUELTO: "bg-[#a63d2f] text-white",
  EMPEZADO: "bg-[#f1ece0] text-[#5c5648]",
  SIN_EMPEZAR: "bg-[#f1ece0] text-[#5c5648]",
};

const TONO: Record<EstadoDelTema, string> = {
  APROBADO: "font-semibold text-[#2f6f53]",
  ESPERANDO: "font-semibold text-[#8a5a12]",
  DEVUELTO: "font-bold text-[#a63d2f]",
  EMPEZADO: "text-[#5c5648]",
  SIN_EMPEZAR: "text-[#5c5648]",
};

function Renglon({ tema }: { tema: TemaEnMisTalleres }) {
  const cuerpo = (
    <>
      <div className="flex items-start gap-[11px]">
        <span
          className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-[12px] font-bold tabular-nums ${NUMERO[tema.estado]}`}
        >
          {tema.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mt-0.5 text-[15px] leading-[1.25] font-semibold">
            {tema.name}
          </p>
          <p className={`mt-[5px] text-[11.5px] leading-[1.45] ${TONO[tema.estado]}`}>
            {rotulo(tema)}
          </p>
        </div>
        {/* ⚠️ La flecha solo se pinta si el renglón abre. Un «›» en un tema
            aprobado prometería que se puede volver a llenar, y no se puede. */}
        {tema.qrCode && tema.estado !== "APROBADO" ? (
          <span aria-hidden className="flex-none text-[17px] leading-[1.5] text-[#b6ac95]">
            ›
          </span>
        ) : null}
      </div>

      {tema.estado === "DEVUELTO" && tema.notaDeLaRevision ? (
        <div className="mt-2.5 ml-[37px] rounded-r-lg border-l-[3px] border-[#a63d2f] bg-white px-[11px] py-2.5">
          <p className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-[#a63d2f] uppercase">
            Tu líder te escribió
          </p>
          <p className="text-[12.5px] leading-[1.5]">{tema.notaDeLaRevision}</p>
        </div>
      ) : null}

      {tema.estado === "DEVUELTO" && tema.qrCode ? (
        <span className="mt-[11px] ml-[37px] block rounded-[9px] bg-[#a63d2f] py-[11px] text-center text-[13.5px] font-semibold text-white">
          Corregir y volver a enviar
        </span>
      ) : null}

      {tema.vecesDevuelto > 1 ? (
        <p className="mt-2 ml-[37px] text-[11px] text-[#5c5648]">
          Te lo han devuelto {tema.vecesDevuelto} veces.
        </p>
      ) : null}
    </>
  );

  const clases = `mb-2.5 block rounded-xl border p-[13px_14px] ${MARCO[tema.estado]}`;

  // ⚠️ **Un tema aprobado NO abre su taller, y un tema sin código tampoco.**
  // Lo primero es decisión de producto: lo que su líder ya firmó no se vuelve
  // a cambiar. Lo segundo es la regla del 16-sep-2026 al revés — lo que no
  // abre no se enseña como enlace: un tema sin `qrCode` daría 404.
  if (!tema.qrCode || tema.estado === "APROBADO") {
    return <div className={clases}>{cuerpo}</div>;
  }

  return (
    <Link href={`/taller/${tema.qrCode}`} className={clases}>
      {cuerpo}
    </Link>
  );
}

function rotulo(tema: TemaEnMisTalleres): string {
  if (tema.estado === "APROBADO") {
    const cuando = tema.aprobadoEl ? ` el ${momentoCorto(tema.aprobadoEl)}` : "";
    const quien = tema.quienAprobo ? ` · por ${tema.quienAprobo}` : "";
    return `✓ Aprobado${cuando}${quien}`;
  }
  if (tema.estado === "DEVUELTO") {
    return `${ETIQUETA_TEMA.DEVUELTO}${tema.devueltoEl ? ` · ${momentoCorto(tema.devueltoEl)}` : ""}`;
  }
  return ETIQUETA_TEMA[tema.estado];
}
