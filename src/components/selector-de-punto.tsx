"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  CENTRO_DE_NEIVA,
  puntoDe,
  puntoLegible,
  type PuntoEnElMapa,
} from "@/lib/reunion-catalogo";

/// **El mapa para marcar dónde queda el grupo.**
///
/// Se abre en grande, encima de todo, y no dentro del cuadro del formulario:
/// un mapa pequeño no deja acercarse lo suficiente para señalar una casa, que
/// es justo lo que hay que poder hacer aquí.
///
/// ⚠️ **El mapa es de OpenStreetMap, no de Google.** Dibujar un mapa de Google
/// dentro de la página exige una clave de API con facturación activa. Los
/// botones «Ver en el mapa» y «Cómo llegar» de la ficha **sí** abren Google,
/// porque es la app que la gente tiene en el celular; lo único que cambia es
/// que ahora les llega el punto exacto en vez de un texto para buscar.
///
/// ⚠️ **El pin va clavado en el centro y lo que se mueve es el mapa.** En el
/// celular, arrastrar un pin lo taparía con el dedo en el momento exacto de
/// afinarlo.

const ZOOM_SIN_PUNTO = 15;
const ZOOM_CON_PUNTO = 18;
/// Por debajo de esto no se distingue una casa de la de al lado, así que se
/// avisa. **No se bloquea**: un punto aproximado sigue siendo mejor que una
/// dirección que el mapa no encuentra.
const ZOOM_PARA_MARCAR = 16;

const TESELAS = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
/// La atribución NO es decorativa: es la condición de la licencia con la que
/// OpenStreetMap deja usar sus mapas gratis.
const ATRIBUCION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores de OpenStreetMap</a>';

type Resultado = { nombre: string; punto: PuntoEnElMapa };

