// Welche Spalten ein Benutzer in welcher Liste sehen will - und in welcher
// Reihenfolge.
//
// Gespeichert wird in users.preferences (jsonb). Die Spalte gab es schon, sie
// wurde nur nie benutzt. Damit gilt die Einstellung auf jedem Geraet, nicht
// nur in dem Browser, in dem sie gesetzt wurde.

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { auswahlPruefen, STUFE } from '../../shared/spalten.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const kopf = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Content-Type': 'application/json'
}

const STUFEN = Object.values(STUFE)

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: kopf, body: '' }

  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const benutzerId = zugang.nutzer.id

  try {
    const { data, error } = await supabase
      .from('users').select('preferences').eq('id', benutzerId).single()
    if (error) throw error
    const bisher = (data?.preferences && typeof data.preferences === 'object') ? data.preferences : {}
    const tabellen = bisher.tabellen && typeof bisher.tabellen === 'object' ? bisher.tabellen : {}

    if (event.httpMethod === 'GET') {
      return { statusCode: 200, headers: kopf, body: JSON.stringify({ tabellen }) }
    }

    if (event.httpMethod === 'PATCH') {
      const koerper = JSON.parse(event.body || '{}')
      const stufe = koerper.stufe
      if (!STUFEN.includes(stufe)) {
        return { statusCode: 400, headers: kopf, body: JSON.stringify({ error: 'Unbekannte Stufe' }) }
      }
      // Null heisst: zurueck auf den Standard der Stufe.
      const spalten = koerper.spalten === null ? null : auswahlPruefen(stufe, koerper.spalten)
      if (koerper.spalten !== null && spalten === null) {
        return { statusCode: 400, headers: kopf, body: JSON.stringify({ error: 'Spalten fehlen oder sind kein Array' }) }
      }

      const neu = { ...tabellen }
      if (spalten === null) delete neu[stufe]
      else neu[stufe] = spalten

      const { error: schreibfehler } = await supabase
        .from('users')
        .update({ preferences: { ...bisher, tabellen: neu } })
        .eq('id', benutzerId)
      if (schreibfehler) throw schreibfehler

      return { statusCode: 200, headers: kopf, body: JSON.stringify({ tabellen: neu }) }
    }

    return { statusCode: 405, headers: kopf, body: JSON.stringify({ error: 'Methode nicht erlaubt' }) }
  } catch (e) {
    return { statusCode: 500, headers: kopf, body: JSON.stringify({ error: e.message }) }
  }
}
