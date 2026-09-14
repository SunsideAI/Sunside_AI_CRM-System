// Einstellungen: lesen fuer alle Angemeldeten, aendern nur fuer die Leitung.
//
// Die Tabelle wird auch vom Operations-System genutzt. Diese Function gibt
// deshalb nur die Schluessel heraus, die das CRM betreffen - sonst laegen
// Absenderadressen und Signaturen des Berichtsversands im Frontend.

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

// Was das CRM sehen und aendern darf. Alles andere bleibt unsichtbar.
const ERLAUBT = {
  bewerbung_pflicht_setter: { art: 'schalter' },
  bewerbung_pflicht_closer: { art: 'schalter' },
  // Ticket 7: welche Calendly-Terminart welchem Gespraech dient, als JSON
  // { "<uri>": "beratung" | "abschluss" }. Leer heisst "wie bisher".
  calendly_terminart_zuordnung: { art: 'text' }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('einstellungen')
        .select('schluessel, wert, beschreibung')
        .in('schluessel', Object.keys(ERLAUBT))

      if (error) throw new Error(error.message)

      const einstellungen = {}
      for (const zeile of data || []) {
        einstellungen[zeile.schluessel] = {
          wert: zeile.wert,
          an: zeile.wert === 'an',
          art: ERLAUBT[zeile.schluessel]?.art || 'schalter',
          beschreibung: zeile.beschreibung
        }
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ einstellungen }) }
    }

    if (event.httpMethod === 'PATCH') {
      if (!angemeldet.istAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Nur die Leitung darf Einstellungen aendern' })
        }
      }

      const { schluessel, an, wert: neuerWert } = JSON.parse(event.body)

      if (!ERLAUBT[schluessel]) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unbekannte Einstellung' })
        }
      }

      let wert
      if (ERLAUBT[schluessel].art === 'text') {
        // Freitext, aber nicht beliebig lang - hier stehen Calendly-URIs.
        if (neuerWert !== null && neuerWert !== undefined && typeof neuerWert !== 'string') {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'wert muss Text sein' })
          }
        }
        wert = String(neuerWert ?? '').trim().slice(0, 4000)
      } else {
        wert = an ? 'an' : 'aus'
      }
      const { error } = await supabase
        .from('einstellungen')
        .update({ wert, geaendert_am: new Date().toISOString() })
        .eq('schluessel', schluessel)

      if (error) throw new Error(error.message)

      console.log(`[Einstellungen] ${schluessel} = ${wert} durch ${angemeldet.name}`)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ schluessel, wert, an: wert === 'an' })
      }
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (e) {
    console.error('Einstellungen Error:', e)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) }
  }
}
