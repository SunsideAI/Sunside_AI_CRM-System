// Prueft die Impressum-Suche.
//
// Anlass: Von 28.851 kalten Leads trugen am 01.10.2026 nur 1.921 einen
// Ansprechpartner. In allen anderen Mails stand der Firmenname statt eines
// Menschen. Die Namen stehen im Impressum - die Frage war nur, wie man sie
// verlaesslich herausholt.
//
// Jeder Fall hier ist ein Fehlgriff aus den drei Probelaeufen vom 01.10.2026,
// nachgestellt an der Website, an der er auftrat.
//
// Aufruf: node scripts/pruefe-ansprechpartner.mjs

import fs from 'node:fs'
import { zuText, ausschnitt, unterseiten, brauchbar, wirktWieEinName, entschluessleBytes,
         namenspaarBrauchbar, andereFirma }
  from '../netlify/functions/utils/impressum.js'


const befunde = []
const sagt = (ok, text) => { console.log(`  ${ok ? '✓' : '✗'} ${text}`); if (!ok) befunde.push(text) }

// ── Inline-Tags duerfen Namen nicht zerreissen ────────────────────────────
// der-regionalmakler.de setzt den Anfangsbuchstaben in ein <span>. Solange
// jedes Tag einen Zeilenumbruch bedeutete, wurde daraus "T" und
// "homas Mennecke" - der Name war weg.
const zerrissen = '<p>Christian Kurlinkus &amp;<span>T</span>homas Mennecke</p>'
sagt(zuText(zerrissen).includes('Thomas Mennecke'),
  `Inline-Tag zerreißt den Namen nicht: „${zuText(zerrissen).trim()}"`)
// Block-Tags muessen dagegen trennen, sonst klebt alles aneinander.
sagt(zuText('<div>Inhaber:</div><div>Anna Berg</div>').split('\n').filter(Boolean).length === 2,
  'Block-Tags trennen weiterhin')
// Entitaeten und Umlaute: ein Zeichen, nicht zwei (NFC).
const umlaut = zuText('<p>M&uuml;cahit Ya&#x15F;ar</p>').trim()
sagt(umlaut.includes('Mücahit') && umlaut.normalize('NFC') === umlaut,
  `Umlaute aus Entitäten, als ein Zeichen: „${umlaut}"`)

// ── Der Zeichensatz ──────────────────────────────────────────────────────
// immobilienbuero-jakob.de nennt keinen - weder im Kopf noch im HTML - ist
// aber latin-1. Aus "Berufsaufsichtsbehörde" wurde "Berufsaufsichtsbeh\uFFFDrde".
const bytesVon = (text, satz) => satz === 'latin1'
  ? Uint8Array.from([...text].map(z => z.codePointAt(0)))
  : new TextEncoder().encode(text)

sagt(entschluessleBytes(bytesVon('Berufsaufsichtsbehörde', 'latin1'), 'text/html')
       === 'Berufsaufsichtsbehörde',
  'Ohne Angabe wird latin-1 erkannt, nicht als UTF-8 verstümmelt')
sagt(entschluessleBytes(bytesVon('Persönlich', 'utf8'), 'text/html; charset=utf-8')
       === 'Persönlich',
  'Und sauberes UTF-8 bleibt UTF-8')
// Eine falsche Angabe darf nicht schlagen, wenn die Bytes es widerlegen.
sagt(entschluessleBytes(bytesVon('Persönlich', 'utf8'), 'text/html; charset=iso-8859-1')
       === 'Persönlich',
  'Eine falsche Angabe im Kopf wird übergangen')
// Ein Zeichensatz, den die Laufzeit nicht kennt, darf nichts verschlucken.
sagt(entschluessleBytes(bytesVon('Nicole Ehret', 'utf8'), 'text/html; charset=cp-unbekannt')
       === 'Nicole Ehret',
  'Ein unbekannter Zeichensatz wirft die Seite nicht weg')

