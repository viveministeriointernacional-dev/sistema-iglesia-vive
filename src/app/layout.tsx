import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-manrope",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--fuente-newsreader",
});

export const metadata: Metadata = {
  title: "Iglesia Vive · Transformación y Propósito",
  description:
    "Plataforma de acompañamiento: Ganar, Fortalecer, Entrenar y Multiplicar.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${newsreader.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
