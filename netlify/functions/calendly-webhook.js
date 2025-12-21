// Calendly Webhook Handler
// Verarbeitet Events: invitee.canceled, invitee.created (bei Reschedule)

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const CALENDLY_WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET // Optional für Signatur-Verifizierung

// Helper: Email aus Airtable-Feld extrahieren (kann String oder Array sein)
function getEmailFromField(field) {
  if (!field) return ''
  if (typeof field === 'string') return field.toLowerCase()
  if (Array.isArray(field) && field.length > 0) return String(field[0]).toLowerCase()
  return ''
}

// Helper: Unternehmen aus Airtable-Feld extrahieren (kann String oder Array sein)
function getUnternehmenFromField(field) {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (Array.isArray(field) && field.length > 0) return String(field[0])
  return ''
}

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
      
      // Unternehmensname aus questions_and_answers extrahieren
      const questionsAndAnswers = data.questions_and_answers || []
      const unternehmensAnswer = questionsAndAnswers.find(q => 
        q.question?.toLowerCase().includes('unternehmen') || 
        q.question?.toLowerCase().includes('company')
      )
      const unternehmen = unternehmensAnswer?.answer || ''
      
      // WICHTIG: Bei Reschedule wird rescheduled=true gesetzt
      // In dem Fall NICHT als "Abgesagt" markieren!
      const isReschedule = data.rescheduled === true
      
      console.log('Cancel Event Details:', {
        email: inviteeEmail,
        name: inviteeName,
        unternehmen,
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
      
      // Erst über Unternehmen suchen, dann Fallback über Zeit
      let hotLead = null
      if (unternehmen) {
        hotLead = await findHotLeadByUnternehmen(unternehmen)
      }
      if (!hotLead && scheduledTime) {
        console.log('→ Fallback: Suche über Termin-Zeit...')
        hotLead = await findHotLeadByTermin(scheduledTime, inviteeEmail)
      }
      
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
      
      // Unternehmensname aus questions_and_answers extrahieren
      const questionsAndAnswers = data.questions_and_answers || []
      const unternehmensAnswer = questionsAndAnswers.find(q => 
        q.question?.toLowerCase().includes('unternehmen') || 
        q.question?.toLowerCase().includes('company')
      )
      const unternehmen = unternehmensAnswer?.answer || ''
      
      // old_invitee enthält die Daten des alten Termins bei Reschedule
      const oldInvitee = data.old_invitee
      const isReschedule = !!oldInvitee
      
      // Vollständiges old_invitee loggen um Struktur zu sehen
      console.log('Created Event Details:', {
        email: inviteeEmail,
        name: inviteeName,
        unternehmen,
        newTime: newScheduledTime,
        isReschedule,
        oldInvitee_full: oldInvitee
      })

      if (isReschedule) {
        // Verschiedene mögliche Pfade für die alte Zeit
        const oldScheduledTime = oldInvitee.scheduled_event?.start_time 
          || oldInvitee.start_time 
          || oldInvitee.event?.start_time
        
        console.log('→ Verschiebung erkannt:', oldScheduledTime, '→', newScheduledTime)
        console.log('→ Suche mit Unternehmen:', unternehmen)
        
        // Hot Lead finden - über Unternehmen (zuverlässigster Weg)
        let hotLead = null
        
        if (unternehmen) {
          hotLead = await findHotLeadByUnternehmen(unternehmen)
        }
        
        // Fallback: Über alte Zeit suchen
        if (!hotLead && oldScheduledTime) {
          console.log('→ Fallback: Suche über Termin-Zeit...')
          hotLead = await findHotLeadByTermin(oldScheduledTime, inviteeEmail)
        }
        
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

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}`

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
          email: getEmailFromField(record.fields.Mail || record.fields['E-Mail'])
        }
      }
    }

    // 2. Falls keine Zeit-Match, nach Email suchen (am gleichen Tag)
    if (email) {
      const searchDateStr = searchDate.toISOString().split('T')[0]
      
      for (const record of data.records) {
        const recordEmail = getEmailFromField(record.fields.Mail || record.fields['E-Mail'])
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

// ==========================================
// Helper: Hot Lead anhand Email finden (Fallback)
// ==========================================
async function findHotLeadByEmail(email) {
  if (!email) {
    console.log('findHotLeadByEmail: Keine Email übergeben')
    return null
  }

  console.log('findHotLeadByEmail: Suche nach', email)

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}`

  try {
    // Hot Leads laden die nicht abgesagt sind und einen Termin haben
    const filterFormula = `AND({Status} != "Abgesagt", {Termin_Beratungsgespräch} != "")`
    
    const response = await fetch(
      `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`,
      { headers: airtableHeaders }
    )

    const data = await response.json()

    if (!response.ok || !data.records || data.records.length === 0) {
      console.log('Keine Hot Leads gefunden')
      return null
    }

    console.log(`${data.records.length} Hot Leads geladen, suche Email-Match...`)

    // Nach Email suchen
    for (const record of data.records) {
      const recordEmail = getEmailFromField(record.fields.Mail || record.fields['E-Mail'])
      
      if (recordEmail === email.toLowerCase()) {
        console.log(`✓ Email-Match gefunden: ${record.fields.Unternehmen}`)
        return {
          id: record.id,
          unternehmen: record.fields.Unternehmen,
          email: recordEmail
        }
      }
    }

    console.log('✗ Kein Email-Match gefunden')
    return null
    
  } catch (err) {
    console.error('Fehler beim Suchen des Hot Leads via Email:', err)
    return null
  }
}

// ==========================================
// Helper: Hot Lead anhand Unternehmen finden
// ==========================================
async function findHotLeadByUnternehmen(unternehmen) {
  if (!unternehmen) {
    console.log('findHotLeadByUnternehmen: Kein Unternehmen übergeben')
    return null
  }

  console.log('findHotLeadByUnternehmen: Suche nach', unternehmen)

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}`

  try {
    // Alle Hot Leads mit Termin laden (nicht abgesagt)
    const filterFormula = `AND({Status} != "Abgesagt", {Termin_Beratungsgespräch} != "")`
    
    let allRecords = []
    let offset = null
    
    // Pagination: Alle Records laden
    do {
      const url = offset 
        ? `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&offset=${offset}`
        : `${TABLE_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`
      
      const response = await fetch(url, { headers: airtableHeaders })
      const data = await response.json()
      
      if (!response.ok) {
        console.log('Airtable Error:', data)
        return null
      }
      
      if (data.records) {
        allRecords = allRecords.concat(data.records)
      }
      offset = data.offset
    } while (offset)

    console.log(`${allRecords.length} Hot Leads geladen, suche Unternehmens-Match...`)

    // Nach Unternehmen suchen
    const searchTerm = unternehmen.toLowerCase().trim()
    
    for (const record of allRecords) {
      // Unternehmen kann String oder Array sein
      const recordUnternehmen = getUnternehmenFromField(record.fields.Unternehmen)
      const recordUnternehmenLower = recordUnternehmen.toLowerCase().trim()
      
      // Debug: Erste paar loggen
      if (allRecords.indexOf(record) < 3) {
        console.log(`  Record ${record.id}: "${recordUnternehmen}"`)
      }
      
      // Match prüfen
      if (recordUnternehmenLower === searchTerm || 
          recordUnternehmenLower.includes(searchTerm) || 
          searchTerm.includes(recordUnternehmenLower)) {
        console.log(`✓ Unternehmens-Match gefunden: ${recordUnternehmen}`)
        return {
          id: record.id,
          unternehmen: recordUnternehmen,
          email: getEmailFromField(record.fields.Mail || record.fields['E-Mail'])
        }
      }
    }

    console.log('✗ Kein Unternehmens-Match gefunden für:', searchTerm)
    return null
    
  } catch (err) {
    console.error('Fehler beim Suchen des Hot Leads via Unternehmen:', err)
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

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}/${hotLeadId}`

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

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}/${hotLeadId}`

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
