# Sunside CRM

Internes CRM-System für das Vertriebsteam von Sunside AI.

## 🚀 Tech Stack

| Technologie | Verwendung |
|-------------|------------|
| React + Vite | Frontend |
| Tailwind CSS | Styling |
| Netlify Functions | Serverless Backend |
| Airtable | Datenbank |
| Resend | E-Mail-Versand |
| bcrypt | Passwort-Hashing |

## 📁 Projektstruktur

```
sunside-crm/
├── src/
│   ├── components/
│   │   └── Layout.jsx          # Header, Navigation, Sidebar
│   ├── context/
│   │   └── AuthContext.jsx     # Authentifizierung & Rollen
│   ├── pages/
│   │   ├── Login.jsx           # Login-Seite
│   │   ├── ForgotPassword.jsx  # Passwort vergessen
│   │   ├── Dashboard.jsx       # Übersicht mit KPIs
│   │   ├── Kaltakquise.jsx     # Lead-Management für Setter
│   │   ├── Closing.jsx         # Termine für Closer
│   │   ├── Einstellungen.jsx   # Admin-Einstellungen
│   │   └── Profil.jsx          # User-Profil & Passwort ändern
│   ├── App.jsx                 # Routing & Provider
│   └── main.jsx                # Entry Point
├── netlify/functions/
│   ├── auth.js                 # Login-Authentifizierung
│   ├── users.js                # User-Verwaltung
│   ├── set-password.js         # Passwort setzen (Admin)
│   ├── forgot-password.js      # Passwort-Reset per E-Mail
│   ├── change-password.js      # Passwort ändern (User)
│   ├── leads.js                # Lead-Verwaltung
│   └── dashboard.js            # Dashboard Analytics
└── public/
```

## 👥 Rollen-System

| Rolle | Zugriff |
|-------|---------|
| **Admin** | Alle Funktionen, User-Verwaltung, alle Leads |
| **Setter (Coldcaller)** | Kaltakquise, eigene Leads |
| **Closer** | Closing, zugewiesene Termine |

Ein User kann mehrere Rollen haben.

## 🔐 Authentifizierung

### Passwort-Sicherheit
- **bcrypt** mit 10 Salt Rounds
- Hash-Format: `$2b$10$...`
- Sichere Passwort-Validierung

### Login-Flow
1. User gibt E-Mail + Passwort ein
2. `auth.js` sucht in `User_Datenbank` (E-Mail oder E-Mail_Geschäftlich)
3. bcrypt vergleicht Hash
4. Bei Erfolg: User-Daten werden zurückgegeben
5. Frontend speichert in localStorage

### Passwort-Reset
1. User gibt E-Mail auf `/passwort-vergessen` ein
2. `forgot-password.js` generiert temporäres 10-stelliges Passwort
3. Passwort wird gehasht und in Airtable gespeichert
4. E-Mail wird via Resend API gesendet
5. User loggt sich ein und ändert Passwort in Profil

### Passwort ändern
- User kann eigenes Passwort in `/profil` ändern
- Aktuelles Passwort muss bestätigt werden
- Neues Passwort muss min. 8 Zeichen haben

## 📊 Dashboard

Das Dashboard zeigt personalisierte KPIs:

| Metrik | Beschreibung |
|--------|--------------|
| Zugewiesene Leads | Anzahl Leads für diesen User |
| Calls heute | Heute kontaktierte Leads |
| Termine diese Woche | Erstgespräche diese Woche |
| Abschlüsse Monat | (Für Closer) |

### Caching
- Daten werden im localStorage gecached (5 Minuten)
- Sofortige Anzeige beim Seitenwechsel
- Manueller Refresh-Button verfügbar

## 📞 Kaltakquise

Lead-Verwaltung für Setter und Admins.

### Features
- **Lead-Tabelle** mit Pagination (50 pro Seite)
- **Suche** nach Firma oder Stadt
- **Filter:** Status, Ergebnis, Vertriebler
- **Admin-Toggle:** "Meine Leads" / "Alle Leads"
- **Quick-Action:** Mit einem Klick als kontaktiert markieren
- **Detail-Modal:** Alle Lead-Infos, Bearbeitung

### Ergebnis-Optionen
- Nicht erreicht
- Kein Interesse
- Erstgespräch
- Unterlage bereitstellen