// ── Ein Personenname, kein Begriffspaar ───────────────────────────────────
// Davon haengt ab, ob eine Stelle als Fund gilt und die Suche aufhoert.
// Jeder Fall unten ist aus einem Probelauf: links der Text, rechts ob ein
// Name drinsteht.
const NAMENSFAELLE = [
  // Sieht aus wie ein Name, ist keiner.
  ['Blankeneser Bahnhofstraße 8', false],            // eine Straße
  ['Ansprechpartner Immobilienverwaltung', false],   // eine Menüzeile (priveg.de)
  ['MEISSLER & CO Verwaltungs GmbH', false],         // eine Firma
  ['Zuständige Aufsichtsbehörde', false],
  ['Zuständige Industrie- und Handelskammer', false],
  ['Handelskammer Bremen', false],
  ['Gesetzlicher Vertreter:', false],                // die Zeile ohne den Namen
  ['Mark Wohnungsgesellschaft', false],              // der Fehlgriff aus Lauf 1
  ['Rechtliche Angaben', false],
  ['ALLE GROSS HIER', false],
  // Ist einer.
  ['Kerstin Petersen', true],
  ['Götz M. Fluck', true],                           // mit Initial in der Mitte
  ['Rainer M. Körbel', true],
  ['Claudia Glaser-Zormann', true],                  // Doppelname
  ['Patrick Florian von Stosch', true],              // Namenszusatz
  ['Ute Gräfin von Ballestrem', true],
  ['Jörg-Michael Meyer', true],
  ['Werner Höbel', true],
  // Buchstaben ausserhalb der deutschen Umlaute. In JavaScript ist \b
  // ASCII-basiert, darum stand vor einem "Ü" keine Wortgrenze und der Name
  // fiel durch - jeder Name, der mit einem Umlaut beginnt, war betroffen.
  ['Ümit Alagöz', true],
  ['Mücahit Yaşar', true],
]
let namensfehler = 0
for (const [text, soll] of NAMENSFAELLE) {
  const ist = wirktWieEinName(text) !== null
  if (ist !== soll) { namensfehler++; console.log(`    ✗ „${text}" → ${ist ? 'Name' : 'kein Name'}`) }
}
sagt(namensfehler === 0, `${NAMENSFAELLE.length} Fälle: Personenname von Begriffspaar unterschieden`)

// ── Die Überschrift zählt erst, wenn sonst nichts da ist ─────────────────
// Viele Impressen nennen Namen und Anschrift direkt unter „Impressum", ohne
// Einleitung: bei rudert-immobilien.de steht „Johannes Rudert Immobilien" in
// der Zeile darunter, und das erste starke Signalwort kam erst neun Zeilen
// später - im Pflichttext, der nie einen Namen enthält.
const unterUeberschrift = ausschnitt(['Impressum', 'Johannes Rudert Immobilien',
  'Lehderstr. 54, 13086 Berlin', 'Telefon: +49 174 9542360',
  'Haftung für Inhalte:', 'Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene '
  + 'Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.'].join('\n'))
sagt(unterUeberschrift.text.includes('Johannes Rudert') && unterUeberschrift.vielversprechend,
  'Der Name direkt unter „Impressum" wird gefunden')
sagt(!unterUeberschrift.text.startsWith('Als Diensteanbieter'),
  'Und der Pflichttext zieht den Ausschnitt nicht an sich')

// Umgekehrt darf die Überschrift die ausdrückliche Angabe nicht verdrängen.
// Bei sinnfalt-immobilien.de stand unter „Impressum" nur die Firma, der Name
// sechs Zeilen weiter.
const ausdruecklich = ausschnitt(['Impressum', 'Sinnfalt GmbH', 'Staufener Str. 25',
  '79189 Bad Krozingen', 'Handelsregister: HRB717343',
  'Vertreten durch:', 'Frau Nicole Ehret', 'Kontakt'].join('\n'))
sagt(ausdruecklich.text.startsWith('Vertreten durch'),
  '„Vertreten durch" schlägt die bloße Überschrift')

// Zusammengesetzte Formen: optin.at schreibt „Geschäftsinhaber", und davor
// steht keine Wortgrenze.
const zusammengesetzt = ausschnitt(['Unternehmensgegenstand: Immobilientreuhänder',
  'Geschäftsinhaber: Mag. David Breitwieser, Mag. Alexander Fenzl',
  'Wirtschaftskammer Wien'].join('\n'))
