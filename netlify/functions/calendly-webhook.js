// Calendly Webhook Handler - Supabase Version
// Verarbeitet Events: invitee.canceled, invitee.created (bei Reschedule)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Calendly-Webhook-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Datum formatieren
function formatDate(isoString) {
  if (!isoString) return 'Unbekannt'
  const date = new Date(isoString)
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin'
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server nicht konfiguriert' }) }
  }

  try {
    const payload = JSON.parse(event.body)

    console.log('=== Calendly Webhook received ===')
    console.log('Event:', payload.event)

    const eventType = payload.event
    const data = payload.payload

    // invitee.canceled (Termin abgesagt ODER verschoben)
    if (eventType === 'invitee.canceled') {
      const inviteeEmail = data.email
      const scheduledTime = data.scheduled_event?.start_time
      const cancellation = data.cancellation || {}
      const canceledBy = cancellation.canceled_by || 'Unbekannt'
      const cancellationReason = cancellation.reason || ''

      const questionsAndAnswers = data.questions_and_answers || []
      const unternehmensAnswer = questionsAndAnswers.find(q =>
        q.question?.toLowerCase().includes('unternehmen') ||
        q.question?.toLowerCase().includes('company')
      )
      const unternehmen = unternehmensAnswer?.answer || ''

      const isReschedule = data.rescheduled === true

      console.log('Cancel Event:', { email: inviteeEmail, unternehmen, isReschedule })

      if (isReschedule) {
        console.log('Ist Reschedule, warte auf invitee.created Event')
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, message: 'Reschedule erkannt' })
        }
      }

      // Echte Absage - Hot Lead finden (3 Fallback-Strategien wie in main)
      let hotLead = null
      // 1. Nach Termin-Zeit suchen
      if (scheduledTime) {
        hotLead = await findHotLeadByTermin(scheduledTime, inviteeEmail)
      }
      // 2. Nach E-Mail suchen (Fallback)
      if (!hotLead && inviteeEmail) {
        hotLead = await findHotLeadByEmail(inviteeEmail)
      }
      // 3. Nach Unternehmen suchen (letzter Fallback)
      if (!hotLead && unternehmen) {
        hotLead = await findHotLeadByUnternehmen(unternehmen)
      }

      if (hotLead) {
        const grund = cancellationReason
          ? `Abgesagt von ${canceledBy}: ${cancellationReason}`
          : `Abgesagt von ${canceledBy}`

        await updateHotLeadAbsage(hotLead.id, hotLead.originalLeadId, grund)
        await sendNotifications(hotLead, 'absage', { grund })
        console.log('Hot Lead Status auf abgesagt geaendert:', hotLead.id)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Absage verarbeitet', hotLeadId: hotLead?.id || null })
      }
    }

    // invitee.created (Neuer Termin / Reschedule)
    if (eventType === 'invitee.created') {
      const inviteeEmail = data.email
      const newScheduledTime = data.scheduled_event?.start_time

      const questionsAndAnswers = data.questions_and_answers || []
      const unternehmensAnswer = questionsAndAnswers.find(q =>
        q.question?.toLowerCase().includes('unternehmen') ||
        q.question?.toLowerCase().includes('company')
      )
      const unternehmen = unternehmensAnswer?.answer || ''

      const oldInvitee = data.old_invitee
      const isReschedule = !!oldInvitee

      console.log('Created Event:', { email: inviteeEmail, unternehmen, isReschedule, newTime: newScheduledTime })

      if (isReschedule) {
        const oldScheduledTime = oldInvitee.scheduled_event?.start_time || oldInvitee.start_time

        // Hot Lead finden (3 Fallback-Strategien wie in main)
        let hotLead = null
        // 1. Nach altem Termin suchen
        if (oldScheduledTime) {
          hotLead = await findHotLeadByTermin(oldScheduledTime, inviteeEmail)
        }
        // 2. Nach E-Mail suchen (Fallback)
        if (!hotLead && inviteeEmail) {
          hotLead = await findHotLeadByEmail(inviteeEmail)
        }
        // 3. Nach Unternehmen suchen (letzter Fallback)
        if (!hotLead && unternehmen) {
          hotLead = await findHotLeadByUnternehmen(unternehmen)
        }

        if (hotLead) {
          console.log('Hot Lead gefunden für Verschiebung:', {
            id: hotLead.id,
            unternehmen: hotLead.unternehmen,
            setterId: hotLead.setterId,
            closerId: hotLead.closerId
          })
          await updateHotLeadTermin(hotLead.id, newScheduledTime, hotLead.originalLeadId, hotLead.termin)
          await sendNotifications(hotLead, 'verschiebung', { neuerTermin: newScheduledTime, alterTermin: hotLead.termin })
          console.log('Hot Lead Termin aktualisiert und Benachrichtigungen gesendet:', hotLead.id)
        } else {
          console.error('WARNUNG: Kein Hot Lead gefunden für Verschiebung!', {
            email: inviteeEmail,
            oldTime: oldScheduledTime,
            unternehmen
          })
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, message: 'Verschiebung verarbeitet', hotLeadId: hotLead?.id || null })
        }
      }

      console.log('Neue Buchung (wird von CRM/TerminPicker behandelt)')
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Neue Buchung - wird vom CRM behandelt' })
      }
    }

    console.log('Unbekanntes Event ignoriert:', eventType)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Event ignoriert' })
    }

  } catch (err) {
    console.error('Calendly Webhook Error:', err)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) }
  }
}

