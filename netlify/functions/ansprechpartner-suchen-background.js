/**
 * Holt die Ansprechpartner aus den Impressen der Firmenwebsites.
 *
 * Von 28.851 kalten Leads trugen am 01.10.2026 nur 1.921 einen Namen. Bei den
 * uebrigen stand in jeder Mail der Firmenname statt eines Menschen. Die Namen
 * stehen aber fast immer oeffentlich im Impressum - das Impressum ist in
 * Deutschland Pflicht.
 *
 * Der Ablauf pro Lead: Website holen, Impressum finden, die Stelle um
 * "Vertreten durch" / "Inhaber" / "Geschäftsführer" ausschneiden, und das
 * Modell entscheidet, welcher Name darin der Ansprechpartner ist.
 *
 * Warum ein Modell und kein Suchmuster: Ein Muster kann einen Personennamen
 * nicht von einem Begriffspaar unterscheiden. In den Probelaeufen hielt es
 * "Ansprechpartner Immobilienverwaltung" aus einer Navigationsleiste fuer
 * einen Namen, "Mark Wohnungsgesellschaft" fuer einen Menschen und
 * "Oskar P. Mötteli" - den Gruender von 1982 - fuer den heutigen Inhaber.
 *
 * Die Anrede setzt diese Funktion nicht. Das macht der Trigger beim
 * Schreiben aus der Tabelle vorname_anrede, und was er nicht kennt, traegt
 * anrede-nachtragen nach. Zwei Wege zur Anrede wuerden auseinanderlaufen.
 *
 * Aufruf: POST /.netlify/functions/ansprechpartner-suchen-background
 * Antwort kommt sofort (202); die Arbeit laeuft danach bis zu 15 Minuten.
 */

import { createClient } from '@supabase/supabase-js'
import { ansprechpartnerStelle, namenspaarBrauchbar, andereFirma } from './utils/impressum.js'
import { anmeldungVerlangen } from './utils/session.js'
import { verboten } from './utils/zugriff.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

/* Wie viele Leads ein Durchgang vornimmt. Netlify bricht nach 15 Minuten ab,
   darum hoert die Funktion bei 12 selbst auf - ein Abbruch mitten im Lauf
   liesse die bereits geholten Ausschnitte ungenutzt verfallen. */
const JE_DURCHGANG = 1200
const FRIST_MS = 12 * 60 * 1000
const GLEICHZEITIG = 12
const JE_FRAGE = 20

/** Ein Modell beantwortet mehrere Ausschnitte auf einmal. */
async function frageModell(stuecke, schluessel) {
  const antwort = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content:
          'Du liest Ausschnitte aus Impressen von Immobilienfirmen und nennst den '
        + 'Ansprechpartner - den Inhaber, Geschäftsführer oder gesetzlichen Vertreter.\n\n'
        + 'Antworte als JSON: {"treffer":[{"nr":1,"vorname":"...","nachname":"..."}]}.\n\n'
        + 'Lass einen Eintrag WEG, wenn du unsicher bist. Insbesondere:\n'
        + '- kein Personenname da, sondern nur eine Firma ("MEISSLER & CO Verwaltungs GmbH")\n'
        + '- der Name gehört erkennbar zu einer anderen Firma: Webdesigner, Agentur, '
        + 'Hoster, Domainhändler, oder eine Mailadresse/Domain im Text passt nicht zur Firma\n'
        + '- es ist ein Gründer aus der Firmenhistorie und nicht die heutige Leitung\n'
        + '- es ist ein Begriffspaar und kein Name ("Ansprechpartner Immobilienverwaltung", '
        + '"Mark Wohnungsgesellschaft", "Gesetzlicher Vertreter")\n'
        + '- es ist nur ein Nachname ohne Vornamen, oder nur ein Vorname\n'
        + '- es ist eine Abkürzung (WEG, IVD, RDM, HV) oder ein Begriff aus dem '
        + 'Seitentext, den du mangels Namen genommen hast\n'
        + '- die Firma ist die Niederlassung einer Kette und das Impressum gehört der '
        + 'Zentrale. Erkennbar daran, dass die Adresse auf eine Unterseite zeigt '
        + '(ksk-immobilien.de/standort/siegburg) oder der Firmenname einen Ort trägt, '
        + 'den das Impressum nicht nennt. Der dort genannte Vorstand ist nicht der '
        + 'Ansprechpartner dieser Niederlassung.\n\n'
        + 'Stehen mehrere Personen da, nimm die erste. Titel wie Dipl.-Ing., Ing. oder '
        + 'Dr. gehören nicht in den Namen. Schreibe Namen in normaler Gross- und '
        + 'Kleinschreibung, auch wenn der Ausschnitt sie in Grossbuchstaben zeigt.\n\n'
        + 'Ein falscher Name ist schlimmer als kein Name: er landet in der Anrede einer '
        + 'echten Mail an diese Firma.',
      }, {
        role: 'user',
        content: stuecke
          .map((s, i) => `${i + 1}. Firma: ${s.firma}\n   Adresse: ${s.website}`
                            + `\n   Gefunden auf: ${s.quelle}\n   Impressum: ${s.text}`)
          .join('\n\n'),
      }],
    }),
  })
  if (!antwort.ok) {
    console.error('OpenAI:', antwort.status, (await antwort.text()).slice(0, 300))
    return []
  }
  const daten = await antwort.json()
  let geparst
  try {
    geparst = JSON.parse(daten.choices?.[0]?.message?.content || '{}')
  } catch (e) {
    console.error('Antwort nicht lesbar:', e.message)
    return []
  }
  return geparst.treffer || []
}

