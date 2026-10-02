/**
 * Den Ansprechpartner aus einer Firmenwebsite lesen.
 *
 * Geholt wird nicht der Name selbst, sondern die Stelle, an der er steht:
 * die Zeilen um "Vertreten durch", "Inhaber", "Geschäftsführer". Welcher der
 * Namen darin der Ansprechpartner ist, entscheidet das Modell - ein
 * Suchmuster kann das nicht. In Probelaeufen hielt es "Ansprechpartner
 * Immobilienverwaltung" aus einer Navigationsleiste fuer einen Personennamen
 * und "Mark Wohnungsgesellschaft" fuer einen Menschen.
 *
 * Drei Dinge waren in den Probelaeufen die Ursache fast aller Fehlgriffe:
 *
 * 1. Inline-Tags zerrissen Namen. Wird jedes Tag zu einem Zeilenumbruch,
 *    wird aus "<span>T</span>homas Mennecke" ein "T" und ein
 *    "homas Mennecke". Darum brechen hier nur Block-Tags um.
 * 2. Eine Seite reicht nicht. Bei der-regionalmakler.de steht im Impressum
 *    "Gesetzlicher Vertreter:" ohne Namen; die Namen stehen auf der
 *    Startseite. Also Impressum, Kontakt und Ueber-uns, bis etwas da ist.
 * 3. Der erste Treffer ist nicht der richtige. "Ansprechpartner" steht oft
 *    im Menue. Darum werden alle Signalstellen gesammelt.
 */

const KOPF = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
              + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  'Accept-Language': 'de-DE,de;q=0.9',
}

/** Woran man im Impressum einen Verantwortlichen erkennt. */
const SIGNAL = new RegExp(
  '\\b(Vertreten durch|vertretungsberechtigt\\w{0,12}|Vertretungsberechtigte[rn]?'
  + '|Gesch\u00e4ftsf\u00fchr\\w{0,10}|Geschaeftsfuehr\\w{0,10}|Inhaber(?:in)?\\b|Inh\\.'
  + '|Eigent\u00fcmer(?:in)?\\b|Verantwortlich\\w{0,3}\\b|Ansprechpartner(?:in)?\\b'
  /* Zusammengesetzt: optin.at schreibt "Geschäftsinhaber", und davor steht
     keine Wortgrenze - mit \\bInhaber ging die Zeile durch. Ebenso
     Firmeninhaber, Alleininhaber, Mitinhaber. */
  + '|\\w*inhaber(?:in)?\\b'
  + '|Gesch\u00e4ftsleitung|Gesetzlicher Vertreter|Sachverst\u00e4ndige[rn]?\\b'
  + '|Gesellschafter(?:in)?\\b'
  + ')', 'i')

/* Die Ueberschrift selbst - ein schwaecheres Signal.
   
   Viele Impressen nennen Namen und Anschrift gleich darunter, ohne
   Einleitung: bei rudert-immobilien.de steht "Johannes Rudert Immobilien" in
   der Zeile nach "Impressum", und das erste starke Signalwort tauchte erst
   neun Zeilen spaeter im Pflichttext auf.
   
   Sie zaehlt aber erst, wenn kein starkes Signal etwas hergab. Sonst gewinnt
   sie gegen die spezifische Angabe: Bei sinnfalt-immobilien.de stand unter
   der Ueberschrift die Firma mit Anschrift, und "Vertreten durch: Frau
   Nicole Ehret" sechs Zeilen weiter unten hatte das Nachsehen. */
const UEBERSCHRIFT = new RegExp(
  '^(Impressum|Angaben gem\u00e4(\u00df|ss) \u00a7 ?5|Angaben nach \u00a7 ?5'
  + '|Angaben gem\u00e4(\u00df|ss) \u00a7 ?5 (TMG|DDG))\\b', 'i')

/* Der Pflichttext, der in fast jedem Impressum gleich lautet. Er enthaelt
   "verantwortlich" und "Diensteanbieter", aber nie einen Namen - und zog den
   Ausschnitt an sich, wenn er vor der Namensnennung stand. */
const PFLICHTTEXT = new RegExp(
  '(Als Diensteanbieter|Haftung f\u00fcr (Inhalte|Links)|Unser Angebot enth\u00e4lt Links'
  + '|nach den allgemeinen Gesetzen verantwortlich|\u00a7\u00a7? ?[78] (Abs|bis)'
  + '|Urheberrecht|urheberrechtlich gesch\u00fctzt|Die Europ\u00e4ische Kommission'
  + '|Streitschlichtung|Streitbeilegung)', 'i')

