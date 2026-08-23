-- Sin valor por defecto, cualquier alta que no envíe el arreglo explícitamente
-- falla con violación de nulos. Un horario vacío es un dato válido: no se sabe.
ALTER TABLE "person" ALTER COLUMN "call_schedules" SET DEFAULT '{}';
