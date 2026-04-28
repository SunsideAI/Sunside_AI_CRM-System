# Sunside CRM — Aufgabenpaket für Claude Code

Dieses Dokument beschreibt 4 zusammenhängende Aufgaben für das Sunside CRM (`crmsunsideai.netlify.app`). Die Aufgaben sind nach Priorität sortiert. Bitte in dieser Reihenfolge abarbeiten.

---

## Aufgabe 1: Bug-Fix — UUID-Crash in `netlify/functions/leads.js`

### Problem

In `leads.js` Zeile 192-201 existiert ein Fallback-Mechanismus, der Airtable-Record-IDs (z.B. `"recf68Rlg6xV3J8an"`) direkt als Wert für die Spalte `lead_assignments.user_id` verwendet. Diese Spalte ist `UUID NOT NULL REFERENCES users(id)` — PostgreSQL wirft `invalid input syntax for type uuid`.

### Betroffener Code

```
Zeile 184-201 in netlify/functions/leads.js:

// Fallback 1: airtableId
if (airtableId) {
  const { count } = await supabase
    .from('lead_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)                    // ← OK: UUID gegen UUID

  if (count === 0) {
    const { count: countAt } = await supabase
      .from('lead_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', airtableId)              // ← BUG: Airtable-ID gegen UUID-Spalte → CRASH

    if (countAt > 0) {
      effectiveUserId = airtableId            // ← BUG: Airtable-ID wird als userId verwendet
    }
  }
}
```

### Fix

Den Fallback-Block (Zeile 191-201) so umschreiben:

1. Die `airtableId` darf NICHT direkt in `.eq('user_id', airtableId)` gegen die `lead_assignments`-Tabelle gehen.
2. Stattdessen: Zuerst in der `users`-Tabelle die Supabase-UUID über `.eq('airtable_id', airtableId)` nachschlagen.
3. Falls ein User gefunden wird, dessen `.id` (UUID) als `effectiveUserId` verwenden.
4. Falls kein User gefunden wird, zum nächsten Fallback (userName-Lookup ab Zeile 204) weiterspringen.

Korrekter Code:

```javascript
if (count === 0 && airtableId) {
  // UUID des Users über dessen airtable_id in der users-Tabelle finden
  const { data: altUser } = await supabase
    .from('users')
    .select('id')
    .eq('airtable_id', airtableId)
    .limit(1)
    .single()

  if (altUser) {
    effectiveUserId = altUser.id  // Jetzt eine echte UUID
    console.log('[Leads] Using airtable_id user lookup:', airtableId, '→', altUser.id)
  }
}
```

### Zusätzlich prüfen

Suche im gesamten `netlify/functions/`-Ordner nach weiteren Vorkommen, wo ein Airtable-ID-String gegen eine UUID-Spalte geprüft wird. Mögliche Patterns:
- `.eq('user_id', airtableId)`
- `.eq('setter_id', airtableId)`
- `.eq('closer_id', airtableId)`
- Jede Stelle wo ein String der mit `rec` beginnt in eine UUID-Spalte geht.

Gleichen Fix überall anwenden.

---

## Aufgabe 2: Refactor — Vergleichsmechanismus im Analytics Dashboard

### Datei: `src/pages/Dashboard.jsx`

Beide Komponenten `KaltakquiseAnalytics` (ab ca. Zeile 1095) und `ClosingAnalytics` (ab ca. Zeile 1900) haben den gleichen Vergleichsmechanismus mit mehreren Bugs.

### Bug 2.1 — Stale Compare-Daten bei Hauptzeitraum-Änderung

**Problem:** Der `useEffect` für `loadCompareStats` reagiert nur auf `[compareMode, compareDateRange]` (Zeile 1372-1378 bei Kaltakquise, Zeile 2114-2120 bei Closing). Wenn der User den primären `dateRange` ändert, bleiben die Vergleichsdaten stehen und zeigen falsche Deltas.

**Fix:** Dependencies erweitern:
- Kaltakquise: `[compareMode, compareDateRange, dateRange, selectedUser]`
- Closing: `[compareMode, compareDateRange, dateRange]`

### Bug 2.2 — Kein Schutz vor identischen Zeiträumen

**Problem:** User kann denselben Zeitraum als Haupt- und Vergleichszeitraum wählen → 0% Abweichung überall.

