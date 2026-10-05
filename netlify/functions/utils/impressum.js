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
  return (await holeSeiteMitGrund(url, msZeit)).html
}

/**
 * Dasselbe, aber mit der Auskunft, warum es nicht ging.
 *
 * "Nicht erreichbar" ist nicht eine Lage, sondern mehrere, und sie verlangen
 * Verschiedenes: Eine Domain, die nicht mehr aufloest, ist weg und der Lead
 * wertlos. Ein 403 heisst das Gegenteil - die Seite lebt und wehrt nur
 * Maschinen ab, der Kunde ist ueber sie erreichbar. Ein Zeitablauf kann
 * beides sein und lohnt einen zweiten Versuch.
 *
 * Solange holeSeite nur `null` lieferte, sah im Bestand alles gleich aus.
 */
export async function holeSeiteMitGrund(url, msZeit = 12000) {
  const abbruch = new AbortController()
  const uhr = setTimeout(() => abbruch.abort(), msZeit)
  try {
    const a = await fetch(url, { headers: KOPF, redirect: 'follow', signal: abbruch.signal })
    if (!a.ok) {
      /* 401, 403 und 429 kommen vom Bot-Schutz, nicht von einer toten Seite.
         Getrennt benannt, damit ein spaeterer Lauf sie anders anfassen kann
         als einen 404. */
      const art = [401, 403, 429].includes(a.status) ? 'abgewiesen' : 'fehler'
      return { html: null, grund: `${art}_${a.status}` }
    }
    const typ = a.headers.get('content-type') || ''
    if (!/html/i.test(typ)) return { html: null, grund: 'kein_html' }
    const bytes = new Uint8Array(await a.arrayBuffer())
    if (bytes.length > 3_000_000) return { html: null, grund: 'zu_gross' }
    return { html: entschluessleBytes(bytes, typ), grund: 'erreichbar' }
  } catch (e) {
    /* Der Abbruch durch die eigene Uhr heisst Zeitablauf; alles andere ist
       ein Netzwerkfehler, in aller Regel eine Domain ohne DNS-Eintrag. */
    const name = String(e?.name || '')
    if (name === 'AbortError' || name === 'TimeoutError') {
      return { html: null, grund: 'zeitablauf' }
    }
    return { html: null, grund: 'kein_dns' }
  } finally {
    clearTimeout(uhr)
  }
}

/* Ein Link, so wie ihn Seiten wirklich schreiben.

   Das alte Muster verlangte doppelte Anfuehrungszeichen um die Adresse und
   hoechstens 120 Zeichen Beschriftung. Beides traf oft nicht zu:
   bremerich-immobilien.de schreibt href='...' mit einfachen - verbreitet in
   WordPress-Themes -, und bei expo-immo.de steckt in der Beschriftung so
   viel verschachteltes Markup, dass 120 Zeichen nicht reichten. In einer
   Stichprobe von 140 leeren Leads blieb dadurch bei 11 das Impressum
   unentdeckt, obwohl es verlinkt war. */
const ANKER = /<a\b([^>]*)>([\s\S]{0,800}?)<\/a>/gi
const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i

/** Impressum zuerst, dann Kontakt, dann Ueber-uns. */
export function unterseiten(html, basis) {
  const gefunden = []
  const gesehen = new Set()
  const gruppen = [/impressum|imprint|legal-notice|mentions-legales/i, /kontakt|contact/i,
                   /ueber-uns|ueber_uns|about|team/i]
  /* Die Anker einmal auslesen und dreimal durchsehen - sonst laeuft das
     Muster pro Gruppe erneut ueber das ganze Dokument. */
  const anker = []
  for (const m of html.matchAll(ANKER)) {
    const h = m[1].match(HREF)
    if (!h) continue
    const ziel = (h[1] ?? h[2] ?? h[3] ?? '').split('#')[0].trim()
    if (!ziel || /^(javascript|mailto|tel):/i.test(ziel)) continue
    anker.push({ ziel, beschriftung: m[2].replace(/<[^>]+>/g, ' ') })
  }
  for (const muster of gruppen) {
    for (const a of anker) {
      if (!muster.test(a.ziel) && !muster.test(a.beschriftung)) continue
      try {
        const voll = new URL(a.ziel, basis).href
        if (!/^https?:/.test(voll) || gesehen.has(voll)) continue
        gesehen.add(voll)
        gefunden.push(voll)
      } catch { continue }   // kaputter Link - der naechste kann gut sein
      break
    }
  }
  return gefunden.slice(0, 3)
}

