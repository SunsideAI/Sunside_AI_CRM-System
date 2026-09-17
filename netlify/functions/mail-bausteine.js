// Mail-Bausteine für das Closing, gebaut aus der Übergabe des Setters.
//
// Im Abschlussgespräch hängt viel an der Mail davor. Die gute Fassung
// spiegelt dem Kunden seine eigenen Zahlen und Worte zurück - "rund 25
// Eigentümeranfragen im Jahr, fast alle über Ihr Netzwerk, Ziel 40" - und
// nennt genau einen nächsten Schritt. Diese Angaben stehen im CRM: Der Setter
// hat sie in der Übergabe 2 eingetragen.
//
// Diese Function sammelt sie, lässt daraus Bausteine schreiben und gibt sie
// zum Einfügen zurück. Sie erfindet nichts: Was nicht im Datensatz steht,
// darf nicht in der Mail stehen. Der Closer entscheidet, was er übernimmt.

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { darf, verboten, hotLeadVerlangen } from './utils/zugriff.js'
import { FELDER } from '../../shared/felder.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}
const antwort = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) })

/**
 * Die Anlässe, zu denen aus dem Closing eine Mail rausgeht - und welche
 * Bausteine dabei gebraucht werden. Die Reihenfolge ist die Reihenfolge in
 * der Mail.
 */
export const ANLAESSE = {
  vorbereitung: {
    name: 'Vor dem Abschlussgespräch',
    zweck: 'Nach dem Beratungsgespräch, als Vorbereitung auf das Abschlussgespräch.',
    bausteine: [
      ['Einstieg', 'Dank für das Gespräch und Bezug auf den nächsten Termin. Zwei Sätze.'],
      ['Rückspiegelung', 'Was der Kollege mitgenommen hat: Ausgangslage, Zahlen und Ziel des Kunden in seinen eigenen Worten. Der wichtigste Baustein.'],
      ['Was bis zum Termin entsteht', 'Was wir bis zum Gespräch vorbereiten, passend zum Ziel des Kunden.'],
      ['Bitte vorab', 'Eine einzige Bitte: das passende Video ansehen. Platzhalter [LINK] für die Adresse.'],
      ['Übergang', 'Ein Satz, dass man im Gespräch direkt beim Wesentlichen einsteigt.'],
      ['PS', 'Hinweis auf eine Referenz oder Unterlage im Anhang, passend zur Berufsgruppe.']
    ]
  },
  unterlagen: {
    name: 'Unterlagen nachsenden',
    zweck: 'Die zugesagten Unterlagen oder die Analyse nachreichen.',
    bausteine: [
      ['Einstieg', 'Bezug auf das Gespräch und die Zusage. Zwei Sätze.'],
      ['Was mitgeschickt wird', 'Was im Anhang liegt und was der Kunde darin findet.'],
      ['Worauf zu achten ist', 'Ein bis zwei Punkte, die für die Lage des Kunden wichtig sind.'],
      ['Nächster Schritt', 'Der vereinbarte Schritt mit Datum, falls vorhanden.'],
      ['PS', 'Kurzer Hinweis auf eine Referenz oder ein Beispiel.']
    ]
  },
  angebot: {
    name: 'Angebot erklären',
    zweck: 'Das verschickte Angebot begleiten und einordnen.',
    bausteine: [
      ['Einstieg', 'Bezug auf das Abschlussgespräch, Hinweis auf das Angebot.'],
      ['Was im Angebot steht', 'Die Bestandteile in der Sprache des Kunden, nicht als Leistungsliste.'],
      ['Warum dieser Zuschnitt', 'Begründung aus Ziel, Zahlen und Investitionsrahmen des Kunden.'],
      ['Nächster Schritt', 'Was der Kunde jetzt tun soll, mit Frist falls zugesagt.'],
      ['PS', 'Ein Satz zu einer offenen Hürde, falls eine notiert ist.']
    ]
  },
  nachfassen: {
    name: 'Nachfassen',
    zweck: 'Es kam keine Reaktion, der Faden soll ohne Druck wieder aufgenommen werden.',
    bausteine: [
      ['Einstieg', 'Leichter Anknüpfer ohne Vorwurf, Bezug auf den letzten Stand.'],
      ['Erinnerung an den Schritt', 'Der zugesagte Schritt und was noch offen ist.'],
      ['Entscheidungshilfe', 'Ein Gedanke, der die notierte Hürde aufgreift.'],
      ['Ausweg', 'Eine einfache Frage, auf die auch ein Nein leicht fällt.'],
      ['PS', 'Optionaler Hinweis auf eine passende Unterlage.']
    ]
  },
  neuer_termin: {
    name: 'Neuer Termin nach Platzer',
    zweck: 'Der Termin ist geplatzt, ein neuer soll zustande kommen.',
    bausteine: [
      ['Einstieg', 'Freundlich, ohne Vorwurf.'],
      ['Bezug', 'Worum es im Termin gehen sollte, in einem Satz.'],
      ['Terminvorschlag', 'Bitte um einen neuen Termin, Platzhalter [LINK] für die Buchungsseite.'],
      ['PS', 'Optionaler Hinweis, dass die Unterlagen weiter gelten.']
    ]
  },
  onboarding: {
    name: 'Nach dem Abschluss',
    zweck: 'Der Kunde hat zugesagt, jetzt beginnt die Zusammenarbeit.',
    bausteine: [
      ['Einstieg', 'Dank und Freude, kurz und ohne Überschwang.'],
      ['Was jetzt passiert', 'Die nächsten Schritte im Onboarding.'],
      ['Was wir brauchen', 'Was der Kunde beisteuern muss, als kurze Liste.'],
      ['PS', 'Wer ab jetzt der Ansprechpartner ist.']
    ]
  }
}

