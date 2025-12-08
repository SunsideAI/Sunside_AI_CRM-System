# Sunside CRM

Internes CRM-System für Sunside AI – Vertriebsprozess von Kaltakquise bis Abschluss.

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Backend:** Netlify Functions (Serverless)
- **Datenbank:** Airtable
- **Hosting:** Netlify

## Setup

### 1. Repository klonen

```bash
git clone https://github.com/sunside-ai/sunside-crm.git
cd sunside-crm
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment Variablen

Kopiere `.env.example` zu `.env` und fülle die Werte aus:

```bash
cp .env.example .env
```

Benötigte Variablen:
- `AIRTABLE_API_KEY` - Dein Airtable Personal Access Token
- `AIRTABLE_BASE_ID` - Die ID deiner Airtable Base

### 4. Lokal starten

```bash
npm run dev
```

Die App läuft unter `http://localhost:3000`

### 5. Mit Netlify Functions testen

```bash
npm run netlify
```

## Deployment

### Netlify verbinden

1. Gehe zu [netlify.com](https://netlify.com)
2. "New site from Git" → GitHub Repository auswählen
3. Build settings werden automatisch aus `netlify.toml` gelesen
4. Environment Variables in Netlify eintragen:
   - `AIRTABLE_API_KEY`
   - `AIRTABLE_BASE_ID`

### Manuelles Deployment

```bash
npm run build
netlify deploy --prod
```

## Projektstruktur

```
sunside-crm/
├── src/
│   ├── components/     # UI-Komponenten
│   │   └── Layout.jsx  # Hauptlayout mit Navigation
│   ├── pages/          # Seiten
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Kaltakquise.jsx
│   │   ├── Closing.jsx
│   │   └── Einstellungen.jsx
│   ├── context/        # React Context
│   │   └── AuthContext.jsx
│   ├── hooks/          # Custom Hooks
│   ├── services/       # API Services
│   ├── App.jsx         # Routing
│   └── main.jsx        # Entry Point
├── netlify/
│   └── functions/      # Serverless Functions
│       ├── auth.js     # Login
│       └── leads.js    # Leads API
├── public/
├── package.json
├── vite.config.js
├── tailwind.config.js
└── netlify.toml
```

## Rollen

| Rolle | Zugriff |
|-------|---------|
| Setter | Dashboard, Kaltakquise |
| Closer | Dashboard, Closing |
| Setter+Closer | Dashboard, Kaltakquise, Closing |
| Admin | Alles + Einstellungen |

## API Endpoints

### POST /.netlify/functions/auth
Login mit E-Mail

```json
{
  "email": "name@sunsideai.de"
}
```

### GET /.netlify/functions/leads
Leads abrufen

Query Parameter:
- `page` - Seitennummer (default: 1)
- `limit` - Einträge pro Seite (default: 25, max: 100)
- `userId` - Filter nach User
- `search` - Suchbegriff

## Entwicklung

### Neue Seite hinzufügen

1. Komponente in `src/pages/` erstellen
2. Route in `src/App.jsx` hinzufügen
3. Navigation in `src/components/Layout.jsx` ergänzen

### Neue API Function

1. Datei in `netlify/functions/` erstellen
2. Export `handler` Funktion
3. Aufruf über `/.netlify/functions/<name>`