**Fix:** Den aktuell gewählten `dateRange` aus den Compare-Dropdown-Optionen ausfiltern. Wenn durch eine Änderung des Hauptzeitraums der Compare-Zeitraum identisch wird, automatisch auf den Smart Default (siehe 2.3) wechseln.

### Feature 2.3 — Smart Defaults für Vergleichszeitraum

**Problem:** Der Vergleichszeitraum steht immer auf dem Default (`lastWeek` bzw. `lastMonth`), egal was der Hauptzeitraum ist.

**Fix:** Wenn der User den Hauptzeitraum ändert UND der Compare-Modus aktiv ist, soll der Vergleichszeitraum automatisch auf die natürliche Vorperiode springen:

| Hauptzeitraum | → Vergleichszeitraum |
|---|---|
| `today` | `yesterday` |
| `yesterday` | Vorgestern (2 Tage zurück) |
| `thisWeek` | `lastWeek` |
| `lastWeek` | Vorletzte Woche |
| `7days` | Vorherige 7 Tage |
| `14days` | Vorherige 14 Tage |
| `30days` | Vorherige 30 Tage |
| `thisMonth` | `lastMonth` |
| `lastMonth` | Vorletzter Monat |
| `3months` | Vorherige 3 Monate |

Der User kann den Vorschlag danach manuell überschreiben. Das Override bleibt erhalten bis der Hauptzeitraum erneut gewechselt wird.

### Refactor 2.4 — Datumslogik deduplizieren

**Problem:** Vier nahezu identische Funktionen existieren:
- `KaltakquiseAnalytics.getDateRange()` (Zeile 1132-1208) — nutzt `formatDateLocal()`
- `KaltakquiseAnalytics.getDateRangeFor()` (Zeile 1302-1369) — Kopie, nutzt `formatDateLocal()`
- `ClosingAnalytics.getDateRange()` (Zeile 1959-1994) — nutzt `.toISOString().split('T')[0]` ← Timezone-Bug
- `ClosingAnalytics.getDateRangeFor()` (Zeile 2075-2111) — Kopie

**Fix:** Eine einzige Utility-Funktion `computeDateRange(rangeKey)` erstellen, entweder oben in `Dashboard.jsx` (vor den Komponenten) oder in einer separaten Datei `src/utils/dateUtils.js`. Überall `formatDateLocal()` verwenden — NICHT `.toISOString().split('T')[0]` (das kann durch Timezone-Offset den falschen Tag liefern). Alle vier Funktionen durch Aufrufe von `computeDateRange()` ersetzen.

### Feature 2.5 — Compare-Daten cachen

**Problem:** Hauptdaten laufen über `getCache`/`setCache`, Compare-Daten nie.

**Fix:** Compare-Daten genauso cachen. Cache-Key-Schema: `dashboard_<tab>_compare_<compareDateRange>_<userPart>`. Bestehendes `DashboardCacheContext` verwenden.

### Bug 2.6 — Admin `selectedUser`-Wechsel invalidiert Compare nicht (Kaltakquise)

**Problem:** `selectedUser` fehlt in den Dependencies des Compare-Effects (Zeile 1378). Wenn der Admin den Vertriebler wechselt, zeigen die Compare-Daten noch den alten User.

**Fix:** Ist durch Bug 2.1 mit abgedeckt wenn `selectedUser` in die Dependencies aufgenommen wird.

---

## Aufgabe 3: Refactor — KI-Analyse Inhalt + Design

### 3.1 Backend: `netlify/functions/ai-analysis.js`

#### 3.1.1 — Erweiterter Request-Body

Das Frontend (`fetchAiAnalysis` in Dashboard.jsx, Zeile 1389-1441) soll zusätzlich zu den bisherigen `stats` folgende Daten mitsenden:

