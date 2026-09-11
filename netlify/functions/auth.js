// Auth Function - Prüft User + Passwort gegen Supabase
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { tokenErzeugen } from './utils/session.js'
import { ROLLE } from '../../shared/rollen.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { email, password } = JSON.parse(event.body)

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'E-Mail und Passwort sind erforderlich' })
      }
    }

    // Ohne Datenbank wird nicht angemeldet. Frueher gab es hier einen
    // Demo-Modus, der jeder @sunsideai.de-Adresse mit dem Passwort "demo"
    // Admin-Rechte gab - ein Ausfall der Umgebungsvariablen haette damit das
    // ganze CRM geoeffnet.
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Anmeldung nicht moeglich: Datenbank nicht konfiguriert')
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Anmeldung derzeit nicht moeglich' })
      }
    }

    console.log('Login attempt for:', email)

    // Supabase Query - User nach E-Mail suchen
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.${email},email_geschaeftlich.ilike.${email}`)
      .limit(1)

    if (error) {
      console.error('Supabase Error:', error)
      throw new Error('Datenbank-Fehler')
    }

    if (!users || users.length === 0) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Ungültige Anmeldedaten' })
      }
    }

    const dbUser = users[0]

    // Status prüfen - deaktivierte User dürfen sich nicht anmelden
    if (dbUser.status !== true) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Dein Account wurde deaktiviert. Bitte Admin kontaktieren.' })
      }
    }

    // Passwort prüfen
    const storedPassword = dbUser.password_hash || ''

    if (!storedPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Kein Passwort gesetzt. Bitte Admin kontaktieren.' })
      }
    }

    // Prüfen ob es ein Hash ist (beginnt mit $2)
    let isValid = false
    if (storedPassword.startsWith('$2')) {
      // Gehashtes Passwort - mit bcrypt vergleichen
      isValid = await bcrypt.compare(password, storedPassword)
    } else {
      // Klartext-Passwort aus der Airtable-Zeit. Wird akzeptiert, damit sich
      // niemand aussperrt - aber sofort durch einen Hash ersetzt.
      isValid = (storedPassword === password)
      if (isValid) {
        try {
          const hash = await bcrypt.hash(password, 10)
          await supabase.from('users').update({ password_hash: hash }).eq('id', dbUser.id)
          console.log('Klartext-Passwort in Hash ueberfuehrt:', dbUser.id)
        } catch (e) {
          console.error('Hash-Umstellung fehlgeschlagen:', e)
        }
      }
    }

    if (!isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Ungültige Anmeldedaten' })
      }
    }

    // User Objekt erstellen (ohne Passwort!) - Kompatibel mit Frontend
    const user = {
      id: dbUser.id,
      airtable_id: dbUser.airtable_id || null, // Für Fallback bei lead_assignments
      vorname: dbUser.vorname || '',
      name: dbUser.nachname || '',
      vor_nachname: dbUser.vor_nachname || `${dbUser.vorname || ''} ${dbUser.nachname || ''}`.trim(),
      email: dbUser.email || dbUser.email_geschaeftlich,
      email_geschaeftlich: dbUser.email_geschaeftlich || '',
      telefon: dbUser.telefon || '',
      rolle: dbUser.rollen || ['Setter'],
      ort: dbUser.ort || '',
      bundesland: dbUser.bundesland || '',
      google_calendar_id: dbUser.google_calendar_id || ''
    }

    // Rolle zu Array falls nötig. Die alte Einzelrolle 'Coldcaller' wurde
    // hier bisher auf 'Setter' abgebildet - das war schon vor dem Umbau falsch
    // und wäre danach grob irreführend: Ein Coldcaller ist ein Opener, kein
    // Setter. Beide Werte bleiben stehen, damit niemand Zugang verliert.
    if (typeof user.rolle === 'string') {
      user.rolle = user.rolle === ROLLE.COLDCALLER
        ? [ROLLE.COLDCALLER, ROLLE.OPENER]
        : [user.rolle]
    }

    // Ab hier stammt die Identitaet des Nutzers aus diesem Token und nicht
    // mehr aus einer user_id in der Query.
    const token = tokenErzeugen(user)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ user, token })
    }

  } catch (error) {
    console.error('Auth Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Interner Server-Fehler' })
    }
  }
}
