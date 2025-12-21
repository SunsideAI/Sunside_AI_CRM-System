// Calendly Webhook Handler
// Verarbeitet Events: invitee.canceled, invitee.created (bei Reschedule)

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const CALENDLY_WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET // Optional für Signatur-Verifizierung

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Calendly-Webhook-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  // Nur POST erlauben
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const payload = JSON.parse(event.body)
    
    console.log('Calendly Webhook received:', {
      event: payload.event,
      createdAt: payload.created_at,
      payload: JSON.stringify(payload.payload, null, 2)
    })

    const eventType = payload.event
    const data = payload.payload

    // ==========================================
    // Event: invitee.canceled (Termin abgesagt)
    // ==========================================
    if (eventType === 'invitee.canceled') {
      const inviteeEmail = data.email
      const eventName = data.event_type?.name || 'Unbekannt'
      const scheduledTime = data.scheduled_event?.start_time
      const cancellationReason = data.cancellation?.reason || 'Keine Angabe'
      const canceledBy = data.cancellation?.canceled_by || 'Unbekannt'
      
      console.log('Termin abgesagt:', {
        email: inviteeEmail,
        event: eventName,
        time: scheduledTime,
        reason: cancellationReason,
        canceledBy
      })

      // Hot Lead in Airtable finden und Status auf "Abgesagt" setzen
      const hotLead = await findHotLeadByTermin(scheduledTime, inviteeEmail)
      
      if (hotLead) {
        await updateHotLeadStatus(hotLead.id, 'Abgesagt', `Abgesagt: ${cancellationReason}`)
        console.log('Hot Lead Status aktualisiert:', hotLead.id)
      } else {
        console.log('Kein passender Hot Lead gefunden für:', scheduledTime, inviteeEmail)
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          message: 'Absage verarbeitet',
          hotLeadId: hotLead?.id || null
        })
      }
    }

    // ==========================================
    // Event: invitee.created (Neuer Termin / Reschedule)
    // ==========================================
    if (eventType === 'invitee.created') {
      const inviteeEmail = data.email
      const inviteeName = data.name
      const scheduledTime = data.scheduled_event?.start_time
      const eventName = data.event_type?.name || 'Unbekannt'
      
      // Prüfen ob es ein Reschedule ist (durch Rescheduled-Flag oder alte Buchung)
      const isReschedule = data.rescheduled || data.old_invitee
      
      if (isReschedule) {
        const oldTime = data.old_invitee?.scheduled_event?.start_time
        
        console.log('Termin verschoben:', {
          email: inviteeEmail,
          oldTime,
          newTime: scheduledTime
        })

        // Hot Lead finden und Termin aktualisieren
        const hotLead = await findHotLeadByTermin(oldTime, inviteeEmail)
        
        if (hotLead) {
          await updateHotLeadTermin(hotLead.id, scheduledTime, 'Verschoben')
          console.log('Hot Lead Termin aktualisiert:', hotLead.id)
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            success: true, 
            message: 'Verschiebung verarbeitet',
            hotLeadId: hotLead?.id || null
          })
        }
      }

      // Normale neue Buchung (wird schon vom TerminPicker behandelt)
      console.log('Neue Buchung (wird von TerminPicker behandelt):', inviteeName, scheduledTime)
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'Neue Buchung ignoriert (wird vom CRM behandelt)' })
      }
    }

    // Unbekanntes Event
    console.log('Unbekanntes Calendly Event:', eventType)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Event ignoriert', event: eventType })
    }

  } catch (err) {
    console.error('Calendly Webhook Error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    }
  }
}

// ==========================================
// Helper: Hot Lead anhand Termin-Zeit und Email finden
// ==========================================
async function findHotLeadByTermin(terminDatum, email) {
  if (!terminDatum) return null

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Hot_Leads')}`

  try {
    // Termin-Datum formatieren für Vergleich (nur Datum + Stunde)
    const searchDate = new Date(terminDatum)
    const dateStr = searchDate.toISOString().split('T')[0]
    
    // Filter: Termin am gleichen Tag
    const filterFormula = `AND(
      IS_SAME({Termin_Beratungsgespräch}, "${dateStr}", "day"),
      {Status} != "Abgesagt"
    )`

    const response = await fetch(
      `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`,
      { headers: airtableHeaders }
    )

    const data = await response.json()

    if (!response.ok || !data.records || data.records.length === 0) {
      return null
    }

    // Besten Match finden (gleiche Uhrzeit und/oder Email)
    const targetTime = searchDate.getTime()
    
    for (const record of data.records) {
      const recordTime = new Date(record.fields.Termin_Beratungsgespräch).getTime()
      const recordEmail = record.fields.Mail || record.fields['E-Mail'] || ''
      
      // Exakte Zeit-Match (±5 Minuten Toleranz)
      const timeDiff = Math.abs(recordTime - targetTime)
      if (timeDiff < 5 * 60 * 1000) {
        return {
          id: record.id,
          unternehmen: record.fields.Unternehmen,
          email: recordEmail
        }
      }
      
      // Email-Match als Fallback
      if (email && recordEmail.toLowerCase() === email.toLowerCase()) {
        return {
          id: record.id,
          unternehmen: record.fields.Unternehmen,
          email: recordEmail
        }
      }
    }

    return null
  } catch (err) {
    console.error('Fehler beim Suchen des Hot Leads:', err)
    return null
  }
}

// ==========================================
// Helper: Hot Lead Status aktualisieren
// ==========================================
async function updateHotLeadStatus(hotLeadId, status, kommentar) {
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Hot_Leads')}/${hotLeadId}`

  const fields = {
    'Status': status
  }

  // Optional: Kommentar anhängen (falls Feld existiert)
  // fields['Absagegrund'] = kommentar

  try {
    const response = await fetch(TABLE_URL, {
      method: 'PATCH',
      headers: airtableHeaders,
      body: JSON.stringify({ fields })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Airtable Update Error:', error)
    }

    return response.ok
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Hot Leads:', err)
    return false
  }
}

// ==========================================
// Helper: Hot Lead Termin aktualisieren (bei Verschiebung)
// ==========================================
async function updateHotLeadTermin(hotLeadId, neuerTermin, notiz) {
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Hot_Leads')}/${hotLeadId}`

  const fields = {
    'Termin_Beratungsgespräch': neuerTermin
    // Optional: 'Notiz': notiz
  }

  try {
    const response = await fetch(TABLE_URL, {
      method: 'PATCH',
      headers: airtableHeaders,
      body: JSON.stringify({ fields })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Airtable Update Error:', error)
    }

    return response.ok
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Termins:', err)
    return false
  }
}