// Felder, die nicht in FELDER stehen, aber für eine Mail zählen.
const ZUSATZ = {
  unternehmen: 'Unternehmen',
  ansprechpartner: 'Ansprechpartner',
  ort: 'Ort',
  website: 'Website',
  kategorie: 'Kategorie',
  termin_beratungsgespraech: 'Beratungsgespräch',
  termin_abschlussgespraech: 'Abschlussgespräch',
  gespraechsausgang: 'Ausgang des Beratungsgesprächs',
  zugesagter_schritt: 'Zugesagter nächster Schritt',
  zugesagt_bis: 'Zugesagt bis',
  nachfass_grund: 'Grund fürs Nachfassen',
  angebot_paket: 'Angebotspaket',
  angebot_setup: 'Angebot: Einrichtung (EUR)',
  angebot_gebuehr: 'Angebot: monatlich (EUR)',
  material_versendet: 'Bereits verschickt',
  empfohlenes_nachfass_stueck: 'Empfohlenes Nachfass-Stück',
  monatliche_besuche: 'Website-Besuche pro Monat',
  anzahl_leads: 'Anfragen über die Website',
  setter: 'Beratungsgespräch geführt von',
  closer: 'Abschlussgespräch führt'
}

const LEER = [null, undefined, '', 'Nicht gefragt', 'Nichts genannt', 'Noch nicht besprochen']

function datum(wert) {
  if (!wert) return null
  const d = new Date(wert)
  if (isNaN(d.getTime())) return String(wert)
  const nurTag = /^\d{4}-\d{2}-\d{2}$/.test(String(wert))
  return d.toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(nurTag ? {} : { hour: '2-digit', minute: '2-digit' }),
    timeZone: 'Europe/Berlin'
  }) + (nurTag ? '' : ' Uhr')
}

