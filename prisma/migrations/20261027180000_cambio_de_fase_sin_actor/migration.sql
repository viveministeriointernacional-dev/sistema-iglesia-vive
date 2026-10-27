-- Un cambio de etapa puede no tener a nadie que lo decida.
--
-- Desde el 27-oct-2026 la etapa se mueve sola al inscribir a alguien en una
-- Casa de Fe, en un Alfa o en la Escuela (`src/lib/etapa-automatica.ts`). Casi
-- siempre hay un responsable —quien inscribió—, pero el QR de la Escuela
-- (`inscribirPorFormulario`) lo llena la persona desde su celular y ahí no hay
-- actor, igual que en `escuela.inscripcion_por_qr`.
--
-- Repetible: `DROP NOT NULL` sobre una columna que ya es opcional no hace nada.
ALTER TABLE "phase_change" ALTER COLUMN "decided_by_id" DROP NOT NULL;
