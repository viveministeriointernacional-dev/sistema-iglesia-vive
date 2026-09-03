"use client";

import { FormularioDatosPersona } from "@/components/formulario-datos-persona";
import type { DatosPersona as Datos } from "@/lib/persona";
import { guardarDatosPersonaDesdeExpediente } from "./acciones";

/// Los datos de la persona, completos y sin enmascarar: quien acompaña necesita
/// el teléfono real para llamar, no una versión con puntos. Si además puede
/// escribir en el expediente, los edita aquí mismo.
export function DatosPersona({
  learnerId,
  inicial,
  puedeEditar,
  horario,
}: {
  learnerId: string;
  inicial: Datos;
  puedeEditar: boolean;
  horario: string | null;
}) {
  return (
    <section className="mt-3 rounded-[12px] bg-papel p-4">
      <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
        DATOS DE LA PERSONA
      </h2>
      {horario ? (
        <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
          Horario para llamar: {horario}
        </p>
      ) : null}

      {puedeEditar ? (
        <div className="mt-3">
          <FormularioDatosPersona
            inicial={inicial}
            guardar={(datos) => guardarDatosPersonaDesdeExpediente(learnerId, datos)}
          />
        </div>
      ) : (
        <dl className="mt-3 flex flex-col gap-[11px]">
          <Dato etiqueta="Nombre" valor={`${inicial.firstName} ${inicial.lastName}`.trim()} />
          <Dato
            etiqueta="Género"
            valor={
              inicial.gender === "MUJER"
                ? "Mujer"
                : inicial.gender === "HOMBRE"
                  ? "Hombre"
                  : null
            }
          />
          <Dato etiqueta="Fecha de nacimiento" valor={inicial.birthDate} />
          <Dato etiqueta="Celular (llamadas)" valor={inicial.callPhone} />
          <Dato etiqueta="WhatsApp" valor={inicial.whatsappPhone} />
          <Dato etiqueta="Correo" valor={inicial.email} />
          <Dato etiqueta="Dirección" valor={inicial.address} />
          <Dato etiqueta="Petición de oración" valor={inicial.prayerRequest} />
        </dl>
      )}
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
        {etiqueta}
      </dt>
      <dd className="mt-1 text-[12.5px] leading-[1.35] font-semibold text-tinta">
        {valor?.trim() ? valor : "Sin registrar"}
      </dd>
    </div>
  );
}