/** Aus dem Datensatz die Angaben machen, die in einer Mail etwas wert sind. */
export function grundlageBauen(lead) {
  const rohwerte = {
    unternehmen: lead.unternehmen || lead.original_lead?.unternehmensname,
    ansprechpartner: [lead.ansprechpartner_vorname || lead.original_lead?.ansprechpartner_vorname,
      lead.ansprechpartner_nachname || lead.original_lead?.ansprechpartner_nachname].filter(Boolean).join(' '),
    ort: lead.ort || lead.original_lead?.stadt,
    website: lead.website,
    kategorie: lead.kategorie || lead.original_lead?.kategorie,
    setter: lead.setter?.vor_nachname,
    closer: lead.closer?.vor_nachname,
    termin_beratungsgespraech: datum(lead.termin_beratungsgespraech),
    termin_abschlussgespraech: datum(lead.termin_abschlussgespraech),
    zugesagt_bis: datum(lead.zugesagt_bis),
    ...Object.fromEntries(Object.keys(FELDER).map(k => [k, lead[k]])),
    gespraechsausgang: lead.gespraechsausgang,
    zugesagter_schritt: lead.zugesagter_schritt,
    nachfass_grund: lead.nachfass_grund,
    angebot_paket: lead.angebot_paket,
    angebot_setup: lead.angebot_setup,
    angebot_gebuehr: lead.angebot_gebuehr,
    material_versendet: Array.isArray(lead.material_versendet) ? lead.material_versendet.join(', ') : lead.material_versendet,
    empfohlenes_nachfass_stueck: lead.empfohlenes_nachfass_stueck,
    monatliche_besuche: lead.monatliche_besuche,
    anzahl_leads: lead.anzahl_leads
  }

  const beschriftung = schluessel => ZUSATZ[schluessel] || FELDER[schluessel]?.name || schluessel

  return Object.entries(rohwerte)
    .filter(([, wert]) => !LEER.includes(wert) && !(Array.isArray(wert) && wert.length === 0))
    .map(([schluessel, wert]) => [
      beschriftung(schluessel),
      typeof wert === 'boolean' ? (wert ? 'ja' : 'nein') : String(wert)
    ])
}

const REGELN = `Regeln:
- Sie-Form, deutsch, sachlich und warm. Keine Floskeln, keine Superlative, keine Emojis, keine Ausrufezeichen.
- Kurze Absätze, höchstens drei Sätze je Baustein.
- Erfinde nichts. Nur die Angaben aus der Grundlage. Fehlt eine Zahl, dann schreibe ohne Zahl.
- Zitiere den Kunden wörtlich, wenn seine Worte in der Grundlage stehen.
- Genau eine Aufforderung in der ganzen Mail. Eine Adresse, die du nicht kennst, schreibst du als [LINK].
- Keine Anrede und keine Grußformel: Die setzt das CRM.
- Keine Preise nennen, wenn sie nicht in der Grundlage stehen.
- Jede Zahl behält ihre Bedeutung: Aufträge bleiben Aufträge, Anfragen bleiben Anfragen, eine Quote bleibt eine Quote. Nichts umdeuten und nichts hochrechnen.
- Bewertungen wie "nur" oder "immerhin" gehören nicht zu den Zahlen des Kunden.
- Diese Angaben sind interne Notizen und werden dem Kunden NICHT zurückgespiegelt: Investitionsrahmen, Bewusstseinsstufe, Tiefe, Entscheider-Messlatte, ob der Kunde Zahlen nennen wollte, ob er dem Rahmen ausgewichen ist. Sie bestimmen nur den Ton.`

function eingabeBauen({ anlass, grundlage, hinweis, absender }) {
  const a = ANLAESSE[anlass]
  return `Schreibe die Bausteine für eine Vertriebsmail von Sunside AI.

Anlass: ${a.name}. ${a.zweck}

Grundlage aus dem CRM (die einzigen erlaubten Angaben):
${grundlage.map(([k, v]) => `- ${k}: ${v}`).join('\n')}
${hinweis ? `\nZusätzlicher Hinweis des Absenders (hat Vorrang): ${hinweis}\n` : ''}
Absender: ${absender}

Diese Bausteine, in dieser Reihenfolge:
${a.bausteine.map(([titel, zweck], i) => `${i + 1}. ${titel} — ${zweck}`).join('\n')}

${REGELN}

Antworte ausschliesslich mit JSON in dieser Form:
{"betreff": "...", "bausteine": [{"titel": "...", "text": "..."}], "entwurf": "alle Bausteine hintereinander als fertiger Mailtext, Absätze mit \\n\\n getrennt"}`
}

// Welches Modell schreibt: Claude, sobald ANTHROPIC_API_KEY in Netlify
// hinterlegt ist. Solange nur der vorhandene OpenAI-Zugang da ist, schreibt
// der. Beides liefert dieselbe Antwortform, damit die Oberfläche es nicht
// unterscheiden muss.
const MODELL_CLAUDE = 'claude-opus-5'
const MODELL_OPENAI = 'gpt-4o-mini'

