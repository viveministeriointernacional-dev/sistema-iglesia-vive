import type { Metadata, Viewport } from "next";
import { Anton } from "next/font/google";
import { FormularioDeMilagro } from "./formulario";
import estilos from "./milagros.module.css";

const titulo = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--fuente-milagros-titulo",
});


export const metadata: Metadata = {
  title: "Cuéntanos tu milagro · Iglesia Vive",
  description: "Lo que Dios hizo en tu vida puede encender la fe de alguien más.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1a0605" };

/// **«Cuéntanos tu milagro»**: enlace público, sin cuenta, que se comparte por
/// WhatsApp o con el QR de `/testimonios/qr`.
///
/// El diseño es el que hizo el usuario en su cuenta personal (15-nov-2026).
/// La diferencia de fondo es dónde viven los datos: allá la lista del equipo se
/// leía con la llave pública que iba dentro de la página —cualquiera podía
/// bajarse todos los nombres y celulares sin saber la clave—; aquí se guardan
/// desde el servidor y solo se leen con sesión, en `/testimonios`.
export default function PaginaDeMilagros() {
  return (
    <main className={`${titulo.variable} ${estilos.pagina}`}>
      <div className={estilos.fondo} aria-hidden="true" />
      <div className={estilos.sombra} aria-hidden="true" />
      <div className={estilos.grano} aria-hidden="true" />

      <div className={estilos.envoltura}>
        <header className={estilos.hero}>
          <p className={estilos.antetitulo}>Tu testimonio</p>
          <h1 className={estilos.titulo}>
            <span className={estilos.tituloA}>Cuéntanos tu</span>
            <span className={estilos.tituloB}>Milagro</span>
          </h1>
          <p className={estilos.subtitulo}>
            Lo que Dios hizo en tu vida puede encender la fe de alguien más.
          </p>
        </header>

        <FormularioDeMilagro />
      </div>
    </main>
  );
}
