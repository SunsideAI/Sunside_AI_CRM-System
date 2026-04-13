# Sunside CRM - Systemanalyse (Aktualisiert)

**Datum:** 2026-04-13  
**Analysiert von:** Claude Code  
**Branch:** claude/analyze-repo-fKMVI  
**Basiert auf:** main-Branch (Produktionsstand)

---

## 1. Zusammenfassung

Das Sunside CRM ist ein Lead-Management und Sales-Tracking System fuer das Vertriebsteam von Sunside AI.

### WICHTIG: Aktueller Datenbank-Status

| Aspekt | Status |
|--------|--------|
| **Aktive Datenbank** | **Airtable** (NICHT Supabase) |
| **Supabase** | Migration war geplant, aber nicht umgesetzt |
| **Letzte Aenderungen** | "Angebot konfigurieren" Feature (April 2026) |

Die Netlify Functions kommunizieren direkt mit der Airtable API. Es gibt keinen `supabase/` Ordner auf dem main-Branch.

---

## 2. Tech Stack (Aktuell)

| Komponente | Technologie | Status |
|------------|-------------|--------|
| Frontend | React 18 + Vite + Tailwind CSS | Aktiv |
| Backend | Netlify Functions (Serverless) | Aktiv |
| **Datenbank** | **Airtable** | **Aktiv** |
| E-Mail | Resend API | Aktiv |
| Kalender | Calendly API | Aktiv |
| Datei-Upload | Cloudinary | Aktiv |
| Auth | bcrypt (Passwort-Hashing) | Aktiv |

---

## 3. Airtable Tabellen-Struktur

### Haupttabellen

| Tabelle | Beschreibung |
|---------|--------------|
| `User_Datenbank` | Mitarbeiter/Benutzer |
| `Immobilienmakler_Leads` | Kaltakquise-Leads |
| `Immobilienmakler_Hot_Leads` | Qualifizierte Leads mit Terminen |
| `Immobilienmakler_Leads_Archiv` | Archivierte Lead-Daten |
| `E-Mail_Templates` | E-Mail Vorlagen |
| `Lead_Anfragen` | Lead-Anfragen |
| `System_Messages` | In-App Benachrichtigungen |

---

## 4. Hot_Leads - Neue Felder (April 2026)

Diese Felder wurden fuer das **"Angebot konfigurieren"** Feature hinzugefuegt:

### Neue Felder

| Airtable-Feld | Frontend-Key | Typ | Beschreibung |
|---------------|--------------|-----|--------------|
| `Vertragsbestandteile` | vertragsbestandteile | Long Text | Individuelle Vertragsbestandteile |
| `Paketname_Individuell` | paketname | Text | Paketname (bei Individuell) |
| `Kurzbeschreibung` | kurzbeschreibung | Text | Kurzbeschreibung fuer E-Mail |
| `Leistungsbeschreibung` | leistungsbeschreibung | Long Text | Detaillierte Leistungsbeschreibung |

### Sichtbarkeit

- **Vertragsbestandteile**: Immer sichtbar (bei allen Produkten)
- **Paketname, Kurzbeschreibung, Leistungsbeschreibung**: Nur bei `Produkt = "Individuell"`

### Relevante Commits

```
047b3da - Implement 'Angebot konfigurieren' modal with full offer configuration
dfecf3c - Map new Airtable fields in hot-leads PATCH handler
b17ef49 - Hide Sachverstaendige hint box when 'Individuell' product is selected
```

---

## 5. Alle Hot_Leads Felder (Vollstaendige Liste)

### Stammdaten (Lookups aus Immobilienmakler_Leads)

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Unternehmen | unternehmen | Lookup |
| Ansprechpartner_Vorname | ansprechpartnerVorname | Lookup |
| Ansprechpartner_Nachname | ansprechpartnerNachname | Lookup |
| Kategorie | kategorie | Lookup |
| Mail | email | Lookup |
| Telefonnummer | telefon | Lookup |
| Ort | ort | Lookup |
| Bundesland | bundesland | Lookup |
| Website | website | Lookup |
| Kommentar | kommentar | Lookup |

### Termin-Felder

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Termin_Beratungsgespraech | terminDatum | DateTime |
| Terminart | terminart | Single Select (Video, Telefonisch) |
| Meeting_Link | meetingLink | URL |

### Status & Zuweisung

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Status | status | Single Select |
| Setter | setterId/setterName | Link |
| Closer | closerId/closerName | Link |
| Quelle | quelle | Single Select |
| Prioritaet | prioritaet | Text |

### Deal-Werte

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Setup | setup | Currency |
| Retainer | retainer | Currency |
| Laufzeit | laufzeit | Number (Monate) |
| Kunde_seit | kundeSeit | Date |
| Produkt_Dienstleistung | produktDienstleistung | Multi-Select |

### Angebot-Felder (NEU)

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Vertragsbestandteile | vertragsbestandteile | Long Text |
| Paketname_Individuell | paketname | Text |
| Kurzbeschreibung | kurzbeschreibung | Text |
| Leistungsbeschreibung | leistungsbeschreibung | Long Text |