export function SelectorDePunto({
  nombreDelGrupo,
  direccion,
  inicial,
  onCerrar,
  onUsar,
}: {
  nombreDelGrupo: string;
  direccion: string | null;
  /// El punto que ya tenía el grupo, si alguien lo marcó antes.
  inicial: PuntoEnElMapa | null;
  onCerrar: () => void;
  onUsar: (punto: PuntoEnElMapa) => void;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  /// Cuando el movimiento lo pide el código (una búsqueda, la ubicación del
  /// GPS) y no el dedo de la persona. Leaflet no distingue los dos, y sin esto
  /// el `setView` inicial contaría como «ya lo movió».
  const programatico = useRef(false);

  const [centro, setCentro] = useState<PuntoEnElMapa>(inicial ?? CENTRO_DE_NEIVA);
  const [zoom, setZoom] = useState(inicial ? ZOOM_CON_PUNTO : ZOOM_SIN_PUNTO);
  /// Sin punto previo hay que mover el mapa antes de poder confirmar: si no,
  /// un clic de más guardaría «el centro de Neiva» como el lugar del grupo.
  const [tocado, setTocado] = useState(inicial !== null);
  const [consulta, setConsulta] = useState(direccion ?? "");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<Resultado[]>([]);

  // El mapa se crea una sola vez. Leaflet se carga con `import()` dentro del
  // efecto porque toca `window` al cargarse, y este componente se compila
  // también en el servidor.
  useEffect(() => {
    let cancelado = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapaRef.current) return;

      const mapa = L.map(contenedor.current, {
        center: [centro.lat, centro.lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TESELAS, { maxZoom: 19, attribution: ATRIBUCION }).addTo(mapa);

      mapa.on("movestart zoomstart", () => {
        if (!programatico.current) setTocado(true);
      });
      mapa.on("moveend zoomend", () => {
        const c = mapa.getCenter();
        setCentro({ lat: c.lat, lng: c.lng });
        setZoom(mapa.getZoom());
      });

      mapaRef.current = mapa;
      // El contenedor acaba de aparecer en pantalla: sin esto Leaflet mide mal
      // y deja las teselas cortadas hasta el primer movimiento.
      setTimeout(() => mapa.invalidateSize(), 0);
    })();

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
    // Solo al montar: el centro y el zoom siguientes los maneja Leaflet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cierra, y mientras el mapa está abierto la página de atrás no se
  // desplaza (si no, en el celular el dedo mueve la página en vez del mapa).
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = antes;
    };
  }, [onCerrar]);

  function irA(punto: PuntoEnElMapa, nivel: number) {
    const mapa = mapaRef.current;
    if (!mapa) return;
    programatico.current = true;
    mapa.setView([punto.lat, punto.lng], nivel);
    // Se suelta después de que Leaflet emita sus eventos de movimiento.
    setTimeout(() => {
      programatico.current = false;
    }, 0);
    setTocado(true);
  }

  /// La búsqueda es de Nominatim, el buscador de OpenStreetMap.
  ///
  /// ⚠️ **Se consulta al ENVIAR, nunca al teclear.** Nominatim es gratis y su
  /// política prohíbe expresamente usarlo como autocompletado; una consulta por
  /// cada letra nos dejaría sin servicio. Y de todas formas **solo acerca al
  /// barrio**: el punto que vale es el que quede bajo el pin.
  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const texto = consulta.trim();
    if (!texto || buscando) return;

    setBuscando(true);
    setAviso(null);
    setOpciones([]);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", texto);
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "co");
      // Va como parámetro y no como cabecera a propósito: una cabecera propia
      // obligaría al navegador a pedir permiso antes (preflight) y Nominatim
      // no lo contesta.
      url.searchParams.set("accept-language", "es");

      const respuesta = await fetch(url.toString());
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const crudo: unknown = await respuesta.json();

      const encontrados: Resultado[] = (Array.isArray(crudo) ? crudo : [])
        .map((fila) => {
          const f = fila as { display_name?: unknown; lat?: unknown; lon?: unknown };
          const punto = puntoDe(Number(f.lat), Number(f.lon));
          if (!punto || typeof f.display_name !== "string") return null;
          return { nombre: f.display_name, punto };
        })
        .filter((r): r is Resultado => r !== null);

      if (encontrados.length === 0) {
        setAviso(
          "No se encontró ese sitio. Es normal con direcciones de barrio: busca el barrio o una calle conocida y luego mueve el mapa a mano.",
        );
        return;
      }
      if (encontrados.length === 1) {
        irA(encontrados[0].punto, ZOOM_CON_PUNTO);
        return;
      }
      setOpciones(encontrados);
    } catch {
      setAviso("No se pudo buscar en este momento. Puedes mover el mapa a mano.");
    } finally {
      setBuscando(false);
    }
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Este teléfono no permite compartir la ubicación.");
      return;
    }
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const punto = puntoDe(posicion.coords.latitude, posicion.coords.longitude);
        if (!punto) {
          setAviso("La ubicación que entregó el teléfono no sirve.");
          return;
        }
        irA(punto, ZOOM_CON_PUNTO);
      },
      () => {
        setAviso(
          "No se pudo leer tu ubicación. Si el navegador la pidió, hay que darle permiso.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const lejos = zoom < ZOOM_PARA_MARCAR;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Marcar el punto del grupo en el mapa"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(19,28,36,.5)] sm:p-5"
    >
      <div className="flex h-full w-full max-w-[980px] flex-col overflow-hidden bg-white shadow-[0_18px_48px_rgba(19,28,36,.3)] sm:max-h-[94vh] sm:rounded-[14px]">
        <div className="flex items-start gap-4 border-b border-[rgba(19,28,36,.09)] px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-grow">
            <h2 className="etiqueta-seccion">MARCAR EL PUNTO EN EL MAPA</h2>
            <p className="mt-2 text-[15px] leading-[1.3] font-bold">{nombreDelGrupo}</p>
            {direccion ? (
              <p className="mt-1 text-[12.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
                {direccion}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el mapa"
            className="flex h-[38px] w-[38px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(19,28,36,.18)] bg-transparent p-0"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-[17px] w-[17px]" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={buscar}
          className="flex flex-wrap gap-2 border-b border-[rgba(19,28,36,.09)] bg-papel px-5 py-3 sm:px-6"
        >
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Busca un barrio o una calle de Neiva…"
            aria-label="Buscar un barrio o una calle"
            className="campo mt-0 min-w-[180px] flex-grow"
          />
          <button type="submit" disabled={buscando} className="boton-secundario bg-white">
            {buscando ? "Buscando…" : "Buscar"}
          </button>
          <button type="button" onClick={usarMiUbicacion} className="boton-secundario bg-white">
            Usar mi ubicación
          </button>
        </form>

        {opciones.length > 0 ? (
          <ul className="max-h-[152px] list-none overflow-y-auto border-b border-[rgba(19,28,36,.09)] p-0">
            {opciones.map((o) => (
              <li key={`${o.punto.lat},${o.punto.lng}`}>
                <button
                  type="button"
                  onClick={() => {
                    setOpciones([]);
                    irA(o.punto, ZOOM_CON_PUNTO);
                  }}
                  className="w-full cursor-pointer border-0 border-b border-[rgba(19,28,36,.06)] bg-white px-5 py-3 text-left text-[12.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.7)] hover:bg-papel sm:px-6"
                >
                  {o.nombre}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="relative min-h-[260px] flex-grow">
          <div ref={contenedor} className="absolute inset-0" />

          {/* El pin, clavado en el centro. `pointer-events-none` para que el
              dedo lo atraviese y arrastre el mapa que hay debajo. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-full"
          >
            <svg viewBox="-26 -64 52 70" className="h-[62px] w-[46px] drop-shadow-[0_3px_5px_rgba(19,28,36,.35)]">
              <path
                d="M0 0c-13-17-21-27-21-38a21 21 0 1 1 42 0c0 11-8 21-21 38Z"
                fill="#0e2a4e"
                stroke="#ffffff"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <circle cx="0" cy="-38" r="7" fill="#ffffff" />
            </svg>
          </div>

          <p className="pointer-events-none absolute top-3 left-3 z-[500] max-w-[260px] rounded-[9px] bg-[rgba(255,255,255,.94)] px-3 py-[10px] text-[12.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.62)] shadow-[0_2px_10px_rgba(19,28,36,.12)]">
            Acércate y arrastra el mapa hasta que el pin quede sobre la casa.
          </p>
        </div>

        {aviso ? (
          <p role="alert" className="border-t border-[rgba(201,123,44,.3)] bg-ambar-fondo px-5 py-3 text-[12.5px] leading-[1.5] text-ambar-texto sm:px-6">
            {aviso}
          </p>
        ) : null}

        {lejos ? (
          <p className="border-t border-[rgba(201,123,44,.3)] bg-ambar-fondo px-5 py-3 text-[12.5px] leading-[1.5] text-ambar-texto sm:px-6">
            Estás viendo el mapa <strong>desde muy lejos</strong>. Acércate hasta ver
            las casas para que el punto señale la correcta.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-[rgba(19,28,36,.09)] px-5 py-4 sm:px-6">
          <span className="flex-grow text-[12.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.62)]">
            {tocado ? (
              <>
                Pin puesto en{" "}
                <span className="font-mono text-tinta">{puntoLegible(centro)}</span>
              </>
            ) : (
              "Mueve el mapa hasta la casa del grupo."
            )}
          </span>
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!tocado}
            onClick={() => {
              const punto = puntoDe(centro.lat, centro.lng);
              if (!punto) {
                setAviso("Ese punto no es válido. Mueve el mapa e inténtalo de nuevo.");
                return;
              }
              onUsar(punto);
            }}
            className="boton-primario"
          >
            Usar este punto
          </button>
        </div>
      </div>
    </div>
  );
}