sagt(zusammengesetzt.text.includes('Breitwieser') && zusammengesetzt.vielversprechend,
  '„Geschäftsinhaber" zählt wie „Inhaber"')

// Navigationswörter sind keine Namen. „Zum Inhalt" aus „Zum Inhalt springen"
// liess die Navigationsleiste als Fundstelle gewinnen.
const NAVIGATION = ['Zum Inhalt springen', 'Unsere Dienstleistungen', 'Herzlich Willkommen',
                    'Alle Objekte', 'Ihre Ansprechpartnerin', 'Neue Wege']
let navfehler = 0
for (const t of NAVIGATION) if (wirktWieEinName(t)) { navfehler++; console.log(`    ✗ „${t}"`) }
sagt(navfehler === 0, `${NAVIGATION.length} Navigationszeilen gelten nicht als Name`)

// ── Die Signalstelle, nicht die erste ─────────────────────────────────────
// priveg.de hat "Ansprechpartner Immobilienverwaltung" im Menü. Der erste
// Treffer war also die Navigationsleiste - und der Ausschnitt begann dort.
const menue = ['Ansprechpartner Immobilienverwaltung', 'Ansprechpartner Logendienste',
               'KONTAKT', 'Menü', 'Startseite',
               'Vertreten durch den Geschäftsführer', 'Götz M. Fluck',
               'Tel: 030 844 14 94 0'].join('\n')
const a = ausschnitt(menue)
sagt(a.text.startsWith('Vertreten durch'),
  `Der Ausschnitt beginnt an der richtigen Stelle: „${a.text.slice(0, 48)}…"`)
sagt(a.text.includes('Götz M. Fluck'), 'Und der Name steht darin')


// ── Die Unterseiten ───────────────────────────────────────────────────────
const seite = `<a href="index.html">Herzlich Willkommen</a>
  <a href="/kontakt">Kontakt</a>
  <a href="impressum.html">Impressum</a>
  <a href="https://www.facebook.com/sharer.php">teilen</a>`
const ziele = unterseiten(seite, 'https://www.beispiel.de/')
sagt(/impressum/.test(ziele[0]), `Impressum zuerst: ${ziele[0]}`)
sagt(ziele.some(z => /kontakt/.test(z)), 'Kontakt als zweite Quelle')
sagt(!ziele.some(z => /facebook/.test(z)), 'Kein Weiterklicken zu Facebook')
sagt(ziele.every(z => z.startsWith('https://www.beispiel.de/')),
  'Relative Links werden zur vollen Adresse')

// ── Was aus dem Modell kommt, wird nochmal gesiebt ────────────────────────
// Das Modell soll Unsicheres weglassen, aber darauf allein verlaesst sich
// hier nichts: eine falsche Anrede faellt beim Empfaenger sofort auf.
sagt(brauchbar('Kerstin') === 'Kerstin', 'Ein Name geht durch')
sagt(brauchbar(' Ümit ') === 'Ümit', 'Umlaute und Leerzeichen ringsum')
sagt(brauchbar('von Stosch') === 'von Stosch', 'Namenszusätze bleiben')
sagt(brauchbar('GmbH') === null, '„GmbH" nicht')
sagt(brauchbar('Vertreter') === null, '„Vertreter" nicht')
sagt(brauchbar('unklar') === null, '„unklar" nicht')
sagt(brauchbar('info@firma.de') === null, 'Keine Mailadresse')
sagt(brauchbar('Haus 12') === null, 'Nichts mit Ziffern')
sagt(brauchbar('') === null && brauchbar(null) === null, 'Leer bleibt leer')

// Das Paar zusammen, nicht nur jeder Teil fuer sich. Im ersten echten
// Durchgang am 01.10.2026 schrieb das Modell bei 6 von 25 Leads "WEG" in
// beide Felder - die Abkuerzung stand im Seitentext, und es nahm sie, weil
// kein Name da war. Einzeln sah "WEG" harmlos aus.
sagt(namenspaarBrauchbar('WEG', 'WEG') === null, '„WEG WEG" kommt nicht durch')
sagt(namenspaarBrauchbar('IVD', 'Immobilien') === null, 'Eine Abkürzung als Vorname auch nicht')
sagt(namenspaarBrauchbar('HV', 'Müller') === null, 'Und „HV Müller" nicht')
sagt(namenspaarBrauchbar('Günther', 'Günther') === null,
  'Zweimal dasselbe Wort ist kein Name, sondern eine Partnerfirma')
