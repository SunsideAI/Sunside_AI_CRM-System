// Set Password Function - Hasht Passwort und speichert in Supabase
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
    const { userId, password, adminId } = JSON.parse(event.body)

    if (!userId || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User ID und Passwort sind erforderlich' })
      }
    }

    if (password.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Passwort muss mindestens 8 Zeichen haben' })
      }
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server nicht konfiguriert' })
      }
    }

    // Optional: Prüfen ob adminId wirklich Admin ist
    if (adminId) {
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('rollen')
        .eq('id', adminId)
        .single()

      if (adminError || !adminUser) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Admin nicht gefunden' })
        }
      }

      const adminRoles = adminUser.rollen || []
      if (!adminRoles.includes('Admin')) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Keine Berechtigung' })
        }
      }
    }

    // Passwort hashen (10 Salt Rounds)
    const hashedPassword = await bcrypt.hash(password, 10)

    // In Supabase speichern
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId)

    if (updateError) {
      console.error('Supabase Update Error:', updateError)
      throw new Error('Fehler beim Speichern')
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Passwort erfolgreich gesetzt'
      })
    }

  } catch (error) {
    console.error('Set Password Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Interner Server-Fehler' })
    }
  }
}
