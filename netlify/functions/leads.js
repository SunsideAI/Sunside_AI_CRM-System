// Leads API - Laden und Aktualisieren von Leads
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  const LEADS_TABLE = 'Immobilienmakler_Leads'
  const USERS_TABLE = 'User_Datenbank'

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
  }

  // Hilfsfunktion: Alle User laden für Name-Mapping
  async function loadUserMap() {
    try {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(USERS_TABLE)}?fields[]=Vor_Nachname`
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
      })
      if (!response.ok) {
        console.error('Failed to load users')
        return {}
      }
      
      const data = await response.json()
      const userMap = {}
      data.records.forEach(record => {
        userMap[record.id] = record.fields.Vor_Nachname || 'Unbekannt'
      })
      console.log('Loaded users:', Object.keys(userMap).length)
      return userMap
    } catch (err) {
      console.error('Error loading users:', err)
      return {}
    }
  }

  // GET - Leads laden
  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {}
      const {
        userName,      // Name des Users (Vor_Nachname) für Link-Feld Filter
        userRole,      // 'Admin', 'Coldcaller', 'Closer'
        view,          // 'all' oder 'own' (für Admins)
        search,        // Suchbegriff
        contacted,     // 'true' oder 'false'
        result,        // Ergebnis-Filter
        vertriebler,   // Filter nach Vertriebler (Name)
        offset,        // Pagination offset
        wiedervorlage  // 'true' = nur Leads mit Wiedervorlage-Datum
      } = params

      // User-Map laden für Namen-Auflösung
      const userMap = await loadUserMap()

      // Basis-URL
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}`
      
      // Filter bauen
      const filters = []
      
      // User-Filter: Nur wenn NICHT Admin mit "all" view
      const needsUserFilter = userRole !== 'Admin' || view === 'own'
      
      if (needsUserFilter && userName) {
        // Filter über den angezeigten Namen im Link-Feld
        filters.push(`FIND("${userName}", ARRAYJOIN({User_Datenbank}, ","))`)
      }

      // Vertriebler-Filter (für Admins) - filtert nach Name
      if (vertriebler && vertriebler !== 'all') {
        filters.push(`FIND("${vertriebler}", ARRAYJOIN({User_Datenbank}, ","))`)
      }

      // Kontaktiert-Filter (Feld ist Text: "X" oder leer)
      if (contacted === 'true') {
        filters.push(`{Bereits_kontaktiert} = 'X'`)
      } else if (contacted === 'false') {
        filters.push(`OR({Bereits_kontaktiert} = '', {Bereits_kontaktiert} = BLANK())`)
      }

      // Ergebnis-Filter
      if (result && result !== 'all') {
        filters.push(`{Ergebnis} = '${result}'`)
      }

      // Wiedervorlage-Filter: Nur Leads mit Wiedervorlage-Datum
      if (wiedervorlage === 'true') {
        filters.push(`{Wiedervorlage_Datum}`)
      }

      // Suchfilter (Unternehmensname oder Stadt)
      if (search) {
        const searchEscaped = search.replace(/"/g, '\\"')
        filters.push(`OR(FIND(LOWER("${searchEscaped}"), LOWER({Unternehmensname})), FIND(LOWER("${searchEscaped}"), LOWER({Stadt})))`)
      }

      // Query-Parameter
      const queryParams = new URLSearchParams()
      
      // Filter kombinieren
      if (filters.length > 0) {
        const formula = filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`
        queryParams.append('filterByFormula', formula)
      }

      // Pagination
      queryParams.append('pageSize', '50')

      // Sortierung
      queryParams.append('sort[0][field]', 'Unternehmensname')
      queryParams.append('sort[0][direction]', 'asc')

      // Felder die wir brauchen
      const fields = [
        'Unternehmensname',
        'Stadt',
        'Kategorie',
        'Mail',
        'Website',
        'Telefonnummer',
        'User_Datenbank',
        'Bereits_kontaktiert',
        'Datum',
        'Ergebnis',
        'Kommentar',
        'Ansprechpartner_Vorname',
        'Ansprechpartner_Nachname',
        'Wiedervorlage_Datum',
        // Website-Statistiken
        'Absprungrate',
        'Monatliche_Besuche',
        'Anzahl_Leads',
        'Mehrwert'
      ]
      fields.forEach(field => queryParams.append('fields[]', field))

      // Offset für Pagination
      if (offset) {
        queryParams.append('offset', offset)
      }

      const fullUrl = `${url}?${queryParams.toString()}`
      
      const response = await fetch(fullUrl, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Error:', JSON.stringify(error))
        throw new Error(error.error?.message || 'Fehler beim Laden der Leads')
      }

      const data = await response.json()

      // Leads formatieren mit aufgelösten User-Namen
      const leads = data.records.map(record => {
        // User IDs aus Link-Feld auflösen zu Namen
        const userField = record.fields.User_Datenbank || []
        
        // Debug: Log ersten Lead
        if (data.records.indexOf(record) === 0) {
          console.log('First lead User_Datenbank field:', userField)
        }
        
        // userField könnte Array von IDs oder Array von Namen sein
        let userNames = []
        let userIds = []
        
        if (Array.isArray(userField)) {
          userField.forEach(item => {
            // Prüfen ob es eine Record ID ist (beginnt mit "rec")
            if (typeof item === 'string' && item.startsWith('rec')) {
              userIds.push(item)
              userNames.push(userMap[item] || item)
            } else if (typeof item === 'string') {
              // Es ist bereits ein Name
              userNames.push(item)
            }
          })
        }
        
        return {
          id: record.id,
          unternehmensname: record.fields.Unternehmensname || '',
          stadt: record.fields.Stadt || '',
          kategorie: record.fields.Kategorie || '',
          email: record.fields.Mail || '',
          website: record.fields.Website || '',
          telefon: record.fields.Telefonnummer || '',
          zugewiesenAn: userNames,
          zugewiesenAnIds: userIds,
          kontaktiert: record.fields['Bereits_kontaktiert'] === 'X' || record.fields['Bereits_kontaktiert'] === true,
          datum: record.fields.Datum || null,
          ergebnis: record.fields.Ergebnis || '',
          kommentar: record.fields.Kommentar || '',
          ansprechpartnerVorname: record.fields.Ansprechpartner_Vorname || '',
          ansprechpartnerNachname: record.fields.Ansprechpartner_Nachname || '',
          wiedervorlageDatum: record.fields.Wiedervorlage_Datum || '',
          // Website-Statistiken
          absprungrate: record.fields.Absprungrate || null,
          monatlicheBesuche: record.fields.Monatliche_Besuche || null,
          anzahlLeads: record.fields.Anzahl_Leads || null,
          mehrwert: record.fields.Mehrwert || null
        }
      })

      // User-Liste für Filter mitgeben (sortiert nach Name)
      const users = Object.entries(userMap)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          leads,
          users,
          offset: data.offset || null,
          hasMore: !!data.offset
        })
      }

    } catch (error) {
      console.error('GET Leads Error:', error.message)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      }
    }
  }

  // PATCH - Lead aktualisieren
  if (event.httpMethod === 'PATCH') {
    try {
      const body = JSON.parse(event.body)
      const leadId = body.leadId || body.id  // Beide Varianten akzeptieren
      const updates = body.updates || {}
      const historyEntry = body.historyEntry

      if (!leadId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Lead ID fehlt' })
        }
      }

      // Erst aktuellen Lead laden (für History)
      let currentKommentar = ''
      if (historyEntry) {
        const getResponse = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}/${leadId}`,
          { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } }
        )
        const leadData = await getResponse.json()
        currentKommentar = leadData.fields?.Kommentar || ''
      }

      const fieldsToUpdate = {}

      if (updates.kontaktiert !== undefined) {
        // Für "kontaktiert": 'X' setzen
        // Für "nicht kontaktiert": null (löscht das Feld in Airtable)
        fieldsToUpdate['Bereits_kontaktiert'] = updates.kontaktiert ? 'X' : null
      }
      if (updates.ergebnis !== undefined) {
        // Leerer String → null (löscht das Feld in Airtable)
        fieldsToUpdate['Ergebnis'] = updates.ergebnis || null
      }
      if (updates.datum !== undefined) {
        fieldsToUpdate['Datum'] = updates.datum || null
      }
      if (updates.ansprechpartnerVorname !== undefined) {
        fieldsToUpdate['Ansprechpartner_Vorname'] = updates.ansprechpartnerVorname || null
      }
      if (updates.ansprechpartnerNachname !== undefined) {
        fieldsToUpdate['Ansprechpartner_Nachname'] = updates.ansprechpartnerNachname || null
      }
      if (updates.wiedervorlageDatum !== undefined) {
        // datetime-local liefert "2024-12-22T14:30"
        // Ohne Z senden, damit Airtable es als lokale Zeit interpretiert
        if (updates.wiedervorlageDatum) {
          const inputDate = updates.wiedervorlageDatum
          // Format: "2024-12-22T11:00" -> "2024-12-22T11:00:00" (ohne Z!)
          const isoDate = inputDate.includes(':') && inputDate.length === 16 
            ? `${inputDate}:00`  // "2024-12-22T11:00" -> "2024-12-22T11:00:00"
            : `${inputDate}:00:00`
          console.log('Wiedervorlage Datum:', { input: inputDate, output: isoDate })
          fieldsToUpdate['Wiedervorlage_Datum'] = isoDate
        } else {
          fieldsToUpdate['Wiedervorlage_Datum'] = null
        }
      }

      // Automatisch Datum setzen wenn kontaktiert
      if (updates.kontaktiert === true && !updates.datum) {
        fieldsToUpdate['Datum'] = new Date().toISOString().split('T')[0]
      }

      // History-Eintrag erstellen wenn vorhanden
      if (historyEntry) {
        const now = new Date()
        const timestamp = now.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        }) + ', ' + now.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })

        // Icon basierend auf Aktion
        const icons = {
          'email': '📧',
          'termin': '📅',
          'angebot': '💰',
          'abgeschlossen': '🎉',
          'verloren': '❌',
          'kontaktiert': '✅',
          'nicht_kontaktiert': '↩️',
          'ergebnis': '📋',
          'ansprechpartner': '👤',
          'kommentar': '💬',
          'wiedervorlage': '🔔'
        }
        const icon = icons[historyEntry.action] || '📋'
        
        const newEntry = `[${timestamp}] ${icon} ${historyEntry.details} (${historyEntry.userName})`
        
        // Neuen Eintrag oben anhängen
        fieldsToUpdate['Kommentar'] = currentKommentar 
          ? `${newEntry}\n${currentKommentar}`
          : newEntry
      } else if (updates.kommentar !== undefined) {
        // Direkte Kommentar-Änderung (ohne History-Format)
        fieldsToUpdate['Kommentar'] = updates.kommentar
      }

      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(LEADS_TABLE)}/${leadId}`

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: fieldsToUpdate })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Airtable Update Error:', JSON.stringify(error))
        throw new Error(error.error?.message || 'Fehler beim Aktualisieren')
      }

      const data = await response.json()

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          lead: {
            id: data.id,
            kontaktiert: data.fields['Bereits_kontaktiert'] === 'X' || data.fields['Bereits_kontaktiert'] === true,
            ergebnis: data.fields.Ergebnis || '',
            kommentar: data.fields.Kommentar || '',
            datum: data.fields.Datum || null,
            ansprechpartnerVorname: data.fields.Ansprechpartner_Vorname || '',
            ansprechpartnerNachname: data.fields.Ansprechpartner_Nachname || ''
          }
        })
      }

    } catch (error) {
      console.error('PATCH Lead Error:', error.message)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  }
}