```javascript
body: JSON.stringify({
  stats: {
    einwahlen: stats.summary?.einwahlen || 0,
    erreicht: stats.summary?.erreicht || 0,
    beratungsgespraech: stats.summary?.beratungsgespraech || 0,
    unterlagen: stats.summary?.unterlagen || 0,
    keinInteresse: stats.summary?.keinInteresse || 0,
    nichtErreicht: stats.summary?.nichtErreicht || 0,
    erreichQuote: stats.summary?.erreichQuote || 0,
    beratungsgespraechQuote: stats.summary?.beratungsgespraechQuote || 0,
    unterlagenQuote: stats.summary?.unterlagenQuote || 0,
    keinInteresseQuote: stats.summary?.keinInteresseQuote || 0
  },
  zeitverlauf: stats.zeitverlauf || [],
  compareStats: compareMode ? {
    label: compareDateRangeLabels[compareDateRange],
    summary: compareStats?.summary || null
  } : null,
  perUser: isAdmin() ? (stats.perUser || []).slice(0, 8).map(u => ({
    name: u.name,
    einwahlen: u.einwahlen,
    erreicht: u.erreicht,
    beratungsgespraech: u.beratungsgespraech,
    keinInteresse: u.keinInteresse
  })) : null,
  dateRange: dateRangeLabels[dateRange] || dateRange,
  context: {
    userName: isAdmin()
      ? (selectedUser === 'all' ? 'Team-Übersicht' : selectedUser)
      : user?.vor_nachname,
    isTeam: isAdmin() && selectedUser === 'all',
    teamSize: isAdmin() ? (stats.perUser?.length || 0) : null
  }
})
```

#### 3.1.2 — Neuer System-Prompt

Den bestehenden System-Prompt (Zeile 99-101) ersetzen durch:

```
Du bist ein erfahrener Vertriebsanalyst für B2B-Kaltakquise im deutschen Mittelstand. Dein Kunde ist ein Vertriebsteam, das Immobilienmakler und Sachverständige als Kunden akquiriert. Du analysierst deren Kaltakquise-KPIs und gibst datenbasierte Einschätzungen.

Regeln:
- Antworte ausschließlich auf Deutsch.
- Antworte ausschließlich mit validem JSON — kein Markdown, keine Backticks, kein Fließtext.
- Basiere deine Aussagen nur auf den übergebenen Zahlen. Wenn die Daten für eine Aussage nicht ausreichen, lass sie weg statt zu raten.
- Vermeide Floskeln wie "Gute Arbeit!" oder "Weiter so!". Sei sachlich, konkret und direkt.
- Gib Quoten immer als gerundete Prozentwerte an.
- Vergleiche die Quoten mit diesen Branchen-Benchmarks für Kaltakquise an Immobilienmakler:
    - Erreichquote: 25–35 % ist durchschnittlich, >40 % ist stark
    - Beratungsgesprächquote (von Erreichten): 8–15 % ist durchschnittlich, >20 % ist stark
    - Kein-Interesse-Quote (von Erreichten): <50 % ist gut, >65 % ist problematisch
```

#### 3.1.3 — Neuer User-Prompt

Den bestehenden Prompt (Zeile 45-87) ersetzen. Der Prompt soll dynamisch zusammengebaut werden — Abschnitte wie VERLAUF, VERGLEICHSZEITRAUM und TEAM-PERFORMANCE nur einfügen wenn die Daten vorhanden sind:

```
Analysiere die Kaltakquise-Performance.

ANSICHT: ${context.userName}${context.isTeam ? ` (${context.teamSize} Vertriebler)` : ''}
ZEITRAUM: ${dateRange}

KENNZAHLEN:
- Einwahlen: ${stats.einwahlen}
- Erreicht: ${stats.erreicht} (${stats.erreichQuote}% Erreichquote)
- Beratungsgespräch: ${stats.beratungsgespraech} (${stats.beratungsgespraechQuote}% der Erreichten)
- Unterlagen/WV: ${stats.unterlagen} (${stats.unterlagenQuote}% der Erreichten)
- Kein Interesse: ${stats.keinInteresse} (${stats.keinInteresseQuote}% der Erreichten)
- Nicht erreicht: ${stats.nichtErreicht}

[Nur wenn zeitverlauf.length >= 3:]
VERLAUF (${zeitverlauf.length} Datenpunkte, chronologisch):
  ${zeitverlauf als "Label: Count Einwahlen" pro Zeile}

[Nur wenn compareStats vorhanden:]
VERGLEICHSZEITRAUM: ${compareStats.label}
- Einwahlen: ${compareStats.summary.einwahlen}
- Erreicht: ${compareStats.summary.erreicht} (${compareStats.summary.erreichQuote}%)
- Beratungsgespräch: ${compareStats.summary.beratungsgespraech} (${compareStats.summary.beratungsgespraechQuote}%)
- Kein Interesse: ${compareStats.summary.keinInteresse} (${compareStats.summary.keinInteresseQuote}%)

[Nur wenn perUser vorhanden:]
TEAM-PERFORMANCE (Top ${perUser.length}):
  ${perUser als "Name: X Einwahlen, Y erreicht, Z BG" pro Zeile}

Antworte mit folgendem JSON:
{
  "zusammenfassung": "2-3 Sätze: Zentrale Stärke + zentrales Problem benennen. Keine Floskeln.",
  "insights": [
    {
      "titel": "Kurzer Fakt-Titel (max 8 Wörter)",
      "beschreibung": "1-2 Sätze. Konkreter Bezug auf Zahlen, Vergleich mit Benchmark oder Vorperiode.",
      "typ": "positiv | neutral | negativ",
      "impact": "hoch | mittel | niedrig"
    }
  ],
  "trend": {                          ← Nur wenn Verlaufsdaten mit erkennbarem Trend
    "richtung": "steigend | fallend | stabil | schwankend",
    "beschreibung": "1 Satz zum Verlauf."
  },
  "empfehlungen": [
    {
      "text": "Konkrete, umsetzbare Handlung in 1 Satz.",
      "prioritaet": "hoch | mittel | niedrig"
    }
  ]
}

Liefere 2-4 Insights (nach Impact sortiert) und 2-3 Empfehlungen (nach Priorität sortiert).
Wenn Vergleichszeitraum vorhanden: In der Zusammenfassung und mindestens einem Insight die Veränderung erwähnen.
Wenn Team-Daten vorhanden: In einem Insight Unterschiede zwischen den Vertrieblern analysieren.
```

