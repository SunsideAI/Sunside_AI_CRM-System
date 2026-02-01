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
    minute: '2-digit'
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

      // Echte Absage - Hot Lead finden
      let hotLead = null
      if (unternehmen) {
        hotLead = await findHotLeadByUnternehmen(unternehmen)
      }
      if (!hotLead && scheduledTime) {
        hotLead = await findHotLeadByTermin(scheduledTime, inviteeEmail)
      }

      if (hotLead) {
        const grund = cancellationReason
          ? `Abgesagt von ${canceledBy}: ${cancellationReason}`
          : `Abgesagt von ${canceledBy}`

        await updateHotLeadAbsage(hotLead.id, hotLead.originalLeadId, grund)
        await sendNotifications(hotLead, 'absage', { grund })
        console.log('Hot Lead Termin geloescht:', hotLead.id)
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

        let hotLead = null
        if (unternehmen) {
          hotLead = await findHotLeadByUnternehmen(unternehmen)
        }
        if (!hotLead && oldScheduledTime) {
          hotLead = await findHotLeadByTermin(oldScheduledTime, inviteeEmail)
        }

        if (hotLead) {
          await updateHotLeadTermin(hotLead.id, newScheduledTime, hotLead.originalLeadId, hotLead.termin)
          await sendNotifications(hotLead, 'verschiebung', { neuerTermin: newScheduledTime, alterTermin: hotLead.termin })
          console.log('Hot Lead Termin aktualisiert:', hotLead.id)
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
    .select('id, unternehmen, termin_datum, setter_id, closer_id, original_lead_id')
    .neq('status', 'Abgesagt')
    .not('termin_datum', 'is', null)

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
        termin: record.termin_datum,
        setterId: record.setter_id,
        closerId: record.closer_id,
        originalLeadId: record.original_lead_id
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
    .select('id, unternehmen, termin_datum, setter_id, closer_id, original_lead_id')
    .neq('status', 'Abgesagt')

  if (error || !hotLeads) return null

  const searchDate = new Date(terminDatum)
  const targetTime = searchDate.getTime()

  for (const record of hotLeads) {
    if (!record.termin_datum) continue

    const recordTime = new Date(record.termin_datum).getTime()
    const timeDiff = Math.abs(recordTime - targetTime)

    if (timeDiff < 10 * 60 * 1000) {
      console.log('Zeit-Match gefunden:', record.unternehmen)
      return {
        id: record.id,
        unternehmen: record.unternehmen,
        termin: record.termin_datum,
        setterId: record.setter_id,
        closerId: record.closer_id,
        originalLeadId: record.original_lead_id
      }
    }
  }

  return null
}

// Hot Lead bei Absage aktualisieren
async function updateHotLeadAbsage(hotLeadId, originalLeadId, grund) {
  console.log('Aktualisiere Hot Lead Absage:', { hotLeadId, originalLeadId })

  const { error } = await supabase
    .from('hot_leads')
    .update({ termin_datum: null, status: 'Termin abgesagt' })
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
    .update({ termin_datum: neuerTermin, status: 'Termin verschoben' })
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
    hour: '2-digit', minute: '2-digit'
  })

  const newEntry = `[${timestamp}] ${neuerKommentar}`
  const newComment = existingComment ? `${newEntry}\n${existingComment}` : newEntry

  await supabase
    .from('leads')
    .update({ kommentar: newComment })
    .eq('id', leadId)
}

// System-Messages an Setter & Closer senden
async function sendNotifications(hotLead, eventType, details) {
  const { setterId, closerId, unternehmen } = hotLead

  let nachricht = ''
  let typ = 'Info'
  let titel = ''

  if (eventType === 'absage') {
    titel = 'Termin abgesagt'
    nachricht = `Termin abgesagt: ${unternehmen}\n${details.grund || 'Kein Grund angegeben'}`
    typ = 'Termin abgesagt'
  } else if (eventType === 'verschiebung') {
    titel = 'Termin verschoben'
    nachricht = `Termin verschoben: ${unternehmen}\nNeuer Termin: ${formatDate(details.neuerTermin)}`
    typ = 'Termin verschoben'
  }

  // System-Message an Setter
  if (setterId) {
    await createSystemMessage(setterId, titel, nachricht, typ, hotLead.id)
  }

  // System-Message an Closer
  if (closerId) {
    await createSystemMessage(closerId, titel, nachricht, typ, hotLead.id)
  }

  console.log('Benachrichtigungen gesendet')
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
