# Fix: 500-Fehler bei `leads`-Endpoint für User mit vielen Assignments

## Problem

`GET /netlify/functions/leads?wiedervorlage=true&userId=<uuid>` returnt **500** für User mit > ~600 Lead-Assignments (Denise Wüst, Carl Rachow, Marvin Schütze, Manuel Schälling, Paul Probodziak, Armin Moskal, Malte Jandik, Svon Keller).

## Ursache

In `netlify/functions/leads.js` (Zeile ~249-251 und ~298-301) baut der Code:

```javascript
const leadIds = allAssignments.map(a => a.lead_id)  // bis zu 2.153 UUIDs
query = query.in('id', leadIds)
```

Das wird von supabase-js zu einer PostgREST-URL serialisiert: `?id=in.(uuid1,uuid2,...,uuidN)`.
Bei 1.200 UUIDs × ~37 Zeichen + Kommas + URL-Encoding = **~50 KB URL**. PostgREST/Netlify Function URL-Limits liegen bei 4–16 KB → Server returnt 500.

**Betroffene User (Stand 15.04.2026):** Manuel Schälling (2.153), Marvin Schütze (1.497), Denise Wüst (1.200), Carl Rachow (988), Paul Probodziak (566), Armin Moskal (503), Malte Jandik (502), Svon Keller (501).

## Lösung

PostgreSQL-RPC-Funktion die den JOIN serverseitig macht. Frontend übergibt nur User-ID + Filter, keine UUID-Liste.

---

## Schritt 1: Migration `supabase/migrations/20260415_add_get_user_leads_rpc.sql`

```sql
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

GRANT EXECUTE ON FUNCTION public.get_user_leads(
  uuid, boolean, boolean, text, text, text, text, int, int
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_user_leads IS
  'Paginierte Lead-Liste für einen User mit Filtern. Ersetzt clientseitiges .in("id", [...uuids]) wegen URL-Limit bei vielen Assignments.';
```

**Wichtig:** Da die Migration eine RPC anlegt, vor dem Apply prüfen ob `apply_migration` (Supabase MCP) verfügbar ist, sonst SQL-Editor nutzen.

---

## Schritt 2: Refactor `netlify/functions/leads.js`

Den kompletten Block **Zeile ~149 bis ~302** (alles unter `if (needsUserFilter && userId) { ... }` plus die nachfolgenden Filter `contacted`/`result`/`land`/`quelle`/`wiedervorlage`/`search`/Sortierung/Pagination/`.range()`) ersetzen durch:

```javascript
// === RPC-basierter Pfad: skaliert auf beliebig viele Assignments ===
if (needsUserFilter && userId) {
  // Effective userId mit Fallback-Kette: userId → airtableId → User-by-name
  let effectiveUserId = userId

  // Fallback 1: airtableId
  if (airtableId) {
    const { count } = await supabase
      .from('lead_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (count === 0) {
      const { count: countAt } = await supabase
        .from('lead_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', airtableId)
      if (countAt > 0) effectiveUserId = airtableId
    }
  }

  // Fallback 2: User by name (nur wenn weder userId noch airtableId Treffer haben)
  if (userName && effectiveUserId === userId) {
    const { count } = await supabase
      .from('lead_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', effectiveUserId)
    if (count === 0) {
      const { data: matchingUsers } = await supabase
        .from('users').select('id').ilike('vor_nachname', userName).limit(5)
      for (const u of matchingUsers || []) {
        if (u.id === userId) continue
        const { count: c2 } = await supabase
          .from('lead_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.id)
        if (c2 > 0) { effectiveUserId = u.id; break }
      }
    }
  }

  // RPC-Aufruf — alle Filter serverseitig
  const { data: rpcResult, error: rpcError } = await supabase.rpc('get_user_leads', {
    p_user_id:       effectiveUserId,
    p_wiedervorlage: wiedervorlage === 'true' ? true : null,
    p_contacted:     contacted === 'true' ? true : (contacted === 'false' ? false : null),
    p_ergebnis:      result && result !== 'all'      ? result      : null,
    p_land:          land   && land   !== 'all'      ? land        : null,
    p_quelle:        quelle && quelle !== 'all'      ? quelle      : null,
    p_search:        search || null,
    p_offset:        parseInt(offset) || 0,
    p_limit:         50
  })

  if (rpcError) {
    console.error('[Leads] RPC error:', rpcError.message)
    throw new Error(rpcError.message || 'Fehler beim Laden der Leads (RPC)')
  }

  const totalCount = rpcResult?.[0]?.total_count ?? 0
  const leadsRaw   = (rpcResult || []).map(r => r.lead_data)

  // Lead Assignments für die zurückgegebenen Leads laden (für zugewiesenAn-Anzeige)
  const leadIds = leadsRaw.map(l => l.id)
  const assignmentMap = await loadLeadAssignments(leadIds)

  const leads = leadsRaw.map(record => formatLead(record, assignmentMap))
  const offsetNum = parseInt(offset) || 0
  const hasMore   = totalCount > offsetNum + leads.length

  const users = Object.entries(userMap)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      leads,
      users,
      offset: hasMore ? offsetNum + leads.length : null,
      hasMore
    })
  }
}

// === Admin-Pfad ohne User-Filter: bestehende Query-Building beibehalten ===
// (Ab hier original-Code lassen, also let query = supabase.from('leads').select('*', { count: 'exact' })
//  plus alle Filter-Blocks für vertriebler/contacted/result/land/quelle/wiedervorlage/search,
//  plus order + range + final fetch)
```