/* Wo das Impressum liegt, wenn kein Link darauf zeigt. Manche Seiten bauen
   ihre Navigation erst im Browser zusammen; ne-immobilien.de etwa nennt
   "Impressum" im Text, verlinkt es im gelieferten HTML aber nicht. Ein
   Abruf kostet nichts, ein verlorener Name schon. */
const UEBLICHE_PFADE = ['/impressum', '/impressum/', '/impressum.html',
                        '/impressum.php', '/de/impressum', '/imprint']

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
  const basis = adresse(website)
  if (!basis) return { text: null, websiteStatus: 'keine_adresse' }
  const { html: start, grund } = await holeSeiteMitGrund(basis)
  if (!start) return { text: null, websiteStatus: grund }

  let ziele = unterseiten(start, basis)
  /* Zeigt kein Link auf ein Impressum, die ueblichen Adressen probieren. */
  if (!ziele.some(u => /impressum|imprint/i.test(u))) {
    for (const pfad of UEBLICHE_PFADE) {
      let url
      try { url = new URL(pfad, basis).href } catch { continue }
      if (ziele.includes(url)) continue
      const html = await holeSeite(url, 8000)
      if (!html) continue
      /* Eine Seite, die auf jede Adresse mit der Startseite antwortet, waere
         sonst dreimal dieselbe. Das Wort muss vorkommen - in einem Impressum
         steht es praktisch immer. */
      if (!/impressum|imprint|angaben gem/i.test(zuText(html).slice(0, 4000))) continue
      ziele = [url, ...ziele]
      break
    }
  }

  /* Die Lead-Adresse kommt zuerst, wenn sie auf eine Unterseite zeigt.

     Bei Franchise-Standorten - von-poll.com/de/immobilienmakler/limburg,
     engelvoelkers.com/de-de/reutlingen - steht der oertliche Ansprechpartner
     genau dort, waehrend das Impressum der Zentrale gehoert und einen
     Vorstand nennt, den das Modell zu Recht verwirft. Stand die Lead-Adresse
     am Ende der Liste, wurde sie in diesen Faellen nie bewertet. 1.439 der
     leeren Leads zeigen auf eine solche Standortseite. */
  const tief = /^https?:\/\/[^/]+\/.+/.test(basis)
  const reihe = tief ? [basis, ...ziele] : [...ziele, basis]

  let rueckfall = null
  for (const url of reihe) {
    const html = url === basis ? start : await holeSeite(url)
    if (!html) continue
    const a = ausschnitt(zuText(html))
    if (a.vielversprechend) return { quelle: url, text: a.text, websiteStatus: 'erreichbar' }
    if (!rueckfall) rueckfall = { quelle: url, text: a.text, websiteStatus: 'erreichbar' }
  }
  /* Die Startseite stand, nur eine brauchbare Stelle gab es nicht. Das ist
     etwas anderes als eine tote Domain und wird auch so vermerkt. */
  return rueckfall ?? { text: null, websiteStatus: 'erreichbar' }
}

/**
 * Die Adresse, mit der sich arbeiten laesst.
 *
 * 44 Leads tragen als Website eine Google-Umleitung - "/url?q=http://..."
 * aus einem Suchergebnis, beim Einlesen mitkopiert. Die wurde nie geladen,
 * weil ihr das Schema fehlt und sie ohnehin keine Firmenseite ist. Das
 * Ziel steht aber im Parameter.
 */
