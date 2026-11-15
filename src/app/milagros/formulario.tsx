"use client";

import { useState, useTransition } from "react";
import {
  LARGO_MAXIMO_CELULAR,
  LARGO_MAXIMO_NOMBRE,
  LARGO_MAXIMO_TESTIMONIO,
  validarTestimonio,
} from "@/lib/testimonios-catalogo";
import { enviarTestimonio } from "./acciones";
import estilos from "./milagros.module.css";

export function FormularioDeMilagro() {
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [edad, setEdad] = useState("");
  const [milagro, setMilagro] = useState("");
  const [trampa, setTrampa] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [enCurso, iniciar] = useTransition();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const datos = { nombre, celular, edad: parseInt(edad, 10), milagro };

    // La misma validación que hace el servidor, para decir el error en el acto.
    const revision = validarTestimonio(datos);
    if (!revision.ok) {
      setError(revision.mensaje);
      return;
    }
    setError("");
    iniciar(async () => {
      const resultado = await enviarTestimonio({ ...datos, trampa }).catch(() => ({
        ok: false as const,
        mensaje: "No se pudo enviar. Revisa tu conexión e intenta de nuevo.",
      }));
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setListo(true);
      window.scrollTo(0, 0);
    });
  }

  if (listo) {
    return (
      <div className={estilos.tarjeta} role="status">
        <div className={estilos.listo}>
          <div className={estilos.listoIcono} aria-hidden="true">
            🔥
          </div>
          <h2 className={estilos.listoTitulo}>¡Gracias!</h2>
          <p className={estilos.listoTexto}>
            Nuestro equipo se contactará contigo para que muchos conozcan lo que
            Dios hizo en tu vida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className={estilos.tarjeta} onSubmit={enviar} noValidate>
      <label className={estilos.etiqueta} htmlFor="nombre">
        Nombre
      </label>
      <input
        id="nombre"
        className={estilos.campo}
        type="text"
        placeholder="Tu nombre completo"
        autoComplete="name"
        maxLength={LARGO_MAXIMO_NOMBRE}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <label className={estilos.etiqueta} htmlFor="celular">
        Número de celular
      </label>
      <input
        id="celular"
        className={estilos.campo}
        type="tel"
        inputMode="tel"
        placeholder="Ej: 300 123 4567"
        autoComplete="tel"
        maxLength={LARGO_MAXIMO_CELULAR}
        value={celular}
        onChange={(e) => setCelular(e.target.value)}
      />

      <label className={estilos.etiqueta} htmlFor="edad">
        Edad
      </label>
      <input
        id="edad"
        className={estilos.campo}
        type="number"
        inputMode="numeric"
        min={1}
        max={120}
        placeholder="Tu edad"
        value={edad}
        onChange={(e) => setEdad(e.target.value)}
      />

      <label className={estilos.etiqueta} htmlFor="milagro">
        Cuéntanos tu milagro brevemente
      </label>
      <textarea
        id="milagro"
        className={`${estilos.campo} ${estilos.texto}`}
        maxLength={LARGO_MAXIMO_TESTIMONIO}
        placeholder="¿Qué hizo Dios en tu vida?"
        value={milagro}
        onChange={(e) => setMilagro(e.target.value)}
      />
      <div className={estilos.contador}>
        {milagro.length} / {LARGO_MAXIMO_TESTIMONIO}
      </div>

      <div className={estilos.trampa} aria-hidden="true">
        <label htmlFor="sitio">No llenes este campo</label>
        <input
          id="sitio"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trampa}
          onChange={(e) => setTrampa(e.target.value)}
        />
      </div>

      <div className={estilos.error} role="alert">
        {error}
      </div>
      <button className={estilos.boton} type="submit" disabled={enCurso}>
        {enCurso ? "Enviando…" : "Enviar mi testimonio"}
      </button>
    </form>
  );
}
