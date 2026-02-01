// Auth Function - Prüft User + Passwort gegen Supabase
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

    // Prüfen ob Supabase konfiguriert ist
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      // Demo-Modus
      console.log('Supabase nicht konfiguriert - Demo-Modus')

      if (email.includes('@sunsideai.de') && password === 'demo') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            user: {
              id: 'demo-1',
              vorname: 'Demo',
              name: 'User',
              vor_nachname: 'Demo User',
              email: email,
              rolle: ['Setter', 'Closer', 'Admin'],
              google_calendar_id: ''
            }
          })
        }
      }

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Ungültige Anmeldedaten' })
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
      // Klartext-Passwort (Legacy) - direkter Vergleich
      isValid = (storedPassword === password)
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

    // Rolle zu Array falls nötig
    if (typeof user.rolle === 'string') {
      if (user.rolle === 'Coldcaller') {
        user.rolle = ['Setter']
      } else {
        user.rolle = [user.rolle]
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ user })
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
