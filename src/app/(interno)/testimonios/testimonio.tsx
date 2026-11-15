"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enlaceAUnaPersona } from "@/lib/whatsapp-enlaces-catalogo";
import { marcarComoContactado } from "./acciones";

export type TestimonioDeLaLista = {
  id: string;
  nombre: string;
  celular: string;
  edad: number;
  milagro: string;
  /// Las fechas llegan ya escritas desde el servidor, en hora de Colombia:
  /// formatearlas aquí las pintaría en la zona de quien mire (§12.1).
  recibido: string;
  contactado: string | null;
  contactadoPor: string | null;
};

export function Testimonio({ t }: { t: TestimonioDeLaLista }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const pendiente = t.contactado === null;
  // `null` cuando el número no se puede llevar al formato de wa.me (un fijo, a
  // medio escribir). Entonces no se pinta: abrir el chat equivocado haría
  // creer que se le escribió a la persona.
  const whatsapp = enlaceAUnaPersona(t.celular);

  function marcar() {
    setError(null);
    iniciar(async () => {
      const resultado = await marcarComoContactado(t.id);
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo guardar.");
        // Si fue porque otra persona se adelantó, repintar enseña quién.
        router.refresh();
        return;
      }
      // `revalidatePath` no repinta lo que el navegador ya tiene (§12.4).
      router.refresh();
    });
  }

  return (
    <li className={`tarjeta p-4 ${pendiente ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] leading-[1.3] font-extrabold text-tinta">{t.nombre}</p>
          <p className="mt-1 text-[12.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)] tabular-nums">
            {t.edad} {t.edad === 1 ? "año" : "años"} · {t.celular} · {t.recibido}
          </p>
        </div>
        {pendiente ? (
          <span className="rounded-full bg-ambar-fondo px-2.5 py-1 text-[11.5px] leading-none font-bold text-ambar-texto">
            Sin contactar
          </span>
        ) : (
          <span className="rounded-full bg-verde-100 px-2.5 py-1 text-[11.5px] leading-[1.3] font-bold text-verde-700">
            Contactado · {t.contactado}
            {t.contactadoPor ? `, por ${t.contactadoPor}` : ""}
          </span>
        )}
      </div>

      <p className="mt-3 max-w-[68ch] text-[14.5px] leading-[1.6] font-medium [overflow-wrap:anywhere] whitespace-pre-wrap text-tinta">
        {t.milagro}
      </p>

      {whatsapp || pendiente ? (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[#1f8f4e] px-3.5 py-[7px] text-[12px] leading-none font-extrabold text-white hover:bg-[#187a42]"
            >
              WhatsApp
            </a>
          ) : null}
          {pendiente ? (
            <button
              type="button"
              onClick={marcar}
              disabled={enCurso}
              className="rounded-full border border-[rgba(19,28,36,.18)] px-3.5 py-[6px] text-[12px] leading-none font-bold text-tinta hover:border-azul-700 disabled:opacity-60"
            >
              {enCurso ? "Guardando…" : "Ya nos comunicamos"}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[12.5px] leading-[1.4] font-semibold text-rojo" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