const kopfzeilen = { 'Content-Type': 'application/json' }
const antworte = (statusCode, nutzlast) =>
  ({ statusCode, headers: kopfzeilen, body: JSON.stringify(nutzlast) })

export async function handler(event) {
  /* Eine offene Background-Funktion kann jeder anstossen, und jeder Anstoss
     kostet Geld beim Modell. Darum dieselbe Huerde wie bei anrede-nachtragen. */
  const sitzung = await anmeldungVerlangen(event)
  if (sitzung.fehler) return sitzung.fehler
  if (!sitzung.nutzer?.istAdmin) return verboten('Nur die Leitung darf die Suche anstoßen')

  const schluessel = process.env.OPENAI_API_KEY
  if (!schluessel) return antworte(500, { error: 'OPENAI_API_KEY nicht konfiguriert' })

  const bis = Date.now() + FRIST_MS
  let menge = JE_DURCHGANG
  try {
    const koerper = JSON.parse(event.body || '{}')
    if (Number.isFinite(koerper?.menge)) menge = Math.min(Math.max(1, koerper.menge), JE_DURCHGANG)
  } catch { /* ohne Angabe die Vorgabe */ }

  // Leads, bei denen noch nie gesucht wurde und die eine Website haben.
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, unternehmensname, website')
    .is('ansprechpartner_gesucht_am', null)
    .is('ansprechpartner_vorname', null)
    .not('website', 'is', null)
    .neq('website', '')
    .limit(menge)
  if (error) {
    console.error('Leads laden:', error)
    return antworte(500, { error: error.message })
  }
  if (!leads?.length) {
    console.log('ansprechpartner-suchen: nichts offen')
    return antworte(200, { offen: 0 })
  }

  /* Die Leads sofort belegen, bevor die Arbeit beginnt.
     
     Ein Durchgang dauert gut zehn Minuten. Wurde der Vermerk erst am Ende
     gesetzt, griff sich ein zweiter, gleichzeitig gestarteter Durchgang
     dieselben Leads - er fragt ja nach denen ohne Vermerk, und den gab es
     noch nicht. Jede Seite waere zweimal geholt und jeder Ausschnitt zweimal
     bezahlt worden.
     
     Reserviert wird nur, was noch frei ist: `.is(..., null)` im Update laesst
     einen Lead aus, den ein anderer Durchgang in der Zwischenzeit genommen
     hat. Was dabei durchfaellt, wird hier auch nicht bearbeitet. */
  const jetzt = new Date().toISOString()
  const belegt = []
  for (let k = 0; k < leads.length; k += 500) {
    const teil = leads.slice(k, k + 500)
    const { data: genommen, error: belegFehler } = await supabase
      .from('leads')
      .update({ ansprechpartner_gesucht_am: jetzt })
      .in('id', teil.map(l => l.id))
      .is('ansprechpartner_gesucht_am', null)
      .select('id')
    if (belegFehler) {
      console.error('Belegen:', belegFehler.message)
      continue
    }
    const meine = new Set((genommen || []).map(z => z.id))
    belegt.push(...teil.filter(l => meine.has(l.id)))
  }
  if (!belegt.length) {
    console.log('ansprechpartner-suchen: alles schon in Arbeit')
    return antworte(200, { offen: 0 })
  }
  console.log(`belegt: ${belegt.length} von ${leads.length}`)

  // Die Websites parallel holen - das ist der langsame Teil.
  const stuecke = []
  const ohneStelle = []
  let i = 0
  async function arbeiter() {
    while (i < belegt.length && Date.now() < bis) {
      const lead = belegt[i++]
      try {
        const stelle = await ansprechpartnerStelle(lead.website)
        if (stelle?.text) {
          stuecke.push({ id: lead.id, firma: lead.unternehmensname || '',
                         website: lead.website, ...stelle })
        } else {
          ohneStelle.push(lead.id)
        }
      } catch (e) {
        console.error('Website', lead.website, e.message)
        ohneStelle.push(lead.id)
      }
    }
  }
  await Promise.all(Array.from({ length: GLEICHZEITIG }, arbeiter))
  console.log(`geholt: ${stuecke.length} mit Stelle, ${ohneStelle.length} ohne`)

  // Das Modell fragen und schreiben.
  let gesetzt = 0
  for (let k = 0; k < stuecke.length; k += JE_FRAGE) {
    const teil = stuecke.slice(k, k + JE_FRAGE)
    const treffer = await frageModell(teil, schluessel)
    for (const t of treffer) {
      const lead = teil[Number(t.nr) - 1]
      if (!lead) continue
      /* Fuehrt die Spur auf eine andere Domain, gehoert der Name einer
         anderen Firma - der Agentur, dem Hoster, einem Nachfolger. Das ist
         eindeutig genug fuer eine Regel; die Filiale einer Kette erkennt nur
         das Modell, darum steht sie oben im Auftrag. */
      if (andereFirma(lead.quelle, lead.website)) {
        console.log('andere Firma:', lead.website, '->', lead.quelle)
        continue
      }
      const paar = namenspaarBrauchbar(t.vorname, t.nachname)
      if (!paar) continue
      const { vorname, nachname } = paar
      const { error: schreibfehler } = await supabase
        .from('leads')
        .update({
          ansprechpartner_vorname: vorname,
          ansprechpartner_nachname: nachname,
          ansprechpartner_quelle: lead.quelle,
          // Der Zeitstempel steht schon aus der Belegung. Wird er hier noch
          // einmal gesetzt, verliert er seine Aussage: an ihm laesst sich
          // sonst nicht mehr ablesen, welche Leads zu welchem Durchgang
          // gehoerten.
        })
        .eq('id', lead.id)
        .is('ansprechpartner_vorname', null)   // nichts von Hand Gesetztes ueberschreiben
      if (schreibfehler) console.error('Schreiben', lead.id, schreibfehler.message)
      else gesetzt++
    }
  }

  /* Was die Frist nicht mehr geschafft hat, wieder freigeben.

     Die Belegung schuetzt davor, dass zwei Durchgaenge dieselbe Seite holen.
     Laeuft die Frist ab, bleibt der Rest der Liste aber unbearbeitet - und
     galt dann fuer immer als durchsucht. Bei Johannes Immobilien stand
     "Geschäftsführer: Alexander Johannes" im Impressum, bei Seebauer
     "Gerhard Seebauer", bei MH Immobilien "Monika Haumann": alle drei nie
     geholt, alle drei abgehakt.

     Eine Seite zu holen kostet nichts. Ein verlorener Name schon. */
  const bearbeitet = new Set([...ohneStelle, ...stuecke.map(s => s.id)])
  const liegengeblieben = belegt.filter(l => !bearbeitet.has(l.id)).map(l => l.id)
  for (let k = 0; k < liegengeblieben.length; k += 500) {
    const { error: e } = await supabase
      .from('leads')
      .update({ ansprechpartner_gesucht_am: null })
      .in('id', liegengeblieben.slice(k, k + 500))
      .is('ansprechpartner_quelle', null)
    if (e) console.error('Freigeben:', e.message)
  }
  if (liegengeblieben.length) {
    console.log(`Frist abgelaufen, ${liegengeblieben.length} wieder freigegeben`)
  }

  const bericht = { geladen: leads.length, vorgenommen: belegt.length,
                    mit_stelle: stuecke.length, gesetzt }
  console.log('ansprechpartner-suchen:', JSON.stringify(bericht))
  return antworte(200, bericht)
}