/* Tags, die eine Zeile beenden. Alles andere ist inline und darf ein Wort
   nicht zerschneiden - siehe Punkt 1 oben. */
const BLOCK = /<\/?(p|div|br|hr|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|nav|aside|main|form|label|dt|dd|address|blockquote|pre|figure|figcaption)\b[^>]*>/gi

/* Zwei grossgeschriebene Woerter nebeneinander. Das allein ist kein Name:
   "Blankeneser Bahnhofstraße", "Ansprechpartner Immobilienverwaltung" und
   "Zuständige Aufsichtsbehörde" passen genauso. Darum wird jeder Fund unten
   nochmal gesiebt. */
const WORTPAAR = /(?<![A-Za-z\u00c0-\u024f])[A-Z\u00c0-\u00de\u0100-\u024e][a-z\u00df-\u00ff\u0101-\u024f]{2,}(?:\s[A-Z\u00c0-\u00de\u0100-\u024e]\.)?(?:[-\s](?:von|van|de|zu|der|Gr\u00e4fin|Graf))?[-\s][A-Z\u00c0-\u00de\u0100-\u024e][a-z\u00df-\u00ff\u0101-\u024f]{2,}/g

/* Woran man erkennt, dass das zweite Wort kein Nachname ist. Als Endung
   gepruefte Begriffe, damit Komposita mitgehen - "Immobilienverwaltung"
   steht nicht in einer Liste, endet aber auf "verwaltung". */
const KEIN_NACHNAME = new RegExp(
  '(verwaltung|gesellschaft|dienste?|makler(?:in)?|bewertung|b\u00fcro|buero|service'
  + '|beratung|vermittlung|management|treuhand|kontor|technik|wesen|handel|vertrieb'
  + '|zentrum|center|agentur|immobilien|aufsichtsbeh\u00f6rde|beh\u00f6rde|angaben'
  + '|vertreter(?:in)?|hinweise?|informationen|stra\u00dfe|strasse|weg|allee|platz'
  + '|damm|ring|gasse|ufer|chaussee|kammer|gericht|amt|nummer|erlaubnis|industrie|kammer|verband|versicherung'
  + ')s?$', 'i')

/* Rechtsformen: steht eine davon im Wortpaar, ist es eine Firma. */
/* Artikel, Praepositionen und Navigationswoerter. Als erstes Wort eines
   Paares sehen sie aus wie ein Vorname: "Zum Inhalt" aus "Zum Inhalt
   springen" liess bei rudert-immobilien.de die Navigationsleiste als
   Fundstelle gewinnen. */
const KEIN_VORNAME = new RegExp(
  '^(zum|zur|der|die|das|den|dem|des|ein|eine|einen|einem|eines|im|am|an|auf|aus'
  + '|bei|mit|nach|seit|vor|\u00fcber|unter|f\u00fcr|ohne|um|durch|gegen|alle|alles'
  + '|unser|unsere|ihr|ihre|mein|meine|dein|kein|keine|neu|neue|neuer|hier|dort'
  + '|jetzt|mehr|weiter|zur\u00fcck|home|start|startseite|men\u00fc|seite|sie|wir|uns'
  + '|was|wie|wo|wer|warum|wann|welche[rsn]?|jede[rsn]?|diese[rsn]?|unsere[rsn]?'
  + '|herzlich|willkommen|aktuell|aktuelle[rsn]?)$', 'i')

const RECHTSFORM = /(?<![A-Za-z\u00c0-\u024f])(gmbh?|mbh?|ag|kg|ohg|gbr|e\.?\s?k(?:fr)?\.?|ug|se|ltd|co\b|kgaa)\b/i

/**
 * Steht in diesem Text etwas, das wie ein Personenname wirkt?
 *
 * Entscheidet nicht, WER der Ansprechpartner ist - das kann nur das Modell.
 * Entscheidet nur, ob die Stelle einen Blick wert ist, und damit, ob noch
 * eine weitere Seite geholt werden muss.
 */
export function wirktWieEinName(text) {
  for (const paar of String(text).matchAll(WORTPAAR)) {
    const s = paar[0]
    if (RECHTSFORM.test(s)) continue
    const worte = s.split(/[-\s]+/)
    if (KEIN_NACHNAME.test(worte[worte.length - 1])) continue
    if (KEIN_NACHNAME.test(worte[0])) continue
    if (KEIN_VORNAME.test(worte[0])) continue
    return s
  }
  return null
}

const ENTITAETEN = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö',
  Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è',
  ndash: '–', mdash: '—', shy: '', laquo: '«', raquo: '»',
}

