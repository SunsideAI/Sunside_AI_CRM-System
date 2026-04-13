# Hot_Leads - Neue Felder Analyse

**Datum:** 2026-04-13  
**Basiert auf:** main-Branch (aktueller Produktionsstand)  
**Datenbank:** Airtable (nicht Supabase)

---

## Wichtiger Hinweis

Das CRM-System verwendet aktuell **Airtable** als primaere Datenbank. Die Supabase-Migration war geplant, wurde aber nicht vollstaendig umgesetzt. Alle Netlify Functions kommunizieren direkt mit der Airtable API.

---

## Neue Felder in Hot_Leads (Airtable)

Diese Felder wurden fuer das **"Angebot konfigurieren"** Feature hinzugefuegt:

### 1. Vertragsbestandteile
| Eigenschaft | Wert |
|-------------|------|
| **Feldtyp** | Long Text |
| **Airtable-Name** | `Vertragsbestandteile` |
| **Frontend-Key** | `vertragsbestandteile` |
| **Beschreibung** | Individuelle Vertragsbestandteile (USt., Laufzeit, Kuendigungsfrist) |
| **Standard-Wert** | Siehe DEFAULT_VERTRAGSBESTANDTEILE in Closing.jsx |
| **Immer sichtbar** | Ja (bei allen Produkten) |

### 2. Paketname_Individuell
| Eigenschaft | Wert |
|-------------|------|
| **Feldtyp** | Text |
| **Airtable-Name** | `Paketname_Individuell` |
| **Frontend-Key** | `paketname` |
| **Beschreibung** | Name des individuellen Pakets |
| **Sichtbarkeit** | Nur bei Produkt = "Individuell" |
| **Beispiel** | "KI-Chatbot, WhatsApp-Assistent" |

### 3. Kurzbeschreibung
| Eigenschaft | Wert |
|-------------|------|
| **Feldtyp** | Text |
| **Airtable-Name** | `Kurzbeschreibung` |
| **Frontend-Key** | `kurzbeschreibung` |
| **Beschreibung** | Kurzbeschreibung fuer E-Mail an Makler |
| **Sichtbarkeit** | Nur bei Produkt = "Individuell" |
| **Beispiel** | "Aufbau & Betrieb Ihrer individuellen KI-Vertriebsassistenz" |

### 4. Leistungsbeschreibung
| Eigenschaft | Wert |
|-------------|------|
| **Feldtyp** | Long Text |
| **Airtable-Name** | `Leistungsbeschreibung` |
| **Frontend-Key** | `leistungsbeschreibung` |
| **Beschreibung** | Detaillierte Leistungsbeschreibung mit Ueberschriften |
| **Sichtbarkeit** | Nur bei Produkt = "Individuell" |
| **Format** | Ueberschriften + Spiegelstriche (siehe Closing.jsx) |

---

## Bestehende Hot_Leads Felder (bereits implementiert)

### Stammdaten (Lookups aus Immobilienmakler_Leads)
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Unternehmen | `Unternehmen` | Lookup |
| Ansprechpartner Vorname | `Ansprechpartner_Vorname` | Lookup |
| Ansprechpartner Nachname | `Ansprechpartner_Nachname` | Lookup |
| Kategorie | `Kategorie` | Lookup |
| E-Mail | `Mail` | Lookup |
| Telefon | `Telefonnummer` | Lookup |
| Ort | `Ort` | Lookup |
| Bundesland | `Bundesland` | Lookup |
| Website | `Website` | Lookup |
| Kommentar | `Kommentar` | Lookup |

### Termin-Felder
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Termin Datum | `Termin_Beratungsgespraech` | DateTime |
| Terminart | `Terminart` | Single Select (Video, Telefonisch) |
| Meeting-Link | `Meeting_Link` | URL |

### Status & Zuweisung
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Status | `Status` | Single Select |
| Setter | `Setter` | Link to User_Datenbank |
| Closer | `Closer` | Link to User_Datenbank |
| Quelle | `Quelle` | Single Select |
| Prioritaet | `Prioritaet` | Text |

