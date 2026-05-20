// No-Show Benachrichtigungen
// Sendet In-App-Notification und E-Mail an Setter bei No-Show

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const {
      hotLeadId,
      setterId,
      closerId,
      closerName,
      unternehmen,
      ansprechpartner,
      terminDatum,
      noShowCount
    } = JSON.parse(event.body)

    if (!hotLeadId || !setterId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'hotLeadId und setterId sind erforderlich' })
      }
    }

    // Setter-Daten laden
    const { data: setter, error: setterError } = await supabase
      .from('users')
      .select('id, vor_nachname, email, email_geschaeftlich')
      .eq('id', setterId)
      .single()

    if (setterError || !setter) {
      console.error('[notify-no-show] Setter nicht gefunden:', setterError)
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Setter nicht gefunden' })
      }
    }

    // 1. In-App-Benachrichtigung erstellen
    const messageId = `NOSHOW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const titel = `🔴 Lead nicht erschienen: ${unternehmen}`
    const nachricht = `${closerName || 'Closer'} hat ${ansprechpartner || 'den Ansprechpartner'} (${unternehmen}) als nicht erschienen markiert. Bitte neuen Termin vereinbaren.`

    const { error: msgError } = await supabase
      .from('system_messages')
      .insert({
        message_id: messageId,
        empfaenger_id: setterId,
        typ: 'no_show',
        titel,
        nachricht,
        hot_lead_id: hotLeadId,
        gelesen: false
      })

    if (msgError) {
      console.error('[notify-no-show] Fehler beim Erstellen der System-Message:', msgError)
    } else {
      console.log('[notify-no-show] In-App-Benachrichtigung erstellt für Setter:', setter.vor_nachname)
    }

    // 2. E-Mail an Setter senden
    const RESEND_API_KEY = process.env.RESEND_API_KEY
    const setterEmail = setter.email_geschaeftlich || setter.email

    if (RESEND_API_KEY && setterEmail) {
      const setterVorname = setter.vor_nachname?.split(' ')[0] || 'Hallo'
      const terminFormatted = terminDatum
        ? new Date(terminDatum).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Berlin'
          })
        : 'Nicht bekannt'

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #F43F5E 0%, #E11D48 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔴 Lead nicht erschienen</h1>
          </div>

          <div style="background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; padding: 32px;">
            <p style="font-size: 16px; margin-bottom: 24px;">
              Hallo ${setterVorname},
            </p>

            <p style="font-size: 16px; margin-bottom: 24px;">
              <strong>${closerName || 'Der Closer'}</strong> hat soeben gemeldet, dass
              <strong>${ansprechpartner || 'der Ansprechpartner'}</strong> von
              <strong>${unternehmen}</strong> nicht zum Beratungstermin erschienen ist.
            </p>

            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #991B1B;">
                <strong>Geplanter Termin:</strong> ${terminFormatted}
              </p>
              <p style="margin: 0; font-size: 14px; color: #991B1B;">
                <strong>No-Show-Anzahl:</strong> ${noShowCount || 1}
              </p>
            </div>

            <p style="font-size: 16px; margin-bottom: 24px;">
              Bitte vereinbare einen neuen Termin oder setze den Lead auf "Verloren",
              falls keine Reaktion mehr erfolgt.
            </p>

            <div style="text-align: center; margin-top: 32px;">
              <a href="https://crmsunsideai.netlify.app/closing"
                 style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                Lead öffnen
              </a>
            </div>
          </div>

          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
            Sunside AI CRM
          </p>
        </body>
        </html>
      `

      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Sunside CRM <noreply@sunside.io>',
            to: setterEmail,
            subject: `🔴 No-Show: ${unternehmen} - bitte neuen Termin vereinbaren`,
            html: emailHtml
          })
        })

        if (emailResponse.ok) {
          console.log('[notify-no-show] E-Mail gesendet an:', setterEmail)
        } else {
          const emailError = await emailResponse.text()
          console.error('[notify-no-show] E-Mail-Versand fehlgeschlagen:', emailError)
        }
      } catch (emailErr) {
        console.error('[notify-no-show] E-Mail-Fehler:', emailErr)
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Notifications sent' })
    }

  } catch (err) {
    console.error('[notify-no-show] Fehler:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}
