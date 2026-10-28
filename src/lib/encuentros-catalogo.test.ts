import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisoDeAbandono,
  CASILLAS_A_LA_VISTA,
  cuantoHaceQueNoSeReune,
  esIndividual,
  nombreDelTema,
  ordenarPorAbandono,
  pieDelEncuentro,
  proximoNumero,
  rotuloDeLaRejilla,
  rotuloDelTema,
  temaQueSigue,
  textoDelBotonDeRegistrar,
  tirillaDeSemanas,
  ultimaVezQueTocaba,
} from "@/lib/encuentros-catalogo";
import { ROTULOS } from "@/lib/tipo-de-grupo";

const diaLargoFalso = (dia: string) => `el día ${dia}`;

test("individual lo decide cuánta gente hay, no el tipo de grupo", () => {
  // La media medida el 27-oct es 1,4 personas por grupo: una Casa de Fe de una
  // sola persona se registra como individual, y una mentoría de dos no.
  assert.equal(esIndividual(0), true);
  assert.equal(esIndividual(1), true);
  assert.equal(esIndividual(2), false);
  assert.equal(esIndividual(6), false);
});

test("la última vez que tocaba respeta el «cada 15 días» contado desde el inicio", () => {
  // Lunes, cada semana. El 2026-10-28 es miércoles, así que el último lunes
  // fue el 26.
  const semanal = { weekday: 1, everyNWeeks: 1, inicio: "2026-10-05" };
  assert.equal(ultimaVezQueTocaba(semanal, "2026-10-28"), "2026-10-26");
  // Si hoy ES el día, hoy cuenta.
  assert.equal(ultimaVezQueTocaba(semanal, "2026-10-26"), "2026-10-26");

  // Cada 15 días desde un lunes 5: le tocan el 5, el 19, el 2-nov… El lunes 26
  // NO le toca, así que la última vez fue el 19.
  const quincenal = { weekday: 1, everyNWeeks: 2, inicio: "2026-10-05" };
  assert.equal(ultimaVezQueTocaba(quincenal, "2026-10-28"), "2026-10-19");
});

test("un grupo sin día de la semana no inventa una fecha", () => {
  // Eran 5 de los 62 grupos abiertos el 27-oct. Proponerles una fecha sería
  // adivinar, así que el botón pide la fecha a mano.
  assert.equal(
    ultimaVezQueTocaba({ weekday: null, everyNWeeks: 1, inicio: "2026-10-05" }, "2026-10-28"),
    null,
  );
});

test("un grupo que todavía no ha llegado a su primera reunión tampoco", () => {
  // 1 de los 62 empieza en el futuro (y 2 de los 3 Restaurados). Mirar hacia
  // atrás no puede devolver un día anterior al arranque del grupo.
  assert.equal(
    ultimaVezQueTocaba({ weekday: 6, everyNWeeks: 1, inicio: "2026-11-30" }, "2026-10-28"),
    null,
  );
});

test("el número de la casilla se pone solo, y no se repite al borrar una de enmedio", () => {
  assert.equal(proximoNumero([]), 1);
  assert.equal(proximoNumero([{ numero: 1 }, { numero: 2 }]), 3);
  // Si se borró el 2, el siguiente es el 4 y no el 3: el número es la casilla,
  // no un contador, y reusar el 3 lo pondría delante del que ya existe.
  assert.equal(proximoNumero([{ numero: 1 }, { numero: 3 }]), 4);
});

