// Oeffnet die Meet-Raeume anstehender Video-Termine.
//
// Wird stuendlich von der Datenbank angestossen (meet_oeffnen_anstossen) und
// kann von Admins auch von Hand ausgeloest werden. Laeuft ohne Zutun - genau
// deshalb, weil das Oeffnen von Hand bei vielen Terminen untergeht.

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { meetCodeErmitteln, meetRaumOeffnen } from './utils/google.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const body = event.body ? JSON.parse(event.body) : {}

  // Zwei Aufrufer: die Datenbank (mit Lauf-Nummer, ohne Sitzung) und ein
  // Admin aus der Oberflaeche. Ein Aufruf ohne beides wird abgewiesen.
  const vomLauf = typeof body.lauf === 'number'
  if (!vomLauf) {
    const zugang = anmeldungVerlangen(event, ['Admin', 'Geschäftsführer'])
    if (zugang.antwort) return zugang.antwort
  }

  const stunden = Number(body.stunden) || 72
  const bis = new Date(Date.now() + stunden * 3600_000).toISOString()
  const ab  = new Date(Date.now() - 3600_000).toISOString()

  const bericht = { geprueft: 0, geoeffnet: 0, ohne_code: 0, fehler: 0, meldungen: [] }

  try {
    // Anstehende Video-Termine, deren Raum noch nicht offen ist. Ein bereits
    // gescheiterter Versuch mit dauerhaftem Grund wird nicht wiederholt -
    // dafuer steht meet_fehler.
    const { data: termine, error } = await supabase
      .from('hot_leads')
      .select('id, unternehmen, meeting_link, meet_code, termin_beratungsgespraech, termin_abschlussgespraech')
      .eq('terminart', 'Video')
      .is('meet_geoeffnet_am', null)
      .is('meet_fehler', null)
      .not('meeting_link', 'is', null)
      .order('termin_beratungsgespraech', { ascending: true })
      .limit(50)

    if (error) throw new Error(error.message)

    for (const t of termine || []) {
      const termin = t.termin_abschlussgespraech || t.termin_beratungsgespraech
      if (!termin || termin > bis || termin < ab) continue

      bericht.geprueft++

      try {
        const code = t.meet_code || await meetCodeErmitteln(t.meeting_link)

        if (!code) {
          // Kein Meet dahinter - etwa Zoom oder ein Telefontermin, der als
          // Video gefuehrt wird. Kein Fehler, nur nichts zu tun.
          bericht.ohne_code++
          await supabase.from('hot_leads')
            .update({ meet_fehler: 'kein Meet-Code hinter dem Link' })
            .eq('id', t.id)
          continue
        }

        const ergebnis = await meetRaumOeffnen(code)

        if (ergebnis.ok) {
          await supabase.from('hot_leads').update({
            meet_code: code,
            meet_geoeffnet_am: new Date().toISOString(),
            meet_fehler: null
          }).eq('id', t.id)
          bericht.geoeffnet++
        } else {
          bericht.fehler++
          bericht.meldungen.push(`${t.unternehmen || t.id}: ${ergebnis.grund}`)
          await supabase.from('hot_leads').update({
            meet_code: code,
            // Nur dauerhafte Fehler festschreiben. Voruebergehende bleiben
            // offen, damit der naechste Lauf es erneut versucht.
            meet_fehler: ergebnis.dauerhaft ? ergebnis.grund : null
          }).eq('id', t.id)
        }
      } catch (e) {
        bericht.fehler++
        bericht.meldungen.push(`${t.unternehmen || t.id}: ${e.message}`)
      }
    }

    console.log('[meet-oeffnen]', JSON.stringify(bericht))

    if (vomLauf) {
      await supabase.rpc('lauf_beenden', {
        p_id: body.lauf,
        p_ergebnis: bericht,
        p_fehler: bericht.fehler > 0 ? bericht.meldungen.slice(0, 3).join(' | ') : null
      })
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(bericht) }

  } catch (e) {
    console.error('[meet-oeffnen] Fehler:', e)
    if (vomLauf) {
      await supabase.rpc('lauf_beenden', { p_id: body.lauf, p_ergebnis: null, p_fehler: e.message })
    }
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) }
  }
}
