-- Toda la lectura y escritura de datos pasa por la API de Next.js usando
-- Prisma con la conexión de servicio, que aplica RBAC y alcance por red en
-- código. Los clientes de Supabase (claves anon/publishable) nunca deben
-- alcanzar estas tablas directamente: habilitamos RLS sin políticas, lo que
-- deniega todo acceso a los roles `anon` y `authenticated`.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_user', 'team', 'person', 'learner_profile', 'mentor_relationship',
    'operation72', 'contact_attempt', 'milestone', 'private_note',
    'faith_house_topic', 'faith_house_progress', 'audit_log',
    'integration_event'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Los roles anon/authenticated solo existen en Supabase; en una base local
    -- de desarrollo no hay nada que revocar.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END
$$;
