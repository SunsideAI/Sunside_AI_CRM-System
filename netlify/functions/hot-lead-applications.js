// Hot-Lead-Bewerbungen API
// GET: Bewerbungen laden (Admin: alle, Closer: eigene)
// POST: Neue Bewerbung erstellen (Closer bewirbt sich auf Lead)
// PATCH: Bewerbung bearbeiten (Admin genehmigt/ablehnt)

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { normalisiere } from '../../shared/status.js'
import { ABSENDER_SYSTEM } from './utils/mail.js'

// Die beiden Stufen, auf die man sich bewerben kann.
const STUFE = { SETTER: 'Setter', CLOSER: 'Closer' }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

function generateBewerbungId() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const mins = String(now.getMinutes()).padStart(2, '0')
  const secs = String(now.getSeconds()).padStart(2, '0')
  return 'HLB-' + year + month + day + '-' + hours + mins + secs
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // Identitaet kommt aus dem Sitzungs-Token, nicht aus der Anfrage.
  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer


  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  try {
    // GET - Bewerbungen laden
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      // Adminrechte kommen aus dem Token, nicht aus der Anfrage. Vorher
      // genuegte ?isAdmin=true, um alles zu sehen.
      const isAdmin = angemeldet.istAdmin
      // Und man sieht die eigenen Bewerbungen, nicht die eines beliebigen
      // Nutzers - dort haengen Kontaktdaten der Leads dran.
      const userId = angemeldet.id
      const status = params.status

      console.log('[Hot-Lead-Applications GET] Params:', { userId, status, isAdmin })

      let query = supabase
        .from('hot_lead_applications')
        .select(`
          *,
          closer:users!hot_lead_applications_closer_id_fkey(id, vor_nachname, email_geschaeftlich),
          bearbeiter:users!hot_lead_applications_bearbeitet_von_fkey(id, vor_nachname),
          hot_lead:hot_leads!hot_lead_applications_hot_lead_id_fkey(
            id,
            status,
            termin_beratungsgespraech,
            original_lead:leads!hot_leads_lead_id_fkey(unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname, stadt),
            setter:users!hot_leads_setter_id_fkey(vor_nachname)
          )
        `)
        .order('erstellt_am', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (!isAdmin && userId) {
        query = query.eq('closer_id', userId)
      }

      const { data: bewerbungenData, error } = await query

      if (error) {
        console.error('[Hot-Lead-Applications GET] Error:', error)
        throw new Error(error.message)
      }

      console.log('[Hot-Lead-Applications GET] Found', bewerbungenData?.length || 0, 'applications')

      const bewerbungen = (bewerbungenData || []).map(record => ({
        id: record.id,
        bewerbungId: record.bewerbung_id || '',
        stufe: record.stufe || STUFE.CLOSER,
        hotLeadId: record.hot_lead_id,
        closerId: record.closer_id,
        closerName: record.closer?.vor_nachname || 'Unbekannt',
        closerEmail: record.closer?.email_geschaeftlich || '',
        kommentar: record.kommentar || '',
        status: record.status || 'Offen',
        adminKommentar: record.admin_kommentar || '',
        bearbeitetVonId: record.bearbeitet_von || null,
        bearbeitetVonName: record.bearbeiter?.vor_nachname || '',
        bearbeitetAm: record.bearbeitet_am || null,
        erstelltAm: record.erstellt_am || null,
        // Hot Lead Details
        unternehmen: record.hot_lead?.original_lead?.unternehmensname || 'Unbekannt',
        ansprechpartner: [record.hot_lead?.original_lead?.ansprechpartner_vorname, record.hot_lead?.original_lead?.ansprechpartner_nachname].filter(Boolean).join(' ') || '',
        stadt: record.hot_lead?.original_lead?.stadt || '',
        terminDatum: record.hot_lead?.termin_beratungsgespraech || null,
        hotLeadStatus: normalisiere(record.hot_lead?.status) || '',
        setterName: record.hot_lead?.setter?.vor_nachname || ''
      }))

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ bewerbungen })
      }
    }

    // POST - Neue Bewerbung erstellen
    if (event.httpMethod === 'POST') {
      const { hotLeadId, kommentar, stufe: stufeRoh } = JSON.parse(event.body)

      // Die Stufe entscheidet, worauf man sich bewirbt: auf das
      // Beratungsgespräch (Setter) oder das Abschlussgespräch (Closer).
      const stufe = stufeRoh === STUFE.SETTER ? STUFE.SETTER : STUFE.CLOSER

      // Wer sich bewirbt, steht im Token. Vorher kam die closerId aus dem
      // Anfrage-Körper - man konnte sich also für jemand anderen bewerben.
      const closerId = angemeldet.id

      if (!hotLeadId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'hotLeadId ist erforderlich' })
        }
      }

      console.log('[Hot-Lead-Applications POST] Bewerber:', closerId, 'Lead:', hotLeadId, 'Stufe:', stufe)

      // Prüfen ob Hot Lead auf dieser Stufe noch frei ist
      const { data: hotLead, error: hotLeadError } = await supabase
        .from('hot_leads')
        .select(`
          id,
          closer_id,
          setter_id,
          opener_id,
          termin_beratungsgespraech,
          original_lead:leads!hot_leads_lead_id_fkey(unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname)
        `)
        .eq('id', hotLeadId)
        .single()

      if (hotLeadError) {
        console.error('[Hot-Lead-Applications POST] Hot Lead query error:', hotLeadError)
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Hot Lead nicht gefunden: ' + hotLeadError.message })
        }
      }

      if (!hotLead) {
        console.error('[Hot-Lead-Applications POST] Hot Lead not found for id:', hotLeadId)
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Hot Lead nicht gefunden' })
        }
      }

      const bereitsBesetzt = stufe === STUFE.SETTER ? hotLead.setter_id : hotLead.closer_id
      if (bereitsBesetzt) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            error: stufe === STUFE.SETTER
              ? 'Für dieses Beratungsgespräch ist bereits ein Setter eingeteilt'
              : 'Dieser Lead wurde bereits einem Closer zugewiesen'
          })
        }
      }

      // Interessenkonflikt: Wer den Kontakt selbst qualifiziert hat, bewirbt
      // sich auf seine eigene Vorarbeit. Das ist nicht verboten - der
      // genehmigende Admin soll es nur sehen, statt es zu übersehen.
      const konflikt = stufe === STUFE.SETTER
        ? (hotLead.opener_id === closerId)
        : (hotLead.setter_id === closerId || hotLead.opener_id === closerId)

      // Prüfen ob bereits eine offene Bewerbung existiert
      const { data: existing } = await supabase
        .from('hot_lead_applications')
        .select('id')
        .eq('hot_lead_id', hotLeadId)
        .eq('closer_id', closerId)
        .eq('stufe', stufe)
        .eq('status', 'Offen')
        .limit(1)

      if (existing && existing.length > 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Du hast dich bereits auf diesen Lead beworben' })
        }
      }

      // Closer-Namen laden
      const { data: closerData } = await supabase
        .from('users')
        .select('vor_nachname')
        .eq('id', closerId)
        .single()

      const closerName = closerData?.vor_nachname || 'Ein Closer'
      const bewerbungId = generateBewerbungId()

      // Schalter aus den Einstellungen: Muss auf dieser Stufe ueberhaupt
      // beworben werden? Ist er aus, wird direkt uebernommen - aber weiterhin
      // als genehmigte Bewerbung protokolliert, damit nachvollziehbar bleibt,
      // wer wann zugegriffen hat. Fehlt der Eintrag, gilt "an": ein fehlender
      // Schalter darf keine Tuer oeffnen.
      const schalter = stufe === STUFE.SETTER
        ? 'bewerbung_pflicht_setter' : 'bewerbung_pflicht_closer'
      const { data: einstellung } = await supabase
        .from('einstellungen').select('wert').eq('schluessel', schalter).maybeSingle()
      const bewerbungNoetig = (einstellung?.wert ?? 'an') !== 'aus'

      if (!bewerbungNoetig) {
        const feld = stufe === STUFE.SETTER ? 'setter_id' : 'closer_id'

        const { error: direktError } = await supabase
          .from('hot_leads')
          .update({ [feld]: closerId, zuletzt_geaendert_von: closerId })
          .eq('id', hotLeadId)
          .is(feld, null)          // nur wenn noch frei - schuetzt vor Gleichzeitigkeit

        if (direktError) throw new Error(direktError.message)

        const { data: danach } = await supabase
          .from('hot_leads').select(feld).eq('id', hotLeadId).maybeSingle()

        if (danach?.[feld] !== closerId) {
          return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Jemand anderes war schneller. Bitte Ansicht neu laden.' })
          }
        }

        await supabase.from('hot_lead_applications').insert({
          bewerbung_id: bewerbungId,
          hot_lead_id: hotLeadId,
          closer_id: closerId,
          stufe,
          kommentar: kommentar || null,
          status: 'Genehmigt',
          admin_kommentar: konflikt
            ? 'Direkt uebernommen (Bewerbung fuer diese Stufe nicht erforderlich). Hinweis: hat diesen Kontakt selbst qualifiziert.'
            : 'Direkt uebernommen (Bewerbung fuer diese Stufe nicht erforderlich).',
          bearbeitet_am: new Date().toISOString()
        })

        console.log(`[Hot-Lead-Applications POST] Direkt uebernommen: ${hotLeadId} von ${closerName} (${stufe})`)

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            direkt: true,
            message: stufe === STUFE.SETTER
              ? 'Beratungsgespräch übernommen.'
              : 'Lead übernommen.'
          })
        }
      }

      // Bewerbung erstellen
      const { data: newApplication, error: insertError } = await supabase
        .from('hot_lead_applications')
        .insert({
          bewerbung_id: bewerbungId,
          hot_lead_id: hotLeadId,
          closer_id: closerId,
          stufe,
          kommentar: konflikt
            ? [kommentar, 'Hinweis: Bewerber hat diesen Kontakt selbst qualifiziert.']
                .filter(Boolean).join(' — ')
            : (kommentar || null),
          status: 'Offen'
        })
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      console.log('[Hot-Lead-Applications POST] Created application:', bewerbungId, 'by', closerName)

      // E-Mail an alle Admins + contact@sunsideai.de senden
      try {
        await sendAdminNotification({
          hotLead,
          closerName,
          bewerbungId,
          kommentar: kommentar || null
        })
      } catch (e) {
        console.error('Admin E-Mail-Benachrichtigung fehlgeschlagen:', e)
      }

      // In-App-Benachrichtigung für Admins
      try {
        await sendAdminInAppNotification({
          hotLead,
          closerName,
          bewerbungId
        })
      } catch (e) {
        console.error('Admin In-App-Benachrichtigung fehlgeschlagen:', e)
      }

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          bewerbung: { id: newApplication.id, bewerbungId }
        })
      }
    }

    // PATCH - Bewerbung bearbeiten (Admin genehmigt/ablehnt)
    if (event.httpMethod === 'PATCH') {
      const { bewerbungId, status, adminKommentar } = JSON.parse(event.body)
      // Wer genehmigt, steht im Token - nicht in der Anfrage.
      const adminId = angemeldet.id
      if (!angemeldet.istAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Nur die Leitung darf Bewerbungen entscheiden' })
        }
      }

      if (!bewerbungId || !status) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'bewerbungId und status sind erforderlich' })
        }
      }

      if (!['Genehmigt', 'Abgelehnt'].includes(status)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Status muss Genehmigt oder Abgelehnt sein' })
        }
      }

      // Bewerbung laden
      const { data: application, error: fetchError } = await supabase
        .from('hot_lead_applications')
        .select(`
          *,
          closer:users!hot_lead_applications_closer_id_fkey(id, vor_nachname, email_geschaeftlich, email),
          hot_lead:hot_leads!hot_lead_applications_hot_lead_id_fkey(
            id,
            closer_id,
            setter_id,
            original_lead:leads!hot_leads_lead_id_fkey(unternehmensname)
          )
        `)
        .eq('id', bewerbungId)
        .single()

      if (fetchError || !application) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Bewerbung nicht gefunden' })
        }
      }

      if (application.status !== 'Offen') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Diese Bewerbung wurde bereits bearbeitet' })
        }
      }

      // Bewerbung updaten
      const { error: updateError } = await supabase
        .from('hot_lead_applications')
        .update({
          status,
          admin_kommentar: adminKommentar || null,
          bearbeitet_von: adminId || null,
          bearbeitet_am: new Date().toISOString()
        })
        .eq('id', bewerbungId)

      if (updateError) throw new Error(updateError.message)

      // Bei Genehmigung: Hot Lead auf der beworbenen Stufe zuweisen
      if (status === 'Genehmigt') {
        const stufe = application.stufe === STUFE.SETTER ? STUFE.SETTER : STUFE.CLOSER
        const feld = stufe === STUFE.SETTER ? 'setter_id' : 'closer_id'

        // Prüfen ob die Stufe noch frei ist
        if (application.hot_lead?.[feld]) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: stufe === STUFE.SETTER
                ? 'Es wurde zwischenzeitlich ein anderer Setter eingeteilt'
                : 'Lead wurde zwischenzeitlich einem anderen Closer zugewiesen'
            })
          }
        }

        // Lead zuweisen
        const { error: assignError } = await supabase
          .from('hot_leads')
          .update({ [feld]: application.closer_id, zuletzt_geaendert_von: angemeldet.id })
          .eq('id', application.hot_lead_id)

        if (assignError) throw new Error(assignError.message)

        console.log('[Hot-Lead-Applications PATCH] Lead', application.hot_lead_id, 'assigned to', application.closer?.vor_nachname)

        // Andere offene Bewerbungen für denselben Lead automatisch ablehnen
        const { error: rejectOthersError } = await supabase
          .from('hot_lead_applications')
          .update({
            status: 'Abgelehnt',
            admin_kommentar: stufe === STUFE.SETTER
              ? 'Beratungsgespräch wurde einem anderen Setter zugeteilt'
              : 'Lead wurde einem anderen Closer zugewiesen',
            bearbeitet_von: adminId || null,
            bearbeitet_am: new Date().toISOString()
          })
          .eq('hot_lead_id', application.hot_lead_id)
          .eq('stufe', stufe)
          .eq('status', 'Offen')
          .neq('id', bewerbungId)

        if (rejectOthersError) {
          console.error('Andere Bewerbungen ablehnen fehlgeschlagen:', rejectOthersError)
        }
      }

      // E-Mail an Closer senden
      try {
        await sendCloserNotification({
          closerEmail: application.closer?.email_geschaeftlich || application.closer?.email,
          closerName: application.closer?.vor_nachname || 'Closer',
          unternehmen: application.hot_lead?.original_lead?.unternehmensname || 'Unbekannt',
          status,
          adminKommentar
        })
      } catch (e) {
        console.error('Closer-Benachrichtigung fehlgeschlagen:', e)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          status
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Hot-Lead-Applications Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// E-Mail an alle Admins + contact@sunsideai.de
async function sendAdminNotification({ hotLead, closerName, bewerbungId, kommentar }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    console.log('[Hot-Lead-Applications] RESEND_API_KEY nicht konfiguriert, überspringe E-Mail')
    return
  }

  // Alle aktiven Admins laden
  const { data: admins } = await supabase
    .from('users')
    .select('email_geschaeftlich, email')
    .eq('status', true)
    .contains('rollen', ['Admin'])

  const adminEmails = (admins || [])
    .map(a => a.email_geschaeftlich || a.email)
    .filter(Boolean)

  // Hardcoded: contact@sunsideai.de immer hinzufügen
  const recipients = [...new Set([...adminEmails, 'contact@sunsideai.de'])]

  if (recipients.length === 0) {
    console.log('[Hot-Lead-Applications] Keine Empfänger für Admin-Benachrichtigung')
    return
  }

  const unternehmen = hotLead.original_lead?.unternehmensname || 'Unbekannt'
  const ansprechpartner = [hotLead.original_lead?.ansprechpartner_vorname, hotLead.original_lead?.ansprechpartner_nachname].filter(Boolean).join(' ') || ''
  const terminDatum = hotLead.termin_beratungsgespraech
    ? new Date(hotLead.termin_beratungsgespraech).toLocaleString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Nicht festgelegt'

  const kommentarHtml = kommentar
    ? `<tr><td style="padding: 8px 0; color: #6B7280;">Kommentar:</td><td style="padding: 8px 0; color: #111827;">${kommentar}</td></tr>`
    : ''

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Neue Hot-Lead-Bewerbung</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        <strong>${closerName}</strong> hat sich auf folgenden Hot Lead beworben:
      </p>

      <div style="background: #F5F3FF; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #8B5CF6;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280; width: 40%;">Unternehmen:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${unternehmen}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280;">Ansprechpartner:</td>
            <td style="padding: 8px 0; color: #111827;">${ansprechpartner || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280;">Termin:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${terminDatum}</td>
          </tr>
          ${kommentarHtml}
        </table>
      </div>

      <p style="color: #6B7280; font-size: 14px;">
        Bewerbungs-ID: ${bewerbungId}
      </p>

      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crmsunsideai.netlify.app/einstellungen?tab=hot-lead-bewerbungen" style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Bewerbung prüfen
        </a>
      </div>
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 20px;">
      Sunside AI GbR | Schiefer Berg 3 | 38124 Braunschweig
    </p>
  </div>
</body>
</html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: ABSENDER_SYSTEM,
      to: recipients,
      subject: `📋 Neue Hot-Lead-Bewerbung: ${closerName} → ${unternehmen}`,
      html: emailHtml
    })
  })

  console.log('[Hot-Lead-Applications] Admin-Benachrichtigung gesendet an', recipients.length, 'Empfänger')
}