function entschluesseln(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (ganz, name) =>
      Object.prototype.hasOwnProperty.call(ENTITAETEN, name) ? ENTITAETEN[name] : ganz)
}

/** HTML zu Text, Zeile fuer Zeile. */
export function zuText(html) {
  let h = html
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(BLOCK, '\n')
    .replace(/<[^>]+>/g, '')   // Inline-Tags spurlos entfernen
  return entschluesseln(h)
    .replace(/[ \t ]+/g, ' ')
    .normalize('NFC')          // Umlaute als ein Zeichen, nicht als zwei
}

/**
 * Bytes zu Text, mit dem richtigen Zeichensatz.
 *
 * Viele aeltere Maklerseiten deklarieren keinen. immobilienbuero-jakob.de
 * nennt weder im Kopf noch im HTML einen, ist aber latin-1 - aus
 * "Berufsaufsichtsbehörde" wurde darum "Berufsaufsichtsbeh\uFFFDrde" und der
 * Ausschnitt war unbrauchbar.
 *
 * UTF-8 laesst sich pruefen: latin-1-Text mit Umlauten ist fast nie
 * gueltiges UTF-8. Schlaegt die Pruefung fehl oder bleiben Ersatzzeichen
 * stehen, ist windows-1252 die richtige Annahme - es deckt latin-1 ab und
 * zusaetzlich die Anfuehrungs- und Gedankenstriche aus Word.
 */
