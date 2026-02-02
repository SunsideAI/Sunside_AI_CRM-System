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

    // NOTIFY CLOSERS - Benachrichtigung bei neuem Termin
    if (body.action === 'notify-closers') {
      const { termin } = body

      if (!termin || !RESEND_API_KEY) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Ungültige Anfrage' })
        }
      }

      const { data: users } = await supabase
        .from('users')
        .select('email_geschaeftlich, rollen')
        .eq('status', true)

      const closerEmails = (users || [])
        .filter(u => (u.rollen || []).some(r => r.toLowerCase().includes('closer') || r.toLowerCase() === 'admin'))
        .map(u => u.email_geschaeftlich)
        .filter(Boolean)

      if (closerEmails.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Keine Closer' }) }
      }

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Sunside CRM <team@sunsideai.de>',
          to: closerEmails,
          subject: 'Neues Beratungsgespraech: ' + termin.unternehmen,
          html: '<p>Neues Beratungsgespraech von ' + termin.setter + ' fuer ' + termin.unternehmen + ' am ' + termin.datum + '</p>'
        })
      })

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) }
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
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Sunside CRM <team@sunsideai.de>', to: closerEmails, subject: 'Termin freigegeben: ' + termin.unternehmen, html: '<p>Termin freigegeben</p>' })
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
  const { data: lead } = await supabase.from('leads').select('kommentar').eq('id', leadId).single()
  const currentKommentar = lead?.kommentar || ''
  const now = new Date()
  const timestamp = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const icon = action === 'email' ? '📧' : '📋'
  const attachmentInfo = attachmentCount > 0 ? ' (' + attachmentCount + ' Anhaenge)' : ''
  const newEntry = '[' + timestamp + '] ' + icon + ' ' + details + attachmentInfo + ' (' + userName + ')'
  const updatedKommentar = currentKommentar ? newEntry + '\n' + currentKommentar : newEntry
  await supabase.from('leads').update({ kommentar: updatedKommentar }).eq('id', leadId)
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