// Hot Lead anhand Unternehmen finden
async function findHotLeadByUnternehmen(unternehmen) {
  if (!unternehmen) return null

  console.log('Suche Hot Lead nach Unternehmen:', unternehmen)

  const { data: hotLeads, error } = await supabase
    .from('hot_leads')
    .select('id, unternehmen, termin_beratungsgespraech, setter_id, closer_id, lead_id')
    .neq('status', 'Abgesagt')
    .not('termin_beratungsgespraech', 'is', null)

  if (error || !hotLeads) return null

  const searchTerm = unternehmen.toLowerCase().trim()

  for (const record of hotLeads) {
    const recordUnternehmen = (record.unternehmen || '').toLowerCase().trim()
    if (recordUnternehmen === searchTerm ||
      recordUnternehmen.includes(searchTerm) ||
      searchTerm.includes(recordUnternehmen)) {
      console.log('Match gefunden:', record.unternehmen)
      return {
        id: record.id,
        unternehmen: record.unternehmen,
        termin: record.termin_beratungsgespraech,
        setterId: record.setter_id,
        closerId: record.closer_id,
        originalLeadId: record.lead_id
      }
    }
  }

  return null
}

// Hot Lead anhand Termin-Zeit finden
async function findHotLeadByTermin(terminDatum, email) {
  if (!terminDatum) return null

  console.log('Suche Hot Lead nach Termin:', terminDatum)

  const { data: hotLeads, error } = await supabase
    .from('hot_leads')
    .select('id, unternehmen, termin_beratungsgespraech, setter_id, closer_id, lead_id')
    .neq('status', 'Abgesagt')

  if (error || !hotLeads) return null

  const searchDate = new Date(terminDatum)
  const targetTime = searchDate.getTime()

  for (const record of hotLeads) {
    if (!record.termin_beratungsgespraech) continue

    const recordTime = new Date(record.termin_beratungsgespraech).getTime()
    const timeDiff = Math.abs(recordTime - targetTime)

    if (timeDiff < 10 * 60 * 1000) {
      console.log('Zeit-Match gefunden:', record.unternehmen)
      return {
        id: record.id,
        unternehmen: record.unternehmen,
        termin: record.termin_beratungsgespraech,
        setterId: record.setter_id,
        closerId: record.closer_id,
        originalLeadId: record.lead_id
      }
    }
  }

  return null
}