export function entschluessleBytes(bytes, contentType = '') {
  /* UTF-8 zuerst, und streng. Gueltiges UTF-8 ist praktisch immer auch als
     UTF-8 gemeint: latin-1-Text mit Umlauten bildet kein gueltiges UTF-8.
     Umgekehrt geht das nicht - latin-1 kann jedes Byte abbilden und meldet
     darum nie einen Fehler. Stand im Kopf also faelschlich latin-1, kam
     "PersÃ¶nlich" heraus, ohne dass es auffiel. */
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).normalize('NFC')
  } catch { /* keine gueltige UTF-8-Folge - dann weiter unten */ }

  const genannt = (String(contentType).match(/charset=["']?([\w-]+)/i) || [])[1]
             || (new TextDecoder('latin1').decode(bytes.subarray(0, 4096))
                 .match(/charset=["']?([\w-]+)/i) || [])[1]

  for (const satz of [genannt, 'windows-1252'].filter(Boolean)) {
    try {
      const text = new TextDecoder(satz, { fatal: false }).decode(bytes)
      if (!text.includes('\uFFFD')) return text.normalize('NFC')
    } catch { /* Zeichensatz, den die Laufzeit nicht kennt */ }
  }
  return new TextDecoder('windows-1252').decode(bytes).normalize('NFC')
}

/**
 * Die Seite holen. Bytes, nicht Text - sonst raet die Laufzeit das
 * Zeichensatz und aus "Persönlich" wird "PersÃ¶nlich".
 */
export async function holeSeite(url, msZeit = 12000) {
  const abbruch = new AbortController()
  const uhr = setTimeout(() => abbruch.abort(), msZeit)
  try {
    const a = await fetch(url, { headers: KOPF, redirect: 'follow', signal: abbruch.signal })
    if (!a.ok) return null
    const typ = a.headers.get('content-type') || ''
    if (!/html/i.test(typ)) return null
    const bytes = new Uint8Array(await a.arrayBuffer())
    if (bytes.length > 3_000_000) return null
    return entschluessleBytes(bytes, typ)
  } catch {
    return null
  } finally {
    clearTimeout(uhr)
  }
}

/** Impressum zuerst, dann Kontakt, dann Ueber-uns. */
export function unterseiten(html, basis) {
  const gefunden = []
  const gesehen = new Set()
  const gruppen = [/impressum|imprint|legal-notice/i, /kontakt|contact/i,
                   /ueber-uns|ueber_uns|about|team/i]
  for (const muster of gruppen) {
    for (const m of html.matchAll(/<a[^>]+href="([^"#]+)"[^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
      const ziel = m[1]
      const beschriftung = m[2].replace(/<[^>]+>/g, '')
      if (!muster.test(ziel) && !muster.test(beschriftung)) continue
      try {
        const voll = new URL(ziel, basis).href
        if (!/^https?:/.test(voll) || gesehen.has(voll)) continue
        gesehen.add(voll)
        gefunden.push(voll)
      } catch { /* kaputter Link */ }
      break
    }
  }
  return gefunden.slice(0, 3)
}

/**
 * Der Ausschnitt, den das Modell lesen muss: die Zeilen ab der Signalstelle.
 * Von allen Signalstellen gewinnt die, bei der ueberhaupt etwas wie ein Name
 * in der Naehe steht - so faellt der Menue-Treffer heraus.
 */
export function ausschnitt(text) {
  const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean)
  const brauchbareZeilen = (von, bis) => zeilen.slice(von, bis)
    .filter(z => (z.split('|').length - 1) <= 3 && z.length <= 400)

  /* Der Name muss nahe am Signalwort stehen - in derselben Zeile oder in
     einer der beiden danach. Bewertet man den ganzen Ausschnitt, erbt der
     Treffer in der Navigationsleiste den Namen, der zehn Zeilen weiter zu
     einer anderen Signalstelle gehoert. Genau so gewann bei priveg.de das
     Menue gegen "Vertreten durch den Geschäftsführer". */
  const suche = (trifft) => {
    let ohneNamen = null
    for (let i = 0; i < zeilen.length; i++) {
      if (!trifft(zeilen[i])) continue
      if (PFLICHTTEXT.test(zeilen[i])) continue   // Standardtext, nie ein Name
      const nah = brauchbareZeilen(i, i + 3).join(' | ')
      const s = brauchbareZeilen(i, i + 10).join(' | ').slice(0, 500)
      if (wirktWieEinName(nah)) return { text: s, vielversprechend: true }
      if (!ohneNamen) ohneNamen = s
    }
    return ohneNamen ? { text: ohneNamen, vielversprechend: false } : null
  }

  // Erst die ausdrueckliche Angabe, dann die blosse Ueberschrift.
  const stark = suche(z => SIGNAL.test(z))
  if (stark?.vielversprechend) return stark
  const kopf = suche(z => UEBERSCHRIFT.test(z))
  if (kopf?.vielversprechend) return kopf
  if (stark) return stark
  if (kopf) return kopf

  // Kein Signalwort: die Zeilen, die wie ein Name aussehen.
  const nah = zeilen.filter(z => wirktWieEinName(z) && z.length < 120).slice(0, 6)
  if (nah.length) return { text: nah.join(' | ').slice(0, 500), vielversprechend: true }
  return { text: zeilen.slice(0, 14).join(' | ').slice(0, 500), vielversprechend: false }
}

/**
 * Alles zusammen: Startseite, dann die Unterseiten, bis eine Stelle mit
 * einem Namen dabei ist.
 */
export async function ansprechpartnerStelle(website) {
  let basis = String(website || '').trim()
  if (!basis) return null
  if (!/^https?:\/\//i.test(basis)) basis = 'https://' + basis
  const start = await holeSeite(basis)
  if (!start) return null

  const ziele = unterseiten(start, basis)
  let rueckfall = null
  for (const url of [...ziele, basis]) {
    const html = url === basis ? start : await holeSeite(url)
    if (!html) continue
    const a = ausschnitt(zuText(html))
    if (a.vielversprechend) return { quelle: url, text: a.text }
    if (!rueckfall) rueckfall = { quelle: url, text: a.text }
  }
  return rueckfall
}

/**
 * Was aus dem Modell kommt, wird nochmal gesiebt.
 *
 * Das Modell ist angewiesen, Unsicheres weglassen - aber darauf allein
 * verlaesst sich hier nichts. Durch kamen in Probelaeufen Reste wie "GmbH",
 * "Vertreter" und einmal eine Mailadresse. Ein falscher Name landet in der
 * Anrede einer echten Mail; lieber keiner.
 */
export function brauchbar(wert) {
  const w = String(wert || '').trim().normalize('NFC')
  if (w.length < 2 || w.length > 40) return null
  if (/\d|@|\.de$|\.com$/.test(w)) return null
  if (/^(gmbh|kg|ohg|gbr|mbh|ag|e\.?k\.?|vertreter|inhaber|gesch|firma|unbekannt|unklar|n\/?a|null)$/i.test(w)) return null
  /* Eine Anrede oder ein Titel ist kein Vorname. kwr-rathenow.de nennt im
     Impressum nur "Herr Harwardt, Geschäftsführer" - ohne Vornamen -, und
     butscher.net "Dr. Jens Butscher": beide Male landete das Wort davor im
     Vornamensfeld. Der Auftrag an das Modell verbot das schon; es hielt sich
     nicht daran, also steht es hier. */
  if (/^(herr|frau|hr|fr|dr|prof|dipl|ing|mag|med|jur|rer|nat|h\.?c|msc|ba|ma|m\.?a|b\.?a)\.?$/i.test(w)) return null
  /* Eine Rechtsform irgendwo im Wert heisst: hier steht die Firma, nicht ihr
     Inhaber. Bei "Niedermayer Immobilien GmbH" trug der Nachname
     "Immobilien GmbH" - die Sperrliste oben traf nur das Wort fuer sich. */
  if (/(?<![A-Za-z\u00c0-\u024f])(gmbh|mbh|ohg|gbr|kgaa|e\.?\s?k(?:fr)?\.|ug\b|\bag\b|\bkg\b)/i.test(w)) return null
  /* Ein Mustername ist kein Name. Beim Aufräumen des Altbestands am
     02.10.2026 standen „Max Mustermann", „Hans Muster" und „Karin Muster" in
     den Feldern - alle drei von Platzhalter-Impressen. „Max" allein bleibt
     natürlich: Max Hartmann, Max Renner, Max Koch sind echte Kontakte. */
  if (/^(muster(mann|frau)?|mustermax|erika mustermann|max mustermann|vorname|nachname)$/i.test(w)) return null
  /* Und eine Anrede- oder Grussfloskel auch nicht - im Altbestand stand bei
     54 Kontakten „liebe Makler" im Namensfeld. */
  if (/^(sehr geehrte[rn]?|liebe[rs]?|hallo|guten tag|damen|herren|sekret(ä|ae)rin|sekretariat|team|zentrale|empfang)$/i.test(w)) return null
  /* Eine Abkuerzung ist kein Name. Im ersten Durchgang am 01.10.2026 kam bei
     sechs von 25 Leads "WEG WEG" heraus - das Wort stand im Seitentext, und
     das Modell nahm es, weil nichts Besseres da war. Ein Wort ganz in
     Grossbuchstaben ist in einem Impressum fast nie ein Vor- oder Nachname;
     wo doch, schadet das Weglassen nicht. */
  if (w.length <= 5 && w === w.toUpperCase()) return null
  if (!/[a-z\u00df-\u00ff\u0101-\u024f]/.test(w)) return null
  if (!/^[A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f'\u2019\s.-]*$/.test(w)) return null
  return w
}

/**
 * Vor- und Nachname zusammen - was einzeln durchgeht, kann als Paar falsch
 * sein. Derselbe Wert zweimal ist kein Name, sondern ein Wort, das das
 * Modell in beide Felder geschrieben hat.
 */
export function namenspaarBrauchbar(vorname, nachname) {
  const v = brauchbar(vorname)
  const n = brauchbar(nachname)
  if (!v || !n) return null
  if (v.toLowerCase() === n.toLowerCase()) return null
  return { vorname: v, nachname: n }
}

/**
 * Gehoert die Fundstelle ueberhaupt zu dieser Firma?
 *
 * Zwei Faelle, in denen der gefundene Name einem anderen Unternehmen gehoert:
 *
 * 1. Fremde Domain. Bei Anneser Immobilien stand im Impressum die Agentur
 *    Butlerium samt mail@aufteilungsplan.de, bei Osterkamp Immobilien der
 *    Inhaber von vosse-immo.de. Eine Weiterleitung auf eine ganz andere
 *    Adresse ist hier das Erkennungszeichen.
 * 2. Filiale einer Kette. Die Lead-Adresse zeigt dann auf eine Unterseite -
 *    ksk-immobilien.de/standort/siegburg - waehrend das Impressum der
 *    Zentrale gehoert und einen Menschen nennt, der mit Siegburg nichts zu
 *    tun hat. Das entscheidet nicht diese Funktion, sondern das Modell: ob
 *    "KSK-Immobilien GmbH Siegburg" zur Zentrale passt, ist eine Frage des
 *    Verstehens, nicht des Vergleichens.
 */
export function andereFirma(quelle, website) {
  const kern = (u) => {
    try {
      const teile = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u)
        .hostname.toLowerCase().replace(/^www\./, '').split('.')
      /* Die eintragbare Domain, grob: bei firma.de die ersten beiden Teile,
         bei firma.co.uk oder firma.com.br drei. Genauer waere eine Liste
         aller Endungen - fuer die Frage "ist das dieselbe Firma" reicht das. */
      const tief = teile.length > 2 && /^(co|com|org|net|gov|ac)$/.test(teile[teile.length - 2]) ? 3 : 2
      return teile.slice(-tief).join('.')
    } catch { return null }
  }
  const a = kern(quelle)
  const b = kern(website)
  if (!a || !b) return false
  return a !== b
}
