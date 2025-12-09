// Change Password Function - Ändert Passwort für eingeloggten User
import bcrypt from 'bcryptjs'

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

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const AIRTABLE_TABLE_NAME = 'User_Datenbank'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server nicht konfiguriert' })
      }
    }

    // User laden
    const userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${userId}`
    
    const userResponse = await fetch(userUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    })

    if (!userResponse.ok) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User nicht gefunden' })
      }
    }

    const userData = await userResponse.json()
    const storedPassword = userData.fields.Passwort || ''

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

    const updateResponse = await fetch(userUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: { Passwort: hashedPassword }
      })
    })

    if (!updateResponse.ok) {
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
