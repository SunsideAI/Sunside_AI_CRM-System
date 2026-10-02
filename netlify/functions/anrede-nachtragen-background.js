// Traegt die Anrede fuer Vornamen nach, die das Nachschlagewerk nicht kennt.
//
// Der Datenbank-Trigger setzt die Anrede sofort aus der Tabelle vorname_anrede
// - kostenlos und ohne Wartezeit, und das deckt fast alles ab. Was uebrig
// bleibt, sind neue Namen: ein tuerkischer Vorname, eine seltene Schreibweise,
// ein Name aus einem Land, aus dem bisher niemand dabei war.
//
// Diese Funktion sammelt genau die ein, fragt das Modell einmal fuer alle und
// schreibt das Ergebnis INS NACHSCHLAGEWERK. Beim naechsten Mal kennt der
// Trigger den Namen und braucht keine KI mehr. Die Tabelle lernt also dazu,
// und die Kosten sinken mit jedem Lauf.
//
// Was unsicher ist, bleibt unbesetzt: Die Mail gruesst dann mit vollem Namen.
// Eine falsche Anrede faellt beim Empfaenger sofort auf; eine fehlende nicht.
//
// Laeuft als Background Function: 1.579 unbekannte Vornamen sind rund
// vierzig Anfragen ans Modell, und so lange haelt eine gewoehnliche Funktion
// nicht durch. Die Antwort kommt sofort (202), die Arbeit danach.
//
// Aufruf: POST /.netlify/functions/anrede-nachtragen-background
// Im Protokoll: { geprueft, gelernt, offen }

import { createClient } from '@supabase/supabase-js'
import { anmeldungVerlangen } from './utils/session.js'
import { darf, verboten } from './utils/zugriff.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

/** Nur was wie ein Vorname aussieht. Firmen und Floskeln gar nicht erst fragen. */
function kommtInFrage(vorname) {
  const v = (vorname || '').trim()
  if (v.length < 2 || v.length > 20) return false
  if (/[0-9@&+,/]/.test(v)) return false
  if (/ und | oder /i.test(v)) return false
  if (/^(herr|frau|hr|fr|damen|firma|team|makler|test|angebot|sehr|liebe)/i.test(v)) return false
  return /^[A-Za-zÄÖÜäöüßÀ-ÿ'-]+$/.test(v)
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Nur POST' }) }
  }

  const sitzung = await anmeldungVerlangen(event)
  if (sitzung.fehler) return sitzung.fehler
  const angemeldet = sitzung.nutzer
  if (!darf.vertrieb(angemeldet)) return verboten('Dafür fehlt die Berechtigung')

  const schluessel = process.env.OPENAI_API_KEY
  if (!schluessel) {
    return {
      statusCode: 500, headers: corsHeaders,
      body: JSON.stringify({ error: 'OPENAI_API_KEY nicht konfiguriert' })
    }
  }

  try {
    // Welche Vornamen stehen ohne Anrede da?
    const [hot, kalt, bekannt] = await Promise.all([
      supabase.from('hot_leads').select('ansprechpartner_vorname').is('anrede', null),
      supabase.from('leads').select('ansprechpartner_vorname').is('anrede', null),
      supabase.from('vorname_anrede').select('vorname')
    ])
    const schonDa = new Set((bekannt.data || []).map(z => z.vorname))

    const offen = [...new Set(
      [...(hot.data || []), ...(kalt.data || [])]
        .map(z => (z.ansprechpartner_vorname || '').trim().split(' ')[0])
        .filter(kommtInFrage)
        .map(v => v.normalize('NFC'))
        .filter(v => !schonDa.has(v.toLowerCase()))
    )]

    if (offen.length === 0) {
      return { statusCode: 200, headers: corsHeaders,
               body: JSON.stringify({ geprueft: 0, gelernt: 0, offen: 0 }) }
    }

    // In Haeppchen fragen, damit eine Antwort nicht zu lang wird.
    const gelernt = []
    for (let i = 0; i < offen.length; i += 40) {
      const teil = offen.slice(i, i + 40)
      const antwort = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'system',
            content: 'Du ordnest Vornamen einem Geschlecht zu, für die Anrede in einer '
                   + 'Geschäftsmail. Antworte als JSON: {"namen":[{"name":"...","anrede":"Herr|Frau|unklar"}]}. '
                   + 'Nimm "unklar", wenn der Name in Deutschland für beide Geschlechter '
                   + 'vorkommt (Kim, Dominique, Toni, Sidney, Chris), wenn es ein Nachname '
                   + 'oder kein Personenname ist, oder wenn du dir nicht sicher bist. '
                   + 'Im Zweifel immer "unklar" - eine falsche Anrede ist schlimmer als keine.'
          }, {
            role: 'user',
            content: teil.join(', ')
          }]
        })
      })

      if (!antwort.ok) {
        console.error('OpenAI:', antwort.status, await antwort.text())
        continue
      }
      const daten = await antwort.json()
      let geparst
      try {
        geparst = JSON.parse(daten.choices?.[0]?.message?.content || '{}')
      } catch (e) {
        console.error('Antwort nicht lesbar:', e)
        continue
      }
      for (const eintrag of geparst.namen || []) {
        if (['Herr', 'Frau'].includes(eintrag.anrede) && kommtInFrage(eintrag.name)) {
          gelernt.push({ vorname: eintrag.name.trim().toLowerCase(), anrede: eintrag.anrede })
        }
      }
    }

    if (gelernt.length > 0) {
      await supabase.from('vorname_anrede').upsert(gelernt, { onConflict: 'vorname' })
      // Die Datensaetze nachziehen: Der Trigger greift nur beim Schreiben.
      await supabase.rpc('anrede_nachziehen')
    }

    return {
      statusCode: 200, headers: corsHeaders,
      body: JSON.stringify({ geprueft: offen.length, gelernt: gelernt.length,
                             offen: offen.length - gelernt.length })
    }
  } catch (fehler) {
    console.error('anrede-nachtragen:', fehler)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: fehler.message }) }
  }
}