// Eine Anrede oder ein Titel ist kein Vorname. Im 500er-Durchgang kam
// zweimal das Wort vor dem Namen ins Vornamensfeld: kwr-rathenow.de nennt
// nur "Herr Harwardt" ohne Vornamen, butscher.net "Dr. Jens Butscher".
sagt(namenspaarBrauchbar('Herr', 'Harwardt') === null, '„Herr Harwardt" kommt nicht durch')
sagt(namenspaarBrauchbar('Dr.', 'Jens Butscher') === null, 'Und „Dr." als Vorname nicht')
sagt(namenspaarBrauchbar('Dipl.', 'Ing. Jakob') === null, 'Und „Dipl." nicht')
// Namen, die so anfangen, muessen bleiben.
sagt(namenspaarBrauchbar('Ingo', 'Ruderisch')?.vorname === 'Ingo', 'Aber „Ingo" schon')
sagt(namenspaarBrauchbar('Ingrid', 'Fischmann')?.vorname === 'Ingrid', 'Und „Ingrid" auch')
sagt(namenspaarBrauchbar('Franz', 'Zormann')?.vorname === 'Franz', 'Und „Franz" auch')
// Eine Rechtsform irgendwo im Namen: da steht die Firma, nicht ihr Inhaber.
// "Niedermayer Immobilien GmbH" trug den Nachnamen "Immobilien GmbH".
sagt(namenspaarBrauchbar('Niedermayer', 'Immobilien GmbH') === null,
  '„Immobilien GmbH" ist kein Nachname')
sagt(namenspaarBrauchbar('Hans', 'Müller GmbH') === null, 'Und „Müller GmbH" auch nicht')
// Echte Namen, in denen dieselben Buchstabenfolgen stecken.
sagt(namenspaarBrauchbar('Hagen', 'Agnesens')?.nachname === 'Agnesens', 'Aber „Agnesens" schon')
sagt(namenspaarBrauchbar('Magnus', 'Kaufmann')?.vorname === 'Magnus', 'Und „Magnus" auch')
sagt(namenspaarBrauchbar('Dagmar', 'Wagner')?.vorname === 'Dagmar', 'Und „Dagmar Wagner" auch')
// Was im 3.000er-Durchgang an echten Namen vorkam und bleiben muss.
sagt(namenspaarBrauchbar('Hans-Christian', 'de la Motte') !== null, 'Ein Namenszusatz bleibt')
sagt(namenspaarBrauchbar('Lutz', 'Freiherr von Entreß-Fürsteneck') !== null, 'Ein Adelstitel auch')
sagt(namenspaarBrauchbar('Eva Maria', 'Nietl') !== null, 'Ein Doppelvorname auch')
sagt(namenspaarBrauchbar('Stefan A.', 'Beeck') !== null, 'Und ein Vorname mit Initial')
// Musternamen und Anredefloskeln. Beim Aufräumen des Altbestands am
// 02.10.2026 standen bei 54 Kontakten „liebe Makler" im Namensfeld und bei
// drei weiteren „Max Mustermann" bzw. „Hans Muster" - aus Impressen, die
// ihren Platzhalter nie ersetzt haben.
sagt(namenspaarBrauchbar('Max', 'Mustermann') === null, '„Max Mustermann" kommt nicht durch')
sagt(namenspaarBrauchbar('Hans', 'Muster') === null, 'Und „Hans Muster" nicht')
sagt(namenspaarBrauchbar('liebe', 'Makler') === null, '„liebe Makler" auch nicht')
sagt(namenspaarBrauchbar('Sehr geehrte', 'Damen') === null, 'Und keine Anredefloskel')
sagt(namenspaarBrauchbar('Sekretärin', 'Meier') === null, 'Und keine Funktion statt eines Namens')
// „Max" allein ist ein echter Vorname - Max Hartmann, Max Renner, Max Koch
// stehen so in der Datenbank, jeweils passend zum Firmennamen.
sagt(namenspaarBrauchbar('Max', 'Hartmann')?.vorname === 'Max', 'Aber „Max Hartmann" schon')
sagt(namenspaarBrauchbar('Liebherr', 'Schmidt') !== null, 'Und „Liebherr" auch')
// Österreichische und akademische Titel. „Immobilien MMag. Hauswurz KG"
// lieferte „MMag." als Vornamen - der Filter kannte nur „Mag.".
sagt(namenspaarBrauchbar('MMag.', 'Hauswurz') === null, '„MMag." ist kein Vorname')
sagt(namenspaarBrauchbar('Dkfm.', 'Huber') === null, 'Und „Dkfm." auch nicht')
sagt(namenspaarBrauchbar('MBA', 'Schmidt') === null, 'Und „MBA" nicht')
// Manche Seiten schreiben den Namen klein. In der Anrede fällt das auf.
sagt(namenspaarBrauchbar('Sa-San Thomas', 'schadkami')?.nachname === 'Schadkami',
  'Ein kleingeschriebener Nachname wird großgeschrieben')
