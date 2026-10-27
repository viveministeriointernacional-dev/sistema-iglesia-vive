import Link from "next/link";
import { diaLargo } from "@/lib/dominio";
import { SESIONES_DE_ALPHA } from "@/lib/alpha";
import type { RotulosDeGrupo } from "@/lib/tipo-de-grupo";

/// **Las listas de grupos, y el bloque que las parte en dos.**
///
/// Vive aparte de la página desde el 27-oct-2026, cuando la lista dejó de ser
/// una sola: con una línea puesta se parte en «las que lleva él» y «las de su
/// línea», y el mismo renglón tenía que dibujarse en los dos sitios. Antes
/// estaba escrito dos veces dentro de `page.tsx` (una por sección) y
/// duplicarlo otras dos habría dado cuatro copias del mismo `<li>`.

export type RenglonDeAlpha = {
  id: string;
  name: string;
  startDate: Date;
  closedAt: Date | null;
  leader: { fullName: string };
  _count: { enrollments: number; sessions: number };
};

export type RenglonDeCasa = {
  id: string;
  name: string;
  startDate: Date;
  closedAt: Date | null;
  leader: { fullName: string };
  _count: { members: number };
};

/// El rótulo de cada mitad. **Dice el número en el propio rótulo** porque es
/// lo que se vino a buscar: «de las 60, estas 15». Sin la cifra al lado del
/// título habría que contar renglones.
function Rotulo({ texto, cuantos }: { texto: string; cuantos: number }) {
  return (
    <p className="mt-5 mb-3 flex flex-wrap items-baseline gap-x-2 text-[11.5px] leading-none font-bold tracking-[.06em] text-[rgba(19,28,36,.45)] uppercase">
      {texto}
      <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[10px] font-bold tracking-normal text-[rgba(19,28,36,.6)] normal-case">
        {cuantos}
      </span>
    </p>
  );
}

