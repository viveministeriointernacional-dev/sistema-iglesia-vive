-- Búsqueda tolerante: columna `search_text` (nombre + correo + teléfonos) en
-- minúsculas y sin tildes, mantenida por un trigger, con índice trigram para
-- que buscar sea rápido y no dependa de mayúsculas, acentos ni exactitud.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "person" ADD COLUMN IF NOT EXISTS "search_text" text;

CREATE OR REPLACE FUNCTION person_fill_search_text() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_text := lower(public.unaccent(
    coalesce(NEW.first_name,'')     || ' ' ||
    coalesce(NEW.last_name,'')      || ' ' ||
    coalesce(NEW.email,'')          || ' ' ||
    coalesce(NEW.call_phone,'')     || ' ' ||
    coalesce(NEW.whatsapp_phone,'')
  ));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_person_search_text ON "person";
CREATE TRIGGER trg_person_search_text
  BEFORE INSERT OR UPDATE ON "person"
  FOR EACH ROW EXECUTE FUNCTION person_fill_search_text();

UPDATE "person" SET search_text = lower(public.unaccent(
  coalesce(first_name,'')     || ' ' ||
  coalesce(last_name,'')      || ' ' ||
  coalesce(email,'')          || ' ' ||
  coalesce(call_phone,'')     || ' ' ||
  coalesce(whatsapp_phone,'')
));

CREATE INDEX IF NOT EXISTS "person_search_text_trgm"
  ON "person" USING gin (search_text gin_trgm_ops);
