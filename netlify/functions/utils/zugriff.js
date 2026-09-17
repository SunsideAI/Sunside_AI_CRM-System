// Wer darf an welchen Datensatz?
//
// session.js beantwortet "wer bist du". Hier steht die zweite Frage: Hast du
// mit diesem Kontakt etwas zu tun? Vorher genügte eine gültige Anmeldung, um
// jeden Hot Lead zu lesen und zu ändern - Preise, Rechnungsdaten und Status
// eines fremden Deals eingeschlossen. Die Oberfläche zeigte nur die eigenen,
// aber der Server fragte nicht nach.
//
// Beteiligt ist, wer in einer der vier Rollen am Hot Lead steht, oder wem der
// zugrunde liegende Lead aus der Kaltakquise zugeteilt ist. Das Zweite
// braucht der Opener, der einen bestehenden Termin neu bucht.
//
// Die Leitung (Admin oder Geschäftsführer) ist überall beteiligt.

import { istOpener, istSetter, istCloser } from '../../../shared/rollen.js'

const KOPF = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Fertige 403-Antwort. */
export function verboten(text = 'Keine Berechtigung für diesen Vorgang', code = 'kein_zugriff') {
  return { statusCode: 403, headers: KOPF, body: JSON.stringify({ error: text, code }) }
}

/** Die Rollenprüfungen, auf einen angemeldeten Nutzer angewandt. */
export const darf = {
  opening: n => n.istAdmin || istOpener(n.rollen),
  setting: n => n.istAdmin || istSetter(n.rollen),
  closing: n => n.istAdmin || istCloser(n.rollen),
  vertrieb: n => n.istAdmin || istOpener(n.rollen) || istSetter(n.rollen) || istCloser(n.rollen)
}

async function leadZugeteilt(supabase, nutzerId, leadId) {
  if (!leadId || !UUID.test(leadId)) return false
  const { data } = await supabase
    .from('lead_assignments')
    .select('id')
    .eq('lead_id', leadId)
    .eq('user_id', nutzerId)
    .limit(1)
  return (data?.length || 0) > 0
}

/**
 * Ist der Nutzer an diesem Hot Lead beteiligt?
 * Rückgabe: 'ja' | 'nein' | 'fehlt' (Datensatz gibt es nicht).
 */
export async function hotLeadBeteiligt(supabase, nutzer, hotLeadId) {
  if (!hotLeadId || !UUID.test(String(hotLeadId))) return 'fehlt'
  const { data } = await supabase
    .from('hot_leads')
    .select('opener_id, setter_id, closer_id, reaktivierung_bearbeiter_id, lead_id')
    .eq('id', hotLeadId)
    .maybeSingle()
  if (!data) return 'fehlt'
  if (nutzer.istAdmin) return 'ja'
  const ich = nutzer.id
  if ([data.opener_id, data.setter_id, data.closer_id, data.reaktivierung_bearbeiter_id].includes(ich)) return 'ja'
  if (await leadZugeteilt(supabase, ich, data.lead_id)) return 'ja'
  return 'nein'
}

/** Ist der Nutzer an diesem Lead der Kaltakquise beteiligt? */
export async function leadBeteiligt(supabase, nutzer, leadId) {
  if (!leadId || !UUID.test(String(leadId))) return false
  if (nutzer.istAdmin) return true
  if (await leadZugeteilt(supabase, nutzer.id, leadId)) return true
  // Setter und Closer arbeiten am Hot Lead, schreiben aber Kommentar und
  // Kontaktdaten in den zugrunde liegenden Lead.
  const ich = nutzer.id
  const { data } = await supabase
    .from('hot_leads')
    .select('id')
    .eq('lead_id', leadId)
    .or(`opener_id.eq.${ich},setter_id.eq.${ich},closer_id.eq.${ich},reaktivierung_bearbeiter_id.eq.${ich}`)
    .limit(1)
  return (data?.length || 0) > 0
}

/**
 * Prüft Beteiligung und liefert bei Misserfolg die fertige Antwort.
 * Rückgabe: null wenn erlaubt, sonst { statusCode, ... }.
 */
export async function hotLeadVerlangen(supabase, nutzer, hotLeadId) {
  const stand = await hotLeadBeteiligt(supabase, nutzer, hotLeadId)
  if (stand === 'ja') return null
  if (stand === 'fehlt') {
    return { statusCode: 404, headers: KOPF, body: JSON.stringify({ error: 'Kontakt nicht gefunden' }) }
  }
  return verboten('Dieser Kontakt gehört nicht zu deinen', 'nicht_beteiligt')
}
