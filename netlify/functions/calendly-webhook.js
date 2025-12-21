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
    
    console.log('=== Calendly Webhook received ===')
    console.log('Event:', payload.event)
    console.log('Payload:', JSON.stringify(payload.payload, null, 2))

    const eventType = payload.event
    const data = payload.payload

    // ==========================================
    // Event: invitee.canceled (Termin abgesagt ODER verschoben)
    // ==========================================
    if (eventType === 'invitee.canceled') {
      const inviteeEmail = data.email
      const inviteeName = data.name
      const scheduledTime = data.scheduled_event?.start_time
      const cancellation = data.cancellation || {}
      const canceledBy = cancellation.canceled_by || 'Unbekannt'
      const cancellationReason = cancellation.reason || ''
      
      // WICHTIG: Bei Reschedule wird rescheduled=true gesetzt
      // In dem Fall NICHT als "Abgesagt" markieren!
      const isReschedule = data.rescheduled === true
      
      console.log('Cancel Event Details:', {
        email: inviteeEmail,
        name: inviteeName,
        time: scheduledTime,
        isReschedule,
        canceledBy,
        reason: cancellationReason
      })

      if (isReschedule) {
        // Bei Verschiebung: Nur loggen, das Update kommt mit invitee.created
        console.log('→ Ist Reschedule, warte auf invitee.created Event')
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            success: true, 
            message: 'Reschedule erkannt - warte auf neuen Termin'
          })
        }
      }

      // Echte Absage - Hot Lead finden und Status setzen
      console.log('→ Echte Absage, suche Hot Lead...')
      const hotLead = await findHotLeadByTermin(scheduledTime, inviteeEmail)
      
      if (hotLead) {
        await updateHotLeadStatus(hotLead.id, 'Abgesagt', `Abgesagt von ${canceledBy}: ${cancellationReason}`)
        console.log('✓ Hot Lead auf Abgesagt gesetzt:', hotLead.id, hotLead.unternehmen)
      } else {
        console.log('✗ Kein passender Hot Lead gefunden')
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
      const newScheduledTime = data.scheduled_event?.start_time
      const eventUri = data.scheduled_event?.uri
      
      // old_invitee enthält die Daten des alten Termins bei Reschedule
      const oldInvitee = data.old_invitee
      const isReschedule = !!oldInvitee
      
      console.log('Created Event Details:', {
        email: inviteeEmail,
        name: inviteeName,
        newTime: newScheduledTime,
        isReschedule,
        oldInvitee: oldInvitee ? {
          email: oldInvitee.email,
          oldTime: oldInvitee.scheduled_event?.start_time
        } : null
      })

      if (isReschedule) {
        const oldScheduledTime = oldInvitee.scheduled_event?.start_time
        const oldEmail = oldInvitee.email
        
        console.log('→ Verschiebung erkannt:', oldScheduledTime, '→', newScheduledTime)
        
        // Hot Lead anhand des ALTEN Termins finden
        const hotLead = await findHotLeadByTermin(oldScheduledTime, oldEmail || inviteeEmail)
        
        if (hotLead) {
          await updateHotLeadTermin(hotLead.id, newScheduledTime)
          console.log('✓ Hot Lead Termin aktualisiert:', hotLead.id, hotLead.unternehmen)
        } else {
          console.log('✗ Kein passender Hot Lead für Verschiebung gefunden')
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            success: true, 
            message: 'Verschiebung verarbeitet',
            hotLeadId: hotLead?.id || null,
            newTime: newScheduledTime
          })
        }
      }

      // Normale neue Buchung (wird schon vom TerminPicker behandelt)
      console.log('→ Neue Buchung (wird von CRM/TerminPicker behandelt)')
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          message: 'Neue Buchung - wird vom CRM behandelt'
        })
      }
    }

    // Unbekanntes Event
    console.log('→ Unbekanntes Event ignoriert:', eventType)
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
  if (!terminDatum) {
    console.log('findHotLeadByTermin: Kein terminDatum übergeben')
    return null
  }

  console.log('findHotLeadByTermin: Suche nach', { terminDatum, email })

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Hot_Leads')}`

  try {
    // Alle Hot Leads laden (nicht abgesagte)
    const filterFormula = `{Status} != "Abgesagt"`
    
    const response = await fetch(
      `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`,
      { headers: airtableHeaders }
    )

    const data = await response.json()

    if (!response.ok) {
      console.log('Airtable Error:', data)
      return null
    }

    if (!data.records || data.records.length === 0) {
      console.log('Keine Hot Leads gefunden')
      return null
    }

    console.log(`${data.records.length} Hot Leads geladen, suche Match...`)

    // Suche nach bestem Match
    const searchDate = new Date(terminDatum)
    const targetTime = searchDate.getTime()
    
    // 1. Erst nach exakter Zeit suchen (±10 Minuten Toleranz)
    for (const record of data.records) {
      const recordTermin = record.fields.Termin_Beratungsgespräch || record.fields['Termin_Beratungsgespräch']
      if (!recordTermin) continue
      
      const recordTime = new Date(recordTermin).getTime()
      const timeDiff = Math.abs(recordTime - targetTime)
      
      if (timeDiff < 10 * 60 * 1000) { // 10 Minuten Toleranz
        console.log(`✓ Zeit-Match gefunden: ${record.fields.Unternehmen} (Diff: ${Math.round(timeDiff/1000)}s)`)
        return {
          id: record.id,
          unternehmen: record.fields.Unternehmen,
          email: record.fields.Mail || record.fields['E-Mail'] || ''
        }
      }
    }

    // 2. Falls keine Zeit-Match, nach Email suchen (am gleichen Tag)
    if (email) {
      const searchDateStr = searchDate.toISOString().split('T')[0]
      
      for (const record of data.records) {
        const recordEmail = (record.fields.Mail || record.fields['E-Mail'] || '').toLowerCase()
        const recordTermin = record.fields.Termin_Beratungsgespräch || record.fields['Termin_Beratungsgespräch']
        
        if (recordEmail === email.toLowerCase() && recordTermin) {
          const recordDateStr = new Date(recordTermin).toISOString().split('T')[0]
          
          if (recordDateStr === searchDateStr) {
            console.log(`✓ Email+Tag-Match gefunden: ${record.fields.Unternehmen}`)
            return {
              id: record.id,
              unternehmen: record.fields.Unternehmen,
              email: recordEmail
            }
          }
        }
      }
    }

    console.log('✗ Kein Match gefunden')
    return null
    
  } catch (err) {
    console.error('Fehler beim Suchen des Hot Leads:', err)
    return null
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
