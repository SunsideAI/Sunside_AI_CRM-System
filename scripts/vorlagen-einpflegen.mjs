#!/usr/bin/env node
// Pflegt die Mailvorlagen aus der Mailstrecken-Datei ins CRM ein.
//
//   node scripts/vorlagen-einpflegen.mjs            erzeugt supabase/vorlagen/vorlagen.sql
//   node scripts/vorlagen-einpflegen.mjs --zeigen   gibt die Vorlagen lesbar aus
//
// Die Datei docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md ist die
// einzige Quelle der Wortlaute (Miro F25: „redaktionelle Änderungen laufen
// immer zuerst über die Datei"). Dieses Skript schneidet die Mails dort aus,
// wortgleich, und setzt nur ein, was die Datei selbst als Regel nennt: den
// Magnet-Einschub je Segment, den Video-Satz der Eigentümer-Fassung und das
// passende Referenzschreiben-PS. Es formuliert nichts um.
//
// Die erzeugte SQL-Datei wird eingespielt; die Vorlagen tragen einen festen
// Schlüssel, ein zweiter Lauf überschreibt sie also, statt sie zu verdoppeln.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const QUELLE = join(WURZEL, 'docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md')
const ZIEL = join(WURZEL, 'supabase/vorlagen/vorlagen.sql')

// Übergangsregeln aus Teil E, solange die VSLs nicht aufgenommen sind. Steht
// ein VSL, hier auf true setzen und neu einpflegen.
const VSL_EIGENTUEMER_FERTIG = false      // sonst entfällt „und neuerdings in KI-Suchen wie ChatGPT"
const VSL_AUTOMATISIERUNG_FERTIG = false  // sonst kein Referenzschreiben-PS bei Automatisierung und SV

const text = readFileSync(QUELLE, 'utf8')

// ---------------------------------------------------------------------------

function abAnker(anker) {
  const i = text.indexOf(anker)
  if (i < 0) throw new Error(`Anker nicht gefunden: ${anker}`)
  return text.slice(i + anker.length)
}

/** Der erste Zitatblock nach dem Anker, optional nur einer mit Betreff. */
function zitat(anker, { mitBetreff = true } = {}) {
  const rest = abAnker(anker).split('\n')
  let start = -1
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('>')) continue
    if (mitBetreff && !rest[i].includes('**Betreff:**')) continue
    start = i
    break
  }
  if (start < 0) throw new Error(`Kein Zitat nach: ${anker}`)
  const zeilen = []
  for (let i = start; i < rest.length && rest[i].startsWith('>'); i++) {
    zeilen.push(rest[i].replace(/^> ?/, ''))
  }
  return zeilen
}

/** Zerlegt eine Mail in Betreff, Text und Anhang-Hinweis. */
function mail(anker) {
  const zeilen = zitat(anker)
  const betreff = zeilen[0].replace('**Betreff:**', '').trim()
  let koerper = zeilen.slice(1)
  let anhang = null
  koerper = koerper.filter(z => {
    const m = z.match(/^\*Anhang: (.+)\*$/)
    if (m) { anhang = m[1]; return false }
    return true
  })
  const inhalt = koerper.join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  return { betreff, inhalt, anhang }
}

