-- Taller 2 del prematrimonial: más corto y mejor redactado.
--
-- Pedido del usuario (12-oct-2026): «está muy largo, quiero que lo hagas más
-- corto y mejore la redacción de algunas preguntas para que quede más claro».
--
-- ⚠️ SE PUEDE BORRAR SIN PERDER NADA: el tema 2 tenía 43 preguntas y **CERO
-- respuestas** (comprobado antes de escribir esto). Hay 3 talleres abiertos
-- sobre él, pero vacíos — abrir no es empezar (regla del 2-oct). Si algún día
-- hay respuestas, este archivo NO sirve tal cual: `premarital_answer` cuelga de
-- `question_id` con CASCADE, así que un borrado se llevaría lo respondido.
--
-- ⚠️ LO LARGO NO ERAN LAS PREGUNTAS, ERAN LAS CASILLAS. Las 43 preguntas pedían
-- **64 casillas**, y 24 de ellas estaban en solo tres preguntas (la 1 con 14,
-- la 2 con 7 y la 5 con 3). Borrar 21 preguntas sueltas dejaba el taller en 44
-- casillas: menos preguntas, pero casi el mismo trabajo. Por eso se recortan
-- además las áreas de la 1 y la 2 — decisión del usuario con el dato delante.
--
--   antes:  43 preguntas · 64 casillas
--   ahora:  22 preguntas · 34 casillas   (casi la mitad)
--
-- ⚠️ SE RENUMERA DE 1 A 22, Y ESO CONTRADICE UNA REGLA ESCRITA — a propósito.
-- El comentario de `PremaritalQuestion.fields` y la bitácora del 5-oct dicen
-- que la numeración NO se toca, para que el pastor encuentre «la 5» en el
-- papel. Aquí no aplica, y conviene razonarlo porque la próxima vez puede
-- volver a aplicar:
--   · Aquella regla era por una pregunta que FALTABA y llegaría después. Aquí
--     se quitan 21 **a propósito y para siempre**: este taller ya no es el del
--     libro, es la versión corta de Iglesia Vive.
--   · El número **se pinta en pantalla** (`{pregunta.number}.`, en el celular
--     de la pareja y en la comparación del pastor). Con huecos se leería
--     «…5, 6, 11, 15, 18…», que parece un error del sistema.
--   · La correspondencia con el libro queda guardada en la bitácora (§12), así
--     que es recuperable.
--
-- Idempotente (§5): el borrado solo corre mientras queden las 43 originales,
-- los enunciados se cambian comparando el texto viejo, y la renumeración es
-- estable (repetirla da el mismo 1..22).

-- 1 ---------------------------------------------------------------- borrar 21
-- Pedidas por el usuario: 7,8,9,10,12,13,14,16,17,24,26,27,29,31,32,33,35,39,
-- 41,42,43. La 39 («¿En qué estrato le gustaría vivir?») la confirmó él: en su
-- lista el 29 aparecía dos veces y el segundo rompía el orden ascendente.
delete from "premarital_question" q
using "premarital_topic" t
where t.id = q."topic_id"
  and t."number" = 2
  and q."number" in (7,8,9,10,12,13,14,16,17,24,26,27,29,31,32,33,35,39,41,42,43)
  and (
    select count(*) from "premarital_question" q2
    join "premarital_topic" t2 on t2.id = q2."topic_id"
    where t2."number" = 2
  ) = 43;

-- 2 ------------------------------------- de 7 áreas a 4, en las preguntas 1 y 2
-- Se conservan Espiritual, Emocional, Financiera y Familiar: las cuatro que
-- más pesan en un matrimonio. Salen Física, Temperamento e Intelectual.
-- (Los números 1 y 2 no cambian al renumerar: son las dos primeras.)
update "premarital_question" q
set "fields" = array[
  'Espiritual · Similitudes', 'Espiritual · Diferencias',
  'Emocional · Similitudes',  'Emocional · Diferencias',
  'Financiera · Similitudes', 'Financiera · Diferencias',
  'Familiar · Similitudes',   'Familiar · Diferencias'
]
from "premarital_topic" t
where t.id = q."topic_id" and t."number" = 2 and q."number" = 1;

update "premarital_question" q
set "fields" = array['Espiritual', 'Emocional', 'Financiera', 'Familiar']
from "premarital_topic" t
where t.id = q."topic_id" and t."number" = 2 and q."number" = 2;

