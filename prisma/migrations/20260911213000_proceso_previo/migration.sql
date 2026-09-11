-- Quien ya lleva proceso en la iglesia y pasa directo a entrega: qué proceso
-- lleva ya.
--
-- Va en su propia columna y NO en `detail` a propósito: `detail` es un resumen
-- libre que cada acción reescribe, y esto tiene que sobrevivir para que el
-- mentor que la reciba sepa por qué le llega una persona sin llamada ni visita.
ALTER TABLE "operation72"
  ADD COLUMN IF NOT EXISTS "prior_process_note" TEXT;