// Hot Lead anhand E-Mail finden (Fallback wenn Termin/Unternehmen nicht matchen)
async function findHotLeadByEmail(email) {
  if (!email) return null

  console.log('Suche Hot Lead nach E-Mail:', email)

  // Erst in hot_leads.mail suchen
  const { data: directMatch, error: directError } = await supabase
    .from('hot_leads')
    .select('id, lead_id, unternehmen, mail, termin_beratungsgespraech, status, setter_id, closer_id')
    .eq('mail', email)
    .not('status', 'in', '(Abgeschlossen,Verloren)')
    .order('termin_beratungsgespraech', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (directError) {
    console.error('findHotLeadByEmail Direct Error:', directError)
  }

  if (directMatch) {
    console.log('E-Mail-Match in hot_leads gefunden:', directMatch.unternehmen)
    return {
      id: directMatch.id,
      unternehmen: directMatch.unternehmen,
      termin: directMatch.termin_beratungsgespraech,
      setterId: directMatch.setter_id,
      closerId: directMatch.closer_id,
      originalLeadId: directMatch.lead_id
    }
  }

  // Fallback: Über original_lead.mail suchen (Join)
  const { data: joinMatch, error: joinError } = await supabase
    .from('hot_leads')
    .select(`
      id, lead_id, unternehmen, termin_beratungsgespraech, status, setter_id, closer_id,
      original_lead:leads!hot_leads_lead_id_fkey(mail)
    `)
    .not('status', 'in', '(Abgeschlossen,Verloren)')
    .order('termin_beratungsgespraech', { ascending: false })

  if (joinError) {
    console.error('findHotLeadByEmail Join Error:', joinError)
    return null
  }

  // Manuell nach E-Mail filtern (weil Supabase kein Filter auf Join-Felder erlaubt)
  const matchingLead = (joinMatch || []).find(hl =>
    hl.original_lead?.mail?.toLowerCase() === email.toLowerCase()
  )

  if (matchingLead) {
    console.log('E-Mail-Match über original_lead gefunden:', matchingLead.unternehmen)
    return {
      id: matchingLead.id,
      unternehmen: matchingLead.unternehmen,
      termin: matchingLead.termin_beratungsgespraech,
      setterId: matchingLead.setter_id,
      closerId: matchingLead.closer_id,
      originalLeadId: matchingLead.lead_id
    }
  }

  console.log('Kein E-Mail-Match gefunden für:', email)
  return null
}

// Hot Lead bei Absage aktualisieren - NUR Status ändern, Termin behalten für Referenz
async function updateHotLeadAbsage(hotLeadId, originalLeadId, grund) {
  console.log('Aktualisiere Hot Lead Absage:', { hotLeadId, originalLeadId })

  // Nur Status ändern - termin_beratungsgespraech bleibt erhalten für Referenz
  const { error } = await supabase
    .from('hot_leads')
    .update({ status: 'Termin abgesagt' })
    .eq('id', hotLeadId)

  if (error) {
    console.error('Update Fehler:', error)
    return false
  }

  if (originalLeadId) {
    await updateOriginalLeadKommentar(originalLeadId, `TERMIN ABGESAGT: ${grund}`)
  }

  return true
}

// Hot Lead Termin aktualisieren
async function updateHotLeadTermin(hotLeadId, neuerTermin, originalLeadId, alterTermin) {
  console.log('Aktualisiere Hot Lead Termin:', { hotLeadId, neuerTermin })

  const { error } = await supabase
    .from('hot_leads')
    .update({ termin_beratungsgespraech: neuerTermin, status: 'Termin verschoben' })
    .eq('id', hotLeadId)

  if (error) {
    console.error('Update Fehler:', error)
    return false
  }

  if (originalLeadId) {
    const kommentar = `TERMIN VERSCHOBEN: ${formatDate(alterTermin)} → ${formatDate(neuerTermin)}`
    await updateOriginalLeadKommentar(originalLeadId, kommentar)
  }

  return true
}

// Kommentar im Original-Lead aktualisieren
async function updateOriginalLeadKommentar(leadId, neuerKommentar) {
  console.log('Aktualisiere Lead Kommentar:', leadId)

  const { data: lead } = await supabase
    .from('leads')
    .select('kommentar')
    .eq('id', leadId)
    .single()

  const existingComment = lead?.kommentar || ''
  const now = new Date()
  const timestamp = now.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin'
  })

  const newEntry = `[${timestamp}] ${neuerKommentar}`
  const newComment = existingComment ? `${newEntry}\n${existingComment}` : newEntry

  await supabase
    .from('leads')
    .update({ kommentar: newComment })
    .eq('id', leadId)
}

