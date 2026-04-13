# Sunside CRM – Supabase-Migration Audit

**Datum:** 2026-04-13
**Scope:** Vergleich `main` (Airtable, Produktion) vs. `claude/analyze-repo-fKMVI` (Supabase-Migration)
**Ziel:** Alle fachlichen Lücken vor dem Cutover schließen

---

## Executive Summary

Die Migration ist zu ~85 % fertig. **5 kritische Bugs** und **~10 kleinere Abweichungen** müssen vor dem Go-Live behoben werden. Der schwerwiegendste Bug ist, dass das **"Angebot konfigurieren"-Feature** (der Hauptgrund für die aktuellen Schema-Änderungen) in der Supabase-Version **überhaupt nicht funktioniert** – die vier Angebots-Felder sind nicht im PATCH-Mapping von `hot-leads.js`.

| # | Priorität | Datei | Bug | Auswirkung |
|---|---|---|---|---|
| 1 | 🔴 Blocker | hot-leads.js | Angebot-Felder fehlen im fieldMap | "Angebot konfigurieren" speichert nicht |
| 2 | 🔴 Blocker | hot-leads.js | Attachments werden im PATCH nicht verarbeitet | Dokument-Upload am Hot Lead broken |
| 3 | 🔴 Blocker | hot-leads.js | `produkt_dienstleistung` nicht als Array gewrapped | DB-Fehler bei Produktwechsel |
| 4 | 🟠 Hoch | send-email.js | Status-Auto-Eskalation fehlt | Workflow-Regression für Kaltakquise |
| 5 | 🟠 Hoch | lead-requests.js | User-E-Mail nach Genehmigung fehlt | Vertriebler erfahren nicht, dass Anfrage genehmigt wurde |
| 6 | 🟡 Mittel | calendly-webhook.js | `findHotLeadByEmail` Fallback fehlt | Cancel-Events ohne exakten Match werden nicht verarbeitet |
| 7 | 🟡 Mittel | send-email.js | `call` Icon im History-Log fehlt | Anruf-Einträge zeigen 📋 statt 📞 |
| 8 | 🟡 Mittel | lead-requests.js | `assignLeadsToUser` skaliert nicht | Bei >1000 Assignments potenziell zu wenige Leads zugewiesen |
| 9 | 🟢 Niedrig | send-email.js | HTML-Templates für Closer-Notifications reduziert | Weniger hübsch, funktional ok |
| 10 | 🟢 Niedrig | analytics.js | 5-min-Cache entfernt | Höhere Supabase-Last, kein funktionaler Bruch |

---

## Bug #1 (🔴 Blocker) – "Angebot konfigurieren" funktioniert nicht

**Datei:** `netlify/functions/hot-leads.js` (Supabase-Version), Zeile ~530
**Betroffenes Feature:** Closing-Seite → "Angebot konfigurieren"-Modal

### Problem

In `main` (Airtable) enthält `allowedFields`:
```
'Vertragsbestandteile', 'Paketname_Individuell',
'Kurzbeschreibung', 'Leistungsbeschreibung',
'Attachments', 'Kommentar'
```

In der Supabase-Version enthält `fieldMap`:
```js
const fieldMap = {
  'status': 'status', 'setup': 'setup', 'retainer': 'retainer',
  'laufzeit': 'laufzeit', 'produktDienstleistung': 'produkt_dienstleistung',
  'kundeSeit': 'kunde_seit', 'prioritaet': 'prioritaet',
  'closerId': 'closer_id', 'terminDatum': 'termin_beratungsgespraech',
  'terminart': 'terminart', 'meetingLink': 'meeting_link'
}
```

→ Alle vier neuen Angebots-Felder **und** Attachments **und** Kommentar fehlen. Das Frontend sendet diese Keys, `hot-leads.js` ignoriert sie still (`if (dbField)` → false → nichts passiert).

### Fix

`netlify/functions/hot-leads.js`, im PATCH-Handler `fieldMap` ersetzen:

