-- Nuevo estado de Operación 72: SEGUIMIENTO. Se llamó y no contestó; la persona
-- sigue esperando contacto pero ya con un intento registrado. Una llamada
-- contestada la pasa a CONTACTADA.
ALTER TYPE "Operation72Status" ADD VALUE IF NOT EXISTS 'SEGUIMIENTO' AFTER 'INICIADA';