### Deal-Werte
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Setup | `Setup` | Currency |
| Retainer | `Retainer` | Currency |
| Laufzeit | `Laufzeit` | Number (Monate) |
| Kunde seit | `Kunde_seit` | Date |
| Produkt/Dienstleistung | `Produkt_Dienstleistung` | Multi-Select |

### Website-Metriken (optional)
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Monatliche Besuche | `Monatliche_Besuche` | Number |
| Mehrwert | `Mehrwert` | Number |
| Absprungrate | `Absprungrate` | Percent |
| Anzahl Leads | `Anzahl_Leads` | Number |

### Attachments
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Dokumente | `Attachments` | Attachment |

### Verknuepfungen
| Feld | Airtable-Name | Typ |
|------|---------------|-----|
| Original Lead | `Immobilienmakler_Leads` | Link |

---

## Status-Optionen (Hot_Leads)

```javascript
const STATUS_OPTIONS = [
  'Lead',              // Neuer Termin
  'Angebot',           // Angebot wird erstellt
  'Angebot versendet', // Angebot verschickt
  'Abgeschlossen',     // Deal gewonnen
  'Termin abgesagt',   // Termin wurde abgesagt
  'Termin verschoben', // Termin wurde verschoben
  'Verloren'           // Deal verloren
]
```

---

## Produkt-Optionen (mit Standardpreisen)

```javascript
const PRODUKT_PREISE = {
  'KI-Chatbot':                         { setup: 1399, retainer: 360 },
  'KI-Voicebot':                        { setup: 1399, retainer: 360 },
  'SEO & KI-Chatbot':                   { setup: 2798, retainer: 360 },
  'Website & KI-Chatbot':               { setup: 3998, retainer: 360 },
  'KI-Voicebot & KI-Chatbot':           { setup: 2798, retainer: 612 },
  'Website & KI-Voicebot & KI-Chatbot': { setup: 5397, retainer: 612 },
  'SEO & KI-Voicebot & KI-Chatbot':     { setup: 4197, retainer: 612 },
  'Individuell':                        { setup: '', retainer: '' } // Manuell eingeben
}
```

---

## Backend-Implementation (hot-leads.js)

### Erlaubte Update-Felder
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
  'Vertragsbestandteile',      // NEU
  'Paketname_Individuell',     // NEU
  'Kurzbeschreibung',          // NEU
  'Leistungsbeschreibung',     // NEU
]
```

### Field-Mapping (Frontend -> Airtable)
```javascript
const fieldMap = {
  'vertragsbestandteile': 'Vertragsbestandteile',
  'paketname': 'Paketname_Individuell',
  'kurzbeschreibung': 'Kurzbeschreibung',
  'leistungsbeschreibung': 'Leistungsbeschreibung',
  // ... weitere Felder
}
```

---

## Migrations-Hinweise

### Falls Migration zu Supabase geplant ist:

1. **Schema erweitern** - Diese Felder muessen zum hot_leads Table hinzugefuegt werden:
   ```sql
   ALTER TABLE hot_leads ADD COLUMN vertragsbestandteile TEXT;
   ALTER TABLE hot_leads ADD COLUMN paketname_individuell TEXT;
   ALTER TABLE hot_leads ADD COLUMN kurzbeschreibung TEXT;
   ALTER TABLE hot_leads ADD COLUMN leistungsbeschreibung TEXT;
   ```

2. **Migrationsskript anpassen** - Die neuen Felder im migrate-data-v2.js mappen

3. **Netlify Functions umstellen** - Von Airtable auf Supabase Client wechseln

---

## Relevante Commits

- `047b3da` - Implement 'Angebot konfigurieren' modal with full offer configuration
- `dfecf3c` - Map new Airtable fields in hot-leads PATCH handler
- `b17ef49` - Hide Sachverstaendige hint box when 'Individuell' product is selected

---

## Dateien die diese Felder verwenden

| Datei | Funktion |
|-------|----------|
| `src/pages/Closing.jsx` | Angebot-Modal UI |
| `netlify/functions/hot-leads.js` | PATCH Handler |
| `netlify/functions/send-email.js` | Angebots-E-Mail (vermutlich) |

---

*Dokumentation erstellt am 2026-04-13*