function Tarjeta({
  href,
  nombre,
  pie,
  cifras,
  cerrado,
}: {
  href: string;
  nombre: string;
  pie: string;
  cifras: string[];
  cerrado: string | null;
}) {
  return (
    <li className="tarjeta p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={href}
            className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
          >
            {nombre}
          </Link>
          <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
            {pie}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
          {cifras.map((c) => (
            <span key={c}>{c}</span>
          ))}
          {cerrado ? (
            <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
              {cerrado}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/// ⚠️ **Dentro del bloque «las que lleva Alejandro Facundo» el nombre del
/// líder sobra**: sería el mismo nombre repetido 15 veces debajo de un rótulo
/// que ya lo dijo. Fuera del reparto sí va, que es lo único que distingue un
/// renglón de otro.
export function ListaDeAlpha({
  grupos,
  conLider = true,
}: {
  grupos: RenglonDeAlpha[];
  conLider?: boolean;
}) {
  return (
    <ul className="mt-4 flex flex-col gap-[10px]">
      {grupos.map((g) => (
        <Tarjeta
          key={g.id}
          href={`/alpha/${g.id}`}
          nombre={g.name}
          pie={
            conLider
              ? `Desde ${diaLargo(g.startDate)} · ${g.leader.fullName}`
              : `Desde ${diaLargo(g.startDate)}`
          }
          cifras={[
            `${g._count.enrollments} ${g._count.enrollments === 1 ? "persona" : "personas"}`,
            `${g._count.sessions} / ${SESIONES_DE_ALPHA} sesiones`,
          ]}
          cerrado={g.closedAt ? "CERRADO" : null}
        />
      ))}
    </ul>
  );
}

/// Sirve para los **tres** tipos que viven en `faith_house_group`: Casa de Fe,
/// Restaurados y Mentorías. El renglón es el mismo —nombre, desde cuándo,
/// quién lo lleva y cuánta gente—; lo único que cambia es la etiqueta de
/// cerrado, que lleva género («CERRADA» una casa, «CERRADO» un grupo de
/// Restaurados), y por eso viene del catálogo y no escrita aquí.
export function ListaDeCasas({
  casas,
  rotulos,
  conLider = true,
}: {
  casas: RenglonDeCasa[];
  rotulos: RotulosDeGrupo;
  conLider?: boolean;
}) {
  return (
    <ul className="mt-4 flex flex-col gap-[10px]">
      {casas.map((c) => (
        <Tarjeta
          key={c.id}
          href={`/casa-de-fe/${c.id}`}
          nombre={c.name}
          pie={
            conLider
              ? `Desde ${diaLargo(c.startDate)} · ${c.leader.fullName}`
              : `Desde ${diaLargo(c.startDate)}`
          }
          cifras={[
            `${c._count.members} ${c._count.members === 1 ? "persona" : "personas"}`,
          ]}
          cerrado={c.closedAt ? rotulos.etiquetaCerrado : null}
        />
      ))}
    </ul>
  );
}

/// **Una lista, o dos bloques rotulados.**
///
/// ⚠️ **Solo parte cuando los dos lados tienen algo**, y la medida del
/// 27-oct lo exige: 9 de las 20 líneas de la iglesia las lleva el mentor
/// enteras (Paola 6 de 6, Ruth 5 de 5) y otras no tienen ninguna suya
/// (Administración 0 de 60, Juliana 0 de 3). En esos casos un rótulo sobre un
/// bloque único y otro bloque vacío no distingue nada: solo añade un cartel.
export function ListaPartida<T>({
  directas,
  deSuLinea,
  rotulos,
  pintar,
}: {
  directas: T[];
  deSuLinea: T[];
  /// Los dos títulos vienen de fuera porque el género cambia la frase: «las
  /// que lleva» para las Casas de Fe y «los que lleva» para los Alpha.
  rotulos: { directas: string; deSuLinea: string };
  /// Recibe además si ese bloque debe llevar el nombre del líder en cada
  /// renglón: en el de las directas es siempre el mismo y no distingue nada.
  pintar: (items: T[], conLider: boolean) => React.ReactNode;
}) {
  if (directas.length === 0 || deSuLinea.length === 0) {
    return <>{pintar([...directas, ...deSuLinea], true)}</>;
  }

  return (
    <>
      <Rotulo texto={rotulos.directas} cuantos={directas.length} />
      {pintar(directas, false)}
      <Rotulo texto={rotulos.deSuLinea} cuantos={deSuLinea.length} />
      {pintar(deSuLinea, true)}
    </>
  );
}

/// **Un bloque de la pantalla: su título, su coletilla, su botón de abrir uno
/// nuevo, y la lista o el hueco.**
///
/// Nació el 27-oct-2026 con Restaurados y Mentorías. Hasta ese día la página
/// tenía dos bloques escritos a mano, casi idénticos salvo el género de las
/// palabras. Con cuatro, copiar el mismo `<section>` dos veces más era la
/// receta del «de el Alpha» que el usuario cazó el 23-oct: la falta no está en
/// la primera copia, está en la cuarta.
///
/// No decide nada: recibe los textos ya resueltos. Quién puede crear, qué
/// está filtrado y cómo se parte la lista se calcula en la página, que es
/// donde están los permisos.
export function BloqueDeGrupos<T>({
  rotulos,
  coletilla,
  crear,
  hueco,
  items,
  partida,
  conLider,
  pintar,
  className,
}: {
  rotulos: RotulosDeGrupo;
  coletilla: string;
  /// El botón de abrir uno nuevo, o nada si esta cuenta no puede.
  crear: React.ReactNode | null;
  /// Qué decir cuando no hay ninguno. Se usa **solo** si `items` está vacío.
  hueco: string;
  items: T[];
  /// Los dos lados del reparto por línea, o `null` cuando no hay que partir.
  partida: { directas: T[]; deSuLinea: T[]; rotulos: { directas: string; deSuLinea: string } } | null;
  conLider: boolean;
  pintar: (items: T[], conLider: boolean) => React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className ?? "mt-9"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="etiqueta-seccion">{rotulos.seccion}</h2>
        <p className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
          {coletilla}
        </p>
      </div>

      {crear ? <div className="mt-4">{crear}</div> : null}

      {items.length === 0 ? (
        <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
          {hueco}
        </p>
      ) : partida ? (
        <ListaPartida
          directas={partida.directas}
          deSuLinea={partida.deSuLinea}
          rotulos={partida.rotulos}
          pintar={pintar}
        />
      ) : (
        pintar(items, conLider)
      )}
    </section>
  );
}