test("el botón dice la fecha cuando se sabe, y la pide cuando no", () => {
  assert.deepEqual(textoDelBotonDeRegistrar(null, false, diaLargoFalso), {
    titulo: "Registrar un encuentro",
    pie: null,
  });

  const sinRegistrar = textoDelBotonDeRegistrar("2026-10-26", false, diaLargoFalso);
  assert.equal(sinRegistrar.titulo, "Registrar el encuentro de el día 2026-10-26");
  assert.equal(sinRegistrar.pie, "Tocó reunirse y todavía no está registrado");

  // ⚠️ Ya registrado NO esconde el botón: un grupo puede reunirse dos veces en
  // una semana. Lo que cambia es que deja de prometer que falta algo.
  const yaEsta = textoDelBotonDeRegistrar("2026-10-26", true, diaLargoFalso);
  assert.equal(yaEsta.titulo, "Registrar otro encuentro");
  assert.match(yaEsta.pie ?? "", /ya está registrado/);
});

test("la rejilla y el tema se nombran según el grupo", () => {
  assert.equal(rotuloDeLaRejilla(true), "SE DIO");
  assert.equal(rotuloDeLaRejilla(false), "QUIÉN VINO");
  // Solo Casa de Fe tiene cartilla (27-oct). A los otros tres no se les puede
  // hablar de «tema» de una lista que no existe.
  assert.equal(rotuloDelTema(ROTULOS.CASA_DE_FE), "QUÉ TEMA SE LLEVÓ");
  assert.equal(rotuloDelTema(ROTULOS.MENTORIA), "DE QUÉ SE HABLÓ");
  assert.equal(rotuloDelTema(ROTULOS.RESTAURADOS), "DE QUÉ SE HABLÓ");
  assert.equal(rotuloDelTema(ROTULOS.ALPHA), "DE QUÉ SE HABLÓ");
});

test("el pie de un encuentro concuerda en singular y en plural", () => {
  // La misma falta que el usuario cazó el 23-oct con «1 persona quedan»: el
  // verbo sigue al número.
  assert.equal(pieDelEncuentro({ seDio: true, vinieron: 1, deCuantos: 6 }, false), "vino 1 de 6");
  assert.equal(
    pieDelEncuentro({ seDio: true, vinieron: 5, deCuantos: 6 }, false),
    "vinieron 5 de 6",
  );
  assert.equal(pieDelEncuentro({ seDio: true, vinieron: 1, deCuantos: 1 }, true), "se dio");
  assert.equal(pieDelEncuentro({ seDio: false, vinieron: 0, deCuantos: 1 }, true), "no se pudo");
});

test("la tirilla son ocho semanas, de la más vieja a esta, y marca la que tuvo encuentro", () => {
  // 2026-10-28 es miércoles; su semana va del lunes 26 al domingo 1-nov.
  const tirilla = tirillaDeSemanas(["2026-10-26", "2026-09-14"], "2026-10-28");
  assert.equal(tirilla.length, 8);
  assert.equal(tirilla[7].semana.inicio, "2026-10-26");
  assert.equal(tirilla[7].hubo, true);
  assert.equal(tirilla[0].semana.inicio, "2026-09-07");
  assert.equal(tirilla[0].hubo, false);
  // El 14 de septiembre cae en la segunda barrita.
  assert.equal(tirilla[1].semana.inicio, "2026-09-14");
  assert.equal(tirilla[1].hubo, true);
  assert.equal(tirilla.filter((s) => s.hubo).length, 2);
});

test("«nunca» tiene su propia frase y NO cuenta como atrasado", () => {
  // ⚠️ El día que esto salga los 62 grupos dirán esto. Marcarlos a todos en
  // rojo como abandonados sería acusar al equipo de algo que no hizo: no es que
  // no se reúnan, es que no había dónde apuntarlo.
  const nunca = cuantoHaceQueNoSeReune(null, "2026-10-28");
  assert.equal(nunca.nunca, true);
  assert.equal(nunca.atrasado, false);
  assert.equal(nunca.frase, "Sin ningún encuentro");
});