export function adresse(website) {
  let w = String(website || '').trim()
  if (!w) return null
  const q = w.match(/^\/?url\?(?:[^&]*&)*q=([^&]+)/i)
  if (q) { try { w = decodeURIComponent(q[1]) } catch { w = q[1] } }
  if (!/^https?:\/\//i.test(w)) w = 'https://' + w
  try { new URL(w) } catch { return null }
  return w
}

/* Akademische Titel am Anfang eines Namens.

   Der Filter hat sie bisher nur erkannt, wenn sie allein im Feld standen -
   "Dr." wurde verworfen, "Dr. Armin" ging als Vorname durch. Dann gruesste
   die Mail "Hallo Dr. Armin Hartmann", und der Trigger fand "dr. armin"
   natuerlich in keiner Vornamensliste. Zehn Leads trugen so einen Vornamen,
   drei weitere nur den Titel. Abschneiden ist besser als verwerfen: unter
   dem Titel steht meist der richtige Name. */
/* Der Punkt ist Teil der Bedingung. Ohne ihn frass "ing" aus der Liste das
   "Ing" in "Ingrid", und aus "Mag. Ingrid" wurde "rid". */
const TITEL = new RegExp(
  '^((?:dr|prof|dipl|ing|mag|mmag|med|jur|rer|nat|habil|msc|bsc|mba|ll\\.m'
  + '|dkfm|phil|agr|oec|h\\.c)\\.[-\\s]*)+', 'i')

export function ohneTitel(wert) {
  const w = String(wert || '').trim()
  /* Nur wenn danach noch etwas steht. "Dr." allein bleibt "Dr." und faellt
     weiter unten durch - sonst kaeme ein leerer Name durch. */
  const rest = w.replace(TITEL, '').trim()
  return rest.length >= 2 ? rest : w
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
  const w = ohneTitel(String(wert || '').trim().normalize('NFC'))
  if (w.length < 2 || w.length > 40) return null
  if (/\d|@|\.de$|\.com$/.test(w)) return null
  if (/^(gmbh|kg|ohg|gbr|mbh|ag|e\.?k\.?|vertreter|inhaber|gesch|firma|unbekannt|unklar|n\/?a|null)$/i.test(w)) return null
  /* Eine Anrede oder ein Titel ist kein Vorname. kwr-rathenow.de nennt im
     Impressum nur "Herr Harwardt, Geschäftsführer" - ohne Vornamen -, und
     butscher.net "Dr. Jens Butscher": beide Male landete das Wort davor im
     Vornamensfeld. Der Auftrag an das Modell verbot das schon; es hielt sich
     nicht daran, also steht es hier. */
  if (/^(herr|frau|hr|fr|dr|prof|dipl|ing|m{1,2}ag|med|jur|rer|nat|h\.?c|msc|bsc|mba|ll\.?m|dkfm|ba|ma|m\.?a|b\.?a)\.?$/i.test(w)) return null
  /* Ein zusammengesetzter Titel ohne Namen dahinter: "Dr.-Ing.", "Dipl.-Ing.",
     "Prof. Dr.". ohneTitel laesst ihn stehen, weil nichts uebrig bliebe -
     hier faellt er durch. */
  if (/^(?:(?:dr|prof|dipl|ing|mag|mmag|med|habil|phil|rer|nat|oec|jur)\.?[-\s]*)+$/i.test(w)) return null
  /* Eine Rechtsform irgendwo im Wert heisst: hier steht die Firma, nicht ihr
     Inhaber. Bei "Niedermayer Immobilien GmbH" trug der Nachname
     "Immobilien GmbH" - die Sperrliste oben traf nur das Wort fuer sich. */
  if (/(?<![A-Za-z\u00c0-\u024f])(gmbh|mbh|ohg|gbr|kgaa|e\.?\s?k(?:fr)?\.|ug\b|\bag\b|\bkg\b)/i.test(w)) return null
  /* Und ein Branchenwort ist weder Vor- noch Nachname. Das Modell zerlegte
     am 04.10.2026 sechs Firmennamen in zwei Teile und schrieb den zweiten
     ins Nachnamensfeld: "Beeler | Immobilien", "Nemetz | Immobilien",
     "Werner | Immobilien Management". Die Rechtsform-Regel darueber traf
     nicht, weil keine dabeistand - KEIN_NACHNAME kannte die Woerter
     laengst, wurde aber nur zur Auswahl der Fundstelle benutzt. */
  if (w.split(/[-\s]+/).some(teil => KEIN_NACHNAME.test(teil))) return null
  /* Ein Mustername ist kein Name. Beim Aufräumen des Altbestands am
     02.10.2026 standen „Max Mustermann", „Hans Muster" und „Karin Muster" in
     den Feldern - alle drei von Platzhalter-Impressen. „Max" allein bleibt
     natürlich: Max Hartmann, Max Renner, Max Koch sind echte Kontakte. */
  if (/^(muster(mann|frau)?|mustermax|erika mustermann|max mustermann|vorname|nachname)$/i.test(w)) return null
  /* Und eine Anrede- oder Grussfloskel auch nicht - im Altbestand stand bei
     54 Kontakten „liebe Makler" im Namensfeld. */
  if (/^(sehr geehrte[rn]?|liebe[rs]?|hallo|guten tag|damen|herren|sekret(ä|ae)rin|sekretariat|team|zentrale|empfang)$/i.test(w)) return null
  /* Auch keine Auskunft ueber das Fehlen einer Auskunft. Bei „s REAL
     Immobilien Braunau" schrieb das Modell wortwoertlich „Nicht angegeben"
     ins Vornamensfeld, obwohl der Auftrag das Weglassen verlangt. */
  if (/^(nicht |keine? |ohne |k\.?a\.?$|n\.?v\.?$)/i.test(w)) return null
  if (/^(unbekannt|unbenannt|anonym|entf(ä|ae)llt|fehlt|leer|none|unknown|not specified|n\/a)$/i.test(w)) return null
  /* Eine Abkuerzung ist kein Name. Im ersten Durchgang am 01.10.2026 kam bei
     sechs von 25 Leads "WEG WEG" heraus - das Wort stand im Seitentext, und
     das Modell nahm es, weil nichts Besseres da war. Ein Wort ganz in
     Grossbuchstaben ist in einem Impressum fast nie ein Vor- oder Nachname;
     wo doch, schadet das Weglassen nicht. */
  /* Initialen sind keine Abkuerzung wie WEG oder IVD - sie haben Punkte.
     Als Nachname taugen sie nichts, als Vorname entscheidet darueber
     namenspaarBrauchbar: dort ist bekannt, in welchem Feld der Wert landet. */
  if (!NUR_INITIALEN.test(w) && w.length <= 5 && w === w.toUpperCase()) return null
  if (NUR_INITIALEN.test(w)) return w
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
  /* Ein Vorname aus Initialen taugt fuer die Mail nicht. Die Anrede kommt
     aus dem Geschlecht, das Geschlecht aus dem Vornamen - und "W." sagt
     dazu nichts. Ohne Anrede gruesst die Mailvorlage mit vollem Namen, und
     "Hallo W. Kuhn" sieht nach Datenbankfehler aus. Ein Nachname allein ist
     laut Auftrag ohnehin kein Treffer; hier ist derselbe Fall nur anders
     geschrieben. */
  if (NUR_INITIALEN.test(v)) return null
  /* Als Nachname sind Initialen genauso wenig ein Name. */
  if (NUR_INITIALEN.test(n)) return null
  return { vorname: grossAnfang(v), nachname: grossAnfang(n) }
}

/* Ein Wert, der nur aus Anfangsbuchstaben besteht: "W.", "H.-J.", "W.D." */
const NUR_INITIALEN = /^(?:[A-Z\u00c0-\u00de]\.[-\s]?){1,3}$/

/* Manche Seiten schreiben den Namen klein - schadkami-immobilien.de etwa.
   In der Anrede faellt das auf ("Hallo Herr schadkami"), im Impressum nicht.
   Namenszusaetze bleiben, wie sie sind: "von Quast" und "de la Motte" sind
   richtig so. */
function grossAnfang(w) {
  if (/^(von|van|de|du|zu|der|den|di|da|le|la)\s/i.test(w)) return w
  if (w !== w.toLowerCase()) return w   // hat schon Grossbuchstaben
  return w.charAt(0).toUpperCase() + w.slice(1)
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
  if (a === b) return false
  /* Zwei Domains derselben Firma. rudert-rudert.de fuehrt ins Impressum von
     rudert-immobilien.de, und dort steht Johannes Rudert - der Mann, den wir
     suchen. Der Filter hat ihn weggeworfen, weil er nur auf Gleichheit sah.
     Teilen beide Adressen ein eigenes Wort, ist es dieselbe Firma.

     Branchen- und Rechtsformwoerter zaehlen dabei nicht: sonst gilt jedes
     "...-immobilien.de" als verwandt mit jedem anderen, und Osterkamp
     Immobilien bekaeme wieder den Inhaber von vosse-immo.de. */
  const eigen = (k) => k.replace(/\.[a-z.]+$/, '').split(/[-_.]+/)
    .filter(t => t.length >= 4 && !BRANCHENWORT.test(t))
  const meine = new Set(eigen(b))
  return !eigen(a).some(t => meine.has(t))
}

/* Woerter, die in jeder zweiten Maklerdomain stehen und darum nichts
   darueber sagen, ob zwei Adressen zur selben Firma gehoeren. */
const BRANCHENWORT = new RegExp(
  '^(immobilien|immobilie|immo|immos|makler|maklerin|hausverwaltung|verwaltung'
  + '|haus|haeuser|wohnen|wohnung|wohnungen|real|realty|realestate|estate'
  + '|invest|investment|treuhand|consulting|group|gruppe|team|service|services'
  + '|gmbh|agentur|kontor|online|info|home|homes|city|center|zentrum'
  + '|sachverstaendiger|gutachter|bewertung|verkauf|objekt|objekte)$', 'i')
