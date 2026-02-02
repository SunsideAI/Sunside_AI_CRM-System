# Sunside CRM

Internes CRM-System für das Vertriebsteam von Sunside AI - ein vollständiges Lead-Management und Sales-Tracking System.

## Tech Stack

| Technologie | Verwendung |
|-------------|------------|
| React 18 + Vite | Frontend SPA |
| Tailwind CSS | Styling Framework |
| Netlify Functions | Serverless Backend API |
| Supabase (PostgreSQL) | Datenbank |
| Calendly API | Terminbuchung |
| Resend | E-Mail-Versand |
| Cloudinary | Datei-Upload (Anhänge) |
| bcrypt | Passwort-Hashing |

## Projektstruktur

```
sunside-crm/
├── src/
│   ├── components/
│   │   ├── Layout.jsx              # Header, Navigation, Sidebar
│   │   ├── Clippy.jsx              # KI-Assistent Widget
│   │   ├── EmailComposer.jsx       # E-Mail Editor mit Templates
│   │   ├── EmailTemplateManager.jsx # Template-Verwaltung
│   │   ├── TerminPicker.jsx        # Calendly Termin-Buchung
│   │   ├── LeadAnfragenVerwaltung.jsx # Admin Lead-Anfragen
│   │   ├── MitarbeiterVerwaltung.jsx  # User-Management
│   │   └── PasswordManager.jsx     # Passwort-Verwaltung
│   ├── context/
│   │   └── AuthContext.jsx         # Authentifizierung & Rollen
│   ├── pages/
│   │   ├── Login.jsx               # Login-Seite
│   │   ├── ForgotPassword.jsx      # Passwort vergessen
│   │   ├── Dashboard.jsx           # KPIs & Analytics
│   │   ├── Kaltakquise.jsx         # Lead-Management (Setter)
│   │   ├── Closing.jsx             # Hot Leads (Closer)
│   │   ├── Termine.jsx             # Terminübersicht
│   │   ├── Einstellungen.jsx       # Admin-Settings
│   │   └── Profil.jsx              # User-Profil
│   ├── App.jsx                     # Routing & Provider
│   └── main.jsx                    # Entry Point
├── netlify/functions/
│   ├── auth.js                     # Login-Authentifizierung
│   ├── users.js                    # User-CRUD
│   ├── leads.js                    # Lead-Verwaltung (Kaltakquise)
│   ├── hot-leads.js                # Hot Lead-Verwaltung (Closing)
│   ├── ebook-leads.js              # E-Book Funnel & Pool
│   ├── lead-requests.js            # Lead-Anfragen System
│   ├── dashboard.js                # Dashboard Analytics
│   ├── analytics.js                # Erweiterte Statistiken
│   ├── calendar.js                 # Calendly Integration
│   ├── calendly-webhook.js         # Calendly Event Handler
│   ├── send-email.js               # E-Mail Versand
│   ├── email-templates.js          # Template-Verwaltung
│   ├── upload-file.js              # Cloudinary Upload
│   ├── archive-leads.js            # Lead-Archivierung
│   ├── system-messages.js          # Benachrichtigungen
│   ├── set-password.js             # Admin Passwort setzen
│   ├── forgot-password.js          # Passwort-Reset
│   └── change-password.js          # Passwort ändern
├── supabase/
│   └── schema.sql                  # Datenbank-Schema
└── public/
```

## Rollen-System

| Rolle | Beschreibung | Zugriff |
|-------|--------------|---------|
| **Admin** | Vollzugriff | Alle Funktionen, User-Verwaltung, alle Leads, Analytics |
| **Setter/Coldcaller** | Akquise-Team | Kaltakquise, eigene Leads, E-Book Pool, Lead-Anfragen |
| **Closer** | Sales-Team | Closing-Seite, zugewiesene Termine, Angebote versenden |

Ein User kann mehrere Rollen haben (z.B. Admin + Closer).

---

## Seiten & Funktionalitäten

### Dashboard (`/dashboard`)

Zentrale Übersicht mit personalisierten KPIs und Statistiken.

**Metriken:**
- Zugewiesene Leads (aktiv)
- Calls heute / diese Woche
- Termine diese Woche
- Abschlüsse (Monat/Gesamt)
- Umsatz (Setup + Retainer)

