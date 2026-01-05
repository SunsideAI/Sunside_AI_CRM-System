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

    // 3. Im Code filtern: Alle Leads die dem User zugewiesen sind
    const alleUserLeads = allLeads.filter(lead => {
      const fields = lead.fields
      const zugewiesen = fields['User_Datenbank'] || fields.User_Datenbank || []
      const userIds = Array.isArray(zugewiesen) ? zugewiesen : [zugewiesen]
      return userIds.includes(vertriebId)
    })

    console.log(`${alleUserLeads.length} Leads insgesamt zugewiesen an ${vertrieblerName}`)

    // 4. Aufteilen in kontaktierte und nicht-kontaktierte
    // WICHTIG: "Ungültiger Lead" wird komplett ausgeschlossen - diese sollen nie wieder vergeben werden
    const ungueltigeLeads = alleUserLeads.filter(lead => {
      const ergebnis = (lead.fields.Ergebnis || '').toLowerCase()
      return ergebnis.includes('ungültiger lead') || ergebnis.includes('ungultiger lead')
    })

    const kontaktierteLeads = alleUserLeads.filter(lead => {
      const kontaktiert = lead.fields['Bereits_kontaktiert'] || lead.fields.Bereits_kontaktiert
      const ergebnis = (lead.fields.Ergebnis || '').toLowerCase()
      const istUngueltig = ergebnis.includes('ungültiger lead') || ergebnis.includes('ungultiger lead')
      return (kontaktiert === 'X' || kontaktiert === 'x') && !istUngueltig
    })
    
    const nichtKontaktierteLeads = alleUserLeads.filter(lead => {
      const kontaktiert = lead.fields['Bereits_kontaktiert'] || lead.fields.Bereits_kontaktiert
      const ergebnis = (lead.fields.Ergebnis || '').toLowerCase()
      const istUngueltig = ergebnis.includes('ungültiger lead') || ergebnis.includes('ungultiger lead')
      return kontaktiert !== 'X' && kontaktiert !== 'x' && !istUngueltig
    })

    console.log(`${kontaktierteLeads.length} bearbeitete Leads, ${nichtKontaktierteLeads.length} nicht-kontaktierte Leads, ${ungueltigeLeads.length} ungültige Leads (werden übersprungen)`)

    // 5. Kontaktierte Leads filtern: Nur die OHNE "Beratungsgespräch" archivieren
    // Leads mit Beratungsgespräch sind bereits in Hot_Leads und bleiben unberührt
    const leadsZuArchivieren = kontaktierteLeads.filter(lead => {
      const ergebnis = (lead.fields.Ergebnis || '').toLowerCase()
      return !ergebnis.includes('beratungsgespräch') && !ergebnis.includes('beratungsgespraech')
    })

    console.log(`${leadsZuArchivieren.length} Leads werden archiviert (${kontaktierteLeads.length - leadsZuArchivieren.length} Beratungsgespräche übersprungen)`)

    // 5. Archiv-Einträge erstellen (Batches von 10)
    const now = new Date().toISOString().split('T')[0]  // Nur Datum: "2025-12-12"
    let archiviertCount = 0
    const erfolgreichArchiviertIds = []  // Track welche Leads erfolgreich archiviert wurden

    for (let i = 0; i < leadsZuArchivieren.length; i += 10) {
      const batch = leadsZuArchivieren.slice(i, i + 10)
      
      const archivRecords = batch.map(lead => {
        const fields = lead.fields
        return {
          fields: {
            'Lead': [lead.id],
            'Vertriebler': [vertriebId],
            'Bereits_kontaktiert': 'X',  // Single Select - immer 'X' weil nur kontaktierte archiviert werden
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
        // Diese Lead-IDs merken für Reset
        batch.forEach(lead => erfolgreichArchiviertIds.push(lead.id))
      } else {
        const error = await archivResponse.json()
        console.error('Archiv-Fehler:', error)
        // Bei Fehler: Diese Leads NICHT zurücksetzen!
      }
    }

    console.log(`${archiviertCount} Leads ins Archiv kopiert`)

    // 6. NUR erfolgreich archivierte Leads zurücksetzen
    let zurueckgesetztCount = 0
    
    if (erfolgreichArchiviertIds.length === 0 && leadsZuArchivieren.length > 0) {
      // Es gab Leads zu archivieren, aber die Archivierung ist fehlgeschlagen
      console.log('Archivierung fehlgeschlagen - Reset übersprungen, aber nicht-kontaktierte werden freigegeben')
    }

    // Nur die erfolgreich archivierten Leads zurücksetzen
    const leadsZumReset = leadsZuArchivieren.filter(lead => erfolgreichArchiviertIds.includes(lead.id))

    for (let i = 0; i < leadsZumReset.length; i += 10) {
      const batch = leadsZumReset.slice(i, i + 10)
      
      const resetRecords = batch.map(lead => ({
        id: lead.id,
        fields: {
          'User_Datenbank': [],  // Verknüpfung lösen
          'Bereits_kontaktiert': null,  // Zurücksetzen (Single Select → leer)
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

    console.log(`${zurueckgesetztCount} archivierte Leads zurückgesetzt`)

    // 7. Nicht-kontaktierte Leads freigeben (nur User-Zuordnung entfernen)
    let freigegebenCount = 0

    for (let i = 0; i < nichtKontaktierteLeads.length; i += 10) {
      const batch = nichtKontaktierteLeads.slice(i, i + 10)
      
      const freigebenRecords = batch.map(lead => ({
        id: lead.id,
        fields: {
          'User_Datenbank': []  // Nur Verknüpfung lösen, Rest bleibt
        }
      }))

      const freigebenResponse = await fetch(LEADS_URL, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({ records: freigebenRecords })
      })

      if (freigebenResponse.ok) {
        freigegebenCount += batch.length
      } else {
        const error = await freigebenResponse.json()
        console.error('Freigeben-Fehler:', error)
      }
    }

    console.log(`${freigegebenCount} nicht-kontaktierte Leads freigegeben`)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: `Archivierung für ${vertrieblerName} abgeschlossen`,
        vertrieblerName,
        gefunden: alleUserLeads.length,
        kontaktiert: kontaktierteLeads.length,
        nichtKontaktiert: nichtKontaktierteLeads.length,
        ungueltigeLeads: ungueltigeLeads.length,
        beratungsgespraecheUebersprungen: kontaktierteLeads.length - leadsZuArchivieren.length,
        archiviert: archiviertCount,
        zurueckgesetzt: zurueckgesetztCount,
        freigegeben: freigegebenCount
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