/** Ein Satz in „…" hinter einem Vorspann. */
function zitierterSatz(vorspann) {
  const rest = abAnker(vorspann)
  const m = rest.match(/^\s*„([^“"]+)[“"]/)
  if (!m) throw new Error(`Kein zitierter Satz nach: ${vorspann}`)
  return m[1]
}

// ---------------------------------------------------------------------------
// Die Vorlagen
// ---------------------------------------------------------------------------

const vorlagen = []
const neu = (schluessel, name, kategorie, m, hinweis = null) =>
  vorlagen.push({ schluessel, name, kategorie, betreff: m.betreff, inhalt: m.inhalt, hinweis: hinweis || (m.anhang ? `Anhang: ${m.anhang}` : null) })

// Segment-Mails nach dem Erstanruf (Teil E, Nr. 2)
neu('segment_eigentuemer', 'Segment-Mail Eigentümer (Video Streil)', 'Opening', mail('Fassung Eigentümergewinnung:'))
neu('segment_kaeufer', 'Segment-Mail Kaufinteressenten (Zielfassung, wartet aufs Käufer-Video)', 'Opening', mail('Fassung Kaufinteressenten:'),
  'Zielfassung. Solange das Käufer-Video fehlt, gilt laut Datei die Übergangsfassung mit dem Streil-Kurzschnitt; ihr Wortlaut ist noch in Freigabe.')
neu('segment_automatisierung', 'Segment-Mail Automatisierung (Video Beier)', 'Opening', mail('Fassung Automatisierung/Entlastung'))
neu('segment_sachverstaendige', 'Segment-Mail Sachverständige (Video Beier)', 'Opening', mail('Fassung Sachverständige (Freigabe'))
neu('segment_vorhaben', 'Segment-Mail Vorhaben (Video Beier)', 'Opening', mail('Fassung Vorhaben (Freigabe'),
  'Das Vorhaben in einem Satz wörtlich aus dem Anruf einsetzen.')

// Bestätigungsmail nach dem Beratungsgespräch (Teil E, Nr. 6), je Segment
const basis = mail('**6. Die Bestätigungsmail')
const eigentuemerSatz = zitat('**Der Video-Satz beim Ziel Eigentümer', { mitBetreff: false }).join(' ').trim()
const magnete = {
  eigentuemer: zitierterSatz('**Eigentümer:**'),
  kaeufer: zitierterSatz('**Kaufinteressenten:**'),
  automatisierung: zitierterSatz('**Automatisierung:**'),
  sachverstaendige: zitierterSatz('**Sachverständige:**')
}
const svPs = zitierterSatz('das PS lautet dort')

function bestaetigung(segment) {
  let inhalt = basis.inhalt.replace('{Magnet-Einschub}', magnete[segment])
  const absaetze = inhalt.split('\n\n')

  if (segment === 'eigentuemer') {
    const satz = VSL_EIGENTUEMER_FERTIG
      ? eigentuemerSatz
      : eigentuemerSatz.replace(' und neuerdings in KI-Suchen wie ChatGPT', '')
    const i = absaetze.findIndex(a => a.startsWith('Eine Bitte vorab:'))
    absaetze[i] = satz
  }

  const ps = absaetze.findIndex(a => a.startsWith('PS:'))
  if (segment === 'sachverstaendige') absaetze[ps] = `PS: ${svPs}`
  if (['automatisierung', 'sachverstaendige'].includes(segment) && !VSL_AUTOMATISIERUNG_FERTIG) {
    // Solange das Beier-Referenzschreiben der Übergangs-Hauptinhalt ist, gibt
    // es kein zusätzliches Schreiben-PS (Regel in Teil E).
    absaetze.splice(ps, 1)
  }
  return { betreff: basis.betreff, inhalt: absaetze.join('\n\n') }
}

const UEBERGANG = {
  eigentuemer: 'Bis der VSL aufgenommen ist, läuft das Loom-Video als {VSL-Link}. Anhang: Referenzschreiben Wüstenrot.',
  kaeufer: 'Bis der Käufer-VSL steht: statt des Videos die Van-Hoorn-Fallstudie anhängen und den Video-Absatz entsprechend anpassen. Anhang: Referenzschreiben Wüstenrot.',
  automatisierung: 'Bis der VSL aufgenommen ist: Beier-Referenzschreiben als Anhang, dann ohne zusätzliches PS.',
  sachverstaendige: 'Bis der VSL aufgenommen ist: Beier-Referenzschreiben als Anhang, dann ohne zusätzliches PS.'
}
const VERMERK = 'Versand-Vermerke: Hast du das Beratungsgespräch selbst geführt, heißt es „Was ich mitgenommen habe". Geht die Mail erst am Folgetag raus, „für das offene Gespräch gestern" statt „eben".'

neu('bestaetigung_eigentuemer', 'Bestätigungsmail nach dem Setting: Eigentümer', 'Setting', bestaetigung('eigentuemer'), `${UEBERGANG.eigentuemer} ${VERMERK}`)
neu('bestaetigung_kaeufer', 'Bestätigungsmail nach dem Setting: Kaufinteressenten', 'Setting', bestaetigung('kaeufer'), `${UEBERGANG.kaeufer} ${VERMERK}`)
neu('bestaetigung_automatisierung', 'Bestätigungsmail nach dem Setting: Automatisierung und Vorhaben', 'Setting', bestaetigung('automatisierung'), `${UEBERGANG.automatisierung} ${VERMERK}`)
neu('bestaetigung_sachverstaendige', 'Bestätigungsmail nach dem Setting: Sachverständige', 'Setting', bestaetigung('sachverstaendige'), `${UEBERGANG.sachverstaendige} ${VERMERK}`)

// Nachfass-Toolkit (Teil D) und SV-Ranking-Beweis (Teil B)
neu('nachfass_zusammenfassung', 'Nachfassen 1: Die Zusammenfassung seiner Zahlen', 'Nachfassen', mail('### Vorlage 1:'),
  'Kein Anhang. Das Fallbeispiel als nächsten Kontakt einplanen.')
neu('nachfass_fallbeispiel', 'Nachfassen 2: Das Fallbeispiel', 'Nachfassen', mail('### Vorlage 2:'))
neu('nachfass_auswirkungsfrage', 'Nachfassen 3: Die Auswirkungsfrage', 'Nachfassen', mail('### Vorlage 3:'),
  'Zuerst anrufen. Bei Mailbox sprechen und die Mail gleichzeitig schicken.')
neu('nachfass_sichtbarkeits_check', 'Nachfassen 4: Der Sichtbarkeits-Check seiner Region', 'Nachfassen', mail('### Vorlage 4:'),
  'Den Check vor dem Versand wirklich machen. Nur senden, wenn er bei ChatGPT und Google fehlt.')
neu('nachfass_ratgeber', 'Nachfassen 5: Der Ratgeber „Sichtbarer in Ihrer Region"', 'Nachfassen', mail('### Vorlage 5:'))
neu('nachfass_beweisstueck', 'Nachfassen 6: Das eine Beweisstück', 'Nachfassen', mail('### Vorlage 6:'),
  'Genau ein Anhang, passend zu seinem offenen Punkt.')
neu('nachfass_referenzanruf', 'Nachfassen 7: Das Referenzanruf-Angebot', 'Nachfassen', mail('### Vorlage 7:'),
  'Zuerst anrufen, bei Mailbox Mail gleichzeitig. Danach beim Zweifler nichts mehr; 14 Tage ohne Reaktion, dann wiedervorlagefähig.')
neu('nachfass_abschied', 'Nachfassen 8: Der Abschied', 'Nachfassen', mail('### Vorlage 8:'))
neu('nachfass_sv_ranking', 'Nachfassen: SV-Ranking-Beweis (Scheffler vor Heid)', 'Nachfassen', mail('### Vorlage: SV-Ranking-Beweis'),
  'Screenshot vor jedem Versand aktuell ziehen und nachprüfen. Je Kontakt nur einmal.')

// ---------------------------------------------------------------------------

const sql = (s) => (s === null || s === undefined) ? 'null' : `'${String(s).replace(/'/g, "''")}'`

if (process.argv.includes('--zeigen')) {
  for (const v of vorlagen) {
    console.log(`\n=== ${v.schluessel} · ${v.kategorie} · ${v.name}\nBetreff: ${v.betreff}\n\n${v.inhalt}\n${v.hinweis ? `\n[Hinweis] ${v.hinweis}` : ''}`)
  }
  process.exit(0)
}

// Der Hinweis ist eine Arbeitsanweisung für den Absender und darf nie beim
// Kunden landen. Deshalb steht er in einer eigenen Spalte, die der Mail-Dialog
// über dem Text anzeigt, nicht im Text selbst.
const zeilen = vorlagen.map(v =>
  `  (${sql(v.schluessel)}, ${sql(v.name)}, ${sql(v.kategorie)}, ${sql(v.betreff)}, ${sql(v.inhalt)}, ${sql(v.hinweis)}, true)`)

const ausgabe = `-- ERZEUGT von scripts/vorlagen-einpflegen.mjs am ${new Date().toISOString().slice(0, 10)}.
-- Nicht von Hand ändern: Wortlaute in docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md
-- pflegen und das Skript neu laufen lassen.
-- Übergang: VSL Eigentümer fertig = ${VSL_EIGENTUEMER_FERTIG}, VSL Automatisierung fertig = ${VSL_AUTOMATISIERUNG_FERTIG}

insert into public.email_templates (schluessel, name, kategorie, betreff, inhalt, hinweis, aktiv) values
${zeilen.join(',\n')}
on conflict (schluessel) where schluessel is not null do update set
  name = excluded.name,
  kategorie = excluded.kategorie,
  betreff = excluded.betreff,
  inhalt = excluded.inhalt,
  hinweis = excluded.hinweis,
  updated_at = now();
`
mkdirSync(dirname(ZIEL), { recursive: true })
writeFileSync(ZIEL, ausgabe)
console.log(`${vorlagen.length} Vorlagen nach ${ZIEL.replace(WURZEL + '/', '')} geschrieben.`)