// In-App-Benachrichtigung für alle Admins
async function sendAdminInAppNotification({ hotLead, closerName, bewerbungId }) {
  // Alle aktiven Admins laden
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('status', true)
    .contains('rollen', ['Admin'])

  if (!admins || admins.length === 0) {
    console.log('[Hot-Lead-Applications] Keine Admins für In-App-Benachrichtigung gefunden')
    return
  }

  const unternehmen = hotLead.original_lead?.unternehmensname || 'Unbekannt'
  const titel = 'Neue Hot-Lead-Bewerbung'
  const nachricht = `${closerName} hat sich auf "${unternehmen}" beworben. Bewerbungs-ID: ${bewerbungId}`

  // Für jeden Admin eine Nachricht erstellen
  const messages = admins.map(admin => ({
    message_id: `HLB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    empfaenger_id: admin.id,
    typ: 'Pool Update',
    titel,
    nachricht,
    hot_lead_id: hotLead.id,
    gelesen: false
  }))

  const { error } = await supabase
    .from('system_messages')
    .insert(messages)

  if (error) {
    console.error('[Hot-Lead-Applications] Fehler beim Erstellen der In-App-Benachrichtigungen:', error)
  } else {
    console.log('[Hot-Lead-Applications] In-App-Benachrichtigungen erstellt für', admins.length, 'Admins')
  }
}

// E-Mail an Closer nach Genehmigung/Ablehnung
async function sendCloserNotification({ closerEmail, closerName, unternehmen, status, adminKommentar }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY || !closerEmail) return

  let statusTitle, statusColor, statusIcon, mainMessage, subject

  if (status === 'Genehmigt') {
    statusTitle = 'Genehmigt ✓'
    statusColor = '#10B981'
    statusIcon = '✅'
    mainMessage = `Deine Bewerbung für <strong>${unternehmen}</strong> wurde genehmigt! Der Lead wurde dir zugewiesen und ist jetzt unter "Meine Leads" verfügbar.`
    subject = `✅ Hot-Lead-Bewerbung genehmigt: ${unternehmen}`
  } else {
    statusTitle = 'Abgelehnt'
    statusColor = '#EF4444'
    statusIcon = '❌'
    mainMessage = `Deine Bewerbung für <strong>${unternehmen}</strong> wurde leider abgelehnt.`
    subject = `❌ Hot-Lead-Bewerbung abgelehnt: ${unternehmen}`
  }

  const kommentarHtml = adminKommentar
    ? `<div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <strong style="color: #374151;">Kommentar vom Admin:</strong>
        <p style="color: #4B5563; margin: 8px 0 0 0;">${adminKommentar}</p>
      </div>`
    : ''

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">${statusIcon}</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">Bewerbung ${statusTitle}</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${closerName},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        ${mainMessage}
      </p>
      ${kommentarHtml}
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crmsunsideai.netlify.app/closing" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Closing
        </a>
      </div>
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 20px;">
      Sunside AI GbR | Schiefer Berg 3 | 38124 Braunschweig
    </p>
  </div>
</body>
</html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: ABSENDER_SYSTEM,
      to: [closerEmail],
      subject,
      html: emailHtml
    })
  })

  console.log('[Hot-Lead-Applications] Closer-Benachrichtigung gesendet an', closerEmail)
}
