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
  let htmlContent = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>\n')
  const signatur = '<div style="margin-top: 20px;"><div>Mit freundlichen Gruessen</div><div><strong>' + (senderName || 'Sunside AI Team') + '</strong></div><div>Sunside AI GbR</div><div>E-Mail: ' + (senderEmail || 'contact@sunsideai.de') + ' | Tel: ' + (senderTelefon || '+49 176 56039050') + '</div></div>'
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: Arial, sans-serif; font-size: 10pt;">' + htmlContent + signatur + '</body></html>'
}
