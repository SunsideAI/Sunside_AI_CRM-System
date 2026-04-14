// Send Email API via Resend - Supabase Version
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body)

    // NOTIFY CLOSERS - Benachrichtigung bei neuem Termin (Email + System Message)
    if (body.action === 'notify-closers') {
      const { termin, hotLeadId } = body

      if (!termin) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Ungültige Anfrage' })
        }
      }

      // Alle aktiven Closer/Admins laden (mit ID für System Messages)
      const { data: users } = await supabase
        .from('users')
        .select('id, email_geschaeftlich, rollen')
        .eq('status', true)

      const closerUsers = (users || [])
        .filter(u => (u.rollen || []).some(r => r.toLowerCase().includes('closer') || r.toLowerCase() === 'admin'))

      if (closerUsers.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Keine Closer' }) }
      }

      // System Messages für alle Closer erstellen (In-App-Benachrichtigungen)
      const messagePromises = closerUsers.map(async (closer) => {
        const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        try {
          await supabase.from('system_messages').insert({
            message_id: messageId,
            empfaenger_id: closer.id,
            typ: 'Pool Update',
            titel: `Neuer Termin im Pool: ${termin.unternehmen}`,
            nachricht: `${termin.setter} hat ein Beratungsgespräch mit ${termin.unternehmen} (${termin.ansprechpartner || ''}) für ${termin.datum} gebucht. Terminart: ${termin.art}`,
            hot_lead_id: hotLeadId || null,
            gelesen: false
          })
        } catch (err) {
          console.error('System Message für Closer fehlgeschlagen:', closer.id, err)
        }
      })
      await Promise.all(messagePromises)
      console.log(`${closerUsers.length} System Messages für Closer erstellt`)

      // Email-Benachrichtigung (falls konfiguriert)
      if (RESEND_API_KEY) {
        const closerEmails = closerUsers.map(u => u.email_geschaeftlich).filter(Boolean)
        if (closerEmails.length > 0) {
          const terminArtIcon = termin.art === 'video' ? '📹' : '📞'
          const terminArtLabel = termin.art === 'video' ? 'Video-Call' : 'Telefon'

          const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">📅</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Neues Beratungsgespraech</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        <strong>${termin.setter}</strong> hat ein neues Beratungsgespraech gebucht:
      </p>
      <div style="background: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%); border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Unternehmen:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${termin.unternehmen}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Ansprechpartner:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${termin.ansprechpartner || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Termin:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${termin.datum}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Terminart:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${terminArtIcon} ${terminArtLabel}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/closing" style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Termin uebernehmen
        </a>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Sunside CRM <team@sunsideai.de>',
              to: closerEmails,
              subject: '📅 Neues Beratungsgespraech: ' + termin.unternehmen,
              html: emailHtml
            })
          })
        }
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, notifiedClosers: closerUsers.length }) }
    }

    // NOTIFY CLOSERS RELEASE
    if (body.action === 'notify-closers-release') {
      const { termin } = body
      if (!termin || !RESEND_API_KEY) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Ungueltige Anfrage' }) }
      }

      const { data: users } = await supabase.from('users').select('email_geschaeftlich, rollen').eq('status', true)
      const closerEmails = (users || []).filter(u => (u.rollen || []).some(r => r.toLowerCase().includes('closer') || r.toLowerCase() === 'admin')).map(u => u.email_geschaeftlich).filter(Boolean)

      if (closerEmails.length > 0) {
        const terminArtIcon = termin.art === 'video' ? '📹' : '📞'
        const terminArtLabel = termin.art === 'video' ? 'Video-Call' : 'Telefon'

        const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🔓</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Termin freigegeben</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Ein Beratungsgespraech wurde zurueck in den Pool gegeben und ist jetzt verfuegbar:
      </p>
      <div style="background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #3B82F6;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Unternehmen:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${termin.unternehmen || '-'}</td>
          </tr>
          ${termin.ansprechpartner ? `<tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Ansprechpartner:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${termin.ansprechpartner}</td>
          </tr>` : ''}
          ${termin.datum ? `<tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Termin:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${termin.datum}</td>
          </tr>` : ''}
          ${termin.art ? `<tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Terminart:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${terminArtIcon} ${terminArtLabel}</td>
          </tr>` : ''}
        </table>
      </div>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/closing" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Closer-Pool
        </a>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Sunside CRM <team@sunsideai.de>',
            to: closerEmails,
            subject: '🔓 Termin freigegeben: ' + termin.unternehmen,
            html: emailHtml
          })
        })
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) }
    }

    // STANDARD EMAIL
    const { to, subject, content, senderName, senderEmail, senderTelefon, replyTo, leadId, templateName, attachments } = body

    if (!to || !subject || !content) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'to, subject und content erforderlich' }) }
    }

    if (!RESEND_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'RESEND nicht konfiguriert' }) }
    }

    const fromEmail = senderEmail && senderEmail.includes('@sunsideai.de') ? senderEmail : 'team@sunsideai.de'
    const fromName = senderName || 'Sunside AI'
    const from = fromName + ' <' + fromEmail + '>'
    const bccEmail = replyTo || senderEmail || fromEmail

    const processedAttachments = await processAttachments(attachments)

    const emailPayload = {
      from,
      to: [to],
      bcc: [bccEmail],
      reply_to: replyTo || fromEmail,
      subject,
      text: content,
      html: formatEmailHtml(content, fromName, fromEmail, senderTelefon)
    }

    if (processedAttachments.length > 0) {
      emailPayload.attachments = processedAttachments
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload)
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(resendData.message || 'E-Mail konnte nicht gesendet werden')
    }

    if (leadId) {
      try {
        await updateLeadHistory({ leadId, action: 'email', details: 'E-Mail gesendet: "' + (templateName || 'Individuell') + '" an ' + to, userName: senderName, attachmentCount: processedAttachments.length })
      } catch (e) { console.error('Lead-Update Fehler:', e) }
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, emailId: resendData.id, attachmentCount: processedAttachments.length }) }

  } catch (error) {
    console.error('Send Email Error:', error)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) }
  }
}

