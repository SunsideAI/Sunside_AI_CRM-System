// Hot Leads API
// GET: Hot Leads laden (für Closing-Seite und Dashboard)
// POST: Neuen Hot Lead erstellen (bei Termin-Buchung)
// PATCH: Hot Lead aktualisieren (Status, Deal-Werte)

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = 'Immobilienmakler_Hot_Leads'
const USER_TABLE_NAME = 'User_Datenbank'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
}

// Cache für User-Namen (Record-ID -> Name)
let userNameCache = null
let userNameCacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 Minuten

async function loadUserNames(airtableHeaders) {
  // Cache prüfen
  if (userNameCache && (Date.now() - userNameCacheTime) < CACHE_DURATION) {
    return userNameCache
  }

  const USER_TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(USER_TABLE_NAME)}`
  
  try {
    const response = await fetch(`${USER_TABLE_URL}?fields[]=Vor_Nachname`, {
      headers: airtableHeaders
    })
    
    if (!response.ok) {
      console.error('User-Namen laden fehlgeschlagen:', response.status)
      return {}
    }
    
    const data = await response.json()
    const nameMap = {}
    
    for (const record of data.records) {
      nameMap[record.id] = record.fields.Vor_Nachname || record.id
    }
    
    // Cache aktualisieren
    userNameCache = nameMap
    userNameCacheTime = Date.now()
    
    console.log('User-Namen geladen:', Object.keys(nameMap).length, 'User')
    return nameMap
  } catch (err) {
    console.error('Fehler beim Laden der User-Namen:', err)
    return {}
  }
}

// Helper: Record-ID zu Name auflösen
function resolveUserName(field, userNames) {
  if (!field) return ''
  if (typeof field === 'string') {
    // Prüfen ob es eine Record-ID ist (beginnt mit "rec")
    if (field.startsWith('rec') && userNames[field]) {
      return userNames[field]
    }
    return field // Bereits ein Name
  }
  if (Array.isArray(field) && field.length > 0) {
    const id = field[0]
    return userNames[id] || id
  }
  return ''
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Airtable nicht konfiguriert' })
    }
  }

  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  const TABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`

  try {
    // ==========================================
    // GET: Hot Leads laden
    // ==========================================
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const { setterId, closerId, setterName, closerName, status, limit, pool } = params

      console.log('Hot Leads GET - Params:', { setterId, closerId, setterName, closerName, status, limit, pool })

      let allRecords = []
      let offset = null

      do {
        let url = TABLE_URL
        const queryParams = []
        
        if (offset) {
          queryParams.push(`offset=${offset}`)
        }

        // Filter bauen
        const filters = []
        
        // Pool-Filter: Termine ohne Closer (offene Termine für Closer-Pool)
        if (pool === 'true') {
          filters.push(`OR({Closer} = '', {Closer} = BLANK())`)
        }
        
        // Setter-Filter: Unterstützt Text-Felder UND Linked Records
        if (setterName) {
          // OR-Kombination: Suche im Text-Feld ODER im Linked Record Namen
          filters.push(`OR(FIND("${setterName}", {Setter}), FIND("${setterName}", ARRAYJOIN({Setter}, ",")))`)
        } else if (setterId) {
          // Nach ID filtern (für zukünftige Daten mit Link-Feldern)
          filters.push(`FIND("${setterId}", ARRAYJOIN({Setter}, ","))`)
        }
        
        // Closer-Filter: Unterstützt Text-Felder UND Linked Records
        if (closerName) {
          // OR-Kombination: Suche im Text-Feld ODER im Linked Record Namen
          filters.push(`OR(FIND("${closerName}", {Closer}), FIND("${closerName}", ARRAYJOIN({Closer}, ",")))`)
        } else if (closerId) {
          filters.push(`FIND("${closerId}", ARRAYJOIN({Closer}, ","))`)
        }
        
        if (status) {
          // Mehrere Status mit Komma getrennt möglich: "Geplant,Im Closing"
          const statusList = status.split(',').map(s => `{Status}="${s.trim()}"`).join(',')
          filters.push(`OR(${statusList})`)
        }

        if (filters.length > 0) {
          const formula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`
          queryParams.push(`filterByFormula=${encodeURIComponent(formula)}`)
          console.log('Hot Leads GET - Filter Formula:', formula)
        }

        // Sortierung: Nach Unternehmen (existierendes Feld)
        // Hinweis: "Hinzugefügt" Feld existiert nicht in dieser Tabelle
        queryParams.push('sort[0][field]=Unternehmen&sort[0][direction]=asc')

        if (limit) {
          queryParams.push(`maxRecords=${limit}`)
        }

        if (queryParams.length > 0) {
          url += '?' + queryParams.join('&')
        }

        console.log('Hot Leads GET - Airtable URL:', url.substring(0, 200) + '...')

        const response = await fetch(url, { headers: airtableHeaders })
        
        if (!response.ok) {
          const error = await response.json()
          console.error('Hot Leads GET - Airtable Error:', error)
          throw new Error(error.error?.message || 'Fehler beim Laden der Hot Leads')
        }

        const data = await response.json()
        allRecords = allRecords.concat(data.records || [])
        offset = data.offset
        
        console.log('Hot Leads GET - Batch geladen:', data.records?.length || 0, 'Records, Total bisher:', allRecords.length)

        // Bei limit: Nicht paginieren
        if (limit) break

      } while (offset)

      console.log('Hot Leads GET - Gesamt gefunden:', allRecords.length, 'Records')

      // User-Namen laden für ID -> Name Auflösung
      const userNames = await loadUserNames(airtableHeaders)

      // Records formatieren
      const hotLeads = allRecords.map(record => {
        // Helper für Lookup-Felder (Arrays zu String)
        const getLookupValue = (field) => {
          if (Array.isArray(field)) return field[0] || ''
          return field || ''
        }
        
        return {
          id: record.id,
          unternehmen: getLookupValue(record.fields.Unternehmen),
          ansprechpartnerVorname: getLookupValue(record.fields.Ansprechpartner_Vorname),
          ansprechpartnerNachname: getLookupValue(record.fields.Ansprechpartner_Nachname),
          kategorie: getLookupValue(record.fields.Kategorie),
          // Feldnamen aus Airtable: "Mail" und "Telefonnummer"
          email: getLookupValue(record.fields.Mail || record.fields['E-Mail']),
          telefon: getLookupValue(record.fields.Telefonnummer || record.fields.Telefon),
          ort: getLookupValue(record.fields.Ort),
          bundesland: getLookupValue(record.fields.Bundesland),
          website: getLookupValue(record.fields.Website),
          terminDatum: record.fields.Termin_Beratungsgespräch || record.fields['Termin_Beratungsgespräch'] || '',
          terminart: record.fields.Terminart || '',  // Video oder Telefonisch
          meetingLink: record.fields.Meeting_Link || '',  // Google Meet Link
          status: record.fields.Status || 'Lead',
          quelle: record.fields.Quelle || '',
          prioritaet: record.fields.Priorität || record.fields.Prioritaet || '',
          setup: record.fields.Setup || 0,
          retainer: record.fields.Retainer || 0,
          laufzeit: record.fields.Laufzeit || 0,
          monatlicheBesuche: record.fields.Monatliche_Besuche || 0,
          mehrwert: record.fields.Mehrwert || 0,
          absprungrate: record.fields.Absprungrate || null,
          anzahlLeads: record.fields.Anzahl_Leads || null,
          produktDienstleistung: record.fields.Produkt_Dienstleistung || [],
          kommentar: getLookupValue(record.fields.Kommentar),  // Lookup aus Immobilienmakler_Leads
          kundeSeit: record.fields['Kunde seit'] || record.fields.Kunde_seit || '',
          // Attachments (PDFs, Dokumente)
          attachments: (record.fields.Attachments || []).map(att => ({
            id: att.id,
            url: att.url,
            filename: att.filename,
            size: att.size,
            type: att.type
          })),
          // Verknüpfungen
          originalLeadId: record.fields.Immobilienmakler_Leads?.[0] || null,
          // Setter/Closer: Record-IDs UND Namen
          setterId: record.fields.Setter?.[0] || null,
          closerId: record.fields.Closer?.[0] || null,
          setterName: resolveUserName(record.fields.Setter, userNames),
          closerName: resolveUserName(record.fields.Closer, userNames)
        }
      })

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ hotLeads })
      }
    }

    // ==========================================
    // POST: Neuen Hot Lead erstellen ODER Closer-Leads freigeben
    // ==========================================
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      
      // ==========================================
      // ACTION: release-closer-leads - Alle Hot Leads eines Closers in Pool zurückgeben
      // ==========================================
      if (body.action === 'release-closer-leads') {
        const { closerId, closerName } = body
        
        if (!closerId && !closerName) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'closerId oder closerName ist erforderlich' })
          }
        }
        
        console.log('Release Closer Leads:', { closerId, closerName })
        
        // User-Namen laden für ID-Auflösung
        const userNames = await loadUserNames(airtableHeaders)
        
        // Name → ID Mapping und umgekehrt
        let targetCloserId = closerId
        let targetCloserName = closerName
        
        if (!targetCloserId && closerName) {
          for (const [id, name] of Object.entries(userNames)) {
            if (name.toLowerCase() === closerName.toLowerCase()) {
              targetCloserId = id
              break
            }
          }
        }
        
        if (targetCloserId && !targetCloserName) {
          targetCloserName = userNames[targetCloserId] || 'Unbekannt'
        }
        
        if (!targetCloserId) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Closer nicht gefunden' })
          }
        }
        
        console.log('Target Closer:', { targetCloserId, targetCloserName })
        
        // ALLE Hot Leads laden (ohne Filter - robuster bei Link-Feldern)
        let allRecords = []
        let offset = null
        
        do {
          let url = TABLE_URL
          if (offset) url += `?offset=${offset}`
          
          const response = await fetch(url, { headers: airtableHeaders })
          const data = await response.json()
          
          if (data.records) {
            allRecords = allRecords.concat(data.records)
          }
          offset = data.offset
        } while (offset)
        
        console.log(`${allRecords.length} Hot Leads total geladen`)
        
        // Im Code filtern: Hot Leads die dem Closer zugewiesen sind
        const closerLeads = allRecords.filter(record => {
          const closerField = record.fields.Closer || []
          const closerIds = Array.isArray(closerField) ? closerField : [closerField]
          return closerIds.includes(targetCloserId)
        })
        
        console.log(`${closerLeads.length} Hot Leads gefunden für Closer ${targetCloserName}`)
        
        if (closerLeads.length === 0) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              success: true,
              message: 'Keine Hot Leads zum Freigeben gefunden',
              released: 0,
              total: 0
            })
          }
        }
        
        // Closer-Feld leeren (in Batches von 10)
        let releasedCount = 0
        const releasedLeads = [] // Für Benachrichtigung
        
        for (let i = 0; i < closerLeads.length; i += 10) {
          const batch = closerLeads.slice(i, i + 10)
          
          const updateRecords = batch.map(record => ({
            id: record.id,
            fields: {
              'Closer': [] // Closer entfernen = zurück in Pool
            }
          }))
          
          const updateResponse = await fetch(TABLE_URL, {
            method: 'PATCH',
            headers: airtableHeaders,
            body: JSON.stringify({ records: updateRecords })
          })
          
          if (updateResponse.ok) {
            releasedCount += batch.length
            // Lead-Infos für Benachrichtigung sammeln
            batch.forEach(record => {
              releasedLeads.push({
                unternehmen: resolveUserName(record.fields.Unternehmen, {}) || record.fields.Unternehmen || 'Unbekannt',
                terminDatum: record.fields.Termin_Datum
              })
            })
          } else {
            const error = await updateResponse.json()
            console.error('Release-Fehler:', error)
          }
        }
        
        console.log(`${releasedCount} Hot Leads in Pool freigegeben`)
        
        // Email-Benachrichtigung an alle aktiven Closer senden
        if (releasedCount > 0) {
          try {
            // Aktive Closer aus User_Datenbank laden
            const userTableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User_Datenbank')}`
            const usersResponse = await fetch(userTableUrl, { headers: airtableHeaders })
            const usersData = await usersResponse.json()
            
            const activeClosers = (usersData.records || []).filter(user => {
              const status = user.fields.Status
              const rolle = user.fields.Rolle || []
              const isActive = status === true || status === 'true'
              const isCloser = rolle.some(r => 
                r.toLowerCase().includes('closer') || r.toLowerCase() === 'admin'
              )
              // Nicht den deaktivierten Closer benachrichtigen
              const isNotDeactivated = user.id !== targetCloserId
              return isActive && isCloser && isNotDeactivated && user.fields.Mail
            })
            
            console.log(`${activeClosers.length} aktive Closer für Benachrichtigung gefunden`)
            
            // Email an jeden aktiven Closer senden
            for (const closer of activeClosers) {
              const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🔄 Neue Leads im Pool</h1>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
        <strong>${targetCloserName}</strong> wurde deaktiviert. 
        <strong style="color: #3B82F6;">${releasedCount} Beratungsgespräche</strong> sind jetzt im Closer-Pool verfügbar.
      </p>
      
      <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; text-transform: uppercase;">Freigegebene Termine:</h3>
        ${releasedLeads.slice(0, 10).map(lead => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
            <span style="color: #374151; font-weight: 500;">${lead.unternehmen}</span>
            <span style="color: #6B7280;">${lead.terminDatum ? new Date(lead.terminDatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Kein Termin'}</span>
          </div>
        `).join('')}
        ${releasedLeads.length > 10 ? `<p style="color: #6B7280; font-size: 14px; margin: 10px 0 0 0;">... und ${releasedLeads.length - 10} weitere</p>` : ''}
      </div>
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="https://crm.sunside.ai/closing" 
           style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Zum Closer-Pool →
        </a>
      </div>
      
      <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 30px; margin-bottom: 0;">
        Sunside AI CRM System
      </p>
    </div>
  </div>
</body>
</html>`

              // Email senden via send-email Funktion
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'Sunside AI <noreply@sunside.ai>',
                  to: closer.fields.Mail,
                  subject: `🔄 ${releasedCount} neue Leads im Closer-Pool`,
                  html: emailHtml
                })
              })
              
              console.log(`Pool-Benachrichtigung gesendet an: ${closer.fields.Mail}`)
            }
          } catch (emailError) {
            console.error('Fehler beim Senden der Pool-Benachrichtigung:', emailError)
            // Fehler nicht werfen - Hauptfunktion war erfolgreich
          }
        }
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: `${releasedCount} Hot Leads in Pool freigegeben`,
            released: releasedCount,
            total: closerLeads.length,
            closerName: targetCloserName
          })
        }
      }
      
      // ==========================================
      // Standard POST: Neuen Hot Lead erstellen
      // ==========================================
      const {
        originalLeadId,     // Link zu Immobilienmakler_Leads
        setterName,         // Name des Setters (Text)
        closerName,         // Name des Closers (Text) - optional für Pool
        setterId,           // Optional: Record-ID des Setters
        closerId,           // Optional: Record-ID des Closers
        unternehmen,        // Firmenname
        terminDatum,        // Termin-Zeitpunkt
        terminart,          // 'Video' oder 'Telefonisch'
        quelle,             // z.B. "Cold Calling"
        infosErstgespraech, // Notizen vom Setter (Problemstellung etc.)
        meetingLink         // Google Meet Link für Video-Termine
      } = body

      console.log('Hot Lead POST - Input:', { 
        originalLeadId, 
        setterName, 
        closerName, 
        setterId, 
        closerId,
        terminDatum,
        terminart,
        infosErstgespraech,
        meetingLink
      })

      // Validierung
      if (!originalLeadId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'originalLeadId ist erforderlich' })
        }
      }

      if (!setterName && !setterId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'setterName oder setterId ist erforderlich' })
        }
      }

      // Closer ist optional - wenn leer, geht Termin in den Pool
      // if (!closerName && !closerId) { ... }

      if (!terminDatum) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'terminDatum ist erforderlich' })
        }
      }

      // Duplikat-Prüfung: Existiert bereits ein Hot Lead für diesen Original-Lead?
      const duplicateCheckUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=FIND("${originalLeadId}",ARRAYJOIN({Immobilienmakler_Leads}))&maxRecords=1`
      const duplicateCheckResponse = await fetch(duplicateCheckUrl, {
        headers: airtableHeaders
      })
      const duplicateCheckData = await duplicateCheckResponse.json()
      
      if (duplicateCheckData.records && duplicateCheckData.records.length > 0) {
        const existingHotLead = duplicateCheckData.records[0]
        console.log('Duplikat gefunden - Hot Lead existiert bereits:', existingHotLead.id)
        return {
          statusCode: 409, // Conflict
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Hot Lead existiert bereits',
            message: 'Für diesen Lead wurde bereits ein Beratungsgespräch gebucht.',
            existingHotLeadId: existingHotLead.id
          })
        }
      }

      // User-Namen laden um Record-IDs zu finden falls nur Namen gegeben
      const userNames = await loadUserNames(airtableHeaders)
      
      // Name → Record-ID Mapping erstellen (umgekehrte Suche)
      const nameToId = {}
      for (const [id, name] of Object.entries(userNames)) {
        nameToId[name.toLowerCase()] = id
      }

      // Setter Record-ID ermitteln
      let setterRecordId = setterId
      if (!setterRecordId && setterName) {
        setterRecordId = nameToId[setterName.toLowerCase()]
        console.log('Setter Name → ID:', setterName, '→', setterRecordId)
      }

      // Closer Record-ID ermitteln
      let closerRecordId = closerId
      if (!closerRecordId && closerName) {
        closerRecordId = nameToId[closerName.toLowerCase()]
        console.log('Closer Name → ID:', closerName, '→', closerRecordId)
      }

      // Hot Lead Felder - Setter/Closer als Linked Records (Array mit Record-IDs)
      const fields = {
        'Immobilienmakler_Leads': [originalLeadId],
        'Unternehmen': unternehmen || '',
        'Termin_Beratungsgespräch': terminDatum,
        'Status': 'Lead',
        'Quelle': quelle || 'Cold Calling'
      }

      // Terminart (Video oder Telefonisch)
      if (terminart) {
        fields['Terminart'] = terminart
      }

      // Meeting-Link für Video-Termine
      if (meetingLink) {
        fields['Meeting_Link'] = meetingLink
      }

      // Infos Erstgespräch wird im Original-Lead Kommentar-Feld gespeichert (nicht hier)

      // Setter als Linked Record oder Text (je nachdem was funktioniert)
      if (setterRecordId) {
        fields['Setter'] = [setterRecordId]  // Linked Record Format
      } else if (setterName) {
        fields['Setter'] = setterName        // Fallback: Text
      }

      // Closer als Linked Record oder Text (leer = Pool-Termin)
      if (closerRecordId) {
        fields['Closer'] = [closerRecordId]  // Linked Record Format
      } else if (closerName) {
        fields['Closer'] = closerName        // Fallback: Text
      }
      // Wenn weder closerRecordId noch closerName, bleibt Closer leer → Pool-Termin

      // Kommentar wird im Original-Lead (Immobilienmakler_Leads) gespeichert, nicht hier
      // Das Kommentar-Feld in Hot_Leads ist ein Lookup aus Immobilienmakler_Leads

      console.log('Creating Hot Lead with fields:', JSON.stringify(fields, null, 2))

      const response = await fetch(TABLE_URL, {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({ fields })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Error:', JSON.stringify(error, null, 2))
        
        // Falls Linked Record fehlschlägt, versuche mit Text-Feldern
        if (error.error?.type === 'INVALID_VALUE_FOR_COLUMN') {
          console.log('Retrying with text fields instead of linked records...')
          
          // Zurück zu Text-Feldern
          if (setterRecordId) fields['Setter'] = setterName
          if (closerRecordId) fields['Closer'] = closerName
          
          const retryResponse = await fetch(TABLE_URL, {
            method: 'POST',
            headers: airtableHeaders,
            body: JSON.stringify({ fields })
          })
          
          if (retryResponse.ok) {
            const data = await retryResponse.json()
            
            return {
              statusCode: 201,
              headers: corsHeaders,
              body: JSON.stringify({
                success: true,
                message: 'Hot Lead erfolgreich erstellt (mit Text-Feldern)',
                hotLeadId: data.id
              })
            }
          }
        }
        
        throw new Error(error.error?.message || 'Hot Lead konnte nicht erstellt werden')
      }

      const data = await response.json()

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Hot Lead erfolgreich erstellt',
          hotLeadId: data.id
        })
      }
    }

    // ==========================================
    // PATCH: Hot Lead aktualisieren
    // ==========================================
    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body)
      const { hotLeadId, updates } = body

      if (!hotLeadId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'hotLeadId ist erforderlich' })
        }
      }

      // User-Namen laden für Name → ID Auflösung
      const userNames = await loadUserNames(airtableHeaders)
      const nameToId = {}
      for (const [id, name] of Object.entries(userNames)) {
        nameToId[name.toLowerCase()] = id
      }

      // Erlaubte Update-Felder (nur Felder die direkt in Hot_Leads existieren)
      const allowedFields = [
        'Status',
        'Setup',
        'Retainer',
        'Laufzeit',
        'Produkt_Dienstleistung',
        'Kunde_seit',
        'Priorität',
        'Closer',  // Falls Closer gewechselt werden soll
        'Termin_Beratungsgespräch',  // Für Neu-Terminierung
        'Terminart',  // Video oder Telefonisch
        'Meeting_Link',  // Google Meet Link
        'Attachments'  // Dokumente (PDFs, etc.)
      ]

      const fields = {}

      for (const [key, value] of Object.entries(updates)) {
        // Mapping von camelCase zu Airtable Feldnamen
        const fieldMap = {
          'status': 'Status',
          'setup': 'Setup',
          'retainer': 'Retainer',
          'laufzeit': 'Laufzeit',
          'produktDienstleistung': 'Produkt_Dienstleistung',
          'kundeSeit': 'Kunde_seit',
          'prioritaet': 'Priorität',
          'closerId': 'Closer',
          'closerName': 'Closer',
          'terminDatum': 'Termin_Beratungsgespräch',
          'terminart': 'Terminart',
          'meetingLink': 'Meeting_Link',
          'attachments': 'Attachments'
        }

        const airtableField = fieldMap[key] || key

        if (allowedFields.includes(airtableField)) {
          // Attachments brauchen Array mit url-Objekten für Airtable
          if (airtableField === 'Attachments' && Array.isArray(value)) {
            fields[airtableField] = value.map(att => ({ url: att.url }))
          }
          // Closer braucht Array-Format für Link
          else if (airtableField === 'Closer' && value) {
            // Wenn closerName gegeben, zu ID auflösen
            if (key === 'closerName') {
              const closerRecordId = nameToId[value.toLowerCase()]
              if (closerRecordId) {
                fields[airtableField] = [closerRecordId]
              } else {
                // Fallback: als Text speichern
                fields[airtableField] = value
              }
            } else {
              // closerId direkt verwenden
              fields[airtableField] = [value]
            }
          } else {
            fields[airtableField] = value
          }
        }
      }

      if (Object.keys(fields).length === 0) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Keine gültigen Update-Felder' })
        }
      }

      console.log('Updating Hot Lead:', hotLeadId, fields)

      const response = await fetch(`${TABLE_URL}/${hotLeadId}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ fields })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Error:', error)
        throw new Error(error.error?.message || 'Hot Lead konnte nicht aktualisiert werden')
      }

      const data = await response.json()

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Hot Lead aktualisiert',
          hotLeadId: data.id
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Hot Leads Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}