```js
const fieldMap = {
  'status': 'status',
  'setup': 'setup',
  'retainer': 'retainer',
  'laufzeit': 'laufzeit',
  'produktDienstleistung': 'produkt_dienstleistung',
  'kundeSeit': 'kunde_seit',
  'prioritaet': 'prioritaet',
  'closerId': 'closer_id',
  'terminDatum': 'termin_beratungsgespraech',
  'terminart': 'terminart',
  'meetingLink': 'meeting_link',
  // --- NEU: Angebot konfigurieren ---
  'vertragsbestandteile': 'vertragsbestandteile',
  'paketname': 'paketname_individuell',
  'kurzbeschreibung': 'kurzbeschreibung',
  'leistungsbeschreibung': 'leistungsbeschreibung',
  // --- NEU: eigene Felder (nicht mehr Lookup) ---
  'kommentar': 'kommentar',
  'attachments': 'attachments'
}
```

Außerdem müssen diese Felder im **GET-Response** ausgegeben werden. Aktuell (Zeile ~222) fehlt das Mapping. Ergänzen in der Record-Transformation:

```js
// Im GET-Handler, beim Bauen des Response-Objekts:
vertragsbestandteile: record.vertragsbestandteile || '',
paketname: record.paketname_individuell || '',
kurzbeschreibung: record.kurzbeschreibung || '',
leistungsbeschreibung: record.leistungsbeschreibung || '',
kommentar: record.kommentar || '',
```

### Verifikations-SQL (nach Fix)

```sql
SELECT id, unternehmen, vertragsbestandteile, paketname_individuell,
       kurzbeschreibung, leistungsbeschreibung
FROM hot_leads
WHERE vertragsbestandteile IS NOT NULL
LIMIT 5;
```

---

## Bug #2 (🔴 Blocker) – Attachments werden im PATCH nicht verarbeitet

**Datei:** `netlify/functions/hot-leads.js` PATCH-Handler

### Problem

Schema hat Attachments **zweifach** definiert:
- Separate Tabelle `hot_lead_attachments` (aus `schema.sql`)
- JSONB-Feld `attachments` direkt auf `hot_leads` (aus Migration `20260413_add_new_hot_leads_fields.sql`)

Der PATCH-Code schreibt keines von beiden. Der GET-Code liest aus der separaten Tabelle (Z. 224):
```js
attachments: (record.hot_lead_attachments || []).map(att => ({ ... }))
```

Inkonsistenz: Lesen aus Tabelle, Schreiben nirgendwo. **Entscheidung treffen** und durchziehen.

### Empfehlung: JSONB-Feld verwenden

Vorteile: Ein Write pro Update, keine Sync-Probleme, Migration hat das Feld bereits.