async function updateLeadHistory({ leadId, action, details, userName, attachmentCount }) {
  // Lead laden (Kommentar + Ergebnis für Status-Eskalation)
  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('kommentar, ergebnis')
    .eq('id', leadId)
    .single()

  if (fetchErr) {
    console.error('Lead konnte nicht geladen werden:', fetchErr.message)
    return
  }

  const currentKommentar = lead?.kommentar || ''
  const currentStatus = lead?.ergebnis || ''

  // Timestamp + neuer Eintrag
  const now = new Date()
  const timestamp = now.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin'
  })
  const icon = action === 'email' ? '📧' : action === 'call' ? '📞' : '📋'
  const attachmentInfo = attachmentCount > 0 ? ' (' + attachmentCount + ' Anhaenge)' : ''
  const newEntry = '[' + timestamp + '] ' + icon + ' ' + details + attachmentInfo + ' (' + userName + ')'
  const updatedKommentar = currentKommentar ? newEntry + '\n' + currentKommentar : newEntry

  // Update-Payload
  const updatePayload = { kommentar: updatedKommentar }

  // Status-Auto-Eskalation bei E-Mail-Versand (wie in main/Airtable)
  const lowerStatuses = ['Nicht erreicht', 'Kein Interesse']
  if (action === 'email' && lowerStatuses.includes(currentStatus)) {
    updatePayload.ergebnis = 'Unterlage bereitstellen'
    console.log(`Status-Eskalation: ${currentStatus} → Unterlage bereitstellen`)
  }

  const { error: updateErr } = await supabase
    .from('leads')
    .update(updatePayload)
    .eq('id', leadId)

  if (updateErr) {
    console.error('Lead-Update fehlgeschlagen:', updateErr.message)
  }
}

