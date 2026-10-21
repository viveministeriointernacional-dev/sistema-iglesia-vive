-- Recordatorio de las Casas de Fe: el registro de lo que ya se mandó.
--
-- Existe por UNA razón: que el envío sea idempotente. El disparador es un
-- workflow de HighLevel llamando a un webhook, y un workflow se puede
-- reintentar, duplicar o quedar configurado dos veces sin que nadie se entere.
-- Sin esta tabla, cada reintento manda otro WhatsApp al mismo líder. El índice
-- único de abajo es lo que lo impide: el segundo intento del mismo día choca y
-- no escribe.
--
-- Y de paso resuelve lo otro: deja ver QUÉ se mandó y a quién. Los dos fallos
-- del 20-oct (el contacto de Saray que no se pudo exportar, el registro de
-- Maricela absorbido por otra ficha) fueron del mismo tipo — algo no pasó y
-- solo quedó en un log. Esto no se queda en un log.
--
-- Repetible (§12.3): todo con IF NOT EXISTS. Y toca una tabla NUEVA, así que no
-- pide candado sobre `app_user` ni `person` y se puede fusionar a cualquier hora.

CREATE TABLE IF NOT EXISTS "faith_house_reminder" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  -- El día de las REUNIONES que resume, «AAAA-MM-DD».
  --
  -- ⚠️ Es TEXT y no DATE a propósito. Las fechas civiles de este proyecto
  -- viajan como texto de punta a punta (§12.1) justamente para no volver a
  -- tropezar con la zona horaria, y esta columna solo se compara por igualdad
  -- para el índice único. Un DATE obligaría a convertir a `Date` en cada
  -- lectura y escritura, que es de donde salieron las siete trampas de fechas.
  "scope_date" TEXT NOT NULL,
  -- DIA (el resumen de la mañana) o NOCHE_ANTES (las de mañana de madrugada).
  "kind" TEXT NOT NULL,
  -- Cuántas casas resumió, en total y cuántas eran suyas. Sirve para responder
  -- «¿por qué no me llegó?» sin tener que reconstruir el día.
  "groups" INTEGER NOT NULL DEFAULT 0,
  "own_groups" INTEGER NOT NULL DEFAULT 0,
  "email_sent" BOOLEAN NOT NULL DEFAULT false,
  "whatsapp_queued" BOOLEAN NOT NULL DEFAULT false,
  -- Por qué no salió, cuando no salió. Un envío que falla sin decir el motivo
  -- es imposible de diagnosticar desde fuera.
  "failure" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "faith_house_reminder_pkey" PRIMARY KEY ("id"),

  -- CASCADE y no SET NULL: si la cuenta desaparece, su registro de envíos se va
  -- con ella. Y sin ningún CHECK sobre estas columnas, que es la trampa del
  -- 13-oct — un CHECK simétrico sobre una columna con SET NULL volvió
  -- imborrables las cuentas que habían marcado una petición de oración.
  --
  -- Va DENTRO del CREATE TABLE y no en un ALTER aparte porque así la migración
  -- es repetible sin un bloque `DO` (que además es lo que cuelga el conector
  -- del MCP, §12.8): si la tabla ya existe, no se hace nada y punto.
  CONSTRAINT "faith_house_reminder_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- **El índice que impide el doble aviso.** Una persona, un día de reuniones, un
-- tipo de envío: una sola fila.
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_reminder_unico"
  ON "faith_house_reminder" ("user_id", "scope_date", "kind");

-- Para la pantalla que mire «qué se mandó hoy».
CREATE INDEX IF NOT EXISTS "faith_house_reminder_scope_date_idx"
  ON "faith_house_reminder" ("scope_date");
