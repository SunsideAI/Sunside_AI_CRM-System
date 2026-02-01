// Change Password Function - Ändert Passwort für eingeloggten User - Supabase Version
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
    const { userId, currentPassword, newPassword } = JSON.parse(event.body)

    if (!userId || !currentPassword || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Alle Felder sind erforderlich' })
      }
    }

    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' })
      }
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server nicht konfiguriert' })
      }
    }

    // User laden
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User nicht gefunden' })
      }
    }

    const storedPassword = user.password_hash || ''

    if (!storedPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Kein Passwort gesetzt' })
      }
    }

    // Aktuelles Passwort prüfen
    let isValid = false
    if (storedPassword.startsWith('$2')) {
      isValid = await bcrypt.compare(currentPassword, storedPassword)
    } else {
      isValid = (storedPassword === currentPassword)
    }

    if (!isValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Aktuelles Passwort ist falsch' })
      }
    }

    // Neues Passwort hashen und speichern
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId)

    if (updateError) {
      throw new Error('Fehler beim Speichern')
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Passwort erfolgreich geändert'
      })
    }

  } catch (error) {
    console.error('Change Password Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ein Fehler ist aufgetreten' })
    }
  }
}
