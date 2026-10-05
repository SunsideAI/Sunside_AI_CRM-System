/**
 * Zeigt, warum ein Lead keinen Ansprechpartner bekam. Schreibt nichts.
 *
 * Der Scraper lief ueber 28.851 Leads und liess 12.175 leer, ohne zu
 * hinterlassen, woran es lag: an der Website, am Ausschnitt oder am Modell.
 * Ohne diese Unterscheidung ist jede Verbesserung ein Ratespiel - beim
 * Prompt dreimal nachgebessert, ohne dass Rudert, Kleiner oder Johannes
 * Immobilien dadurch einen Namen bekamen.
 *
 * Gibt pro Lead zurueck: ob eine Stelle gefunden wurde, den Ausschnitt, die
 * rohe Antwort des Modells und - falls sie verworfen wurde - den Grund.
 *
 * Dasselbe fuer die Anrede: ein Name ohne Anrede ist fuer die Mail nur
 * halb brauchbar, denn die Vorlage gruesst dann mit vollem Namen. Auch hier
 * war nicht zu sehen, ob das Modell einen Vornamen als Doppelnamen
 * einstufte oder gar nicht gefragt wurde.
 *
 * Aufruf: POST /.netlify/functions/ansprechpartner-diagnose
 *         { menge: 40 }                 Stichprobe aus den leeren Leads
 *         { websites: ["..."] }          bestimmte Adressen
 *         { vornamen: ["Jannik"] }       was das Modell zum Geschlecht sagt
 *         { vornamen: "offen" }          die Vornamen ohne Anrede aus der Datenbank
 *         { modell: "gpt-4o" }           anderes Modell zum Vergleich
 */

import { createClient } from '@supabase/supabase-js'
import { ansprechpartnerStelle, brauchbar, namenspaarBrauchbar, andereFirma }
  from './utils/impressum.js'
import { anmeldungVerlangen } from './utils/session.js'
import { verboten } from './utils/zugriff.js'
import { AUFTRAG } from './utils/ansprechpartner-auftrag.js'
import { ANREDE_AUFTRAG } from './utils/anrede-auftrag.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const kopfzeilen = { 'Content-Type': 'application/json' }
const antworte = (statusCode, nutzlast) =>
  ({ statusCode, headers: kopfzeilen, body: JSON.stringify(nutzlast) })

async function frageModell(stuecke, schluessel, modell) {
  const antwort = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modell,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AUFTRAG },
        { role: 'user', content: stuecke
            .map((s, i) => `${i + 1}. Firma: ${s.firma}\n   Adresse: ${s.website}`
                              + `\n   Gefunden auf: ${s.quelle}\n   Impressum: ${s.text}`)
            .join('\n\n') },
      ],
    }),
  })
  if (!antwort.ok) {
    return { fehler: `${antwort.status} ${(await antwort.text()).slice(0, 200)}` }
  }
  const daten = await antwort.json()
  const roh = daten.choices?.[0]?.message?.content || ''
  try { return { treffer: JSON.parse(roh).treffer || [], roh } }
  catch (e) { return { fehler: 'nicht lesbar: ' + e.message, roh } }
}