### Website-Metriken

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Monatliche_Besuche | monatlicheBesuche | Number |
| Mehrwert | mehrwert | Number |
| Absprungrate | absprungrate | Percent |
| Anzahl_Leads | anzahlLeads | Number |

### Attachments & Links

| Airtable-Feld | Frontend-Key | Typ |
|---------------|--------------|-----|
| Attachments | attachments | Attachment |
| Immobilienmakler_Leads | originalLeadId | Link |

---

## 6. Produkt-Optionen und Preise

```javascript
const PRODUKT_PREISE = {
  'KI-Chatbot':                         { setup: 1399, retainer: 360 },
  'KI-Voicebot':                        { setup: 1399, retainer: 360 },
  'SEO & KI-Chatbot':                   { setup: 2798, retainer: 360 },
  'Website & KI-Chatbot':               { setup: 3998, retainer: 360 },
  'KI-Voicebot & KI-Chatbot':           { setup: 2798, retainer: 612 },
  'Website & KI-Voicebot & KI-Chatbot': { setup: 5397, retainer: 612 },
  'SEO & KI-Voicebot & KI-Chatbot':     { setup: 4197, retainer: 612 },
  'Individuell':                        { setup: '', retainer: '' }
}
```

---

## 7. Status-Optionen (Hot_Leads)

| Status | Beschreibung | Farbe |
|--------|--------------|-------|
| Lead | Neuer Termin | Blau |
| Angebot | Angebot wird erstellt | Gelb |
| Angebot versendet | Angebot verschickt | Lila |
| Abgeschlossen | Deal gewonnen | Gruen |
| Termin abgesagt | Termin wurde abgesagt | Orange |
| Termin verschoben | Termin wurde verschoben | Amber |
| Verloren | Deal verloren | Rot |

---

## 8. API Endpoints (Aktuelle Implementation)

### Hot Leads (hot-leads.js)

| Methode | Action | Beschreibung |
|---------|--------|--------------|
| GET | - | Hot Leads laden mit Filter |
| POST | - | Neuen Hot Lead erstellen |
| POST | release-closer-leads | Alle Leads eines Closers freigeben |
| PATCH | - | Hot Lead aktualisieren |

### Erlaubte PATCH-Felder

```javascript
const allowedFields = [
  'Status',
  'Setup',
  'Retainer',
  'Laufzeit',
  'Produkt_Dienstleistung',
  'Kunde_seit',
  'Prioritaet',
  'Closer',
  'Termin_Beratungsgespraech',
  'Terminart',
  'Meeting_Link',
  'Attachments',
  'Vertragsbestandteile',       // NEU
  'Paketname_Individuell',      // NEU
  'Kurzbeschreibung',           // NEU
  'Leistungsbeschreibung',      // NEU
]
```

---

## 9. Migrations-Empfehlungen

### Option A: Bei Airtable bleiben

- Keine Migration erforderlich
- Neue Felder sind bereits in Airtable aktiv
- Nur sicherstellen, dass Felder in Airtable korrekt konfiguriert sind

### Option B: Migration zu Supabase

Falls eine Supabase-Migration geplant ist:

1. **Schema erstellen:**
```sql
-- Neue Felder fuer hot_leads Tabelle
ALTER TABLE hot_leads 
  ADD COLUMN vertragsbestandteile TEXT,
  ADD COLUMN paketname_individuell TEXT,
  ADD COLUMN kurzbeschreibung TEXT,
  ADD COLUMN leistungsbeschreibung TEXT;
```

2. **Migrationsskript anpassen:**
   - Felder im Mapping hinzufuegen
   - Airtable-Daten exportieren
   - In Supabase importieren

3. **Netlify Functions umstellen:**
   - Von Airtable API auf Supabase Client wechseln
   - Alle Funktionen testen

---

## 10. Dateien die Hot_Leads verwenden

| Datei | Funktion |
|-------|----------|
| `netlify/functions/hot-leads.js` | Backend API |
| `src/pages/Closing.jsx` | Closing-Seite mit Angebot-Modal |
| `src/pages/Dashboard.jsx` | Dashboard KPIs |
| `src/pages/Termine.jsx` | Terminuebersicht |
| `netlify/functions/dashboard.js` | Dashboard Analytics |
| `netlify/functions/calendly-webhook.js` | Termin-Erstellung |
| `netlify/functions/send-email.js` | Angebots-E-Mail |

---

## 11. Naechste Schritte

1. **Airtable pruefen:**
   - Sind alle neuen Felder korrekt angelegt?
   - Feldtypen verifizieren

2. **Daten-Migration planen:**
   - Backup der aktuellen Airtable-Daten
   - Mapping-Dokument erstellen
   - Testmigration durchfuehren

3. **Frontend testen:**
   - "Angebot konfigurieren" Modal testen
   - Alle Produktoptionen durchgehen
   - E-Mail-Versand verifizieren

---

## Weitere Dokumentation

- [HOT_LEADS_NEUE_FELDER.md](./HOT_LEADS_NEUE_FELDER.md) - Detaillierte Felddokumentation
- [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) - Migrations-Checkliste

---

*Analyse erstellt am 2026-04-13 - Basiert auf main-Branch*