**Fix Teil A** – `fieldMap` um `'attachments': 'attachments'` erweitern (siehe Bug #1).

**Fix Teil B** – Frontend sendet Attachments als:
```js
[{ url: 'https://...', filename: 'angebot.pdf', size: 12345, mime: 'application/pdf' }]
```
Das passt direkt als JSONB. Kein Transform nötig.

**Fix Teil C** – GET-Handler umbauen, damit er **aus dem JSONB-Feld** liest statt aus der separaten Tabelle:

```js
// Alt:
attachments: (record.hot_lead_attachments || []).map(...)
// Neu:
attachments: Array.isArray(record.attachments) ? record.attachments : []
```

Und die `.select()` Query entsprechend kürzen (`hot_lead_attachments(...)` Join entfernen).

**Fix Teil D** (optional, später) – `hot_lead_attachments`-Tabelle per Cleanup-Migration droppen:
```sql
-- Nach erfolgreicher Frontend-Umstellung:
DROP TABLE IF EXISTS hot_lead_attachments;
```

---

## Bug #3 (🔴 Blocker) – produkt_dienstleistung DB-Typ-Mismatch

**Datei:** `netlify/functions/hot-leads.js` PATCH-Handler

### Problem

Laut Migration `20260413_add_new_hot_leads_fields.sql` ist `produkt_dienstleistung` jetzt `TEXT[]` (Array). Der PATCH-Code sendet aber den Wert **unverändert** weiter:

```js
for (const [key, value] of Object.entries(updates)) {
  const dbField = fieldMap[key]
  if (dbField) {
    if (key === 'closerName' && value) {
      // ...
    } else {
      fields[dbField] = value  // <-- Hier: value ist wahrscheinlich String "KI-Chatbot"
    }
  }
}
```

Wenn das Frontend einen String sendet (was `main` tut, weil Airtable Single-Select war), schlägt Supabase den Insert mit Typfehler ab (PG-Error 22P02 `malformed array literal`).

### Fix

Array-Wrap im PATCH-Handler ergänzen, **bevor** `fields[dbField] = value`:

```js
// Spezialbehandlung für produkt_dienstleistung (TEXT[])
if (dbField === 'produkt_dienstleistung') {
  fields[dbField] = Array.isArray(value) ? value : (value ? [value] : null)
  continue
}
fields[dbField] = value
```

Analog im `POST`-Handler prüfen (bei Neuanlage eines Hot Leads über `release-closer-leads` u. ä.).

---

## Bug #4 (🟠 Hoch) – Status-Auto-Eskalation fehlt

**Datei:** `netlify/functions/send-email.js`, Funktion `updateLeadHistory`

### Problem

In `main` triggert ein E-Mail-Versand automatisch einen Status-Update, wenn der Lead aktuell auf `Nicht erreicht` oder `Kein Interesse` steht:

```js
const lowerStatuses = ['Nicht erreicht', 'Kein Interesse']
const shouldUpdateStatus = action === 'email' && lowerStatuses.includes(currentStatus)
// ... später:
if (shouldUpdateStatus) {
  // PATCH Ergebnis -> 'Unterlage bereitstellen'
}
```

In der Supabase-Version fehlt diese Logik komplett. Workflow-Regression.

### Fix

`updateLeadHistory` in `netlify/functions/send-email.js` erweitern:

```js
async function updateLeadHistory({ leadId, action, details, userName, attachmentCount }) {
  // Lead laden (Kommentar + Ergebnis)
  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('kommentar, ergebnis')
    .eq('id', leadId)
    .single()

  if (fetchErr) throw new Error('Lead konnte nicht geladen werden: ' + fetchErr.message)

  const currentKommentar = lead?.kommentar || ''
  const currentStatus = lead?.ergebnis || ''

  // Timestamp + neuer Eintrag
  const now = new Date()
  const timestamp = now.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  const icon = action === 'email' ? '📧' : action === 'call' ? '📞' : '📋'
  const attachmentInfo = attachmentCount > 0 ? ` (${attachmentCount} Anhänge)` : ''
  const newEntry = `[${timestamp}] ${icon} ${details}${attachmentInfo} (${userName})`
  const updatedKommentar = currentKommentar ? `${newEntry}\n${currentKommentar}` : newEntry

  // Update-Payload
  const updatePayload = { kommentar: updatedKommentar }

  // Status-Auto-Eskalation bei E-Mail-Versand
  const lowerStatuses = ['Nicht erreicht', 'Kein Interesse']
  if (action === 'email' && lowerStatuses.includes(currentStatus)) {
    updatePayload.ergebnis = 'Unterlage bereitstellen'
  }

  const { error: updateErr } = await supabase
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId)

  if (updateErr) throw new Error('Lead-Update fehlgeschlagen: ' + updateErr.message)
}
```

**Hinweis:** `ergebnis` ist ein ENUM (`ergebnis_type`). `'Unterlage bereitstellen'` ist dort definiert – passt. Testen mit einem Lead im Status "Nicht erreicht": nach Template-E-Mail sollte Status auf "Unterlage bereitstellen" springen.

---

## Bug #5 (🟠 Hoch) – User-E-Mail nach Lead-Anfrage-Genehmigung fehlt

**Datei:** `netlify/functions/lead-requests.js` PATCH-Handler

### Problem

`main` sendet nach Genehmigung/Ablehnung/Teilgenehmigung eine HTML-E-Mail an den anfragenden User (Funktion `sendUserNotification`, ~120 Zeilen). In Supabase-Version **komplett entfernt**.

Folge: Vertriebler erfahren nur per System Message im CRM, dass Anfrage bearbeitet wurde – keine Push-Nachricht via E-Mail.

### Fix

Am Ende des PATCH-Handlers, **nach** `assignLeadsToUser`, vor dem `return`:

```js
// E-Mail-Benachrichtigung an den Anfragenden
try {
  await sendUserNotification({
    userId: updatedRequest.user_id,
    status: updatedRequest.status,
    genehmigteAnzahl: updatedRequest.genehmigte_anzahl || updatedRequest.anzahl,
    angefragt: updatedRequest.anzahl,
    adminKommentar: updatedRequest.admin_kommentar,
    zugewieseneLeads
  })
} catch (e) {
  console.error('User-Benachrichtigung fehlgeschlagen:', e)
}
```

Und unten im File (als separate Funktion):

```js
async function sendUserNotification({ userId, status, genehmigteAnzahl, angefragt, adminKommentar, zugewieseneLeads }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) return

  const { data: user } = await supabase
    .from('users')
    .select('vor_nachname, email_geschaeftlich, email')
    .eq('id', userId)
    .single()

  const userEmail = user?.email_geschaeftlich || user?.email
  if (!userEmail) return

  const userName = user.vor_nachname || 'Vertriebler'

  // Status-spezifische Texte
  let statusTitle, statusColor, statusIcon, mainMessage, subject
  if (status === 'Genehmigt') {
    statusTitle = 'Genehmigt ✓'
    statusColor = '#10B981'
    statusIcon = '✅'
    mainMessage = `Deine Anfrage über ${angefragt} Leads wurde genehmigt. ${zugewieseneLeads > 0 ? `${zugewieseneLeads} Leads wurden dir zugewiesen.` : ''}`
    subject = `✅ Deine Lead-Anfrage wurde genehmigt (${zugewieseneLeads} Leads)`
  } else if (status === 'Teilweise_Genehmigt') {
    statusTitle = 'Teilweise Genehmigt'
    statusColor = '#F59E0B'
    statusIcon = '⚠️'
    mainMessage = `Deine Anfrage wurde teilweise genehmigt. ${genehmigteAnzahl} von ${angefragt} Leads wurden dir zugewiesen.`
    subject = `⚠️ Lead-Anfrage teilweise genehmigt (${genehmigteAnzahl}/${angefragt})`
  } else if (status === 'Abgelehnt') {
    statusTitle = 'Abgelehnt'
    statusColor = '#EF4444'
    statusIcon = '❌'
    mainMessage = `Deine Anfrage über ${angefragt} Leads wurde leider abgelehnt.`
    subject = `❌ Deine Lead-Anfrage wurde abgelehnt`
  } else {
    return
  }

  // HTML Template (kann 1:1 aus main übernommen werden - siehe unten)
  const emailBody = buildUserNotificationHtml({
    userName, statusTitle, statusColor, statusIcon,
    mainMessage, adminKommentar
  })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Sunside CRM <noreply@sunsideai.de>',
      to: [userEmail],
      subject,
      html: emailBody
    })
  })
}
```

Das HTML-Template aus `main/lead-requests.js` Zeile 551–594 kann 1:1 in `buildUserNotificationHtml` übernommen werden.

---

## Bug #6 (🟡 Mittel) – findHotLeadByEmail Fallback

**Datei:** `netlify/functions/calendly-webhook.js`

### Problem

`main` hat **drei** Fallback-Strategien, um einen Hot Lead einer Calendly-Event-ID zuzuordnen:
1. `findHotLeadByTermin(datum, email)` – exakter Termin-Match
2. `findHotLeadByEmail(email)` – reiner E-Mail-Match ← **fehlt in Supabase**
3. `findHotLeadByUnternehmen(unternehmen)` – Firmen-Name-Match

Supabase hat nur #1 und #3. Praktische Auswirkung: Wenn Calendly ein Cancel-Event sendet und weder Termin-Zeit noch Unternehmen exakt matchen (z. B. weil Kunde nach Firmennamen-Änderung bucht), findet der Webhook den Lead nicht und speichert den Cancel nirgendwo.

### Fix

In `netlify/functions/calendly-webhook.js` ergänzen:

```js
async function findHotLeadByEmail(email) {
  if (!email) return null
  const { data } = await supabase
    .from('hot_leads')
    .select('id, lead_id, unternehmen, mail, termin_beratungsgespraech, status, setter_id, closer_id')
    .eq('mail', email)
    .not('status', 'in', '(Abgeschlossen,Verloren)')
    .order('termin_beratungsgespraech', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}
```

Im Event-Handler nach `findHotLeadByTermin` einfügen:

```js
let hotLead = await findHotLeadByTermin(terminDatum, email)
if (!hotLead) hotLead = await findHotLeadByEmail(email)   // <-- NEU
if (!hotLead) hotLead = await findHotLeadByUnternehmen(unternehmen)
```

---

## Bug #7 (🟡 Mittel) – Call-Icon in History

Siehe Bug #4 – der Fix dort behandelt das mit (`action === 'call' ? '📞' : '📋'`).

---

## Bug #8 (🟡 Mittel) – assignLeadsToUser skaliert nicht

**Datei:** `netlify/functions/lead-requests.js`, Funktion `assignLeadsToUser`

### Problem

```js
const { data: assignments } = await supabase.from('lead_assignments').select('lead_id')
```

Bei wachsendem System werden hier **alle** Assignments geladen (kann zig-tausend Zeilen werden). Anschließend:

```js
.or('bereits_kontaktiert.is.null,bereits_kontaktiert.eq.false')
.neq('ergebnis', 'Ungültiger Lead')
.limit(anzahl * 2)  // Nur 2x Anzahl - evtl. alle schon assigned
```

Das `limit(anzahl * 2)` ist zu knapp, wenn viele bereits zugewiesen sind. Bei 30 angefragten Leads und 60 geladenen freien Leads, von denen aber zufällig 50 schon einem anderen User zugewiesen sind, bekommt der User nur 10.

### Fix

Saubere Lösung mit Subquery (Supabase JS SDK unterstützt `.not('id','in','(subquery)')` nicht direkt, daher via RPC oder zweistufig):

**Option A (empfohlen) – SQL Function:**

Eine Stored Procedure in Supabase hinzufügen (neue Migration):

```sql
CREATE OR REPLACE FUNCTION get_unassigned_leads(requested_count INT)
RETURNS TABLE(id UUID) AS $$
  SELECT l.id
  FROM leads l
  WHERE NOT EXISTS (SELECT 1 FROM lead_assignments la WHERE la.lead_id = l.id)
    AND (l.bereits_kontaktiert IS NULL OR l.bereits_kontaktiert = false)
    AND (l.ergebnis IS NULL OR l.ergebnis != 'Ungültiger Lead')
  ORDER BY l.created_at ASC
  LIMIT requested_count;
$$ LANGUAGE sql STABLE;
```

In `assignLeadsToUser` dann:

```js
async function assignLeadsToUser(userId, anzahl) {
  const { data: freeLeads, error } = await supabase
    .rpc('get_unassigned_leads', { requested_count: anzahl })

  if (error) throw new Error(error.message)
  if (!freeLeads || freeLeads.length === 0) return 0

  const newAssignments = freeLeads.map(l => ({ lead_id: l.id, user_id: userId }))
  const { error: insertErr } = await supabase.from('lead_assignments').insert(newAssignments)
  if (insertErr) throw new Error(insertErr.message)
  return freeLeads.length
}
```

Skaliert auch bei Millionen Leads.

**Option B (quick fix)** – Nur den Limit dramatisch erhöhen:
```js
.limit(anzahl * 10)
```
Hält nur kurzfristig, aber keine Schema-Änderung nötig.

---

## Bug #9 (🟢 Niedrig) – HTML-Templates für Closer-Notifications reduziert

**Datei:** `netlify/functions/send-email.js`

### Problem

Main hat aufwendige HTML-Templates (Gradient-Header, Event-Detail-Tabelle, CTA-Button, Footer mit Logo). Supabase sendet `<p>Neues Beratungsgespraech von X fuer Y am Z</p>`.

Qualitätsverlust, aber funktional korrekt.

### Fix

Die vollständigen HTML-Templates aus `main/send-email.js` Zeilen 81–174 (`notify-closers`) und Zeilen ~300–400 (`notify-closers-release`) übernehmen. Ist reines Copy-Paste ohne Airtable-Bezug.

---

## Bug #10 (🟢 Niedrig) – Analytics-Cache entfernt

**Datei:** `netlify/functions/analytics.js`

### Problem

Main hat einen 2-Minuten-In-Memory-Cache (`analyticsResultCache`). Supabase-Version ohne. Bei viel Dashboard-Traffic können Supabase-Reads teuer werden.

### Fix (optional)

Einfacher Map-Cache am File-Scope:

```js
const cache = new Map()
const TTL_MS = 2 * 60 * 1000

function getCacheKey(params) {
  return JSON.stringify(params)
}

// Im Handler:
const key = getCacheKey(params)
const hit = cache.get(key)
if (hit && (Date.now() - hit.ts) < TTL_MS) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(hit.data) }
}
// ... nach Berechnung:
cache.set(key, { ts: Date.now(), data: result })
```

---

## Zusätzliche Beobachtungen

### a) RLS-Policies sind zu permissiv

`schema.sql` definiert:
```sql
CREATE POLICY "Authenticated users can read users" ON users FOR SELECT USING (true);
```

Das erlaubt **jedem** (auch anonymen Anfragen, wenn `anon`-Key leakt), alle Users zu lesen – inklusive `password_hash`.

**Empfehlung:**
```sql
DROP POLICY "Authenticated users can read users" ON users;

-- Nur Service-Role (Backend) darf Users lesen:
-- Kein SELECT-Policy für andere Rollen -> Default-Deny greift.

-- Alternative: wenn Frontend direkt lesen soll, Passwort-Hash ausschließen:
CREATE VIEW users_public AS
SELECT id, vorname, nachname, vor_nachname, email, email_geschaeftlich,
       telefon, rollen, status, onboarding, created_at
FROM users;
GRANT SELECT ON users_public TO authenticated;
```

### b) Airtable-ID-Reconciliation

Die Migration `20260413_add_new_hot_leads_fields.sql` fügt `airtable_id`-Spalten hinzu. Die Migrationsskripte (`migrate-airtable-to-supabase.js`, `migrate-data-v2.js`) müssen diese Spalte auch füllen, damit Dual-Run (Airtable + Supabase parallel für 1-2 Tage) möglich ist. **Bitte prüfen**, ob das Skript `airtable_id` setzt:

```bash
grep -n "airtable_id" analyze_repo/.../supabase/migrate-airtable-to-supabase.js
```

### c) `users.vor_nachname` ist GENERATED STORED

```sql
vor_nachname TEXT GENERATED ALWAYS AS (COALESCE(vorname, '') || ' ' || COALESCE(nachname, '')) STORED,
```

Das bedeutet: Bei Migrationsskripten **darf `vor_nachname` nicht gesetzt werden**. Airtable hatte dieses Feld als Formel, in Supabase wird es berechnet. Bitte in Migrationsskripten verifizieren.

### d) Frontend-Anpassungen

Das Frontend in `src/` (unverändert zwischen beiden Repos) spricht heute über `fetch('/.netlify/functions/xxx')` – das bleibt gleich. **Kein Frontend-Refactor nötig**, solange die Endpoints die gleiche Request/Response-Shape bewahren. Das sollte vor Go-Live explizit getestet werden.

---

## Empfohlene Migrations-Reihenfolge

### Phase 1: Code-Fixes (1 Tag)
1. Bug #1 (hot-leads fieldMap) + Bug #3 (produkt_dienstleistung Array)
2. Bug #2 (Attachments JSONB)
3. Bug #4 (Status-Eskalation + call-Icon)
4. Bug #5 (User-Notification)
5. Bug #6 (findHotLeadByEmail)
6. Bug #8 (Skalierbarkeit – SQL-Function-Migration erstellen)

### Phase 2: Schema anwenden (Supabase-Test-Projekt, 30 Min)
```bash
psql -h <test-db> -f supabase/schema.sql
psql -h <test-db> -f supabase/migrations/20260202_fix_wiedervorlage_timestamp.sql
psql -h <test-db> -f supabase/migrations/20260202_fix_wiedervorlage_times.sql
psql -h <test-db> -f supabase/migrations/20260413_add_new_hot_leads_fields.sql
psql -h <test-db> -f supabase/migrations/20260414_get_unassigned_leads.sql  # NEU
```

### Phase 3: Daten-Migration (30 Min – 2h je nach Datenmenge)
```bash
node supabase/migrate-airtable-to-supabase.js
```

### Phase 4: Validierung (SQL-Queries aus `docs/MIGRATION_CHECKLIST.md` laufen lassen)
- Row-Counts vs. Airtable
- Referentielle Integrität
- Stichproben-Tests

### Phase 5: Frontend-Smoketest gegen Staging
- Login → Dashboard
- Kaltakquise: Lead laden, Kommentar hinzufügen, E-Mail senden → Status-Eskalation prüfen
- Closing: Hot Lead öffnen, **Angebot konfigurieren** (alle Felder), PATCH prüfen
- Calendly-Webhook simulieren (Cancel + Reschedule)
- Lead-Anfrage stellen → Genehmigen → E-Mail-Empfang prüfen
- System Messages: Ungelesen-Counter
- File-Upload an Hot Lead

### Phase 6: Cutover
- `env`-Variablen im Netlify-Prod-Deploy von Airtable auf Supabase umstellen
- Deploy
- 48h engmaschiges Monitoring

### Phase 7: Cleanup (nach 1 Woche stabilem Betrieb)
- Airtable-Util (`netlify/functions/utils/airtable.js`) löschen
- Optional: `hot_lead_attachments`-Tabelle droppen (wenn JSONB-Migration erfolgreich)
- Airtable-ID-Spalten können bleiben für Debug

---

## Test-Checkliste (vor Cutover abhaken)

### Leads (Kaltakquise)
- [ ] Lead-Liste lädt mit Filtern (Land, Kategorie, Status)
- [ ] Lead zu Ergebnis "Beratungsgespräch" setzen → Hot Lead entsteht
- [ ] Wiedervorlage mit Datum **und Uhrzeit** setzen → persistiert korrekt
- [ ] Kommentar via E-Mail-Versand → Historie wird aktualisiert
- [ ] Status-Eskalation: Lead mit "Nicht erreicht" + E-Mail-Versand → Status wird zu "Unterlage bereitstellen"

### Hot Leads (Closing)
- [ ] Hot Lead aus Lead-Konvertierung
- [ ] Hot Lead aus Calendly-Webhook
- [ ] Status-Änderung (alle Werte inkl. neuer: Angebot, Termin abgesagt, Termin verschoben)
- [ ] **Angebot konfigurieren: alle 4 neuen Felder speichern und beim Reload sichtbar**
- [ ] Deal-Werte (Setup, Retainer, Laufzeit) speichern
- [ ] Produkt-Dienstleistung wechseln (inkl. Multi-Select "KI-Voicebot & KI-Chatbot")
- [ ] **Attachment (PDF) hochladen und speichern**
- [ ] Meeting-Link + Terminart setzen
- [ ] Closer-Wechsel (by Name → ID-Auflösung)

### Termine
- [ ] Calendly-Webhook: neuer Termin → Hot Lead wird erstellt
- [ ] Calendly-Webhook: **Cancel mit nur E-Mail-Match** → Hot Lead bekommt Status "Termin abgesagt"
- [ ] Calendly-Webhook: Reschedule → termin_beratungsgespraech wird aktualisiert

### Lead-Anfragen
- [ ] Vertriebler stellt Anfrage → System Message an Admins
- [ ] Admin genehmigt → **E-Mail an Vertriebler** + Leads werden zugewiesen
- [ ] Admin genehmigt teilweise → korrekte Anzahl zugewiesen
- [ ] Skalierbarkeit: bei 10k+ Lead-Assignments werden trotzdem genug freie Leads gefunden

### System Messages
- [ ] Ungelesen-Counter in Navbar
- [ ] Als gelesen markieren

### User-Management
- [ ] Login mit `email_geschaeftlich` UND `email` (beide Felder)
- [ ] Passwort ändern, vergessen, reset
- [ ] Neuer User anlegen, Rollen (Array) zuweisen
- [ ] User deaktivieren (`status = false`)

### E-Mail-Templates
- [ ] Template mit Anhang versenden
- [ ] Closer-Notification: HTML sieht gut aus
- [ ] User-Notification (Lead-Anfrage): HTML sieht gut aus

---

## Rollback-Plan

1. Netlify-Deploy auf vorherigen Commit (Airtable) zurückrollen
2. `env`-Variablen zurück auf Airtable setzen
3. Supabase-Daten bleiben intakt (nur-lesend) – kein Datenverlust
4. Supabase-Schema kann für Retry behalten werden

---

*Erstellt am 2026-04-13 von Claude, basierend auf vollständigem Code-Audit beider Repos.*