export async function handler(event) {
  const sitzung = await anmeldungVerlangen(event)
  if (sitzung.fehler) return sitzung.fehler
  if (!sitzung.nutzer?.istAdmin) return verboten('Nur die Leitung darf die Diagnose sehen')

  const schluessel = process.env.OPENAI_API_KEY
  if (!schluessel) return antworte(500, { error: 'OPENAI_API_KEY nicht konfiguriert' })

  let wunsch = {}
  try { wunsch = JSON.parse(event.body || '{}') } catch { /* ohne Angabe */ }
  const modell = typeof wunsch.modell === 'string' ? wunsch.modell : 'gpt-4o-mini'
  const menge = Math.min(Math.max(1, Number(wunsch.menge) || 20), 60)

  /* Der Anrede-Zweig: fragt genau wie anrede-nachtragen, schreibt aber
     nichts und gibt die rohe Antwort zurueck. */
  if (wunsch.vornamen) {
    let namen = wunsch.vornamen
    if (namen === 'offen') {
      const gesehen = new Set()
      for (const tabelle of ['leads', 'hot_leads']) {
        for (let von = 0; ; von += 1000) {
          const { data } = await supabase.from(tabelle)
            .select('ansprechpartner_vorname')
            .is('anrede', null).not('ansprechpartner_vorname', 'is', null)
            .range(von, von + 999)
          for (const z of data || []) {
            const v = (z.ansprechpartner_vorname || '').trim().split(' ')[0]
            if (v) gesehen.add(v.normalize('NFC'))
          }
          if ((data || []).length < 1000) break
        }
      }
      namen = [...gesehen]
    }
    if (!Array.isArray(namen) || !namen.length) {
      return antworte(400, { error: 'vornamen: Liste oder "offen"' })
    }
    const urteile = []
    const rohe = []
    for (let i = 0; i < Math.min(namen.length, 400); i += 40) {
      const teil = namen.slice(i, i + 40)
      const a = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modell, temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: ANREDE_AUFTRAG },
                     { role: 'user', content: teil.join(', ') }],
        }),
      })
      if (!a.ok) { rohe.push(`${a.status} ${(await a.text()).slice(0, 200)}`); continue }
      const roh = (await a.json()).choices?.[0]?.message?.content || ''
      try { urteile.push(...(JSON.parse(roh).namen || [])) }
      catch { rohe.push(roh.slice(0, 500)) }
    }
    const genannt = new Set(urteile.map(u => String(u.name || '').toLowerCase()))
    const zahl = (form) => urteile.filter(u => u.anrede === form).length
    return antworte(200, {
      modell,
      uebersicht: { gefragt: Math.min(namen.length, 400), beantwortet: urteile.length,
                    herr: zahl('Herr'), frau: zahl('Frau'), unklar: zahl('unklar'),
                    nicht_genannt: namen.slice(0, 400)
                      .filter(n => !genannt.has(String(n).toLowerCase())).length },
      unklar: urteile.filter(u => u.anrede === 'unklar').map(u => u.name),
      urteile,
      nicht_lesbar: rohe,
    })
  }

  let leads
  if (Array.isArray(wunsch.websites) && wunsch.websites.length) {
    leads = wunsch.websites.slice(0, 60)
      .map(w => ({ id: null, unternehmensname: '', website: String(w) }))
    /* Die Firmennamen nachladen - das Modell bekommt sie im Auftrag mit, und
       ohne sie laesst sich der Fall "Nachname steckt im Firmennamen" nicht
       nachstellen. */
    const { data } = await supabase.from('leads')
      .select('id, unternehmensname, website').in('website', leads.map(l => l.website))
    for (const l of leads) {
      const treffer = (data || []).find(d => d.website === l.website)
      if (treffer) Object.assign(l, treffer)
    }
  } else {
    /* Eine Stichprobe aus den leeren Leads. Nicht die ersten - die stehen
       alphabetisch zusammen und zeigen nur einen Ausschnitt der Wirklichkeit. */
    const { data, error } = await supabase
      .from('leads')
      .select('id, unternehmensname, website')
      .is('ansprechpartner_vorname', null)
      .not('website', 'is', null)
      .neq('website', '')
      .order('id')
      .range(Number(wunsch.ab) || 0, (Number(wunsch.ab) || 0) + menge - 1)
    if (error) return antworte(500, { error: error.message })
    leads = data || []
  }

  // Die Seiten holen.
  const ergebnis = []
  const stuecke = []
  let i = 0
  async function arbeiter() {
    while (i < leads.length) {
      const lead = leads[i++]
      const zeile = { firma: lead.unternehmensname, website: lead.website }
      try {
        const stelle = await ansprechpartnerStelle(lead.website)
        if (stelle?.text) {
          Object.assign(zeile, { quelle: stelle.quelle, ausschnitt: stelle.text })
          stuecke.push({ ...lead, firma: lead.unternehmensname || '', ...stelle, zeile })
        } else {
          zeile.grund = 'keine Stelle - Website nicht erreichbar oder ohne Impressum'
        }
      } catch (e) {
        zeile.grund = 'Website-Fehler: ' + e.message
      }
      ergebnis.push(zeile)
    }
  }
  await Promise.all(Array.from({ length: 12 }, arbeiter))

  // Das Modell fragen, in denselben Gruppen wie im echten Lauf.
  for (let k = 0; k < stuecke.length; k += 20) {
    const teil = stuecke.slice(k, k + 20)
    const { treffer, fehler, roh } = await frageModell(teil, schluessel, modell)
    if (fehler) {
      for (const s of teil) s.zeile.grund = 'Modell: ' + fehler
      if (roh) teil[0].zeile.rohe_antwort = roh.slice(0, 2000)
      continue
    }
    const genannt = new Set()
    for (const t of treffer) {
      const nr = Number(t.nr) - 1
      const s = teil[nr]
      if (!s) continue
      genannt.add(nr)
      s.zeile.modell = { vorname: t.vorname, nachname: t.nachname }
      if (andereFirma(s.quelle, s.website)) {
        s.zeile.grund = `verworfen: Fundstelle gehoert einer anderen Domain (${s.quelle})`
        continue
      }
      const paar = namenspaarBrauchbar(t.vorname, t.nachname)
      if (!paar) {
        s.zeile.grund = 'verworfen vom Filter: '
          + (!brauchbar(t.vorname) ? `Vorname "${t.vorname}"` : '')
          + (!brauchbar(t.nachname) ? ` Nachname "${t.nachname}"` : '')
          + (brauchbar(t.vorname) && brauchbar(t.nachname) ? 'Vor- und Nachname gleich' : '')
        continue
      }
      s.zeile.treffer = paar
    }
    for (let n = 0; n < teil.length; n++) {
      if (!genannt.has(n)) teil[n].zeile.grund = 'Modell liess den Eintrag weg'
    }
  }

  const zahl = (prueft) => ergebnis.filter(prueft).length
  return antworte(200, {
    modell,
    uebersicht: {
      geprueft: ergebnis.length,
      treffer: zahl(z => z.treffer),
      ohne_stelle: zahl(z => /keine Stelle|Website-Fehler/.test(z.grund || '')),
      stelle_aber_modell_nein: zahl(z => z.ausschnitt && /weggelassen|liess den Eintrag weg/.test(z.grund || '')),
      vom_filter_verworfen: zahl(z => /verworfen/.test(z.grund || '')),
    },
    leads: ergebnis,
  })
}
