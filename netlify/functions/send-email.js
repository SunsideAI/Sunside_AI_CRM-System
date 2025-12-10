// Send Email API via Resend
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const RESEND_API_KEY = process.env.RESEND_API_KEY

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders }
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
    const {
      to,              // Empfänger E-Mail
      subject,         // Betreff
      content,         // E-Mail Inhalt (Text)
      senderName,      // Absender Name (z.B. "Phillip Schadek")
      senderEmail,     // Absender E-Mail (muss @sunsideai.de sein)
      replyTo,         // Reply-To (falls anders als Absender)
      leadId,          // Lead ID für Logging
      templateName,    // Template Name für Logging
      userId,          // User ID für Logging
      attachments      // Attachments Array [{url, filename, type}]
    } = body

    // Validierung
    if (!to || !subject || !content) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'to, subject und content sind erforderlich' })
      }
    }

    if (!RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'RESEND_API_KEY nicht konfiguriert' })
      }
    }

    // Absender E-Mail muss @sunsideai.de sein (verifizierte Domain)
    const fromEmail = senderEmail && senderEmail.includes('@sunsideai.de') 
      ? senderEmail 
      : 'team@sunsideai.de'
    
    const fromName = senderName || 'Sunside AI'
    const from = `${fromName} <${fromEmail}>`

    // Attachments von URLs laden und zu Base64 konvertieren
    const processedAttachments = await processAttachments(attachments)

    // E-Mail via Resend senden
    const emailPayload = {
      from: from,
      to: [to],
      reply_to: replyTo || fromEmail,
      subject: subject,
      text: content,
      html: formatEmailHtml(content, fromName, fromEmail)
    }

    // Attachments hinzufügen wenn vorhanden
    if (processedAttachments.length > 0) {
      emailPayload.attachments = processedAttachments
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend Error:', resendData)
      throw new Error(resendData.message || 'E-Mail konnte nicht gesendet werden')
    }

    // Lead-Kommentar aktualisieren (Historie)
    if (leadId) {
      try {
        await updateLeadHistory({
          leadId,
          action: 'email',
          details: `E-Mail gesendet: "${templateName || 'Individuell'}" an ${to}`,
          userName: senderName,
          attachmentCount: processedAttachments.length
        })
      } catch (updateError) {
        console.warn('Lead-Update Fehler:', updateError)
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'E-Mail erfolgreich gesendet',
        emailId: resendData.id,
        attachmentCount: processedAttachments.length
      })
    }

  } catch (error) {
    console.error('Send Email Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// Lead-Kommentarfeld mit Historie aktualisieren
async function updateLeadHistory({ leadId, action, details, userName, attachmentCount }) {
  const headers = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  // Erst aktuellen Kommentar laden
  const getResponse = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`,
    { headers }
  )
  
  const leadData = await getResponse.json()
  const currentKommentar = leadData.fields?.Kommentar || ''

  // Neuen Eintrag formatieren
  const now = new Date()
  const timestamp = now.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const icon = action === 'email' ? '📧' : action === 'call' ? '📞' : '📋'
  const attachmentInfo = attachmentCount > 0 ? ` (${attachmentCount} Anhänge)` : ''
  const newEntry = `[${timestamp}] ${icon} ${details}${attachmentInfo} (${userName})`

  // Neuen Eintrag oben anhängen
  const updatedKommentar = currentKommentar 
    ? `${newEntry}\n${currentKommentar}`
    : newEntry

  // Lead aktualisieren
  await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          Kommentar: updatedKommentar
        }
      })
    }
  )
}

// Attachments von Airtable URLs laden und für Resend vorbereiten
async function processAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return []
  }

  const processed = []

  for (const att of attachments) {
    try {
      if (!att.url) continue

      // Datei von Airtable URL laden
      const response = await fetch(att.url)
      
      if (!response.ok) {
        console.warn(`Attachment ${att.filename} konnte nicht geladen werden`)
        continue
      }

      // Als ArrayBuffer laden und zu Base64 konvertieren
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      processed.push({
        filename: att.filename || 'attachment',
        content: base64
      })

    } catch (err) {
      console.warn(`Fehler beim Laden von Attachment ${att.filename}:`, err)
    }
  }

  return processed
}

// E-Mail Inhalt als einfaches HTML formatieren (sieht aus wie normale Mail)
function formatEmailHtml(text, senderName, senderEmail) {
  // Text zu HTML konvertieren (Zeilenumbrüche zu <br>)
  const htmlContent = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    // URLs klickbar machen
    .replace(
      /(https?:\/\/[^\s<]+)/g, 
      '<a href="$1" style="color: #6B46C1;">$1</a>'
    )

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto;">
    ${htmlContent}
  </div>
</body>
</html>
  `.trim()
}
