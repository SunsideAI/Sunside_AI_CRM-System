// Forgot Password Function - Generiert temporäres Passwort und sendet E-Mail - Supabase Version
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { systemMailSenden } from './utils/mailLayout.js'
import { neuesPasswort } from './utils/mails.js'

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
      const { betreff, mail } = neuesPasswort({
        vorname: user.vorname,
        passwort: tempPassword
      })
      const emailResponse = await systemMailSenden({ an: userEmail, betreff, mail })

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
