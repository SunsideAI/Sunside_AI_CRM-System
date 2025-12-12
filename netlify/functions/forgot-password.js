// Forgot Password Function - Generiert temporäres Passwort und sendet E-Mail
import bcrypt from 'bcryptjs'

// Zufälliges Passwort generieren
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

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
    const { email } = JSON.parse(event.body)

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'E-Mail ist erforderlich' })
      }
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const AIRTABLE_TABLE_NAME = 'User_Datenbank'

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server nicht konfiguriert' })
      }
    }

    // User in Airtable suchen
    const formula = `OR({E-Mail}='${email}',{E-Mail_Geschäftlich}='${email}')`
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`

    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    })

    if (!searchResponse.ok) {
      throw new Error('Airtable API Fehler')
    }

    const searchData = await searchResponse.json()

    // Immer gleiche Antwort (Sicherheit - verrät nicht ob User existiert)
    const successMessage = 'Falls ein Konto mit dieser E-Mail existiert, wurde ein neues Passwort gesendet.'

    if (!searchData.records || searchData.records.length === 0) {
      // User existiert nicht - aber gleiche Antwort zurückgeben
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: successMessage })
      }
    }

    const record = searchData.records[0]
    
    // E-Mail an die Adresse senden, die der User eingegeben hat (nicht an eine andere!)
    // Prüfen ob die eingegebene E-Mail in den Feldern existiert
    const privateEmail = record.fields['E-Mail']?.trim()
    const businessEmail = record.fields['E-Mail_Geschäftlich']?.trim()
    const inputEmailLower = email.toLowerCase().trim()
    
    let userEmail = null
    if (privateEmail && privateEmail.toLowerCase() === inputEmailLower) {
      userEmail = privateEmail
    } else if (businessEmail && businessEmail.toLowerCase() === inputEmailLower) {
      userEmail = businessEmail
    } else {
      // Fallback: Eine der beiden E-Mails verwenden
      userEmail = businessEmail || privateEmail
    }
    
    const userName = record.fields.Vorname || 'User'

    // E-Mail validieren
    if (!userEmail || !userEmail.includes('@')) {
      console.error('Invalid email in Airtable:', rawEmail)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: successMessage })
      }
    }

    console.log('Sending password reset to:', userEmail)

    // Temporäres Passwort generieren
    const tempPassword = generateTempPassword()
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // Passwort in Airtable speichern
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${record.id}`
    
    const updateResponse = await fetch(updateUrl, {
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
      throw new Error('Fehler beim Speichern des Passworts')
    }

    // E-Mail senden
    if (RESEND_API_KEY) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Sunside CRM <noreply@sunsideai.de>', 
          to: [userEmail],
          subject: 'Dein neues Passwort - Sunside CRM',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #7C3AED 100%); padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0;">Sunside CRM</h1>
              </div>
              <div style="padding: 40px; background: #ffffff;">
                <h2 style="color: #1a1a2e; margin-top: 0;">Hallo ${userName}!</h2>
                <p style="color: #4a5568; line-height: 1.6;">
                  Du hast ein neues Passwort für dein Sunside CRM Konto angefordert.
                </p>
                <div style="background: #f7f7f7; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
                  <p style="color: #718096; margin: 0 0 8px 0; font-size: 14px;">Dein neues Passwort:</p>
                  <p style="color: #1a1a2e; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px;">${tempPassword}</p>
                </div>
                <p style="color: #4a5568; line-height: 1.6;">
                  Bitte ändere dein Passwort nach dem Login in deinen Profileinstellungen.
                </p>
                <p style="color: #718096; font-size: 14px; margin-top: 32px;">
                  Falls du kein neues Passwort angefordert hast, kontaktiere bitte deinen Admin.
                </p>
              </div>
              <div style="background: #f7f7f7; padding: 20px; text-align: center;">
                <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} Sunside AI
                </p>
              </div>
            </div>
          `
        })
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        console.error('Resend Error:', errorData)
        // Trotzdem Success zurückgeben - Passwort wurde gesetzt
      }
    } else {
      console.log('Resend nicht konfiguriert. Temp Password:', tempPassword)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: successMessage })
    }

  } catch (error) {
    console.error('Forgot Password Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.' })
    }
  }
}
