# Sunside CRM

Internes CRM-System für Sunside AI – Vertriebsprozess von Kaltakquise bis Abschluss.

## 🚀 Tech Stack

| Komponente | Technologie |
|------------|-------------|
| **Frontend** | React 18 + Vite |
| **Styling** | Tailwind CSS |
| **Backend** | Netlify Functions (Serverless) |
| **Datenbank** | Airtable |
| **Authentifizierung** | bcrypt (gehashte Passwörter) |
| **E-Mail** | Resend API |
| **Hosting** | Netlify |

## 📁 Projektstruktur

```
sunside-crm/
├── src/
│   ├── components/           # Wiederverwendbare UI-Komponenten
│   │   ├── Layout.jsx        # Hauptlayout mit Navigation
│   │   └── PasswordManager.jsx # Admin: Passwörter verwalten
│   │
│   ├── pages/                # Seiten der Anwendung
│   │   ├── Login.jsx         # Login-Seite
│   │   ├── ForgotPassword.jsx # Passwort vergessen
│   │   ├── Dashboard.jsx     # Übersicht
│   │   ├── Kaltakquise.jsx   # Lead-Liste für Setter
│   │   ├── Closing.jsx       # Termine für Closer
│   │   ├── Profil.jsx        # User-Profil + Passwort ändern
│   │   └── Einstellungen.jsx # Admin-Bereich
│   │
│   ├── context/              # React Context
│   │   └── AuthContext.jsx   # Authentifizierung & Rollen
│   │
│   ├── hooks/                # Custom React Hooks
│   ├── services/             # API Services
│   ├── App.jsx               # Routing
│   ├── main.jsx              # Entry Point
│   └── index.css             # Globale Styles
│
├── netlify/
│   └── functions/            # Serverless Backend
│       ├── auth.js           # Login mit Hash-Vergleich
│       ├── set-password.js   # Admin: Passwort setzen
│       ├── change-password.js # User: Passwort ändern
│       ├── forgot-password.js # Passwort-Reset per E-Mail
│       ├── users.js          # User-Liste laden
│       └── leads.js          # Leads API
│
├── public/
│   └── favicon.svg
│
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── netlify.toml
└── .env.example
```

## 🔐 Rollen-System

| Rolle | Zugriff |
|-------|---------|
| **Setter** | Dashboard, Kaltakquise, Profil |
| **Closer** | Dashboard, Closing, Profil |
| **Setter + Closer** | Dashboard, Kaltakquise, Closing, Profil |
| **Admin** | Alles + Einstellungen |

Die Rollen werden in Airtable als Multi-Select gespeichert, sodass ein User mehrere Rollen haben kann.

## 🔑 Authentifizierung

### Passwort-Sicherheit
- Passwörter werden mit **bcrypt** gehasht gespeichert
- Hash-Format: `$2b$10$...` (nicht umkehrbar)
- Salt Rounds: 10

### Login-Flow
1. User gibt E-Mail + Passwort ein
2. Backend sucht User in Airtable
3. Passwort wird mit bcrypt verglichen
4. Bei Erfolg: User-Daten werden zurückgegeben (ohne Passwort)

### Passwort-Reset
1. User klickt "Passwort vergessen"
2. Gibt E-Mail ein
3. System generiert temporäres Passwort
4. E-Mail wird via Resend API gesendet
5. User kann sich mit temporärem Passwort einloggen
6. User sollte Passwort in Profileinstellungen ändern

## 🗄️ Airtable Struktur

### User_Datenbank

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| ID | Auto Number | Eindeutige ID |
| Name | Text | Nachname |
| Vorname | Text | Vorname |
| Vor_Nachname | Formula/Text | **Primary Field** für Verknüpfungen |
| E-Mail | Email | Private E-Mail |
| E-Mail_Geschäftlich | Email | @sunsideai.de Adresse |
| Telefon | Phone | Telefonnummer |
| Rolle | Multi Select | Setter, Closer, Admin |
| Passwort | Text | bcrypt Hash |
| Straße, PLZ, Ort, Bundesland | Text | Adressdaten |
| Zugewiesene_Leads | Link to Leads | Verknüpfung zu Leads |

### Immobilienmakler_Leads

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| Unternehmensname | Text | Firmenname |
| Stadt | Text | Standort |
| Kategorie | Single Select | Branche |
| Mail | Email | Kontakt-E-Mail |
| Website | URL | Webseite |
| Telefonnummer | Phone | Telefon |
| User_Datenbank | Link to Users | Zugewiesener Vertriebler |
| Bereits kontaktiert | Checkbox | Status |
| Datum | Date | Letzter Kontakt |
| Ergebnis | Single Select | Call-Ergebnis |
| Kommentar | Long Text | Notizen |

