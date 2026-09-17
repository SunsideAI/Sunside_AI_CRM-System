// Rendert jede Systemmail mit Beispieldaten nach tmp/mails/ - zum Ansehen
// im Browser und fuer die Pruefung vor einem Deploy.
//
//   node scripts/mails-vorschau.mjs [zielordner]
//
// Prueft dabei, was sich pruefen laesst: kein Emoji im Betreff, keine
// Umschreibung von Umlauten, Maskierung von Formular-Eingaben, Text-Fassung.
import { mkdirSync, writeFileSync } from 'node:fs'
import * as M from '../netlify/functions/utils/mails.js'

const ziel = process.argv[2] || 'tmp/mails'
mkdirSync(ziel, { recursive: true })

const boese = '<img src=x onerror=alert(1)> "Müller" & Söhne'

const faelle = {
  'neuer-termin-im-pool': M.neuerTerminImPool({ gebuchtVon: 'Max Lehmann', unternehmen: 'Muster Immobilien GmbH', ansprechpartner: 'Jana Beispiel', datum: 'Do., 24.09.2026 · 10:30 Uhr', art: 'video' }),
  'termin-wieder-frei': M.terminWiederFrei({ freigegebenVon: 'Nikolas Kryut', unternehmen: 'Muster Immobilien GmbH', ansprechpartner: 'Jana Beispiel', datum: 'Mi., 30.09.2026 · 11:00 Uhr', art: 'telefon' }),
  'termine-zurueck-im-pool': M.termineZurueckImPool({ closerName: 'Anton Brand', anzahl: 4 }),
  'termin-zurueck-im-pool-einzeln': M.termineZurueckImPool({ closerName: 'Anton Brand', anzahl: 1 }),
  'neuer-ebook-lead': M.neuerEbookLead({ vorname: 'Jana', nachname: 'Beispiel', unternehmen: 'Muster Immobilien GmbH', email: 'jana@muster-immobilien.de', telefon: '+49 170 1234567', kategorie: 'Makler' }),
  'neuer-ebook-lead-boese': M.neuerEbookLead({ vorname: boese, nachname: '**fett**', unternehmen: boese, email: 'x@y.de', telefon: '' }),
  'neue-bewerbung-closer': M.neueBewerbung({ bewerber: 'Carl-Richard Rachow', stufe: 'Closer', unternehmen: 'Muster Immobilien GmbH', ansprechpartner: 'Jana Beispiel', termin: 'Mi., 30.09.2026, 11:00 Uhr', kommentar: 'Kenne die Region gut.', bewerbungId: 'HLB-7F3K2' }),
  'bewerbung-angenommen-setter': M.bewerbungEntschieden({ angenommen: true, stufe: 'Setter', unternehmen: 'Muster Immobilien GmbH' }),
  'bewerbung-abgelehnt-closer': M.bewerbungEntschieden({ angenommen: false, stufe: 'Closer', unternehmen: 'Muster Immobilien GmbH', kommentar: 'Termin kollidiert mit deinem Kalender.' }),
  'lead-anfrage-genehmigt': M.leadAnfrageEntschieden({ status: 'Genehmigt', angefragt: 50, zugewiesen: 50 }),
  'lead-anfrage-teilweise': M.leadAnfrageEntschieden({ status: 'Teilweise_Genehmigt', angefragt: 50, zugewiesen: 20, kommentar: 'Pool ist gerade knapp.' }),
  'lead-anfrage-abgelehnt': M.leadAnfrageEntschieden({ status: 'Abgelehnt', angefragt: 50, zugewiesen: 0 }),
  'nicht-erschienen': M.nichtErschienen({ gemeldetVon: 'Carl-Richard Rachow', unternehmen: 'Muster Immobilien GmbH', ansprechpartner: 'Jana Beispiel', termin: 'Di., 22.09.2026, 14:00 Uhr', anzahl: 2 }),
  'termin-abgesagt': M.terminGeaendert({ art: 'absage', gespraech: 'Beratungsgespräch', unternehmen: 'Muster Immobilien GmbH', grund: 'Diese Woche keine Zeit' }),
  'termin-verschoben': M.terminGeaendert({ art: 'verschiebung', gespraech: 'Abschlussgespräch', unternehmen: 'Muster Immobilien GmbH', alterTermin: '24.09.2026, 10:30', neuerTermin: '28.09.2026, 09:00' }),
  'nachricht-lead-gewonnen': M.crmNachricht({ typ: 'Lead gewonnen', titel: 'Lead gewonnen: Muster Immobilien GmbH', nachricht: 'Nikolas Kryut hat Muster Immobilien GmbH abgeschlossen.\nPaket: SEO + Funnel' }),
  'nachricht-lead-verloren': M.crmNachricht({ typ: 'Lead verloren', titel: 'Lead verloren: Muster Immobilien GmbH', nachricht: 'Kein Budget in diesem Jahr.' }),
  'nachricht-unbekannter-typ': M.crmNachricht({ typ: 'no_show_rescheduled', titel: 'Info', nachricht: '' }),
  'neues-passwort': M.neuesPasswort({ vorname: 'Jana', passwort: 'k7Q-mR4x-2pLa' }),
  'neues-passwort-ohne-namen': M.neuesPasswort({ vorname: '', passwort: 'k7Q-mR4x-2pLa' })
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2705}\u{274C}]/u
const UMSCHRIFT = /\b\w*(gespraech|uebernehm|fuer|verfuegbar|zurueck|aender|moecht|koenn|waehl|schliess)\w*\b/i
const befunde = []

for (const [name, inhalt] of Object.entries(faelle)) {
  const { betreff, mail } = inhalt
  if (EMOJI.test(betreff)) befunde.push(`${name}: Emoji im Betreff`)
  if (EMOJI.test(mail.html)) befunde.push(`${name}: Emoji im HTML`)
  const sichtbar = mail.html.replace(/<[^>]+>/g, ' ')
  const umschrift = sichtbar.match(UMSCHRIFT)
  if (umschrift) befunde.push(`${name}: Umschrift "${umschrift[0]}"`)
  if (!/^\w[\w-]* · /.test(betreff)) befunde.push(`${name}: Betreff ohne Bereich: ${betreff}`)
  if (!mail.text || mail.text.length < 60) befunde.push(`${name}: Text-Fassung fehlt`)
  if (/<img|onerror/i.test(mail.html.replace(/&lt;img|onerror=alert/g, ''))) befunde.push(`${name}: ungefiltertes HTML`)
  if (/[\u0001\u0002]/.test(mail.html + mail.text + betreff)) befunde.push(`${name}: Steuerzeichen durchgerutscht`)
  if (name.endsWith('-boese') && /<strong[^>]*>fett<\/strong>/.test(mail.html)) befunde.push(`${name}: Eingabe als Formatierung gelesen`)
  if (/linear-gradient/.test(mail.html)) befunde.push(`${name}: Farbverlauf`)
  writeFileSync(`${ziel}/${name}.html`, mail.html)
  writeFileSync(`${ziel}/${name}.txt`, `Betreff: ${betreff}\n\n${mail.text}\n`)
}

console.log(`${Object.keys(faelle).length} Mails nach ${ziel} geschrieben`)
if (befunde.length) {
  console.log('BEFUNDE:\n  ' + befunde.join('\n  '))
  process.exitCode = 1
} else {
  console.log('Keine Befunde.')
}
