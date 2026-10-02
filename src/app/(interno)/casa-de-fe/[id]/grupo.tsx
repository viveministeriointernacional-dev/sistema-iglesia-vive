"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  alternarCierreCasaDeFe,
  buscarCandidatosCasaDeFe,
  inscribirEnCasaDeFe,
  reenviarAccesoAlTaller,
  retirarDeCasaDeFe,
  type CandidatoCasaDeFe,
} from "../acciones";

export type MiembroVista = {
  membershipId: string;
  learnerId: string;
  nombre: string;
  fase: string;
  telefono: string | null;
};

export function CasaDeFe({
  groupId,
  miembros,
  cerrada,
  puedeEditar,
}: {
  groupId: string;
  miembros: MiembroVista[];
  cerrada: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function ejecutar(
    accion: () => Promise<{ ok: boolean; mensaje?: string; aviso?: string }>,
  ) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo guardar.");
        return;
      }
      // El aviso no es un error: la acción sí se hizo. Se enseña en ámbar y se
      // repinta igual.
      if (resultado.aviso) setAviso(resultado.aviso);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-[14px]">
      <section className="tarjeta p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="etiqueta-seccion">PERSONAS EN LA CASA DE FE</h2>
          {puedeEditar ? (
            <button
              type="button"
              disabled={enCurso}
              onClick={() =>
                ejecutar(() => alternarCierreCasaDeFe(groupId, !cerrada))
              }
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline hover:text-tinta"
            >
              {cerrada ? "Reabrir Casa de Fe" : "Cerrar Casa de Fe"}
            </button>
          ) : null}
        </div>

        <ul className="mt-4 flex flex-col gap-3">
          {miembros.map((miembro) => (
            <li
              key={miembro.membershipId}
              className="flex flex-wrap items-center gap-3 rounded-[10px] bg-papel p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/expediente/${miembro.learnerId}`}
                  className="text-[13px] leading-none font-semibold text-tinta hover:text-azul-700 hover:underline"
                >
                  {miembro.nombre}
                </Link>
                <p className="mt-1.5 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
                  {miembro.fase}
                  {miembro.telefono ? ` · ${miembro.telefono}` : ""}
                </p>
              </div>
              <Link
                href={`/expediente/${miembro.learnerId}`}
                className="text-[11.5px] leading-none font-semibold text-azul-700"
              >
                Ver temas
              </Link>
              {puedeEditar ? (
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() =>
                    ejecutar(() =>
                      reenviarAccesoAlTaller(groupId, miembro.learnerId),
                    )
                  }
                  className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-azul-700 underline"
                >
                  Mandarle su código
                </button>
              ) : null}
              {puedeEditar ? (
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() =>
                    ejecutar(() =>
                      retirarDeCasaDeFe(groupId, miembro.membershipId),
                    )
                  }
                  className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)] underline hover:text-rojo"
                >
                  Retirar
                </button>
              ) : null}
            </li>
          ))}
          {miembros.length === 0 ? (
            <li className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              Todavía no hay nadie en esta Casa de Fe.
            </li>
          ) : null}
        </ul>

        {puedeEditar && !cerrada ? <Inscribir groupId={groupId} /> : null}

        {error ? (
          <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
            {error}
          </p>
        ) : null}

        {aviso ? (
          <p
            role="status"
            className="mt-3 rounded-[8px] border border-[rgba(138,90,18,.3)] bg-[#fbf4dc] px-3 py-2.5 text-[11.5px] leading-[1.45] font-medium text-[#8a5a12]"
          >
            {aviso}
          </p>
        ) : null}
      </section>

      <p className="text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
        Al inscribir a alguien, el sistema le manda por correo y por WhatsApp su
        código y el enlace a sus 12 talleres. El avance se registra en el
        expediente de cada persona, y los talleres enviados se revisan en «Por
        revisar».
      </p>
    </div>
  );
}

function Inscribir({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoCasaDeFe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  return (
    <div className="mt-4 border-t border-[rgba(19,28,36,.09)] pt-4">
      <span className="etiqueta-campo">Inscribir persona</span>
      <div className="mt-2 flex gap-2">
        <input
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Buscar por nombre…"
          className="campo mt-0 flex-1"
        />
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              setCandidatos(await buscarCandidatosCasaDeFe(groupId, consulta));
            });
          }}
          className="boton-secundario"
        >
          Buscar
        </button>
      </div>

      {candidatos ? (
        candidatos.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {candidatos.map((candidato) => (
              <li key={candidato.learnerId}>
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() => {
                    setError(null);
                    iniciar(async () => {
                      const resultado = await inscribirEnCasaDeFe(
                        groupId,
                        candidato.learnerId,
                      );
                      if (!resultado.ok) {
                        setError(resultado.mensaje);
                        return;
                      }
                      // ⚠️ El aviso se queda en pantalla aunque la lista de
                      // candidatos se limpie: si el WhatsApp no salió, ese
                      // texto es lo único que le dice al líder que tiene que
                      // dictarle el código, y vaciarlo lo escondería.
                      setAviso(resultado.aviso ?? null);
                      setCandidatos(null);
                      setConsulta("");
                      router.refresh();
                    });
                  }}
                  className="w-full rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white p-2 text-left text-[12.5px] font-semibold text-tinta"
                >
                  {candidato.nombre}
                  <span className="ml-2 text-[11px] font-semibold text-[rgba(19,28,36,.45)]">
                    {candidato.fase}
                    {candidato.telefono ? ` · ${candidato.telefono}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
            Nadie coincide. Búscala por su nombre completo.
          </p>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}

      {aviso ? (
        <p
          role="status"
          className="mt-2 rounded-[8px] border border-[rgba(138,90,18,.3)] bg-[#fbf4dc] px-3 py-2.5 text-[11.5px] leading-[1.45] font-medium text-[#8a5a12]"
        >
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