-- 3 ------------------------------------------------- redacción más clara (13)
-- Se tocan solo las que tenían un problema real: frases enredadas, signos mal
-- puestos («?, ¿»), una tilde que faltaba («¿A que le temía?») o una pregunta
-- incompleta («cuando grande»). Las otras nueve se dejan tal cual.
--
-- ⚠️ LA DE LAS DEBILIDADES CAMBIA DE ALCANCE, Y NO ES UN DESCUIDO: al borrar la
-- 32 (dones naturales) y la 33 (fortalezas), la 34 quedaba preguntando solo por
-- lo malo. Se le devuelve la otra mitad en la misma casilla.
update "premarital_question" q set "prompt" = n.nuevo
from "premarital_topic" t,
(values
  ('Escriba las diferencias y similitudes con su novio(a) en las siguientes áreas.',
   '¿En qué se parecen y en qué se diferencian usted y su novio(a)? Escríbalo en cada área.'),
  ('De acuerdo a la pregunta anterior, ¿cómo piensa usted que las similitudes y diferencias pueden ser complemento o conflicto en cada área?',
   'Según lo que escribió arriba: en cada área, ¿esas similitudes y diferencias los van a complementar o los van a enfrentar? Explique por qué.'),
  ('Dentro de las diferencias y similitudes encontradas, ¿en cuáles cree que necesita llegar a acuerdos, trabajar inmediatamente o establecer metas a largo plazo?',
   'De todo lo anterior, ¿en qué necesitan ponerse de acuerdo ya mismo, y qué pueden ir trabajando con el tiempo?'),
  ('Según Efesios 4:2 ¿cómo su relación con Dios puede ayudarle en las diferencias que se puedan presentar en su matrimonio?',
   'Lea Efesios 4:2. ¿Cómo puede su relación con Dios ayudarle a manejar las diferencias dentro del matrimonio?'),
  ('Identifique los eventos que marcaron su niñez de manera positiva y negativa en las siguientes áreas:',
   '¿Qué hechos de su niñez lo marcaron, para bien y para mal, en cada una de estas áreas?'),
  ('¿Cómo se lleva con cada uno de sus padres?, ¿qué le gustaba y qué le disgustaba de ellos?',
   '¿Cómo se lleva con cada uno de sus padres? ¿Qué le gustaba y qué le disgustaba de ellos?'),
  ('¿Qué soñaba ser cuando grande?',
   '¿Qué soñaba ser cuando fuera grande?'),
  ('¿Qué premios y logros obtuvo?',
   '¿Qué logros o reconocimientos ha tenido en su vida?'),
  ('¿En su familia se hablaba de Dios?',
   '¿En su familia se hablaba de Dios? Cuente cómo.'),
  ('¿A que le temía?, ¿sigue teniendo alguno de esos temores hoy en día?',
   '¿A qué le temía cuando era niño? ¿Conserva alguno de esos temores hoy?'),
  ('¿Ha tenido hijos? ¿Desea tener hijos?',
   '¿Tiene hijos? ¿Desea tener hijos? ¿Cuántos le gustaría tener?'),
  ('¿Cuáles cree que son sus debilidades?',
   '¿Cuáles cree que son sus fortalezas y cuáles sus debilidades?'),
  ('¿Qué concepto tiene de la vejez?',
   '¿Qué piensa de la vejez? ¿Cómo se imagina la suya?')
) as n(viejo, nuevo)
where t.id = q."topic_id" and t."number" = 2 and q."prompt" = n.viejo;

-- 4 ----------------------------------------------------- renumerar de 1 a 22
-- En dos pasos por el `@@unique([topic_id, number])`: sin el desplazamiento,
-- al asignar el 7 a la que era 11 chocaría con alguna todavía sin mover.
update "premarital_question" q
set "number" = q."number" + 1000
from "premarital_topic" t
where t.id = q."topic_id" and t."number" = 2 and q."number" < 1000;

with orden as (
  select q.id, row_number() over (order by q."number") as n
  from "premarital_question" q
  join "premarital_topic" t on t.id = q."topic_id"
  where t."number" = 2
)
update "premarital_question" q
set "number" = orden.n
from orden
where orden.id = q.id;