**Helper extrahieren** (existierender Mapping-Code aus Zeile ~282-309 in eigene Funktion `formatLead(record, assignmentMap)` ziehen, damit sowohl der RPC-Pfad als auch der Admin-Pfad ihn nutzen können). Inhalt unverändert.

---

## Schritt 3: Verifikation

Nach Deploy für jeden der 8 Power-User testen:

```bash
# Beispiel für Denise (1.200 Assignments)
curl -i 'https://crmsunsideai.netlify.app/.netlify/functions/leads?userId=45a20b75-5c78-427d-ba4f-4497f304de66&wiedervorlage=true'
# → erwartet: HTTP 200, JSON mit leads-Array (max 50), users-Array, offset, hasMore

# Sanity-Check für Admin-Pfad (kein userId)
curl -i 'https://crmsunsideai.netlify.app/.netlify/functions/leads?userRole=Admin&view=all'
# → erwartet: HTTP 200, unverändertes Verhalten
```

Außerdem im Frontend prüfen: Notifications-Polling für die 8 Power-User darf keine 500er mehr werfen (siehe DevTools-Konsole).

---

## Akzeptanz-Kriterien

1. ✅ Keine 500er für `?wiedervorlage=true&userId=<powerUserId>` — alle 8 Power-User testen
2. ✅ Pagination funktioniert (offset, hasMore, total_count korrekt)
3. ✅ Alle Filter (`contacted`, `result`, `land`, `quelle`, `search`, `wiedervorlage`) liefern dieselben Ergebnisse wie vorher (Smoke-Test mit Paul Probodziak — kleine User-Basis, vorher schon funktional)
4. ✅ Admin-Pfad (kein `userId`) unverändert
5. ✅ `zugewiesenAn`-Feld wird korrekt befüllt (Mapping über `loadLeadAssignments` erhalten)
6. ✅ Fallback-Logik (airtableId, User-by-name) funktioniert weiterhin
7. ✅ Performance: RPC-Calls < 500ms auch für Manuel Schälling (2.153 Assignments)

---

## Hinweise / Stolpersteine

- **`leads`-Tabelle hat ARRAY-Felder** (`mail`, `unternehmensname` etc. waren historisch JSON-strings/arrays nach Migration). Das aktuelle `arrayToString()`-Mapping in `formatLead` muss erhalten bleiben. `to_jsonb(l.*)` in der RPC liefert die Rohdaten, der JS-Mapper kümmert sich um die Normalisierung.
- **`ergebnis`/`land`/`quelle` sind PostgreSQL-Enums** — deshalb `::text`-Cast in den WHERE-Klauseln, sonst würde Postgres bei NULL-Vergleichen meckern.
- **`COALESCE(bereits_kontaktiert, false)`**: dein bisheriger Code behandelt `IS NULL` als `false` (siehe Z.234). Das hier nachgebaut für Konsistenz.
- **Variable-Konflikt**: das alte `result` als Filter-Param kollidiert mit dem neuen `rpcResult`. Im Patch oben umbenannt — beim Refactor drauf achten.
- **`exec_sql`-Funktion** existiert nicht mehr (wurde nach der Lead-Timestamp-Migration gedroppt). Für die Migration den Supabase SQL-Editor oder `apply_migration` via MCP nutzen.
