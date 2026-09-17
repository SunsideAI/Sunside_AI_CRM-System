// Send Email API via Resend - Supabase Version
import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { darf, verboten, leadBeteiligt, hotLeadBeteiligt } from './utils/zugriff.js'
import { systemMailSenden } from './utils/mailLayout.js'
import { neuerTerminImPool, terminWiederFrei } from './utils/mails.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer


  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // Mails verschickt der Vertrieb. Wer keine Vertriebsrolle hat, hat hier
  // nichts zu senden.
  if (!darf.vertrieb(angemeldet)) return verboten()

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

      // Wer ein frisch gebuchtes Beratungsgespraech uebernehmen kann, sind die
      // SETTER - nicht die Closer. Der Aufruf heisst aus der Zeit vor dem
      // OSC-Umbau noch 'notify-closers'; der Name bleibt, damit nichts
      // anderes bricht, die Empfaenger stimmen jetzt.
      //
      // Admins bleiben dabei: Sie entscheiden ueber die Bewerbungen und
      // muessen wissen, dass etwas wartet.
      const { data: users } = await supabase
        .from('users')
        .select('id, email_geschaeftlich, rollen')
        .eq('status', true)

      const closerUsers = (users || [])
        .filter(u => (u.rollen || []).some(r => {
          const rolle = r.toLowerCase()
          return rolle.includes('setter') || rolle === 'admin' || rolle === 'geschäftsführer'
        }))

      if (closerUsers.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, message: 'Keine Setter' }) }
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
          const { betreff, mail } = neuerTerminImPool({
            gebuchtVon: termin.setter,
            unternehmen: termin.unternehmen,
            ansprechpartner: termin.ansprechpartner,
            datum: termin.datum,
            art: termin.art
          })
          await systemMailSenden({ an: closerEmails, betreff, mail })
        }
      }

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, notifiedClosers: closerUsers.length }) }
    }

    // NOTIFY CLOSERS RELEASE
    if (body.action === 'notify-closers-release') {
      if (!darf.closing(angemeldet)) return verboten('Termine gibt nur ein Closer frei', 'rolle_fehlt')
      const { termin } = body
      if (!termin || !RESEND_API_KEY) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Ungueltige Anfrage' }) }
      }

      const { data: users } = await supabase.from('users').select('email_geschaeftlich, rollen').eq('status', true)
      const closerEmails = (users || []).filter(u => (u.rollen || []).some(r => r.toLowerCase().includes('closer') || r.toLowerCase() === 'admin')).map(u => u.email_geschaeftlich).filter(Boolean)

      if (closerEmails.length > 0) {
        const { betreff, mail } = terminWiederFrei({
          freigegebenVon: angemeldet.name,
          unternehmen: termin.unternehmen,
          ansprechpartner: termin.ansprechpartner,
          datum: termin.datum,
          art: termin.art
        })
        await systemMailSenden({ an: closerEmails, betreff, mail })
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) }
    }

    // STANDARD EMAIL
    const { to, subject, content, senderName, senderEmail, senderTelefon, replyTo, leadId, hotLeadId: hotLeadFuerMaterial, templateName, attachments } = body

    if (!to || !subject || !content) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'to, subject und content erforderlich' }) }
    }

    if (!RESEND_API_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'RESEND nicht konfiguriert' }) }
    }

    // Absender ist, wer angemeldet ist - mit der Adresse aus seinem Profil.
    // Vorher kam sie aus der Anfrage, und includes('@sunsideai.de') liess
    // jede fremde Adresse der Firma zu, sogar "x@sunsideai.de.example.com".
    const { data: profil } = await supabase
      .from('users').select('email_geschaeftlich, email, telefon').eq('id', angemeldet.id).maybeSingle()
    const eigeneAdresse = String(profil?.email_geschaeftlich || '').trim().toLowerCase()
    const fromEmail = /^[^@\s]+@sunsideai\.de$/.test(eigeneAdresse) ? eigeneAdresse : 'team@sunsideai.de'
    if (senderEmail && senderEmail.trim().toLowerCase() !== fromEmail) {
      console.warn('[send-email] Absender aus der Anfrage ignoriert:', senderEmail)
    }
    const fromName = angemeldet.name || senderName || 'Sunside AI'
    // Antworten gehen an die eigene Adresse - auch wenn sie nicht auf
    // sunsideai.de endet und darum nicht Absender sein kann.
    const antwortAn = eigeneAdresse || String(profil?.email || '').trim() || fromEmail

    // Wer Verlauf oder Unterlagen an einen Kontakt schreibt, muss an ihm
    // beteiligt sein.
    if (leadId && !(await leadBeteiligt(supabase, angemeldet, leadId))) {
      return verboten('Dieser Lead gehört nicht zu deinen', 'nicht_beteiligt')
    }
    if (hotLeadFuerMaterial && (await hotLeadBeteiligt(supabase, angemeldet, hotLeadFuerMaterial)) !== 'ja') {
      return verboten('Dieser Kontakt gehört nicht zu deinen', 'nicht_beteiligt')
    }
    const from = fromName + ' <' + fromEmail + '>'
    const bccEmail = antwortAn

    const processedAttachments = await processAttachments(attachments)

    const emailPayload = {
      from,
      to: [to],
      bcc: [bccEmail],
      reply_to: antwortAn,
      subject,
      text: content,
      // Auch die Signatur kommt aus dem Profil: Name, Adresse und Nummer
      // liessen sich vorher über die Anfrage frei setzen.
      html: formatEmailHtml(content, fromName, fromEmail, profil?.telefon || senderTelefon)
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
        await updateLeadHistory({ leadId, action: 'email', details: 'E-Mail gesendet: "' + (templateName || 'Individuell') + '" an ' + to, userName: fromName, attachmentCount: processedAttachments.length })
      } catch (e) { console.error('Lead-Update Fehler:', e) }
    }

    // Versendete Unterlagen mitschreiben. Der Hilfetext im CRM sagt "Fuellt das
    // System beim Senden automatisch aus" - bisher tat es das nicht, und der
    // Setter stand vor einem Pflichtfeld, das er von Hand tippen musste.
    if (hotLeadFuerMaterial) {
      try {
        const stueck = templateName || subject
        const { data: stand } = await supabase
          .from('hot_leads').select('material_versendet').eq('id', hotLeadFuerMaterial).maybeSingle()

        const bisher = Array.isArray(stand?.material_versendet) ? stand.material_versendet : []
        if (stueck && !bisher.includes(stueck)) {
          await supabase.from('hot_leads')
            .update({ material_versendet: [...bisher, stueck] })
            .eq('id', hotLeadFuerMaterial)
        }
      } catch (e) {
        // Der Versand ist gelungen - daran soll ein misslungener Vermerk
        // nichts aendern.
        console.error('material_versendet konnte nicht fortgeschrieben werden:', e)
      }
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

function ausEigenemSpeicher(url) {
  try {
    const ziel = new URL(url)
    const speicher = new URL(process.env.SUPABASE_URL)
    return ziel.protocol === 'https:' && ziel.host === speicher.host &&
      ziel.pathname.startsWith('/storage/v1/object/public/')
  } catch { return false }
}

async function processAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return []
  const processed = []
  for (const att of attachments) {
    try {
      if (!att.url) continue
      // Nur aus dem eigenen Speicher. Sonst holt der Server jede beliebige
      // Adresse ab - auch interne, die von aussen nicht erreichbar sind.
      if (!ausEigenemSpeicher(att.url)) {
        console.warn('[send-email] Anhang ausserhalb des Speichers ignoriert:', att.url)
        continue
      }
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
        <a href="https://sunsideai.de/#kontakt" style="color: #7c3aed; margin-left: 4px;">Jetzt Termin buchen</a> |
        <a href="https://sachverstand-mit-herz.podigee.io/12-new-episode" style="color: #7c3aed; margin-left: 4px;">Zur Podcast-Folge</a>
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