## 🛠️ Setup

### 1. Repository klonen

```bash
git clone https://github.com/SunsideAI/Sunside_AI_CRM-System.git
cd Sunside_AI_CRM-System
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variables

Erstelle `.env` Datei (oder in Netlify Dashboard):

```env
AIRTABLE_API_KEY=pat_xxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 4. Lokal starten

```bash
npm run dev
```

Die App läuft unter `http://localhost:3000`

### 5. Mit Netlify Functions testen

```bash
npx netlify dev
```

## 🚀 Deployment

### Netlify Setup

1. Gehe zu [app.netlify.com](https://app.netlify.com)
2. "Add new site" → "Import an existing project"
3. GitHub Repository auswählen
4. Build settings (automatisch erkannt):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Environment Variables hinzufügen:
   - `AIRTABLE_API_KEY`
   - `AIRTABLE_BASE_ID`
   - `RESEND_API_KEY` (optional, für E-Mail)

### Manuelles Deployment

```bash
npm run build
npx netlify deploy --prod
```

## 📡 API Endpoints

### POST `/.netlify/functions/auth`
Login mit E-Mail und Passwort

**Request:**
```json
{
  "email": "name@sunsideai.de",
  "password": "GeheimesPasswort123"
}
```

**Response:**
```json
{
  "user": {
    "id": "recXXXXXX",
    "vorname": "Max",
    "name": "Mustermann",
    "vor_nachname": "Max Mustermann",
    "email": "max@sunsideai.de",
    "rolle": ["Setter", "Admin"]
  }
}
```

### POST `/.netlify/functions/set-password`
Admin: Passwort für User setzen

**Request:**
```json
{
  "userId": "recXXXXXX",
  "password": "NeuesPasswort123",
  "adminId": "recYYYYYY"
}
```

### POST `/.netlify/functions/change-password`
User: Eigenes Passwort ändern

**Request:**
```json
{
  "userId": "recXXXXXX",
  "currentPassword": "AltesPasswort",
  "newPassword": "NeuesPasswort123"
}
```

### POST `/.netlify/functions/forgot-password`
Passwort-Reset per E-Mail

**Request:**
```json
{
  "email": "name@sunsideai.de"
}
```

### GET `/.netlify/functions/users`
Alle User laden (für Admin)

### GET `/.netlify/functions/leads`
Leads laden

**Query Parameter:**
- `page` - Seitennummer (default: 1)
- `limit` - Einträge pro Seite (default: 25, max: 100)
- `userId` - Filter nach User
- `search` - Suchbegriff

## 🎨 Styling

### Farben (Tailwind Config)

```javascript
colors: {
  'sunside': {
    primary: '#7C3AED',    // Lila (Hauptfarbe)
    secondary: '#1a1a2e',  // Dunkelblau
    accent: '#F59E0B',     // Orange
    light: '#F3F4F6',      // Hellgrau
    dark: '#111827',       // Fast Schwarz
  }
}
```

### Verwendung

```jsx
<button className="bg-sunside-primary text-white">
  Button
</button>
```

## 📋 Entwicklung

### Neue Seite hinzufügen

1. Komponente in `src/pages/` erstellen
2. Route in `src/App.jsx` hinzufügen
3. Navigation in `src/components/Layout.jsx` ergänzen

### Neue API Function

1. Datei in `netlify/functions/` erstellen
2. Export `handler` Funktion
3. Aufruf über `/.netlify/functions/<name>`

### Icon hinzufügen

Wir nutzen [Lucide React](https://lucide.dev/icons/):

```jsx
import { IconName } from 'lucide-react'

<IconName className="w-5 h-5" />
```

## 🔄 Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| **MVP** | Login, Dashboard, Grundstruktur | ✅ |
| **Phase 1** | Passwort-System mit Hashing | ✅ |
| **Phase 2** | Leads anzeigen, filtern, bearbeiten | 🔄 |
| **Phase 3** | Dashboard KPIs, Statistiken | ⬜ |
| **Phase 4** | Calendly-Integration, Termine | ⬜ |
| **Phase 5** | E-Mail-Automationen | ⬜ |
| **Phase 6** | Notion-Migration, Angebote | ⬜ |

## 👥 Team

- **Paul Probodziak** - Admin
- **Niklas Schwerin** - Admin

## 📄 Lizenz

Proprietär - Sunside AI © 2025