**Features:**
- Zeitraum-Filter (7 Tage, 30 Tage, 90 Tage, Jahr)
- Team-Performance Vergleich (Admin)
- Grafische Auswertungen mit Recharts
- 5-Minuten Caching für Performance
- Automatische Aktualisierung

---

### Kaltakquise (`/kaltakquise`)

Lead-Management für Setter und Coldcaller.

**Views:**
- **Meine Leads**: Nur dem User zugewiesene Leads
- **Pool**: E-Book Leads ohne Zuweisung (zum Übernehmen)
- **Alle**: Alle Leads (nur Admin)

**Features:**
- Lead-Tabelle mit Pagination (50 pro Seite)
- Suche nach Firma, Name, Ort
- Multi-Filter: Status, Ergebnis, Vertriebler, Land, Quelle
- Quick-Actions: Als kontaktiert markieren
- Lead-Detail Modal mit:
  - Kontaktdaten (Telefon, E-Mail, Website)
  - Ansprechpartner-Verwaltung
  - Ergebnis-Tracking (Dropdown)
  - Verlauf/Historie (automatisch)
  - Wiedervorlage-Datum
  - Termin-Buchung via Calendly
  - E-Mail versenden

**Ergebnis-Optionen:**
- Nicht erreicht
- Kein Interesse
- Beratungsgespräch (→ Hot Lead)
- Unterlage bereitstellen
- Wiedervorlage
- Ungültiger Lead

**Lead-Anfragen:**
- Vertriebler können neue Leads anfordern
- Admin genehmigt/lehnt ab
- Automatische Zuweisung aus freiem Pool

---

### Closing (`/closing`)

Verwaltung von Hot Leads (qualifizierte Termine) für Closer.

**Views:**
- **Meine Leads**: Dem Closer zugewiesene Termine
- **Pool**: Offene Termine ohne Closer (zum Übernehmen)
- **Alle**: Alle Hot Leads (nur Admin)

**Hot Lead Status:**
1. **Lead** - Neuer Termin gebucht
2. **Geplant** - Termin bestätigt
3. **Im Closing** - Verhandlung läuft
4. **Angebot versendet** - Angebot rausgeschickt
5. **Abgeschlossen** - Deal gewonnen
6. **Verloren** - Deal verloren

**Features:**
- Termin-Übersicht mit Datum/Uhrzeit
- Video-Meeting Links (automatisch von Calendly)
- Deal-Werte eingeben (Setup, Retainer, Laufzeit)
- Angebot versenden (mit Attachments)
- Unterlagen versenden (E-Mail Templates)
- Termin verschieben
- Website-Statistiken (wenn verfügbar)
- Lead an Pool freigeben

---

### Termine (`/termine`)

Kalenderansicht aller anstehenden Termine.

**Features:**
- Wochenansicht mit Kalender-Grid
- Tagesansicht für Details
- Termine nach Closer filtern (Admin)
- Direkt-Link zum Video-Meeting
- Quick-Navigation zu Hot Lead Details

---

### Einstellungen (`/einstellungen`) - Admin only

**Mitarbeiter-Verwaltung:**
- User erstellen/bearbeiten/deaktivieren
- Rollen zuweisen
- Passwort setzen
- Bei Deaktivierung: Hot Leads in Pool freigeben

**E-Mail Templates:**
- Templates erstellen/bearbeiten
- Kategorien: Kaltakquise, Closing, Allgemein
- Datei-Anhänge verwalten
- Platzhalter für Personalisierung

**Lead-Anfragen:**
- Offene Anfragen anzeigen
- Genehmigen mit gewünschter Anzahl
- Ablehnen mit Kommentar
- Automatische Lead-Zuweisung

---

### Profil (`/profil`)

**Features:**
- Persönliche Daten anzeigen
- Passwort ändern
- Kontaktdaten bearbeiten

---

## E-Book Funnel Integration

Leads aus dem E-Book Marketing-Funnel werden automatisch ins CRM importiert.

**Flow:**
1. User füllt E-Book Formular aus
2. Webhook sendet Daten an `ebook-leads.js`
3. Lead wird in `leads` Tabelle erstellt mit `quelle = 'E-Book'`
4. Alle aktiven Setter erhalten E-Mail-Benachrichtigung
5. Lead erscheint im "Pool" Tab
6. Setter kann Lead übernehmen (Zuweisung)

