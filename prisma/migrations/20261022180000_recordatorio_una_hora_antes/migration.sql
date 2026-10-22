-- El recordatorio de «una hora antes» necesita que el control sea POR CASA.
--
-- El de la mañana es un aviso por PERSONA y DÍA: si alguien lleva tres casas,
-- recibe un solo mensaje con las tres. Por eso su llave única era
-- (persona · día · tipo) y sobraba cualquier otra cosa.
--
-- El de una hora antes es al revés, y tiene que serlo: tres casas el mismo día
-- son tres toques, cada uno a su hora. Con la llave vieja, el segundo chocaría
-- contra el primero y **no saldría**, sin dar ningún error — el envío se
-- saltaría en silencio, que es justo lo que esta tabla existe para impedir.
--
-- Así que la llave pasa a llevar la casa. Para los dos tipos de siempre
-- `group_id` queda en '' y el índice se comporta EXACTAMENTE igual que antes:
-- una sola fila por persona, día y tipo. No cambia nada de lo que ya funciona.
--
-- Repetible (§12.3): IF NOT EXISTS / IF EXISTS en todo. Y la tabla es nueva y
-- está vacía, así que no pide candado sobre nada caliente y se puede fusionar a
-- cualquier hora.

-- La casa a la que pertenece el aviso. '' para los avisos que resumen el día
-- entero, que no son de ninguna casa en concreto.
--
-- ⚠️ **Es '' y no NULL, y NO lleva clave foránea. Es una decisión, no un
-- descuido.** Con NULL, la unicidad habría que escribirla como un índice sobre
-- `COALESCE(group_id, '')`, y eso Prisma no lo sabe expresar: el `@@unique` del
-- esquema dejaría de describir la base. Un esquema que miente sobre sus índices
-- es caro aquí, porque `tsc` tampoco ve las selecciones de Prisma (§12.4) y
-- entonces no queda nadie mirando. Con '' el índice es de cuatro columnas
-- planas y el modelo lo describe tal cual.
-- Lo que se pierde es el borrado en cascada si alguien elimina una casa: su
-- `group_id` quedaría apuntando a nada. Es una tabla de registro, nunca se une
-- a `faith_house_group` para decidir nada, así que un id huérfano no rompe un
-- envío — solo deja de resolverse en una pantalla que todavía no existe.
ALTER TABLE "faith_house_reminder"
  ADD COLUMN IF NOT EXISTS "group_id" TEXT NOT NULL DEFAULT '';

-- **El cambio de llave, en el orden que importa.** Primero se crea la nueva y
-- después se borra la vieja: así, si algo fallara en medio, nunca hay un
-- instante sin protección contra el doble aviso. Van las dos en la misma
-- transacción (`scripts/migrar.mjs` envuelve cada migración), pero el orden se
-- respeta igual porque no cuesta nada y el día que alguien copie este archivo
-- para otra cosa puede que no haya transacción.
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_reminder_unico_casa"
  ON "faith_house_reminder" ("user_id", "scope_date", "kind", "group_id");

DROP INDEX IF EXISTS "faith_house_reminder_unico";

-- Para la pantalla que algún día mire «qué se mandó de esta casa».
CREATE INDEX IF NOT EXISTS "faith_house_reminder_group_id_idx"
  ON "faith_house_reminder" ("group_id");
