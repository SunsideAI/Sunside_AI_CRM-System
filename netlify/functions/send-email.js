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
    
    // ==========================================
    // NOTIFY CLOSERS - Benachrichtigung an alle Closer bei neuem Termin
    // ==========================================
    if (body.action === 'notify-closers') {
      const { termin } = body
      
      if (!termin) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'termin ist erforderlich' })
        }
      }

      if (!RESEND_API_KEY || !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'API Keys nicht konfiguriert' })
        }
      }

      try {
        // Alle Closer aus Airtable laden
        const usersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User_Datenbank')}?fields[]=E-Mail_Geschäftlich&fields[]=Vor_Nachname&fields[]=Rolle`
        const usersResponse = await fetch(usersUrl, {
          headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        })
        const usersData = await usersResponse.json()

        // Closer filtern (Rolle enthält "Closer" oder "Admin" oder "Coldcaller + Closer")
        const closerEmails = usersData.records
          ?.filter(record => {
            const rollen = record.fields.Rolle || []
            return rollen.some(r => 
              r.toLowerCase().includes('closer') || 
              r.toLowerCase() === 'admin'
            )
          })
          .map(record => record.fields['E-Mail_Geschäftlich'])
          .filter(email => email && email.includes('@')) || []

        if (closerEmails.length === 0) {
          console.log('Keine Closer gefunden für Benachrichtigung')
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ success: true, message: 'Keine Closer gefunden' })
          }
        }

        // Email an alle Closer senden
        // Email-Text erstellen (wird dann mit formatEmailHtml formatiert)
        const emailText = `Hallo zusammen,

es wurde ein neues Beratungsgespräch gebucht, das noch keinem Closer zugewiesen ist.

**Termin-Details:**
• Datum: ${termin.datum}
• Art: ${termin.art}
• Unternehmen: ${termin.unternehmen}
• Ansprechpartner: ${termin.ansprechpartner}
• Gebucht von: ${termin.setter}

Bitte logge dich ins CRM ein, um den Termin zu übernehmen:
[Zum Closer-Pool](https://sunside-crm.netlify.app/closing)`

        // Mit Standard-Formatierung und Signatur versehen
        const emailHtml = formatEmailHtml(emailText, 'Sunside AI CRM', 'team@sunsideai.de', null)

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Sunside AI CRM <team@sunsideai.de>',
            to: closerEmails,
            subject: `Neues Beratungsgespräch: ${termin.unternehmen}`,
            html: emailHtml
          })
        })

        const emailResult = await emailResponse.json()

        if (!emailResponse.ok) {
          console.error('Closer-Benachrichtigung fehlgeschlagen:', emailResult)
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Email-Versand fehlgeschlagen', details: emailResult })
          }
        }

        console.log(`Closer-Benachrichtigung an ${closerEmails.length} Empfänger gesendet`)
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            success: true, 
            message: `Benachrichtigung an ${closerEmails.length} Closer gesendet`,
            recipients: closerEmails
          })
        }
      } catch (notifyError) {
        console.error('Notify-Closers Fehler:', notifyError)
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Interner Fehler', details: notifyError.message })
        }
      }
    }

    // ==========================================
    // STANDARD EMAIL SENDEN
    // ==========================================
    const {
      to,              // Empfänger E-Mail
      subject,         // Betreff
      content,         // E-Mail Inhalt (Text)
      senderName,      // Absender Name (z.B. "Phillip Schadek")
      senderEmail,     // Absender E-Mail (muss @sunsideai.de sein)
      senderTelefon,   // Absender Telefonnummer für Signatur
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
      html: formatEmailHtml(content, fromName, fromEmail, senderTelefon)
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
        console.log('Lead history updated successfully')
      } catch (updateError) {
        console.error('Lead-Update Fehler:', updateError.message || updateError)
        // Fehler nicht verschlucken - in Response anzeigen
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: 'E-Mail gesendet, aber Lead-Historie konnte nicht aktualisiert werden',
            emailId: resendData.id,
            attachmentCount: processedAttachments.length,
            historyError: updateError.message
          })
        }
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