---

## Calendly Integration

Terminbuchung direkt aus dem CRM.

**Setup:**
- Calendly API Key in Environment Variables
- Event Types werden automatisch erkannt (Video/Telefon)

**Features:**
- Event Type Auswahl (verschiedene Terminarten)
- Tages-Slots anzeigen (deutsche Zeitzone)
- Buchung mit Lead-Daten
- Automatische Hot Lead Erstellung
- Meeting-Link Extraktion (Google Meet)

**Webhook Events:**
- `invitee.created` → Hot Lead erstellen, Benachrichtigung
- `invitee.canceled` → System-Message an Closer

---

## E-Mail System

Vollständiger E-Mail-Versand aus dem CRM.

**Provider:** Resend API

**Features:**
- Template-basierte E-Mails
- Platzhalter-Ersetzung:
  - `{{ANREDE}}` - Herr/Frau + Nachname
  - `{{VORNAME}}` - Vorname
  - `{{NACHNAME}}` - Nachname
  - `{{FIRMA}}` - Unternehmensname
- Datei-Anhänge (Cloudinary URLs)
- Professionelle Signatur mit Logo
- Tracking im Lead-Kommentar

---

## API Endpoints

### Authentifizierung

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/auth` | POST | Login mit E-Mail/Passwort |
| `/forgot-password` | POST | Passwort-Reset anfordern |
| `/change-password` | POST | Eigenes Passwort ändern |
| `/set-password` | POST | Admin: Passwort setzen |

### Leads (Kaltakquise)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/leads` | GET | Leads laden mit Filtern |
| `/leads` | PATCH | Lead aktualisieren |
| `/ebook-leads` | GET | E-Book Pool Leads |
| `/ebook-leads` | POST | Webhook: Neuer E-Book Lead |
| `/ebook-leads` | PATCH | Lead aus Pool übernehmen |

### Hot Leads (Closing)

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/hot-leads` | GET | Hot Leads laden |
| `/hot-leads` | POST | Hot Lead erstellen |
| `/hot-leads` | PATCH | Hot Lead aktualisieren |

### Termine

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/calendar?action=calendly-test` | GET | API-Verbindung testen |
| `/calendar?action=calendly-event-types` | GET | Event Types laden |
| `/calendar?action=calendly-slots` | GET | Verfügbare Slots |
| `/calendar` | POST | Termin buchen |
| `/calendly-webhook` | POST | Calendly Events |

### E-Mail

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/send-email` | POST | E-Mail versenden |
| `/email-templates` | GET | Templates laden |
| `/email-templates` | POST | Template erstellen |
| `/email-templates` | PATCH | Template bearbeiten |
| `/email-templates` | DELETE | Template löschen |

### Admin

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/users` | GET | User-Liste |
| `/users` | POST | User erstellen |
| `/users` | PATCH | User bearbeiten |
| `/lead-requests` | GET | Anfragen laden |
| `/lead-requests` | POST | Anfrage erstellen |
| `/lead-requests` | PATCH | Anfrage bearbeiten |

