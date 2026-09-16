// Die Zeitleiste eines Kontakts.
//
// Liest v_kontakt_verlauf - den einen Strom aus migrierten Kommentarzeilen,
// Statuswechseln und Anwahlen. Die Oberflaeche muss nicht wissen, aus welcher
// Quelle ein Ereignis stammt; sie zeigt, was wann passiert ist.
import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
}

// Ein Kontakt hat selten mehr als ein paar hundert Ereignisse; der dichteste
// im Bestand hat 60. 500 ist Luft nach oben, ohne eine Antwort zu bauen, die
// niemand liest.
const GRENZE = 500

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { leadId, hotLeadId, art } = event.queryStringParameters || {}

  if (!leadId && !hotLeadId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'leadId oder hotLeadId ist erforderlich' })
    }
  }

  try {
    let abfrage = supabase
      .from('v_kontakt_verlauf')
      .select('lead_id, hot_lead_id, geschehen_am, art, titel, akteur_name, quelle')
      .order('geschehen_am', { ascending: false })
      .limit(GRENZE)

    // hot_lead_id deckt beides ab: Die Sicht traegt zu jedem Lead-Ereignis
    // den zugehoerigen Hot Lead nach, sofern es einen gibt.
    if (hotLeadId) abfrage = abfrage.eq('hot_lead_id', hotLeadId)
    else abfrage = abfrage.eq('lead_id', leadId)

    if (art) abfrage = abfrage.in('art', art.split(',').map(a => a.trim()))

    const { data, error } = await abfrage
    if (error) throw new Error(error.message)

    const eintraege = (data || []).map(e => ({
      wann: e.geschehen_am,
      art: e.art,
      titel: e.titel,
      akteur: e.akteur_name || null,
      quelle: e.quelle
    }))

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        verlauf: eintraege,
        // Ehrlich sagen, wenn abgeschnitten wurde - sonst sieht eine
        // gekappte Liste aus wie eine vollstaendige.
        vollstaendig: eintraege.length < GRENZE,
        anzahl: eintraege.length
      })
    }
  } catch (e) {
    console.error('Verlauf Error:', e)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) }
  }
}
