-- Nombre del contacto llamado, tal como lo manda HighLevel. Respaldo para
-- mostrar a quién se llamó cuando el contacto no está en el sistema.
ALTER TABLE "call_log" ADD COLUMN "contact_name" TEXT;