### Analytics

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/dashboard` | GET | Dashboard KPIs |
| `/analytics` | GET | Detaillierte Statistiken |

---

## Datenbank-Schema (Supabase)

### users
Mitarbeiter/Benutzer des Systems.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID | Primary Key |
| vorname, nachname | TEXT | Name |
| vor_nachname | TEXT | Generiert: Vollständiger Name |
| email | TEXT | Login E-Mail (unique) |
| email_geschaeftlich | TEXT | @sunsideai.de Adresse |
| password_hash | TEXT | bcrypt Hash |
| rollen | rolle_type[] | Array: Admin, Setter, Closer, Coldcaller |
| status | BOOLEAN | Aktiv/Inaktiv |

### leads
Kaltakquise-Leads.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID | Primary Key |
| unternehmensname | TEXT | Firmenname |
| stadt, land | TEXT | Standort |
| kategorie | ENUM | Immobilienmakler, Sachverständiger |
| mail, telefonnummer, website | TEXT | Kontaktdaten |
| ansprechpartner_vorname/nachname | TEXT | Ansprechpartner |
| bereits_kontaktiert | BOOLEAN | Kontaktiert? |
| datum | DATE | Kontaktdatum |
| ergebnis | ENUM | Gesprächsergebnis |
| kommentar | TEXT | Notizen/Verlauf |
| wiedervorlage_datum | DATE | Wiedervorlage |
| quelle | ENUM | E-Book, Kaltakquise, etc. |
| monatliche_besuche, mehrwert, absprungrate, anzahl_leads | TEXT | Website-Metriken |

### lead_assignments
Many-to-Many: Leads ↔ Users (Zuweisung).

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| lead_id | UUID | FK → leads |
| user_id | UUID | FK → users |
| assigned_at | TIMESTAMPTZ | Zuweisungszeitpunkt |

### hot_leads
Qualifizierte Leads mit gebuchtem Termin.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | UUID | Primary Key |
| lead_id | UUID | FK → Original Lead |
| unternehmen | TEXT | Firmenname |
| ansprechpartner_* | TEXT | Ansprechpartner |
| termin_beratungsgespraech | TIMESTAMPTZ | Termin-Zeitpunkt |
| terminart | ENUM | Video, Telefonisch |
| meeting_link | TEXT | Google Meet URL |
| status | ENUM | Lead → Abgeschlossen/Verloren |
| setter_id, closer_id | UUID | FK → users |
| setup, retainer, laufzeit | NUMERIC/INT | Deal-Werte |

### lead_requests
Lead-Anfragen von Vertrieblern.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| anfrage_id | TEXT | Referenz (ANF-YYYYMMDD-HHMMSS) |
| user_id | UUID | Antragsteller |
| anzahl | INTEGER | Gewünschte Leads |
| status | ENUM | Offen, Genehmigt, Abgelehnt |
| genehmigte_anzahl | INTEGER | Tatsächlich genehmigt |

### email_templates
E-Mail Vorlagen.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| name | TEXT | Template-Name |
| betreff | TEXT | E-Mail Betreff |
| inhalt | TEXT | HTML Content |
| kategorie | ENUM | Kaltakquise, Closing, Allgemein |

### system_messages
In-App Benachrichtigungen.

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| empfaenger_id | UUID | Empfänger User |
| typ | ENUM | Termin abgesagt, Lead gewonnen, etc. |
| titel, nachricht | TEXT | Inhalt |
| gelesen | BOOLEAN | Gelesen-Status |

---

## Environment Variables

| Variable | Beschreibung |
|----------|--------------|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key |
| `RESEND_API_KEY` | Resend API Key für E-Mail |
| `CALENDLY_API_KEY` | Calendly Personal Access Token |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |

---

## Lokale Entwicklung

```bash
# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev

# Mit Netlify Functions (empfohlen)
netlify dev

# Production Build
npm run build
```

---

## Deployment

Das Projekt wird automatisch auf Netlify deployed:

```bash
git add .
git commit -m "Feature: ..."
git push
```

**Netlify Konfiguration:**
- Build Command: `npm run build`
- Publish Directory: `dist`
- Functions Directory: `netlify/functions`

---

## Styling

### Farben (Tailwind Config)

```javascript
colors: {
  'sunside-primary': '#7C3AED',  // Lila (Buttons, Akzente)
  'sunside-dark': '#1a1a2e',     // Dunkelblau (Header)
}
```

### Komponenten

| Element | Klassen |
|---------|---------|
| Primary Button | `bg-sunside-primary hover:bg-purple-700 text-white rounded-lg px-4 py-2` |
| Card | `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` |
| Input | `border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sunside-primary` |
| Modal | `fixed inset-0 bg-black/50 z-50` mit React Portal |
| Badge | `px-2.5 py-1 rounded-full text-xs font-medium` |

---

## Changelog

### 2026-02-02
- Fix: "Meine Leads" Filter für Admins
- Fix: Array-String Darstellung in Closing-Seite
- Fix: Numerische Felder (Besucher, Mehrwert) korrekt anzeigen

### 2026-01
- Komplette Migration von Airtable zu Supabase
- E-Book Pool Integration
- Lead-Anfragen System
- Calendly Webhook Integration
- Datei-Upload für Angebote

### 2025-12
- Closing-Seite mit Hot Leads
- Termine-Übersicht
- E-Mail Templates
- System-Benachrichtigungen

---

**Sunside AI** - Unlocking Intelligence Together
