// ---------------------------------------------------------------------------
// El WhatsApp con el que un mentor recibe a una persona (27-nov-2026)
//
// Aquí vive SOLO el texto. Quien lo deja listo en el CRM es
// `exportarEntregaAMentor` (`highlevel-salida.ts`), y el aviso completo —el
// correo con el historial entero de Operación 72— lo arma
// `avisarAlMentorDeLaEntrega` (`correo-entrega.ts`).
//
// Partido así por lo mismo que los otros catálogos: el texto se puede dibujar
// y probar sin base de datos ni CRM, que es lo único que destapó las cuatro
// faltas de redacción del borrado de grupos y las cuatro del aviso de petición
// (§12.5).
// ---------------------------------------------------------------------------

/// **El centro del mensaje, en UNA sola línea.**
///
/// ⚠️ **Y termina aplanando a propósito.** El valor de una variable de una
/// plantilla de WhatsApp no admite saltos de línea, ni tabuladores, ni cuatro
/// espacios seguidos (§6) — y un nombre teclelado por el equipo puede traer
/// cualquiera de los tres. El saludo y el cierre viven en el texto fijo de la
/// plantilla de Meta; del sistema solo viaja este centro.
///
/// ⚠️ **El «asignada / asignado» vive AQUÍ, no en el texto fijo**, que es el
/// mismo para todos y por tanto no puede llevar género. Es la lección del
/// acceso al taller, que se cobró tres semanas (§6). Y la frase neutra **no es
/// un caso raro**: de las 171 entregas de la historia, **36 personas no tienen
/// el género registrado** — 1 de cada 5.
///
/// ⚠️ **Va el celular dentro, y es una decisión del usuario** (27-nov): la
/// primera tarea que le pedimos al mentor es llamar, así que con el número en
/// el propio WhatsApp llama sin abrir nada. El correo lo lleva igual, con todo
/// lo demás.
export function variableDeWhatsAppDeLaEntrega(datos: {
  /// El nombre completo de quien se entrega: aquí no se saluda, se identifica.
  personaNombre: string;
  genero: "MUJER" | "HOMBRE" | null;
  /// **Ya formateado** con `telefonoLegible` («320 433 9968»). `null` cuando no
  /// hay ninguno — no ha pasado en 171 entregas, pero si pasa el mensaje tiene
  /// que decirlo en vez de dejar un hueco.
  celular: string | null;
}): string {
  const quien = datos.personaNombre.trim() || "Una persona";

  // «queda asignada» / «queda asignado», y neutro cuando no sabemos: suponer
  // el género de alguien es el fallo que salió al dibujar el aviso de petición
  // y cuyo primer caso real fue Juan Felipe (§12.6).
  const queda =
    datos.genero === "MUJER"
      ? "queda asignada a tu mentoría"
      : datos.genero === "HOMBRE"
        ? "queda asignado a tu mentoría"
        : "pasa a tu mentoría";

  // Lo mismo con el pronombre del verbo: «llamarla», «llamarlo», y sin
  // pronombre cuando no se sabe — «llamarle» suena a formulario.
  const llamar =
    datos.genero === "MUJER"
      ? "Lo primero es llamarla y presentarte"
      : datos.genero === "HOMBRE"
        ? "Lo primero es llamarlo y presentarte"
        : "Lo primero es llamar y presentarte";

  const telefono = datos.celular?.trim()
    ? `Su celular es ${datos.celular.trim()}.`
    : "No tenemos su celular en el sistema, así que habrá que conseguirlo.";

  return `${quien} terminó Operación 72 y ${queda}. ${telefono} ${llamar}. El detalle está en la plataforma, en su expediente.`
    .replace(/\s+/g, " ")
    .trim();
}