// System-Messages + E-Mails an Setter & Closer senden
async function sendNotifications(hotLead, eventType, details) {
  const { setterId, closerId, unternehmen } = hotLead

  let nachricht = ''
  let typ = 'Info'
  let titel = ''
  let emailIcon = '📬'
  let emailColor = '#3B82F6'

  if (eventType === 'absage') {
    titel = 'Termin abgesagt'
    nachricht = `Termin abgesagt: ${unternehmen}\n${details.grund || 'Kein Grund angegeben'}`
    typ = 'Termin abgesagt'
    emailIcon = '❌'
    emailColor = '#EF4444'
  } else if (eventType === 'verschiebung') {
    titel = 'Termin verschoben'
    nachricht = `Termin verschoben: ${unternehmen}\nNeuer Termin: ${formatDate(details.neuerTermin)}`
    typ = 'Termin verschoben'
    emailIcon = '🔄'
    emailColor = '#F59E0B'
  }

  // User-Daten laden für E-Mail-Versand
  const userIds = [setterId, closerId].filter(Boolean)
  let usersData = []

  if (userIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, vor_nachname, email, email_geschaeftlich')
      .in('id', userIds)

    usersData = data || []
  }

  // System-Message + E-Mail an Setter
  if (setterId) {
    console.log('Sende Benachrichtigung an Setter:', setterId)
    await createSystemMessage(setterId, titel, nachricht, typ, hotLead.id)
    const setterUser = usersData.find(u => u.id === setterId)
    if (setterUser) {
      console.log('Setter gefunden:', setterUser.vor_nachname, setterUser.email_geschaeftlich || setterUser.email)
      await sendNotificationEmail(setterUser, titel, nachricht, typ, emailIcon, emailColor, details, unternehmen)
    } else {
      console.error('Setter nicht in usersData gefunden:', setterId)
    }
  } else {
    console.log('Kein Setter zugewiesen - keine Setter-Benachrichtigung')
  }

  // System-Message + E-Mail an Closer
  if (closerId) {
    console.log('Sende Benachrichtigung an Closer:', closerId)
    await createSystemMessage(closerId, titel, nachricht, typ, hotLead.id)
    const closerUser = usersData.find(u => u.id === closerId)
    if (closerUser) {
      console.log('Closer gefunden:', closerUser.vor_nachname, closerUser.email_geschaeftlich || closerUser.email)
      await sendNotificationEmail(closerUser, titel, nachricht, typ, emailIcon, emailColor, details, unternehmen)
    } else {
      console.error('Closer nicht in usersData gefunden:', closerId)
    }
  } else {
    console.log('Kein Closer zugewiesen - keine Closer-Benachrichtigung')
  }

  console.log('Benachrichtigungen verarbeitet')
}

// E-Mail-Benachrichtigung senden
async function sendNotificationEmail(user, titel, nachricht, typ, icon, color, details, unternehmen) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY nicht konfiguriert - keine E-Mail gesendet')
    return
  }

  const userEmail = user.email_geschaeftlich || user.email
  if (!userEmail) {
    console.log('Keine E-Mail-Adresse für User:', user.id)
    return
  }

  const userName = user.vor_nachname || 'User'

  // Details für E-Mail aufbereiten
  let detailsHtml = ''
  if (typ === 'Termin verschoben' && details.neuerTermin) {
    detailsHtml = `
      <tr>
        <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Alter Termin:</td>
        <td style="padding: 8px 0; color: #111827; font-size: 15px; text-decoration: line-through;">${formatDate(details.alterTermin)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Neuer Termin:</td>
        <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${formatDate(details.neuerTermin)}</td>
      </tr>`
  } else if (typ === 'Termin abgesagt' && details.grund) {
    detailsHtml = `
      <tr>
        <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Grund:</td>
        <td style="padding: 8px 0; color: #111827; font-size: 15px;">${details.grund}</td>
      </tr>`
  }

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>
      <h1 style="color: white; margin: 0; font-size: 24px;">${titel}</h1>
    </div>
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        Hallo ${userName},
      </p>
      <div style="background: ${color}15; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${color};">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280; font-size: 14px; width: 120px;">Unternehmen:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 15px;">${unternehmen}</td>
          </tr>
          ${detailsHtml}
        </table>
      </div>
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/closing" style="display: inline-block; background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Im CRM ansehen
        </a>
      </div>
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Sunside AI <noreply@sunside.ai>',
        to: userEmail,
        subject: `${icon} ${titel}: ${unternehmen}`,
        html: emailHtml
      })
    })
    console.log('E-Mail gesendet an:', userEmail)
  } catch (err) {
    console.error('E-Mail-Fehler:', err)
  }
}

// System-Message erstellen
async function createSystemMessage(empfaengerId, titel, nachricht, typ, hotLeadId) {
  const messageId = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  await supabase
    .from('system_messages')
    .insert({
      message_id: messageId,
      empfaenger_id: empfaengerId,
      titel,
      nachricht,
      typ,
      hot_lead_id: hotLeadId || null,
      gelesen: false
    })
}
