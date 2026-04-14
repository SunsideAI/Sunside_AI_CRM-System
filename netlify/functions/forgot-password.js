// Forgot Password Function - Generiert temporäres Passwort und sendet E-Mail - Supabase Version
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

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

    const RESEND_API_KEY = process.env.RESEND_API_KEY

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server nicht konfiguriert' })
      }
    }

    // Immer gleiche Antwort (Sicherheit - verrät nicht ob User existiert)
    const successMessage = 'Falls ein Konto mit dieser E-Mail existiert, wurde ein neues Passwort gesendet.'

    // User in Supabase suchen
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('id, vorname, email, email_geschaeftlich')
      .or(`email.ilike.${email},email_geschaeftlich.ilike.${email}`)
      .limit(1)

    if (searchError) {
      console.error('Supabase Error:', searchError)
      throw new Error('Datenbank-Fehler')
    }

    if (!users || users.length === 0) {
      // User existiert nicht - aber gleiche Antwort zurückgeben
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: successMessage })
      }
    }

    const user = users[0]

    // E-Mail an die Adresse senden, die der User eingegeben hat
    const privateEmail = user.email?.trim()
    const businessEmail = user.email_geschaeftlich?.trim()
    const inputEmailLower = email.toLowerCase().trim()

    let userEmail = null
    if (privateEmail && privateEmail.toLowerCase() === inputEmailLower) {
      userEmail = privateEmail
    } else if (businessEmail && businessEmail.toLowerCase() === inputEmailLower) {
      userEmail = businessEmail
    } else {
      userEmail = businessEmail || privateEmail
    }

    const userName = user.vorname || 'User'

    // E-Mail validieren
    if (!userEmail || !userEmail.includes('@')) {
      console.error('Invalid email:', userEmail)
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

    // Passwort in Supabase speichern
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', user.id)

    if (updateError) {
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
          html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🔐</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Neues Passwort</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${userName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Du hast ein neues Passwort fuer dein Sunside CRM Konto angefordert.
      </p>
      <div style="background: linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; border-left: 4px solid #7C3AED;">
        <p style="color: #6B7280; margin: 0 0 10px 0; font-size: 14px;">Dein neues Passwort:</p>
        <p style="color: #1F2937; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 3px; font-family: monospace;">${tempPassword}</p>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Bitte aendere dein Passwort nach dem Login in deinen Profileinstellungen.
      </p>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/login" style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Login
        </a>
      </div>
      <p style="color: #9CA3AF; font-size: 13px; margin-top: 30px; line-height: 1.5;">
        Falls du kein neues Passwort angefordert hast, kontaktiere bitte deinen Admin.
      </p>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 20px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`
        })
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        console.error('Resend Error:', errorData)
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
