// Fragen-Vorschlag für das Beratungsgespräch (Ticket 17, Feldspezifikation
// Block 3).
//
// Bei anderer Branche, eigenem Vorhaben und Sachverständigen passen die
// Standardfragen des Skripts nicht oder nur mit anderen Wörtern. Dann
// übersetzt ein Modell unser festes Gerüst auf den Fall: höchstens sieben
// sprechbare Fragen, in derselben Reihenfolge, nichts dazuerfunden.
//
// Leitplanken:
// - Ein Aufruf beim ersten Öffnen, das Ergebnis wird gespeichert. Neu nur auf
//   Knopfdruck, sonst sähe der Setter beim zweiten Blick andere Fragen.
// - In den Prompt gehen nur Branche, Vorhaben ja/nein, Problem im Wortlaut
//   und Ziel. Keine Namen, keine Firma, keine Kontaktdaten.
// - Die KI schlägt nur Fragen vor. Sie füllt kein Feld und fasst nichts
//   zusammen.
// - Fällt das Modell aus oder braucht es zu lange, kommt die Basis zurück.
//   Nie eine leere Bubble.
// - Protokolliert wird ohne Kundendaten: Kontakt-ID, Dauer, Modell, Anzahl.

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { darf, verboten, hotLeadVerlangen } from './utils/zugriff.js'
import { BRANCHE, ZIEL } from '../../shared/felder.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}
const antwort = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) })

/** Die Basis in sprechbarer Form, wörtlich aus der Spezifikation. */
export const BASIS = [
  'Was wollen Sie erreichen?',
  'Was läuft heute nicht so, wie es soll?',
  'Was haben Sie schon versucht, um das zu lösen?',
  'Was bräuchten Sie, damit das besser läuft?',
  'Woran würden Sie in einem halben Jahr festmachen, dass es sich gelohnt hat?',
  'Was wären Sie bereit zu investieren?',
  'Wer entscheidet das bei Ihnen mit?'
]

// Netlify bricht eine Function nach zehn Sekunden ab. Das Modell bekommt
// weniger, damit die Basis noch rechtzeitig zurückkommt.
const ZEITLIMIT_MS = 8000
const MODELL_CLAUDE = 'claude-sonnet-5'
const MODELL_OPENAI = 'gpt-4o-mini'

const SYSTEM = 'Du hilfst Settern von Sunside AI, einer Agentur für Sichtbarkeit und KI-Assistenzen für Makler und Sachverständige, im Beratungsgespräch am Telefon. Du antwortest nur mit JSON.'

function fallBeschreiben(lead) {
  const branche = lead.berufsgruppe === BRANCHE.ANDERE
    ? `andere Branche${lead.branche_andere ? ` (${lead.branche_andere})` : ''}`
    : lead.berufsgruppe || 'unbekannt'
  const ziel = lead.ziel && lead.ziel !== ZIEL.OFFEN
    ? lead.ziel
    : (lead.ziele || []).filter(z => z !== ZIEL.OFFEN).join(', ') || 'noch nicht besprochen'
  return [
    `Branche: ${branche}`,
    `Konkretes eigenes Vorhaben: ${lead.vorhaben === true ? 'ja' : 'nein'}`,
    `Größtes Problem in seinen Worten: ${lead.schmerzpunkt_wortlaut ? `„${String(lead.schmerzpunkt_wortlaut).slice(0, 600)}"` : 'nicht notiert'}`,
    `Ziel: ${ziel}`
  ].join('\n')
}

function eingabeBauen(lead) {
  const sv = lead.berufsgruppe === BRANCHE.SV
  return `Der Setter führt gleich ein Beratungsgespräch. Unser Gesprächsgerüst passt auf diesen Fall nicht wörtlich. Übersetze es auf den Fall.

Der Fall:
${fallBeschreiben(lead)}

Das Gerüst, in genau dieser Reihenfolge:
1. Was ist sein Ziel?
2. Was ist sein Problem?
3. Was hat er schon probiert, um es zu lösen?
4. Was bräuchte er, damit das besser läuft?
5. Woran würde er in einem halben Jahr festmachen, dass es sich gelohnt hat?
6. Was ist sein Budget?
7. Wer ist noch Entscheider?

Regeln:
- Höchstens sieben Fragen, eine je Punkt des Gerüsts, in derselben Reihenfolge.
- Jede Frage in Sie-Form, so formuliert, dass man sie am Telefon wörtlich vorlesen kann. Ein Satz, höchstens zwei.
- Übersetzen, nicht erweitern: Du darfst umformulieren und die Sprache des Falls verwenden, aber kein zusätzliches Thema erfinden.
- Keine Preise, keine erfundenen Zahlen, keine Zusagen.
- Keine Gedankenstriche, keine Emojis.${sv ? '\n- Der Kunde ist Sachverständiger für Immobilienbewertung: Sprich von Bewertungsanfragen und Gutachten-Aufträgen statt von Eigentümeranfragen und Objekten.' : ''}

Antworte ausschließlich mit JSON in dieser Form:
{"fragen": ["...", "..."]}`
}