## 🗄️ Airtable Struktur

### User_Datenbank

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Vor_Nachname | Text (Primary) | Vollständiger Name |
| E-Mail | Email | Private E-Mail |
| E-Mail_Geschäftlich | Email | @sunsideai.de Adresse |
| Rolle | Multi Select | Admin, Coldcaller, Closer |
| Passwort | Text | bcrypt Hash |
| Status | Checkbox | Aktiv-Status |
| Telefon | Phone | Telefonnummer |
| Bundesland | Text | Standort |

### Immobilienmakler_Leads

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Unternehmensname | Text (Primary) | Firmenname |
| Stadt | Text | Standort |
| Kategorie | Text | Branche |
| Mail | Email | Kontakt-E-Mail |
| Website | URL | Webseite |
| Telefonnummer | Phone | Kontaktnummer |
| User_Datenbank | Link | Zugewiesener Vertriebler |
| Bereits_kontaktiert | Text | "X" oder leer |
| Datum | Date | Kontaktdatum |
| Ergebnis | Single Select | Gesprächsergebnis |
| Kommentar | Long Text | Notizen |

## 🔌 API Endpoints

### Authentifizierung

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/.netlify/functions/auth` | POST | Login |
| `/.netlify/functions/forgot-password` | POST | Passwort-Reset anfordern |
| `/.netlify/functions/change-password` | POST | Eigenes Passwort ändern |

### Leads

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/.netlify/functions/leads` | GET | Leads laden (mit Filter) |
| `/.netlify/functions/leads` | PATCH | Lead aktualisieren |

### Dashboard

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/.netlify/functions/dashboard` | GET | Analytics laden |

### Admin

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/.netlify/functions/users` | GET | Alle User laden |
| `/.netlify/functions/set-password` | POST | Passwort setzen |

## ⚙️ Environment Variables

In Netlify unter Site Settings → Environment Variables:

| Variable | Beschreibung |
|----------|--------------|
| `AIRTABLE_API_KEY` | Airtable Personal Access Token |
| `AIRTABLE_BASE_ID` | Base ID (beginnt mit `app...`) |
| `RESEND_API_KEY` | Resend API Key für E-Mail |

## 🎨 Styling

### Farben (Tailwind)

```javascript
// tailwind.config.js
colors: {
  'sunside-primary': '#7C3AED',  // Lila
  'sunside-dark': '#1a1a2e',     // Dunkelblau
}
```

### Komponenten-Klassen

| Element | Klassen |
|---------|---------|
| Primary Button | `bg-sunside-primary hover:bg-purple-700 text-white` |
| Card | `bg-white rounded-xl border border-gray-200 p-6` |
| Input | `border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sunside-primary` |
| Modal Overlay | `fixed inset-0 bg-black/50 z-[9999]` (mit React Portal) |

## 🚀 Deployment

### Lokal entwickeln

```bash
npm install
npm run dev
```

### Netlify CLI

```bash
netlify dev  # Lokaler Server mit Functions
```

### Production Deploy

```bash
git add .
git commit -m "Update"
git push  # Auto-Deploy auf Netlify
```

## 📋 Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| MVP | ✅ | Login, Rollen, Passwort-Hashing |
| Phase 1 | ✅ | Passwort-Reset, E-Mail-Versand |
| Phase 2 | ✅ | Lead-Verwaltung, Filter, Suche |
| Phase 3 | ✅ | Dashboard Analytics, Caching |
| Phase 4 | 🔜 | Closing-Seite, Termine |
| Phase 5 | 🔜 | Calendly-Integration |
| Phase 6 | 🔜 | Notion-Migration, Angebote |

## 📝 Changelog

### 2024-12-09
- ✅ Passwort-Reset per E-Mail (Resend)
- ✅ Profil-Seite mit Passwort ändern
- ✅ Kaltakquise-Seite mit echten Leads
- ✅ Lead-Filter (Status, Ergebnis, Vertriebler)
- ✅ User-Namen Auflösung für Link-Felder
- ✅ Dashboard mit echten Analytics
- ✅ Dashboard-Caching (5 Min localStorage)
- ✅ React Portal für Modals
- ✅ Verbesserte Loading-States

---

**Sunside AI** - Unlocking Intelligence Together