async function processAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return []
  const processed = []
  for (const att of attachments) {
    try {
      if (!att.url) continue
      const response = await fetch(att.url)
      if (!response.ok) continue
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      processed.push({ filename: att.filename || 'attachment', content: base64 })
    } catch (err) { console.warn('Attachment Fehler:', err) }
  }
  return processed
}

function formatEmailHtml(text, senderName, senderEmail, senderTelefon) {
  // Convert markdown-style formatting to HTML
  let htmlContent = text
    // Escape HTML entities first (but not our markdown syntax)
    .replace(/&/g, '&amp;')
    // Convert markdown links [text](url) to HTML links
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" style="color: #7c3aed; text-decoration: underline;">$1</a>')
    // Convert bold **text** to <strong>
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert line breaks
    .replace(/\n/g, '<br>\n')

  const signatur = `
    <div style="margin-top: 30px; font-family: Arial, sans-serif; font-size: 10pt;">
      <div style="margin-bottom: 5px;">Mit freundlichen Grüßen</div>
      <div style="font-weight: bold; margin-bottom: 2px;">${senderName || 'Sunside AI Team'}</div>
      <div style="color: #666; margin-bottom: 15px;">KI-Entwicklung für Immobilienmakler</div>

      <img src="https://onecdn.io/media/8c3e476c-82b3-4db6-8cbe-85b46cd452d0/full" alt="Sunside AI" style="height: 32px; margin-bottom: 10px;" />

      <div style="margin-bottom: 15px;">
        <a href="https://www.instagram.com/sunside.ai/" style="text-decoration: none; margin-right: 8px;">
          <img src="https://onecdn.io/media/a8cea175-8fcb-4f91-9d6f-f53479a9a7fe/full" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle;" />
        </a>
        <a href="https://www.sunsideai.de" style="text-decoration: none;">
          <img src="https://onecdn.io/media/10252e19-d770-418d-8867-2ec8236c8d86/full" alt="Website" style="width: 24px; height: 24px; vertical-align: middle;" />
        </a>
      </div>

      <div style="font-weight: bold; font-size: 9pt;">Sunside AI GbR</div>
      <div style="font-size: 9pt; color: #666;">
        Schiefer Berg 3 | 38124 Braunschweig | Deutschland<br />
        E-Mail: ${senderEmail || 'contact@sunsideai.de'} | Tel: ${senderTelefon || '+49 176 56039050'}<br />
        <a href="https://www.sunsideai.de" style="color: #7c3aed;">www.sunsideai.de</a> |
        <a href="https://calendly.com/sunsideai/30min" style="color: #7c3aed; margin-left: 4px;">Jetzt Termin buchen</a> |
        <a href="https://open.spotify.com/show/5OUFEuTHVKpGqPNWQOqUIp" style="color: #7c3aed; margin-left: 4px;">Zur Podcast-Folge</a>
      </div>
      <div style="font-size: 9pt; color: #888; margin-top: 5px;">Geschäftsführung: Paul Probodziak und Niklas Schwerin</div>

      <div style="margin-top: 15px;">
        <img src="https://onecdn.io/media/9de8d686-0a97-42a7-b7a6-8cf0fa4c6e95/full" alt="IBM AI Developer" style="height: 48px; margin-right: 8px; vertical-align: middle;" />
        <img src="https://onecdn.io/media/2c4b8d13-4b19-4898-bd71-9b52f053ee57/full" alt="Make Badge" style="height: 48px; vertical-align: middle;" />
      </div>
      <div style="font-size: 9pt; color: #666; margin-top: 8px; font-style: italic;">
        <strong>Wir sind zertifizierte IBM KI-Entwickler und Make Automatisierungsexperten.</strong>
      </div>
    </div>
  `

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; font-size: 10pt;">' + htmlContent + signatur + '</body></html>'
}
