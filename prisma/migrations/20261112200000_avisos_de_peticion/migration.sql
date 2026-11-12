-- Quién recibe los avisos de una petición nueva (oración, consejería, proceso).
--
-- ⚠️ **Es un interruptor de AVISOS, no un permiso de vista.** No abre ni cierra
-- ninguna pantalla: solo dice a quién le llega el correo. Se guarda en la cuenta
-- y no se deriva del rol porque la mesa ministerial no coincide con el rol:
-- Jairo, Ruth y Yuli son MENTOR y tienen que recibirlo igual (decisión del
-- usuario, 12-nov-2026: «No son pastores, pero hacen parte de la mesa
-- ministerial»), y derivarlo del rol obligaría a hacerlos pastores para que les
-- llegue — justo lo que dijo que NO quería.
ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "receives_prayer_alerts" BOOLEAN NOT NULL DEFAULT false;

-- La semilla: los pastores y administradores ACTIVOS.
--
-- Solo activos a propósito: Alejandro Ruiz es PASTOR con la cuenta apagada, y
-- mandarle correo a una cuenta de baja es ruido que nadie lee.
UPDATE "app_user"
   SET "receives_prayer_alerts" = true
 WHERE "active" = true
   AND "role" IN ('PASTOR', 'ADMIN');

-- Y los cuatro que pidió el usuario por nombre el 12-nov-2026.
--
-- Por CORREO y no por nombre: el nombre se puede corregir (a María José le
-- faltó el «José» en una fusión) y entonces esto no casaría con nadie y no
-- fallaría — se quedaría sin avisar en silencio. Nora Bonilla entra aquí
-- aunque él la vaya a pasar a ADMIN: si lo hace, la fila de arriba la habría
-- cogido igual, y si no lo hace, igual recibe.
UPDATE "app_user"
   SET "receives_prayer_alerts" = true
 WHERE "active" = true
   AND lower("email") IN (
     'esquibeljairo8@gmail.com',              -- Jairo Esquivel (MENTOR)
     'seguridadindustrialpenielneiva@gmail.com', -- Ruth Bonilla Gómez (MENTOR)
     'yhernandez17@udi.edu.co',               -- Yuli Perdomo (MENTOR)
     'tatabony@hotmail.com'                   -- Nora Bonilla
   );
