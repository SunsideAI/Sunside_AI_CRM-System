// Set Password Function - Hasht Passwort und speichert in Airtable
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

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const AIRTABLE_TABLE_NAME = 'User_Datenbank'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Airtable nicht konfiguriert' })
      }
    }

    // Optional: Prüfen ob adminId wirklich Admin ist
    if (adminId) {
      const adminCheckUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${adminId}`
      const adminResponse = await fetch(adminCheckUrl, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
      })
      
      if (adminResponse.ok) {
        const adminData = await adminResponse.json()
        const adminRoles = adminData.fields.Rolle || []
        if (!adminRoles.includes('Admin')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Keine Berechtigung' })
          }
        }
      }
    }

    // Passwort hashen (10 Salt Rounds)
    const hashedPassword = await bcrypt.hash(password, 10)

    // In Airtable speichern
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${userId}`
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Passwort: hashedPassword
        }
      })
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error('Airtable Update Error:', errorText)
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