// Lead-Kommentarfeld mit Historie aktualisieren + Status-Update bei E-Mail
async function updateLeadHistory({ leadId, action, details, userName, attachmentCount }) {
  // Check Environment Variables
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Missing env vars - API_KEY:', !!AIRTABLE_API_KEY, 'BASE_ID:', !!AIRTABLE_BASE_ID)
    throw new Error('Airtable Konfiguration fehlt')
  }

  const headers = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  console.log('updateLeadHistory called with:', { leadId, action, details, userName, attachmentCount })

  // Erst aktuellen Lead laden (Kommentar + Status)
  const getResponse = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`,
    { headers }
  )
  
  if (!getResponse.ok) {
    console.error('Failed to fetch lead:', getResponse.status)
    throw new Error('Lead konnte nicht geladen werden')
  }
  
  const leadData = await getResponse.json()
  console.log('Current lead data:', leadData.fields?.Kommentar?.substring(0, 100), '...', 'Status:', leadData.fields?.Ergebnis)
  
  const currentKommentar = leadData.fields?.Kommentar || ''
  const currentStatus = leadData.fields?.Ergebnis || ''

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

  console.log('New entry:', newEntry)

  // Neuen Eintrag oben anhängen
  let updatedKommentar = currentKommentar 
    ? `${newEntry}\n${currentKommentar}`
    : newEntry

  // Status-Update Logik bei E-Mail-Versand
  // Nur wenn aktueller Status "niedriger" ist als "Unterlage bereitstellen"
  const lowerStatuses = ['Nicht erreicht', 'Kein Interesse']
  const shouldUpdateStatus = action === 'email' && lowerStatuses.includes(currentStatus)

  // SCHRITT 1: Kommentar IMMER aktualisieren
  let finalKommentar = updatedKommentar

  console.log('Updating lead Kommentar...')

  const kommentarResponse = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: { Kommentar: finalKommentar }
      })
    }
  )

  if (!kommentarResponse.ok) {
    const errorData = await kommentarResponse.json()
    console.error('Failed to update Kommentar:', errorData)
    throw new Error('Kommentar konnte nicht aktualisiert werden: ' + JSON.stringify(errorData))
  }

  console.log('Kommentar updated successfully')

  // SCHRITT 2: Status separat aktualisieren (falls nötig)
  if (shouldUpdateStatus) {
    console.log(`Versuche Status zu ändern: ${currentStatus} → Unterlage bereitstellen`)
    
    try {
      const statusResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            fields: { Ergebnis: 'Unterlage bereitstellen' }
          })
        }
      )

      if (statusResponse.ok) {
        console.log('Status updated successfully')
        
        // History-Eintrag für Status-Änderung hinzufügen
        const statusEntry = `[${timestamp}] 📋 Ergebnis: Unterlage bereitstellen (automatisch nach E-Mail-Versand)`
        const kommentarMitStatus = `${statusEntry}\n${finalKommentar}`
        
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              fields: { Kommentar: kommentarMitStatus }
            })
          }
        )
      } else {
        const errorData = await statusResponse.json()
        console.warn('Status-Update fehlgeschlagen (Option existiert nicht in Airtable?):', errorData.error?.message)
        // Kein throw - Kommentar wurde ja gespeichert
      }
    } catch (statusError) {
      console.warn('Status-Update Fehler:', statusError.message)
      // Kein throw - Kommentar wurde ja gespeichert
    }
  }

  console.log('Lead history update completed')
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

// E-Mail Inhalt als HTML formatieren mit Signatur - IONOS-Style
function formatEmailHtml(text, senderName, senderEmail, senderTelefon) {
  // Text zu HTML konvertieren - IONOS-Style mit engen Zeilenabständen
  let htmlContent = text
    // HTML-Sonderzeichen escapen
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Markdown-Links: [Anzeigename](URL) zu klickbarem Link
    // MUSS vor der nackten URL-Konvertierung passieren!
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" style="color: #6B46C1;">$1</a>')
    
    // **Fettgedruckt** zu <strong> (funktioniert auch über mehrere Wörter)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    
    // Bullet Points: Zeilen die mit • beginnen - inline statt list-item für IONOS-Look
    .replace(/^• (.+)$/gm, '<div style="padding-left: 15px;">• $1</div>')
    
    // Zeilenumbrüche zu <br>
    .replace(/\n/g, '<br>\n')
  
  // Nackte URLs klickbar machen (nur wenn nicht bereits in einem href)
  htmlContent = htmlContent.replace(
    /(^|[^"'>])(https?:\/\/[^\s<]+)/g, 
    '$1<a href="$2" style="color: #6B46C1;">$2</a>'
  )

  // Signatur HTML - basierend auf IONOS Vorlage
  const signatur = `
    <div style="font-size: 10pt; font-family: Arial, Helvetica, sans-serif; margin-top: 20px; color: #000000;">
      <br>
      <div>Mit freundlichen Grüßen</div>
      <div><strong>${senderName || 'Sunside AI Team'}</strong></div>
      <div>KI-Entwicklung für Immobilienmakler</div>
      <br>
      
      <!-- Logo -->
      <div>
        <a href="https://www.sunsideai.de/">
          <img src="https://onecdn.io/media/8c3e476c-82b3-4db6-8cbe-85b46cd452d0/full" 
               alt="Sunside AI" width="189" height="41" style="border: 0;">
        </a>
      </div>
      <br>
      
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
      <br>
      
      <!-- Kontaktdaten -->
      <div><strong>Sunside AI GbR</strong></div>
      <div>Schiefer Berg 3 I 38124 Braunschweig I Deutschland<br>
      E-Mail: <a href="mailto:contact@sunsideai.de" style="color: #000000;">contact@sunsideai.de</a>${senderTelefon ? ` I Tel: ${senderTelefon}` : ''}</div>
      <div>
        <a href="https://www.sunsideai.de/" style="color: #000000;">www.sunsideai.de</a> | 
        <a href="https://sunsideai.de/jetzt-termin-buchen" style="color: #000000;">Jetzt Termin buchen</a> | 
        <a href="https://sachverstand-mit-herz.podigee.io/12-new-episode" style="color: #000000;">Zur Podcast-Folge</a>
      </div>
      <br>
      
      <!-- Geschäftsführung -->
      <div>Geschäftsführung: Paul Probodziak und Niklas Schwerin</div>
      <br>
      
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

  // IONOS-Style: line-height 1.4 statt 1.6, normale Schriftgröße 10pt
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; color: #000000; margin: 0; padding: 20px;">
  <div style="color: #000000;">
    ${htmlContent}
    ${signatur}
  </div>
</body>
</html>`.trim()
}
