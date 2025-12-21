// Calendly Webhook Handler
// Verarbeitet Events: invitee.canceled, invitee.created (bei Reschedule)

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const CALENDLY_WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET

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

// Helper: Linked Record ID extrahieren
function getLinkedRecordId(field) {
  if (!field) return null
  if (typeof field === 'string') return field
  if (Array.isArray(field) && field.length > 0) return field[0]
  return null
}

// Helper: Datum formatieren für Anzeige
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
        // Datum löschen + Kommentar setzen
        const grund = cancellationReason 
          ? `Abgesagt von ${canceledBy}: ${cancellationReason}`
          : `Abgesagt von ${canceledBy}`
        
        await updateHotLeadAbsage(hotLead.id, hotLead.originalLeadId, grund)
        console.log('✓ Hot Lead Termin gelöscht:', hotLead.id, hotLead.unternehmen)
        
        // Benachrichtigungen an Setter & Closer senden
        await sendNotifications(hotLead, 'absage', { 
          grund,
          alterTermin: scheduledTime
        })
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
          // Termin aktualisieren + Kommentar setzen
          await updateHotLeadTermin(hotLead.id, newScheduledTime, hotLead.originalLeadId, hotLead.termin)
          console.log('✓ Hot Lead Termin aktualisiert:', hotLead.id, hotLead.unternehmen)
          
          // Benachrichtigungen an Setter & Closer senden
          await sendNotifications(hotLead, 'verschiebung', { 
            neuerTermin: newScheduledTime,
            alterTermin: hotLead.termin
          })
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
        
        // Mehr Daten zurückgeben für Email-Benachrichtigungen
        return {
          id: record.id,
          unternehmen: recordUnternehmen,
          email: getEmailFromField(record.fields.Mail || record.fields['E-Mail']),
          termin: record.fields.Termin_Beratungsgespräch || '',
          setterId: getLinkedRecordId(record.fields.Setter),
          closerId: getLinkedRecordId(record.fields.Closer),
          originalLeadId: getLinkedRecordId(record.fields.Immobilienmakler_Leads),
          ansprechpartner: record.fields.Ansprechpartner || ''
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
// Helper: Hot Lead bei Absage aktualisieren (Datum löschen)
// ==========================================
async function updateHotLeadAbsage(hotLeadId, originalLeadId, grund) {
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  // 1. Datum löschen + Status setzen (Closer bleibt erhalten für Nachverfolgung)
  const hotLeadUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}/${hotLeadId}`
  
  try {
    const response = await fetch(hotLeadUrl, {
      method: 'PATCH',
      headers: airtableHeaders,
      body: JSON.stringify({ 
        fields: {
          'Termin_Beratungsgespräch': null,
          'Status': 'Termin abgesagt'
          // Closer bleibt erhalten damit er ggf. neuen Termin machen kann
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Airtable Hot Lead Update Error:', error)
      return false
    }
    
    console.log('✓ Hot Lead Termin gelöscht')

    // 2. Kommentar im Original-Lead setzen (falls ID vorhanden)
    if (originalLeadId) {
      await updateOriginalLeadKommentar(originalLeadId, `TERMIN ABGESAGT: ${grund}`)
    }

    return true
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Hot Leads:', err)
    return false
  }
}

// ==========================================
// Helper: Hot Lead Termin aktualisieren (bei Verschiebung)
// ==========================================
async function updateHotLeadTermin(hotLeadId, neuerTermin, originalLeadId, alterTermin) {
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Hot_Leads')}/${hotLeadId}`

  try {
    const response = await fetch(TABLE_URL, {
      method: 'PATCH',
      headers: airtableHeaders,
      body: JSON.stringify({ 
        fields: {
          'Termin_Beratungsgespräch': neuerTermin,
          'Status': 'Termin verschoben'
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Airtable Update Error:', error)
      return false
    }

    console.log('✓ Hot Lead Termin aktualisiert')

    // Kommentar im Original-Lead setzen (falls ID vorhanden)
    if (originalLeadId) {
      const kommentar = `TERMIN VERSCHOBEN: ${formatDate(alterTermin)} → ${formatDate(neuerTermin)}`
      await updateOriginalLeadKommentar(originalLeadId, kommentar)
    }

    return true
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Termins:', err)
    return false
  }
}

// ==========================================
// Helper: Kommentar im Original-Lead (Immobilienmakler_Leads) updaten
// ==========================================
async function updateOriginalLeadKommentar(leadId, neuerKommentar) {
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Immobilienmakler_Leads')}/${leadId}`

  try {
    // Erst bestehenden Kommentar laden
    const getResponse = await fetch(TABLE_URL, { headers: airtableHeaders })
    const existingData = await getResponse.json()
    const existingComment = existingData.fields?.Kommentar || ''
    
    // Timestamp hinzufügen
    const timestamp = new Date().toLocaleDateString('de-DE', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    })
    
    // Neuen Kommentar OBEN anhängen (neueste zuerst)
    const newEntry = `[${timestamp}] 📅 ${neuerKommentar}`
    const newComment = existingComment 
      ? `${newEntry}\n${existingComment}`
      : newEntry

    const response = await fetch(TABLE_URL, {
      method: 'PATCH',
      headers: airtableHeaders,
      body: JSON.stringify({ 
        fields: { 'Kommentar': newComment }
      })
    })

    if (response.ok) {
      console.log('✓ Kommentar in Original-Lead aktualisiert')
    }
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Kommentars:', err)
  }
}

// ==========================================
// Helper: User-Daten laden (Name + Email)
// ==========================================
async function loadUserData(userId) {
  if (!userId) return null
  
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Users')}/${userId}`

  try {
    const response = await fetch(TABLE_URL, { headers: airtableHeaders })
    const data = await response.json()
    
    if (response.ok && data.fields) {
      return {
        id: userId,
        name: data.fields.Name || data.fields.Vorname || 'Unbekannt',
        email: data.fields.Email || data.fields['E-Mail'] || ''
      }
    }
  } catch (err) {
    console.error('Fehler beim Laden der User-Daten:', err)
  }
  return null
}

// ==========================================
// Helper: System-Message erstellen
// ==========================================
async function createSystemMessage(empfaengerId, nachricht, typ) {
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('System_Messages')}`

  try {
    const response = await fetch(TABLE_URL, {
      method: 'POST',
      headers: airtableHeaders,
      body: JSON.stringify({
        fields: {
          'Empfänger': empfaengerId ? [empfaengerId] : [],
          'Nachricht': nachricht,
          'Typ': typ || 'Info',
          'Gelesen': false,
          'Erstellt': new Date().toISOString()
        }
      })
    })

    if (response.ok) {
      console.log('✓ System-Message erstellt für:', empfaengerId)
    } else {
      const error = await response.json()
      console.log('System-Message Fehler (evtl. Tabelle existiert nicht):', error.error?.message)
    }
  } catch (err) {
    console.error('Fehler beim Erstellen der System-Message:', err)
  }
}

// ==========================================
// Helper: Benachrichtigungen senden (System-Messages an Setter & Closer)
// ==========================================
async function sendNotifications(hotLead, eventType, details) {
  const { setterId, closerId, unternehmen } = hotLead
  
  let nachricht = ''
  let typ = 'Info'
  
  if (eventType === 'absage') {
    nachricht = `❌ Termin abgesagt: ${unternehmen}\n${details.grund || 'Kein Grund angegeben'}`
    typ = 'Warnung'
  } else if (eventType === 'verschiebung') {
    nachricht = `📅 Termin verschoben: ${unternehmen}\nNeuer Termin: ${formatDate(details.neuerTermin)}`
    typ = 'Info'
  }
  
  // System-Message an Setter
  if (setterId) {
    await createSystemMessage(setterId, nachricht, typ)
  }
  
  // System-Message an Closer (falls vorhanden)
  if (closerId) {
    await createSystemMessage(closerId, nachricht, typ)
  }
  
  console.log('✓ Benachrichtigungen gesendet')
}