function fragenLesen(roh) {
  const text = String(roh || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const inhalt = JSON.parse(text)
  const fragen = (Array.isArray(inhalt?.fragen) ? inhalt.fragen : [])
    .map(f => String(f || '').trim())
    .filter(Boolean)
    .slice(0, 7)
  if (fragen.length === 0) throw new Error('Leere Antwort')
  return fragen
}

async function mitClaude(eingabe, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELL_CLAUDE,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: 'user', content: eingabe }]
    })
  })
  const daten = await res.json()
  if (!res.ok) throw new Error(`Anthropic antwortete mit ${res.status}`)
  const text = (daten.content || []).filter(t => t.type === 'text').map(t => t.text).join('')
  return { fragen: fragenLesen(text), modell: MODELL_CLAUDE }
}

async function mitOpenai(eingabe, signal) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELL_OPENAI,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: eingabe }]
    })
  })
  const daten = await res.json()
  if (!res.ok) throw new Error(`OpenAI antwortete mit ${res.status}`)
  return { fragen: fragenLesen(daten.choices?.[0]?.message?.content), modell: MODELL_OPENAI }
}

async function fragenHolen(lead) {
  const eingabe = eingabeBauen(lead)
  const abbruch = new AbortController()
  const wecker = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS)
  try {
    if (process.env.ANTHROPIC_API_KEY) return await mitClaude(eingabe, abbruch.signal)
    if (process.env.OPENAI_API_KEY) return await mitOpenai(eingabe, abbruch.signal)
    throw new Error('Kein Schlüssel konfiguriert')
  } finally {
    clearTimeout(wecker)
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' }

  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer

  if (event.httpMethod !== 'POST') return antwort(405, { error: 'Method not allowed' })
  if (!darf.vertrieb(angemeldet)) return verboten()

  const { hotLeadId, neu = false } = JSON.parse(event.body || '{}')
  const gesperrt = await hotLeadVerlangen(supabase, angemeldet, hotLeadId)
  if (gesperrt) return gesperrt

  const { data: lead, error } = await supabase
    .from('hot_leads')
    .select('id, berufsgruppe, branche_andere, vorhaben, schmerzpunkt_wortlaut, ziel, ziele, fragen_vorschlag, fragen_vorschlag_am')
    .eq('id', hotLeadId)
    .single()
  if (error) return antwort(500, { error: error.message })

  // Gespeichert und nicht ausdrücklich neu verlangt: dieselben Fragen wie beim
  // ersten Öffnen.
  if (!neu && Array.isArray(lead.fragen_vorschlag?.fragen) && lead.fragen_vorschlag.fragen.length) {
    return antwort(200, { ...lead.fragen_vorschlag, am: lead.fragen_vorschlag_am, gespeichert: true })
  }

  const beginn = Date.now()
  try {
    const { fragen, modell } = await fragenHolen(lead)
    const vorschlag = { fragen, quelle: 'modell', modell }
    const am = new Date().toISOString()
    await supabase.from('hot_leads')
      .update({ fragen_vorschlag: vorschlag, fragen_vorschlag_am: am, zuletzt_geaendert_von: angemeldet.id })
      .eq('id', hotLeadId)
    console.log('[fragen-vorschlag]', JSON.stringify({ hotLeadId, ms: Date.now() - beginn, modell, anzahl: fragen.length }))
    return antwort(200, { ...vorschlag, am, gespeichert: false })
  } catch (fehler) {
    // Die Basis wird nicht gespeichert: Beim nächsten Öffnen versucht es das
    // System noch einmal.
    console.warn('[fragen-vorschlag] Basis statt Modell', JSON.stringify({
      hotLeadId, ms: Date.now() - beginn, grund: fehler.name === 'AbortError' ? 'Zeitlimit' : fehler.message
    }))
    return antwort(200, { fragen: BASIS, quelle: 'basis' })
  }
}