sagt(namenspaarBrauchbar('Hans', 'müller')?.nachname === 'Müller', 'Auch mit Umlaut')
// Namenszusätze bleiben, wie sie sind.
sagt(namenspaarBrauchbar('Carina', 'von Salis-Soglio')?.nachname === 'von Salis-Soglio',
  '„von Salis-Soglio" bleibt klein')
sagt(namenspaarBrauchbar('Hans-Christian', 'de la Motte')?.nachname === 'de la Motte',
  'Und „de la Motte" auch')
sagt(namenspaarBrauchbar('Kerstin', 'Petersen')?.nachname === 'Petersen', 'Ein echtes Paar schon')
sagt(namenspaarBrauchbar('Ümit', 'Alagöz')?.vorname === 'Ümit', 'Auch mit Umlaut am Anfang')
sagt(namenspaarBrauchbar('Lars', 'Krüssel')?.nachname === 'Krüssel', 'Und mit Umlaut im Namen')

// ── Gehört die Fundstelle zu dieser Firma? ────────────────────────────────
const FIRMENFAELLE = [
  // Dieselbe Firma - nur www, http/https oder eine Unterseite.
  ['https://kriech-immobilien.de/impressum/', 'http://www.kriech-immobilien.de/', false],
  ['https://www.pienzenauer-trudering.de/impressum/', 'https://pienzenauer-trudering.de/', false],
  ['https://www.traum.immobilien/impressum', 'https://www.traum.immobilien/', false],
  ['https://firma.co.uk/imprint', 'https://firma.co.uk/', false],
  // Eine Filiale liegt auf derselben Domain - das erkennt nur das Modell,
  // nicht diese Regel. Hier darf sie nicht fälschlich zuschlagen.
  ['https://www.ksk-immobilien.de/impressum/', 'https://www.ksk-immobilien.de/standort/siegburg/', false],
  // Eine andere Firma: die Agentur, der Hoster, ein Nachfolger.
  ['https://www.aufteilungsplan.de/impressum', 'https://anneser-immobilien.de/', true],
  ['https://vosse-immo.de/impressum', 'https://osterkamp-immobilien.de/', true],
]
let firmenfehler = 0
for (const [quelle, website, soll] of FIRMENFAELLE) {
  if (andereFirma(quelle, website) !== soll) {
    firmenfehler++
    console.log(`    ✗ ${website} ← ${quelle}`)
  }
}
sagt(firmenfehler === 0, `${FIRMENFAELLE.length} Fälle: fremdes Impressum erkannt`)

// ── Der Auftrag an das Modell ─────────────────────────────────────────────
const fn = fs.readFileSync('netlify/functions/ansprechpartner-suchen-background.js', 'utf8')
sagt(/falscher Name ist schlimmer als kein Name/.test(fn),
  'Das Modell weiß: ein falscher Name ist schlimmer als keiner')
// Umgekehrt kostete zu viel Vorsicht Treffer: Bei „Johannes Immobilien" mit
// „Geschäftsführer: Alexander Johannes" lehnte das Modell ab, weil es den
// Nachnamen für den Firmennamen hielt. Ebenso bei MH Immobilien, wo neben
// Monika Haumann der Webdesigner stand, und bei Rudert, dessen Impressum
// eine andere Mail-Domain nennt als die Lead-Adresse.
sagt(/STEHT EIN NAME DA, NIMM IHN/.test(fn),
  'Und ebenso: ein übersehener Name kostet einen Kontakt')