test("las semanas se cuentan por semana civil, no por días sueltos", () => {
  // Lunes 26 y miércoles 28 son la MISMA semana, aunque haya dos días de por
  // medio: «esta semana», no «hace 0 semanas».
  assert.equal(cuantoHaceQueNoSeReune("2026-10-26", "2026-10-28").frase, "Esta semana");
  // Domingo 25 es la semana pasada aunque solo hayan pasado tres días.
  assert.equal(cuantoHaceQueNoSeReune("2026-10-25", "2026-10-28").frase, "La semana pasada");
  assert.equal(cuantoHaceQueNoSeReune("2026-10-25", "2026-10-28").atrasado, false);

  const tres = cuantoHaceQueNoSeReune("2026-10-05", "2026-10-28");
  assert.equal(tres.frase, "Hace 3 semanas");
  assert.equal(tres.atrasado, true);

  // Dos semanas todavía no es atraso: con un grupo quincenal es una sola falta.
  assert.equal(cuantoHaceQueNoSeReune("2026-10-12", "2026-10-28").atrasado, false);
});

test("arriba va lo que lleva más tiempo quieto, y los que nunca registraron, primero", () => {
  const ordenado = ordenarPorAbandono([
    { id: "a", ultimoDia: "2026-10-26" },
    { id: "b", ultimoDia: null },
    { id: "c", ultimoDia: "2026-09-01" },
  ]);
  assert.deepEqual(
    ordenado.map((g) => g.id),
    ["b", "c", "a"],
  );
});

test("el aviso de abandono no sale cuando no hay nada que avisar", () => {
  // Un aviso que sale siempre se deja de leer (§12.6).
  assert.equal(avisoDeAbandono(0), null);
  assert.match(avisoDeAbandono(1) ?? "", /^Un grupo lleva /);
  assert.match(avisoDeAbandono(3) ?? "", /^3 grupos llevan /);
});

test("el tema se resuelve por su número, para que renombrarlo no deje nombres viejos", () => {
  const temas = [
    { numero: 1, nombre: "Regalo de Dios" },
    { numero: 2, nombre: "¿Quién es Dios?" },
  ];
  assert.equal(nombreDelTema({ topicNumber: 2, topic: null }, temas), "2 · ¿Quién es Dios?");
  // Un número que ya no está en la lista dice el número, no se calla.
  assert.equal(nombreDelTema({ topicNumber: 9, topic: null }, temas), "Tema 9");
  // Escrito a mano, que es como van Alpha, Restaurados y las mentorías.
  assert.equal(
    nombreDelTema({ topicNumber: null, topic: "  Su llamado  " }, temas),
    "Su llamado",
  );
  assert.equal(nombreDelTema({ topicNumber: null, topic: "   " }, temas), "Sin tema apuntado");
  assert.equal(nombreDelTema({ topicNumber: null, topic: null }, temas), "Sin tema apuntado");
});

test("el tema que sigue es el siguiente al mayor dado, y se acaba al llegar al último", () => {
  assert.equal(temaQueSigue([], 12), 1);
  assert.equal(temaQueSigue([{ topicNumber: 1 }, { topicNumber: 2 }], 12), 3);
  // Se saltaron temas: sigue el siguiente al mayor, no el primer hueco. Un
  // grupo que va por el 7 no quiere que le propongan el 3.
  assert.equal(temaQueSigue([{ topicNumber: 1 }, { topicNumber: 7 }], 12), 8);
  // Encuentros con el tema escrito a mano no cuentan.
  assert.equal(temaQueSigue([{ topicNumber: null }, { topicNumber: 4 }], 12), 5);
  // Terminada la cartilla no hay siguiente: el desplegable abre sin marcar.
  assert.equal(temaQueSigue([{ topicNumber: 12 }], 12), null);
  assert.equal(temaQueSigue([], 0), null);
});

test("el tope de casillas a la vista existe y es menor que la vida de un grupo viejo", () => {
  // La casa abierta más vieja arrancó el 16-nov-2024: sin tope, su fila tendría
  // más de cien casillas.
  assert.ok(CASILLAS_A_LA_VISTA >= 4 && CASILLAS_A_LA_VISTA <= 16);
});
