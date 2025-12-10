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

// E-Mail Inhalt als HTML formatieren mit Signatur
function formatEmailHtml(text, senderName, senderEmail, senderTelefon) {
  // Text zu HTML konvertieren
  let htmlContent = text
    // HTML-Sonderzeichen escapen
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // **Fettgedruckt** zu <strong> (funktioniert auch über mehrere Wörter)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    
    // Bullet Points: Zeilen die mit • beginnen
    .replace(/^• (.+)$/gm, '<li style="margin-left: 20px; list-style-type: disc; color: #000000;">$1</li>')
    
    // Zeilenumbrüche zu <br> (aber nicht bei <li> Tags)
    .replace(/\n(?!<li)/g, '<br>')
    
    // URLs klickbar machen
    .replace(
      /(https?:\/\/[^\s<]+)/g, 
      '<a href="$1" style="color: #6B46C1;">$1</a>'
    )

  // Signatur HTML - basierend auf IONOS Vorlage
  const signatur = `
    <div style="font-size: 10pt; font-family: Arial, Helvetica, sans-serif; margin-top: 30px; color: #000000;">
      <div>Mit freundlichen Grüßen</div>
      <div><br></div>
      <div><strong>${senderName || 'Sunside AI Team'}</strong></div>
      <div>KI-Entwicklung für Immobilienmakler</div>
      <div><br></div>
      
      <!-- Logo -->
      <div>
        <a href="https://www.sunsideai.de/">
          <img src="https://onecdn.io/media/8c3e476c-82b3-4db6-8cbe-85b46cd452d0/full" 
               alt="Sunside AI" width="189" height="41" style="border: 0;">
        </a>
      </div>
      <div><br></div>
      
      <!-- Social Icons -->
      <div>
        <a href="https://www.instagram.com/sunside.ai/" style="text-decoration: none; margin-right: 8px;">
          <img src="https://onecdn.io/media/a8cea175-8fcb-4f91-9d6f-f53479a9a7fe/full" 
               alt="Instagram" width="28" height="28" style="border: 0; vertical-align: middle;">
        </a>
        <a href="https://www.sunsideai.de/" style="text-decoration: none;">
          <img src="https://onecdn.io/media/10252e19-d770-418d-8867-2ec8236c8d86/full" 
               alt="Website" width="28" height="28" style="border: 0; vertical-align: middle;">
        </a>
      </div>
      <div><br></div>
      
      <!-- Kontaktdaten -->
      <div><strong>Sunside AI GbR</strong></div>
      <div>Schiefer Berg 3 I 38124 Braunschweig I Deutschland<br>
      E-Mail: <a href="mailto:contact@sunsideai.de" style="color: #000000;">contact@sunsideai.de</a> I Tel: +49 176 56039050</div>
      <div>
        <a href="https://www.sunsideai.de/" style="color: #000000;">www.sunsideai.de</a> | 
        <a href="https://sunsideai.de/jetzt-termin-buchen" style="color: #000000;">Jetzt Termin buchen</a> | 
        <a href="https://sachverstand-mit-herz.podigee.io/12-new-episode" style="color: #000000;">Zur Podcast-Folge</a>
      </div>
      <div><br></div>
      
      <!-- Geschäftsführung -->
      <div>Geschäftsführung: Paul Probodziak und Niklas Schwerin</div>
      <div><br></div>
      
      <!-- Zertifikate -->
      <div>
        <a href="https://coursera.org/share/022de5be2d06363370a26f58d0993aa9" style="text-decoration: none; margin-right: 5px;">
          <img src="https://onecdn.io/media/9de8d686-0a97-42a7-b7a6-8cf0fa4c6e95/full" 
               alt="Coursera Badge" width="125" height="63" style="border: 0; vertical-align: middle;">
        </a>
        <a href="https://www.credly.com/badges/a3fac4e4-90bd-4b9a-b318-dd70bc3aa95c/public_url" style="text-decoration: none;">
          <img src="https://onecdn.io/media/2c4b8d13-4b19-4898-bd71-9b52f053ee57/full" 
               alt="Make Badge" width="63" height="63" style="border: 0; vertical-align: middle;">
        </a>
      </div>
      <div><em><strong>Wir sind zertifizierte IBM KI-Entwickler und Make Automatisierungsexperten.</strong></em></div>
    </div>
  `

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.6; color: #000000; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; color: #000000;">
    ${htmlContent}
    ${signatur}
  </div>
</body>
</html>
  `.trim()
}
