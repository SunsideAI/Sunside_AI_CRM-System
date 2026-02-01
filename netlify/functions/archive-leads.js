// Archive Leads API - Supabase Version
// Archiviert die Arbeitsdaten eines Vertrieblers wenn dieser deaktiviert wird
// POST: Archivierung starten für einen Vertriebler

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

export async function handler(event) {
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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server nicht konfiguriert' })
    }
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

    // 1. Vertriebler-Daten laden
    const { data: vertrieblerData, error: userError } = await supabase
      .from('users')
      .select('vor_nachname')
      .eq('id', vertriebId)
      .single()

    if (userError || !vertrieblerData) {
      throw new Error('Vertriebler nicht gefunden')
    }

    const vertrieblerName = vertrieblerData.vor_nachname || 'Unbekannt'

    // 2. Alle Lead-Assignments für diesen User laden
    const { data: assignments, error: assignError } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('user_id', vertriebId)

    if (assignError) {
      throw new Error('Fehler beim Laden der Assignments')
    }

    const leadIds = (assignments || []).map(a => a.lead_id)

    console.log(`${leadIds.length} Leads insgesamt zugewiesen an ${vertrieblerName}`)

    if (leadIds.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: `Keine Leads für ${vertrieblerName} gefunden`,
          gefunden: 0,
          archiviert: 0,
          zurueckgesetzt: 0,
          freigegeben: 0
        })
      }
    }

    // 3. Leads-Daten laden
    const { data: allLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, bereits_kontaktiert, ergebnis, datum')
      .in('id', leadIds)

    if (leadsError) {
      throw new Error('Fehler beim Laden der Leads')
    }

    // 4. Aufteilen in kontaktierte und nicht-kontaktierte
    const ungueltigeLeads = allLeads.filter(lead => {
      const ergebnis = (lead.ergebnis || '').toLowerCase()
      return ergebnis.includes('ungültiger lead') || ergebnis.includes('ungultiger lead')
    })

    const kontaktierteLeads = allLeads.filter(lead => {
      const kontaktiert = lead.bereits_kontaktiert === true
      const ergebnis = (lead.ergebnis || '').toLowerCase()
      const istUngueltig = ergebnis.includes('ungültiger lead') || ergebnis.includes('ungultiger lead')
      return kontaktiert && !istUngueltig
    })

    const nichtKontaktierteLeads = allLeads.filter(lead => {
      const kontaktiert = lead.bereits_kontaktiert === true
      const ergebnis = (lead.ergebnis || '').toLowerCase()
      const istUngueltig = ergebnis.includes('ungültiger lead') || ergebnis.includes('ungultiger lead')
      return !kontaktiert && !istUngueltig
    })

    console.log(`${kontaktierteLeads.length} bearbeitete Leads, ${nichtKontaktierteLeads.length} nicht-kontaktierte Leads, ${ungueltigeLeads.length} ungültige Leads`)

    // 5. Kontaktierte Leads filtern: Nur die OHNE "Beratungsgespräch" archivieren
    const leadsZuArchivieren = kontaktierteLeads.filter(lead => {
      const ergebnis = (lead.ergebnis || '').toLowerCase()
      return !ergebnis.includes('beratungsgespräch') && !ergebnis.includes('beratungsgespraech')
    })

    console.log(`${leadsZuArchivieren.length} Leads werden archiviert`)

    // 6. Archiv-Einträge erstellen
    const now = new Date().toISOString().split('T')[0]
    let archiviertCount = 0
    const erfolgreichArchiviertIds = []

    for (const lead of leadsZuArchivieren) {
      const { error: archivError } = await supabase
        .from('lead_archive')
        .insert({
          lead_id: lead.id,
          vertriebler_id: vertriebId,
          bereits_kontaktiert: true,
          ergebnis: lead.ergebnis || null,
          datum: lead.datum || null,
          archiviert_am: now
        })

      if (!archivError) {
        archiviertCount++
        erfolgreichArchiviertIds.push(lead.id)
      } else {
        console.error('Archiv-Fehler für Lead:', lead.id, archivError)
      }
    }

    console.log(`${archiviertCount} Leads ins Archiv kopiert`)

    // 7. Erfolgreich archivierte Leads zurücksetzen
    let zurueckgesetztCount = 0

    if (erfolgreichArchiviertIds.length > 0) {
      // Leads zurücksetzen
      const { error: resetError } = await supabase
        .from('leads')
        .update({
          bereits_kontaktiert: false,
          ergebnis: null,
          datum: null
        })
        .in('id', erfolgreichArchiviertIds)

      if (!resetError) {
        zurueckgesetztCount = erfolgreichArchiviertIds.length
      }

      // Assignments löschen
      await supabase
        .from('lead_assignments')
        .delete()
        .eq('user_id', vertriebId)
        .in('lead_id', erfolgreichArchiviertIds)
    }

    console.log(`${zurueckgesetztCount} archivierte Leads zurückgesetzt`)

    // 8. Nicht-kontaktierte Leads freigeben
    let freigegebenCount = 0

    if (nichtKontaktierteLeads.length > 0) {
      const nichtKontaktierteIds = nichtKontaktierteLeads.map(l => l.id)

      const { error: freigebenError } = await supabase
        .from('lead_assignments')
        .delete()
        .eq('user_id', vertriebId)
        .in('lead_id', nichtKontaktierteIds)

      if (!freigebenError) {
        freigegebenCount = nichtKontaktierteLeads.length
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
        gefunden: allLeads.length,
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
