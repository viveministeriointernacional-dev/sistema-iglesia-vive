"use client";

import { useEffect } from "react";

/// El último recurso: lo único que atrapa un fallo del **layout raíz**.
///
/// ⚠️ **Los `error.tsx` NO cubren el layout raíz**, y sin esto ese caso seguiría
/// cayendo en la pantalla negra de Cloudflare. Es poco probable —el layout de
/// este proyecto solo carga tipografías y no toca la base— pero es justo el
/// hueco que deja la red de los demás.
///
/// ⚠️ **Lleva su propio `<html>` y `<body>`, y los estilos van EN LÍNEA.**
/// Cuando el layout raíz es el que falló, no se puede contar con que haya
/// cargado la hoja de estilos ni las tipografías: una pantalla de error que
/// depende de lo que acaba de romperse no sirve de nada.
export default function ErrorDelLayout({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[layout] la aplicación no cargó:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#f6f4ef",
          color: "#131c24",
          fontFamily: "system-ui, sans-serif",
          padding: "40px 20px",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(19,28,36,.42)",
            }}
          >
            Iglesia Vive
          </p>
          <h1
            style={{
              margin: "16px 0 0",
              fontFamily: "Georgia, serif",
              fontSize: 26,
              lineHeight: 1.12,
              fontWeight: 400,
            }}
          >
            La plataforma no alcanzó a cargar
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(19,28,36,.55)",
            }}
          >
            Fue algo momentáneo. Vuelve a intentarlo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 28,
              width: "100%",
              border: 0,
              borderRadius: 12,
              background: "#0e2a4e",
              color: "#fff",
              padding: "14px 16px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Volver a intentar
          </button>
          {error.digest ? (
            <p
              style={{
                margin: "28px 0 0",
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(19,28,36,.42)",
              }}
            >
              Si vuelve a pasar, pasa este código junto con la hora:{" "}
              <strong style={{ color: "rgba(19,28,36,.55)" }}>
                {error.digest}
              </strong>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
