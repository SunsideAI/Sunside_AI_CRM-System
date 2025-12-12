// Archive Leads API
// Archiviert die Arbeitsdaten eines Vertrieblers wenn dieser deaktiviert wird
// POST: Archivierung starten für einen Vertriebler

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
  
  // Tabellen
  const LEADS_TABLE_ID = 'tblFRrrCPoT3t8FpC' // Immobilienmakler_Leads
  const ARCHIV_TABLE_ID = 'tbluaHfCySe8cSgSY' // Immobilienmakler_Leads_Archiv
  const USER_TABLE = 'User_Datenbank'
  
  const LEADS_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEADS_TABLE_ID}`
  const ARCHIV_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ARCHIV_TABLE_ID}`
  const USER_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(USER_TABLE)}`
  
  const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
  }

  try {
    const { vertriebId } = JSON.parse(event.body)

    if (!vertriebId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Vertriebler-ID ist erforderlich' })
      }
    }

    console.log(`Archivierung gestartet für Vertriebler: ${vertriebId}`)

    // 1. Vertriebler-Daten laden (für Logging)
    const userResponse = await fetch(`${USER_URL}/${vertriebId}`, { headers: airtableHeaders })
    if (!userResponse.ok) {
      throw new Error('Vertriebler nicht gefunden')
    }
    const userData = await userResponse.json()
    const vertrieblerName = userData.fields?.Vor_Nachname || 'Unbekannt'

    // 2. Alle Leads laden (ohne Filter, dann im Code filtern - robuster bei Link-Feldern)
    let allLeads = []
    let offset = null

    do {
      let url = LEADS_URL
      if (offset) {
        url += `?offset=${offset}`
      }

      const response = await fetch(url, { headers: airtableHeaders })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Fehler beim Laden der Leads')
      }

      const data = await response.json()
      allLeads = allLeads.concat(data.records || [])
      offset = data.offset
    } while (offset)

    console.log(`${allLeads.length} Leads total geladen`)

    // 3. Im Code filtern: User zugewiesen UND bereits kontaktiert
    const userLeads = allLeads.filter(lead => {
      const fields = lead.fields
      
      // User-Zuordnung prüfen (Link-Feld)
      const zugewiesen = fields['User_Datenbank'] || fields.User_Datenbank || []
      const userIds = Array.isArray(zugewiesen) ? zugewiesen : [zugewiesen]
      if (!userIds.includes(vertriebId)) return false
      
      // Bereits kontaktiert prüfen (verschiedene Feldnamen)
      const kontaktiert = fields['Bereits kontaktiert'] || 
                          fields['Bereits_kontaktiert'] || 
                          fields.Bereits_kontaktiert ||
                          false
      
      // Kann 'X', true, oder 1 sein
      return kontaktiert === true || kontaktiert === 'X' || kontaktiert === 'x' || kontaktiert === 1
    })

    console.log(`${userLeads.length} bearbeitete Leads gefunden für ${vertrieblerName}`)

    if (userLeads.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Keine bearbeiteten Leads zum Archivieren gefunden',
          vertrieblerName,
          archiviert: 0,
          zurueckgesetzt: 0
        })
      }
    }

    // 4. Leads filtern: Nur die OHNE "Beratungsgespräch" archivieren
    // Leads mit Beratungsgespräch sind bereits in Hot_Leads und bleiben unberührt
    const leadsZuArchivieren = userLeads.filter(lead => {
      const ergebnis = (lead.fields.Ergebnis || '').toLowerCase()
      return !ergebnis.includes('beratungsgespräch') && !ergebnis.includes('beratungsgespraech')
    })

    console.log(`${leadsZuArchivieren.length} Leads werden archiviert (${userLeads.length - leadsZuArchivieren.length} Beratungsgespräche übersprungen)`)

    // 5. Archiv-Einträge erstellen (Batches von 10)
    const now = new Date().toISOString()
    let archiviertCount = 0

    for (let i = 0; i < leadsZuArchivieren.length; i += 10) {
      const batch = leadsZuArchivieren.slice(i, i + 10)
      
      const archivRecords = batch.map(lead => {
        const fields = lead.fields
        const kontaktiert = fields['Bereits kontaktiert'] || 
                            fields['Bereits_kontaktiert'] || 
                            fields.Bereits_kontaktiert
        
        return {
          fields: {
            'Lead': [lead.id],
            'Vertriebler': [vertriebId],
            'Bereits_kontaktiert': kontaktiert === true || kontaktiert === 'X' || kontaktiert === 'x',
            'Ergebnis': mapErgebnis(fields.Ergebnis),
            'Datum': fields.Datum || null,
            'Archiviert_am': now
          }
        }
      })

      const archivResponse = await fetch(ARCHIV_URL, {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({ records: archivRecords })
      })

      if (archivResponse.ok) {
        archiviertCount += batch.length
      } else {
        const error = await archivResponse.json()
        console.error('Archiv-Fehler:', error)
      }
    }

    console.log(`${archiviertCount} Leads ins Archiv kopiert`)

    // 6. Original-Leads zurücksetzen (Arbeitsdaten löschen)
    let zurueckgesetztCount = 0

    for (let i = 0; i < leadsZuArchivieren.length; i += 10) {
      const batch = leadsZuArchivieren.slice(i, i + 10)
      
      const resetRecords = batch.map(lead => ({
        id: lead.id,
        fields: {
          'User_Datenbank': [],  // Verknüpfung lösen
          'Bereits kontaktiert': null,  // Zurücksetzen (mit Leerzeichen)
          'Bereits_kontaktiert': null,  // Zurücksetzen (mit Unterstrich)
          'Ergebnis': null,  // Zurücksetzen
          'Datum': null  // Zurücksetzen
        }
      }))

      const resetResponse = await fetch(LEADS_URL, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ records: resetRecords })
      })

      if (resetResponse.ok) {
        zurueckgesetztCount += batch.length
      } else {
        const error = await resetResponse.json()
        console.error('Reset-Fehler:', error)
      }
    }

    console.log(`${zurueckgesetztCount} Leads zurückgesetzt`)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `Archivierung für ${vertrieblerName} abgeschlossen`,
        vertrieblerName,
        gefunden: userLeads.length,
        beratungsgespraecheUebersprungen: userLeads.length - leadsZuArchivieren.length,
        archiviert: archiviertCount,
        zurueckgesetzt: zurueckgesetztCount
      })
    }

  } catch (error) {
    console.error('Archive-Leads Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    }
  }
}

// Ergebnis-Mapping für Archiv (falls Feldnamen leicht anders sind)
function mapErgebnis(ergebnis) {
  if (!ergebnis) return null
  
  const mapping = {
    'nicht erreicht': 'Nicht erreicht',
    'beratungsgespräch': 'Beratungsgespräch',
    'beratungsgespraech': 'Beratungsgespräch',
    'unterlage bereitstellen': 'Unterlage bereitstellen',
    'unterlagen': 'Unterlage bereitstellen',
    'kein interesse': 'Kein Interesse'
  }
  
  const lower = ergebnis.toLowerCase().trim()
  return mapping[lower] || ergebnis
}