sagt(/Der Nachname steckt im Firmennamen/.test(fn),
  'Der Nachname im Firmennamen ist ein Treffer, kein Ausschlussgrund')
sagt(/das ist nicht deine Aufgabe/.test(fn),
  'Die Domain prüft der Code, nicht das Modell')
sagt(/nimm den mit der Rolle/.test(fn),
  'Bei mehreren Namen gewinnt der mit der Rolle')
sagt(/dem Webdesigner, der Agentur oder dem Hoster/.test(fn),
  'Und es soll fremde Impressen erkennen (Anneser → Butlerium)')
sagt(/Gründer aus der Firmenhistorie/.test(fn),
  'Und den Gründer von 1982 nicht für die heutige Leitung halten (OMIT AG)')
sagt(/Begriffspaar/.test(fn),
  'Und „Mark Wohnungsgesellschaft" nicht für einen Menschen')
sagt(/Abkürzung ist \(WEG, IVD, RDM, HV\)/.test(fn),
  'Und keine Abkürzung aus dem Seitentext')
sagt(/Niederlassung einer Kette ist und das Impressum der Zentrale/.test(fn),
  'Und nicht den Vorstand einer Kette für den Filialleiter')
sagt(/andereFirma\(lead\.quelle, lead\.website\)/.test(fn),
  'Eine fremde Domain wird gar nicht erst geschrieben')

// ── Was die Funktion nicht anfasst ────────────────────────────────────────
sagt(/\.is\('ansprechpartner_vorname', null\)/.test(fn),
  'Ein von Hand gesetzter Name wird nicht überschrieben')
// Der Vermerk steht, bevor die Arbeit beginnt. Ein Durchgang dauert gut zehn
// Minuten; wurde erst am Ende vermerkt, griff sich ein gleichzeitig
// gestarteter zweiter Durchgang dieselben Leads - und jede Seite waere
// zweimal geholt und jeder Ausschnitt zweimal bezahlt worden.
const belegStelle = fn.indexOf('ansprechpartner_gesucht_am: jetzt')
const arbeitStelle = fn.indexOf('await ansprechpartnerStelle(lead.website)')
sagt(belegStelle > 0 && belegStelle < arbeitStelle,
  'Die Leads werden belegt, bevor die Arbeit beginnt')
sagt(/\.is\('ansprechpartner_gesucht_am', null\)\s*\n\s*\.select\('id'\)/.test(fn),
  'Und nur, was kein anderer Durchgang schon hat')
sagt(/const lead = belegt\[i\+\+\]/.test(fn),
  'Gearbeitet wird an den belegten, nicht an den geladenen')
// Was die Frist nicht mehr schafft, muss zurueck in den Topf. Bei Johannes
// Immobilien stand „Geschäftsführer: Alexander Johannes" im Impressum, bei
// Seebauer „Gerhard Seebauer", bei MH Immobilien „Monika Haumann" - alle drei
// wurden belegt, nie geholt und galten dann für immer als durchsucht.
sagt(/ansprechpartner_gesucht_am: null/.test(fn),
  'Was die Frist nicht schafft, wird wieder freigegeben')
sagt(/const liegengeblieben = belegt\.filter\(l => !bearbeitet\.has\(l\.id\)\)/.test(fn),
  'Und zwar genau die Leads, die kein Arbeiter angefasst hat')
sagt(/Eine Seite zu holen kostet nichts\. Ein verlorener Name schon\./.test(fn),
  'Die Belegung schützt vor Doppelarbeit, nicht vor dem zweiten Versuch')
sagt(!/anrede:/.test(fn),
  'Die Anrede setzt der Trigger, nicht diese Funktion')
sagt(/istAdmin/.test(fn), 'Nur die Leitung darf den Lauf anstoßen')

console.log('')
if (befunde.length) {
  console.error('FEHLER:')
  for (const b of befunde) console.error('  - ' + b)
  process.exit(1)
}
console.log('Ansprechpartner: aus dem Impressum, und im Zweifel keiner.')