const SYSTEM = 'Du schreibst Vertriebsmails für Sunside AI, eine Agentur für Sichtbarkeit und KI-Assistenzen für Makler und Sachverständige. Du antwortest nur mit JSON.'

function jsonLesen(roh, modell) {
  const text = String(roh || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const inhalt = JSON.parse(text)
    return { betreff: inhalt.betreff || '', bausteine: inhalt.bausteine || [], entwurf: inhalt.entwurf || '', modell }
  } catch {
    // Lieber der ganze Text als ein Fehler - der Closer kann ihn verwenden.
    return { betreff: '', bausteine: [], entwurf: text, modell }
  }
}

async function mitClaude(eingabe) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELL_CLAUDE,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: eingabe }]
    })
  })
  const daten = await res.json()
  if (!res.ok) throw new Error(daten?.error?.message || `Anthropic antwortete mit ${res.status}`)
  const text = (daten.content || []).filter(t => t.type === 'text').map(t => t.text).join('')
  return jsonLesen(text, MODELL_CLAUDE)
}

async function mitOpenai(eingabe) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELL_OPENAI,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: eingabe }]
    })
  })
  const daten = await res.json()
  if (!res.ok) throw new Error(daten?.error?.message || `OpenAI antwortete mit ${res.status}`)
  return jsonLesen(daten.choices?.[0]?.message?.content, MODELL_OPENAI)
}

async function bausteineHolen(eingabe) {
  if (process.env.ANTHROPIC_API_KEY) return mitClaude(eingabe)
  if (process.env.OPENAI_API_KEY) return mitOpenai(eingabe)
  throw Object.assign(new Error('Kein Schlüssel für die Textvorschläge konfiguriert'), { code: 'kein_schluessel' })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const zugang = anmeldungVerlangen(event)
  if (zugang.antwort) return zugang.antwort
  const angemeldet = zugang.nutzer

  if (event.httpMethod !== 'POST') return antwort(405, { error: 'Method not allowed' })
  if (!darf.vertrieb(angemeldet)) return verboten()

  try {
    const { hotLeadId, anlass, hinweis } = JSON.parse(event.body || '{}')

    if (!ANLAESSE[anlass]) {
      return antwort(400, { error: 'Unbekannter Anlass', anlaesse: Object.keys(ANLAESSE) })
    }
    const gesperrt = await hotLeadVerlangen(supabase, angemeldet, hotLeadId)
    if (gesperrt) return gesperrt

    const { data: lead, error } = await supabase
      .from('hot_leads')
      .select(`*,
        setter:users!hot_leads_setter_id_fkey(vor_nachname),
        closer:users!hot_leads_closer_id_fkey(vor_nachname),
        original_lead:leads!hot_leads_lead_id_fkey(unternehmensname, ansprechpartner_vorname, ansprechpartner_nachname, stadt, kategorie)`)
      .eq('id', hotLeadId)
      .single()
    if (error) throw new Error(error.message)

    const grundlage = grundlageBauen(lead)
    // Unter fünf Angaben wird jeder Text zur Behauptung. Dann lieber sagen,
    // was fehlt, als eine Mail erfinden.
    if (grundlage.length < 5) {
      return antwort(422, {
        error: 'zu_wenig_grundlage',
        message: 'Für Vorschläge fehlen noch Angaben aus der Übergabe des Setters.',
        grundlage
      })
    }

    const ergebnis = await bausteineHolen(eingabeBauen({
      anlass,
      grundlage,
      hinweis: typeof hinweis === 'string' ? hinweis.slice(0, 500) : '',
      absender: angemeldet.name
    }))

    return antwort(200, { ...ergebnis, anlass, grundlage })
  } catch (fehler) {
    console.error('[mail-bausteine]', fehler)
    if (fehler.code === 'kein_schluessel') {
      return antwort(503, { error: 'kein_schluessel', message: 'Die KI-Vorschläge sind noch nicht eingerichtet.' })
    }
    return antwort(500, { error: fehler.message })
  }
}
