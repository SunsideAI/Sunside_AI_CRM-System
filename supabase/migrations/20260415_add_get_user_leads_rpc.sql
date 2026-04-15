-- =====================================================
-- MIGRATION: RPC-Funktion get_user_leads
-- Datum: 2026-04-15
-- Problem: .in('id', [...1200 UUIDs]) sprengt URL-Limits
-- Lösung: Server-seitiger JOIN via RPC
-- =====================================================

-- Liefert paginierte Leads für einen User mit Filtern.
-- Ersetzt das clientseitige .in('id', [...uuids]) Pattern, das bei > ~600 Assignments
-- die PostgREST-URL-Limits sprengt.
CREATE OR REPLACE FUNCTION public.get_user_leads(
  p_user_id      uuid,
  p_wiedervorlage boolean DEFAULT NULL,  -- true = nur mit Datum, NULL = egal
  p_contacted    boolean DEFAULT NULL,   -- true/false = Filter, NULL = egal
  p_ergebnis     text    DEFAULT NULL,   -- exakter Match auf ergebnis::text
  p_land         text    DEFAULT NULL,
  p_quelle       text    DEFAULT NULL,
  p_search       text    DEFAULT NULL,   -- ILIKE auf unternehmensname + stadt
  p_offset       int     DEFAULT 0,
  p_limit        int     DEFAULT 50
)
RETURNS TABLE(lead_data jsonb, total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_total bigint;
BEGIN
  -- Total für Pagination zählen
  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  JOIN public.lead_assignments la ON la.lead_id = l.id
  WHERE la.user_id = p_user_id
    AND (p_wiedervorlage IS NULL OR (p_wiedervorlage = true AND l.wiedervorlage_datum IS NOT NULL))
    AND (p_contacted    IS NULL OR COALESCE(l.bereits_kontaktiert, false) = p_contacted)
    AND (p_ergebnis     IS NULL OR l.ergebnis::text = p_ergebnis)
    AND (p_land         IS NULL OR l.land::text     = p_land)
    AND (p_quelle       IS NULL OR l.quelle::text   = p_quelle)
    AND (p_search       IS NULL OR
         l.unternehmensname ILIKE '%' || p_search || '%' OR
         l.stadt            ILIKE '%' || p_search || '%');

  -- Daten als jsonb zurückgeben (kompatibel mit aktuellem Mapper)
  RETURN QUERY
  SELECT to_jsonb(l.*), v_total
  FROM public.leads l
  JOIN public.lead_assignments la ON la.lead_id = l.id
  WHERE la.user_id = p_user_id
    AND (p_wiedervorlage IS NULL OR (p_wiedervorlage = true AND l.wiedervorlage_datum IS NOT NULL))
    AND (p_contacted    IS NULL OR COALESCE(l.bereits_kontaktiert, false) = p_contacted)
    AND (p_ergebnis     IS NULL OR l.ergebnis::text = p_ergebnis)
    AND (p_land         IS NULL OR l.land::text     = p_land)
    AND (p_quelle       IS NULL OR l.quelle::text   = p_quelle)
    AND (p_search       IS NULL OR
         l.unternehmensname ILIKE '%' || p_search || '%' OR
         l.stadt            ILIKE '%' || p_search || '%')
  ORDER BY l.unternehmensname ASC
  OFFSET p_offset
  LIMIT  p_limit;
END;
$$;

-- Berechtigungen
GRANT EXECUTE ON FUNCTION public.get_user_leads(
  uuid, boolean, boolean, text, text, text, text, int, int
) TO anon, authenticated, service_role;

-- Dokumentation
COMMENT ON FUNCTION public.get_user_leads IS
  'Paginierte Lead-Liste für einen User mit Filtern. Ersetzt clientseitiges .in("id", [...uuids]) wegen URL-Limit bei vielen Assignments.';