#### 3.1.4 — Modell-Parameter

```javascript
// Zeile 96-108 ersetzen:
model: 'gpt-4o-mini',
temperature: 0.3,     // War 0.7 — zu hoch für analytische Outputs
max_tokens: 1500       // War 1000 — zu knapp für strukturiertes JSON mit erweiterten Daten
```

#### 3.1.5 — Robustes Parsing

Die bestehende Parse-Logik (Zeile 134-146) erweitern:

```javascript
try {
  const cleaned = aiResponse
    .replace(/```json\n?/g, '').replace(/```\n?/g, '')
    .replace(/\/\/.*$/gm, '')          // Einzeilige Kommentare strippen
    .replace(/,\s*([}\]])/g, '$1')     // Trailing Commas entfernen
    .trim()
  analysis = JSON.parse(cleaned)
} catch (parseError) {
  console.error('Failed to parse AI response:', aiResponse)
  // Fallback statt 500: Minimale Antwort zurückgeben
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      analysis: {
        zusammenfassung: aiResponse.substring(0, 300),
        insights: [],
        empfehlungen: []
      }
    })
  }
}
```

### 3.2 Frontend: Dashboard.jsx — KI-Analyse Sektion

#### 3.2.1 — Auto-Trigger entfernen

Den `useEffect` auf Zeile 1125-1129 entfernen:

```javascript
// DIESEN EFFECT LÖSCHEN:
useEffect(() => {
  if (stats?.summary && !aiAnalysis && !aiLoading) {
    fetchAiAnalysis()
  }
}, [stats])
```

Stattdessen: Wenn sich `dateRange`, `selectedUser`, `compareMode` oder `compareDateRange` ändern, den `aiAnalysis`-State auf `null` setzen. Im UI einen dezenten Hinweis zeigen: "Zeitraum geändert — Analyse neu generieren?"

#### 3.2.2 — Optisches Redesign (Zeile 1676-1794)

Die gesamte KI-Analyse-Sektion neu gestalten:

**Zusammenfassung (Zeile 1727-1729):**
Visuell hervorheben — Gradient-Card (z.B. leichter `bg-gradient-to-r from-primary-container/40 to-primary-container/10`), größere Schrift (`text-body-lg font-medium`), links ein dezentes KI-Icon.

**Insights (Zeile 1731-1755):**
Statt vertikaler Liste → 2-Spalten-Grid auf Desktop (`grid grid-cols-1 md:grid-cols-2 gap-3`). Jede Insight-Card bekommt:
- Ein farbiges Icon basierend auf `typ` (CheckCircle grün für positiv, AlertTriangle rot für negativ, Info blau für neutral)
- Einen kleinen `impact`-Badge oben rechts (roter Dot = hoch, gelber Dot = mittel, grauer Dot = niedrig)
- Bestehendes `border-l-4` Design beibehalten

**Trend (NEU — zwischen Insights und Empfehlungen):**
Nur rendern wenn `aiAnalysis.trend` vorhanden. Dezente Linie darüber, dann ein einzelner Block mit Richtungs-Icon (TrendingUp/TrendingDown/Minus) und 1-Zeiler Beschreibung.

**Empfehlungen (Zeile 1776-1792):**
Statt Bullet-Liste → nummerierte Cards. Jede Empfehlung als eigene Card mit:
- Nummer links in einem farbigen Circle (1, 2, 3)
- Prioritäts-Badge rechts (rot=hoch, gelb=mittel, grau=niedrig)
- Text als `empfehlung.text` (war vorher `empfehlung` als String — jetzt ist es ein Objekt)

**Prognosen-Sektion (Zeile 1758-1773):**
ENTFERNEN. Wird durch das `trend`-Feld ersetzt.

#### 3.2.3 — Erweitertes Response-Schema

Das Frontend muss auf das neue Schema angepasst werden (TypeScript-Typen zur Orientierung):

```typescript
interface AIAnalysis {
  zusammenfassung: string
  insights: Array<{
    titel: string
    beschreibung: string
    typ: 'positiv' | 'neutral' | 'negativ'
    impact: 'hoch' | 'mittel' | 'niedrig'      // NEU
  }>
  trend?: {                                      // NEU (optional)
    richtung: 'steigend' | 'fallend' | 'stabil' | 'schwankend'
    beschreibung: string
  }
  empfehlungen: Array<{                          // GEÄNDERT: war string[]
    text: string
    prioritaet: 'hoch' | 'mittel' | 'niedrig'
  }>
  // ENTFERNT: prognosen[]
}
```

---

## Aufgabe 4: Feature — Follow-Up Tab (Admin-only)

Neuer Tab im CRM für Admins, der alle Hot Leads im Follow-Up-Prozess zeigt (Status "Wiedervorlage" + "Verloren") und es ermöglicht, Maßnahmen, Todos und Notizen pro Lead zu tracken. Wird für regelmäßige Review-Meetings mit den Closern verwendet.

### 4.1 Datenbank-Migration

#### 4.1.1 — Enum erweitern

```sql
-- "Wiedervorlage" und "Termin abgesagt" zum Enum hinzufügen
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Wiedervorlage';
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Termin abgesagt';
```

#### 4.1.2 — Neue Tabelle `follow_up_actions`

```sql
CREATE TABLE follow_up_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hot_lead_id UUID NOT NULL REFERENCES hot_leads(id) ON DELETE CASCADE,
  typ TEXT NOT NULL CHECK (typ IN ('mail_gesendet', 'anruf', 'todo', 'notiz', 'closer_meeting')),
  beschreibung TEXT NOT NULL,
  erledigt BOOLEAN DEFAULT FALSE,
  faellig_am DATE,
  erstellt_von UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_up_hot_lead ON follow_up_actions(hot_lead_id);
CREATE INDEX idx_follow_up_faellig ON follow_up_actions(faellig_am) WHERE NOT erledigt;
CREATE INDEX idx_follow_up_typ ON follow_up_actions(typ);
```

#### 4.1.3 — Neue Felder auf `hot_leads`

```sql
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS follow_up_status TEXT CHECK (follow_up_status IN ('aktiv', 'pausiert', 'abgeschlossen'));
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS follow_up_naechster_schritt TEXT;
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS follow_up_datum DATE;
```

#### 4.1.4 — RLS Policies

```sql
ALTER TABLE follow_up_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage follow_up_actions"
  ON follow_up_actions FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 4.2 Netlify Function: `netlify/functions/follow-up.js`

Neue Function mit folgenden Endpoints:

#### GET — Follow-Up Leads laden

Query-Parameter: `closerId`, `followUpStatus` (aktiv/pausiert/abgeschlossen), `faelligBis` (ISO-Datum), `search` (ILIKE auf unternehmen), `sortBy` (follow_up_datum|unternehmen|closer), `sortDir` (asc|desc).

Logik:
1. Hot Leads mit `status IN ('Wiedervorlage', 'Verloren')` laden
2. LEFT JOIN auf `users` (2x: für setter_id → setter_name, closer_id → closer_name)
3. Für jeden Hot Lead die letzten 5 `follow_up_actions` mitlesen (sortiert `created_at DESC`)
4. Die nächste offene Action (WHERE `erledigt = false` ORDER BY `faellig_am ASC LIMIT 1`) als `naechste_aktion` mitsenden
5. Filter anwenden (closerId, followUpStatus, faelligBis, search)

Response-Format:
```json
{
  "leads": [
    {
      "id": "uuid",
      "unternehmen": "...",
      "ansprechpartner_vorname": "...",
      "ansprechpartner_nachname": "...",
      "telefonnummer": "...",
      "mail": "...",
      "website": "...",
      "status": "Wiedervorlage",
      "setter_name": "Jan Ermochin",
      "closer_name": "Nikolas Kryut",
      "kommentar": "...",
      "follow_up_status": "aktiv",
      "follow_up_naechster_schritt": "...",
      "follow_up_datum": "2026-04-27",
      "letzte_aktionen": [
        {
          "id": "uuid",
          "typ": "mail_gesendet",
          "beschreibung": "Fallstudie Klose & Partner versendet",
          "erledigt": true,
          "faellig_am": null,
          "erstellt_von_name": "Paul Probodziak",
          "created_at": "2026-04-13T..."
        }
      ]
    }
  ],
  "total": 99
}
```

WICHTIG: Saubere Error-Responses mit JSON (gleicher Pattern wie in Aufgabe 1 — IMMER valides JSON zurückgeben, nie leerer Body).

#### POST — Neue Action anlegen

Body: `{ hotLeadId, typ, beschreibung, faelligAm?, erstelltVon? }`

Optional parallel `hot_leads.follow_up_naechster_schritt` und `follow_up_datum` updaten, wenn `naechsterSchritt` und `naechstesDatum` im Body mitgesendet werden.

#### PATCH — Action/Lead updaten

Body: `{ actionId?, hotLeadId?, updates: {} }`

Wenn `actionId` → `follow_up_actions` updaten (z.B. `erledigt: true`).
Wenn `hotLeadId` → `hot_leads`-Felder updaten (`follow_up_status`, `follow_up_naechster_schritt`, `follow_up_datum`, `kommentar`).

### 4.3 Frontend: `src/pages/FollowUp.jsx`

Neue Seite, erreichbar unter `/follow-up`.

#### 4.3.1 — Routing ergänzen

In `src/App.jsx` nach der `closing`-Route (Zeile 78-85) einfügen:

```jsx
<Route
  path="follow-up"
  element={
    <ProtectedRoute allowedRoles={['Admin']}>
      <FollowUp />
    </ProtectedRoute>
  }
/>
```

#### 4.3.2 — Navigation ergänzen

In `src/components/Layout.jsx`, Array `navItems` (Zeile 343-368), nach dem Closing-Eintrag einfügen:

```javascript
{
  name: 'Follow-Up',
  path: '/follow-up',
  icon: RotateCcw,      // aus lucide-react importieren
  show: isAdmin()
},
```

#### 4.3.3 — Seitenlayout

**Header:**
- Titel "Follow-Up" mit Untertitel "X Leads im Follow-Up-Prozess"
- Rechts: Refresh-Button

**Filter-Bar:**
- Closer-Dropdown (alle Closer aus den geladenen Leads + "Alle")
- Follow-Up-Status: Alle | Aktiv | Pausiert | Abgeschlossen
- Fälligkeit: Alle | Überfällig | Heute fällig | Diese Woche | Nächste 7 Tage
- Freitext-Suche (ILIKE auf Unternehmen)

**Tabelle:**
Spalten:
| Unternehmen | Closer | Status | Nächster Schritt | Fällig am | Letzte Aktion |
|---|---|---|---|---|---|

- "Unternehmen": Firmenname, klickbar → öffnet Detail-Drawer
- "Closer": Name des Closers
- "Status": Badge (`aktiv` = grün, `pausiert` = gelb, `abgeschlossen` = grau) — inline als Dropdown editierbar
- "Nächster Schritt": Freitext, inline editierbar (Click-to-Edit mit Blur-Save)
- "Fällig am": Datum, rot wenn überfällig, inline Datepicker
- "Letzte Aktion": Typ-Icon + Beschreibung (gekürzt auf 50 Zeichen), Datum als Tooltip

Sortierung: Default nach `follow_up_datum ASC` (nächste fällige Aktion zuerst, NULL-Daten ans Ende). Klick auf Spaltenheader zum Umsortieren.

Zeilen mit überfälligen Actions leicht rot hinterlegen (`bg-red-50/30`).

**Detail-Drawer (Slide-In von rechts, wie bei Kaltakquise):**

Oben — Stammdaten (nicht editierbar):
- Unternehmen (groß), Kategorie-Badge
- Kontakt: Ansprechpartner-Name, Telefon (klickbar), Mail (klickbar), Website (klickbar)
- Setter + Closer als Tags
- Kommentar aus dem Hot Lead (editierbar)

Mitte — Follow-Up-Steuerung:
- Follow-Up-Status Dropdown (aktiv/pausiert/abgeschlossen)
- Nächster Schritt (Textarea)
- Fällig am (Datepicker)
- "Speichern"-Button (PATCH auf hot_leads)

Unten — Action-Timeline:
- Chronologisch (neueste oben)
- Jede Action als Card:
  - Links: Typ-Icon (Mail=`Mail`, Anruf=`Phone`, Todo=`CheckSquare`, Notiz=`FileText`, Meeting=`Users`)
  - Mitte: Beschreibung + "von [Name]" + Datum
  - Rechts: Erledigt-Toggle (Checkbox)
- Ganz unten: "Neue Aktion"-Formular
  - Typ-Dropdown (Mail gesendet, Anruf, Todo, Notiz, Closer-Meeting)
  - Beschreibung-Textarea
  - Fälligkeitsdatum (optional, nur bei Typ "todo")
  - "Hinzufügen"-Button

#### 4.3.4 — Design

Konsistent mit dem bestehenden Layout:
- Gleiche Card-Styles (`card`-Klasse)
- Gleiche lila Akzentfarbe (`text-primary`, `bg-primary`, etc.)
- Gleiche Mobile-Responsiveness (Tabelle wird auf Mobile zu Cards)
- Gleiche Drawer-Mechanik wie in Kaltakquise/Closing

### 4.4 Daten-Migration (einmalig, nach dem Feature-Build)

Die ~99 Leads aus der Google-Sheet-Liste müssen in der DB auf "Wiedervorlage" gesetzt und mit initialen Actions versehen werden. Das kann als SQL-Migration oder Node.js-Script umgesetzt werden. NICHT Teil des Feature-Builds — wird separat ausgeführt nachdem das Feature deployed ist.

Was migriert werden muss:
1. Status der betroffenen Hot Leads auf "Wiedervorlage" ändern
2. `follow_up_status = 'aktiv'` setzen
3. Pro Lead 2 Standard-Actions anlegen:
   - `typ='mail_gesendet', beschreibung='Erste Follow-Up-Mail versendet - Fallstudie Klose & Partner', erledigt=true, created_at='2026-04-13'`
   - `typ='todo', beschreibung='Zweite Mail Referenzschreiben FALC oder Wüstenrot', erledigt=false, faellig_am='2026-04-27'`
4. Lead-spezifische Notizen aus Spalte N des Sheets als `typ='notiz'` importieren (wo vorhanden)

---

## Reihenfolge & Abhängigkeiten

```
Aufgabe 1 (UUID-Fix)          → Sofort, blockiert nichts
Aufgabe 2 (Compare-Refactor)  → Unabhängig
Aufgabe 3 (KI-Analyse)        → Teilweise abhängig von Aufgabe 2 (Compare-Daten als Input)
Aufgabe 4 (Follow-Up)         → Unabhängig, aber größte Aufgabe → zuletzt
```

Empfohlene Reihenfolge: 1 → 2 → 3 → 4

## Testhinweise

- **Aufgabe 1:** Mit User "Malte Jandik" (Closer) testen — der hat die Airtable-ID `recf68Rlg6xV3J8an`. Kaltakquise-Seite muss ohne `invalid input syntax for type uuid` laden.
- **Aufgabe 2:** Primärzeitraum wechseln während Compare aktiv → Vergleichsdaten müssen neu laden. Gleichen Zeitraum für beide wählen → muss verhindert oder gewarnt werden.
- **Aufgabe 3:** KI-Analyse generieren mit aktivem Compare-Modus → Analyse muss die Veränderung zwischen Zeiträumen referenzieren. Als Admin mit "Alle" generieren → Analyse muss Team-Dynamik erwähnen.
- **Aufgabe 4:** Als Admin einloggen → Follow-Up Tab muss sichtbar sein. Als Closer → Tab darf nicht erscheinen. Action hinzufügen → muss sofort in der Timeline erscheinen. Überfällige Todos → Zeile muss rot hinterlegt sein.
