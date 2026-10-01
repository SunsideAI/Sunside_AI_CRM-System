/**
 * Die E-Mail-Signatur - an einer Stelle.
 *
 * Sie stand doppelt im Code: einmal als HTML-String im Versand
 * (netlify/functions/send-email.js), einmal als nachgebautes JSX in der
 * Vorschau des Composers. Zwei Fassungen derselben Signatur laufen
 * auseinander, und genau das war passiert - in der Vorschau trugen die
 * Symbole keine Links, die drei Fusszeilen-Verweise waren <span> statt <a>,
 * und das IBM-Abzeichen hiess dort "Coursera Badge". Gesehen hat es niemand,
 * weil Vorschau und echte Mail nie nebeneinander lagen.
 *
 * Massgeblich ist der Versand: was hier steht, ist das, was beim Empfaenger
 * ankommt. Die Vorschau rendert seither dieselbe Zeichenkette.
 */

const BILD = {
  logo:      'https://onecdn.io/media/8c3e476c-82b3-4db6-8cbe-85b46cd452d0/full',
  instagram: 'https://onecdn.io/media/a8cea175-8fcb-4f91-9d6f-f53479a9a7fe/full',
  website:   'https://onecdn.io/media/10252e19-d770-418d-8867-2ec8236c8d86/full',
  ibm:       'https://onecdn.io/media/9de8d686-0a97-42a7-b7a6-8cf0fa4c6e95/full',
  make:      'https://onecdn.io/media/2c4b8d13-4b19-4898-bd71-9b52f053ee57/full',
}

export const SIGNATUR_FARBE = '#460E74'

/**
 * Die eine Zeile unter dem Namen.
 *
 * Wer das Unternehmen gegruendet hat, steht auch so da. Bei allen anderen
 * steht an derselben Stelle, was die Firma tut. Zwei Zeilen braucht es nicht:
 * Der Gruender sagt mit "Gründer" schon alles, und bei den uebrigen stand der
 * Firmensatz vorher ohnehin direkt darunter.
 *
 * Verglichen wird ohne Ruecksicht auf Gross- und Kleinschreibung und auf
 * doppelte Leerzeichen, weil der Name aus dem Benutzerprofil kommt und dort
 * schon mal zwei davon stehen.
 */
const GRUENDER = ['paul probodziak', 'niklas schwerin']
const FIRMENZEILE = 'KI-Entwicklung für Immobilienmakler'

export function positionFuer(name) {
  const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return GRUENDER.includes(n) ? 'Gründer' : FIRMENZEILE
}

export const ABSENDER_VORGABE = {
  name: 'Sunside AI Team',
  email: 'contact@sunsideai.de',
  telefon: '+49 176 56039050',
}

/* Name, Adresse und Telefon kommen aus dem Benutzerprofil und landen roh im
   HTML. Ein spitzes Klammerpaar darin zerlegt sonst die Signatur. */
const sicher = (wert) =>
  String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * @param {object} absender
 * @param {string} absender.name        Vor- und Nachname des Absenders
 * @param {string} absender.email       geschaeftliche Adresse
 * @param {string} absender.telefon
 * @param {boolean} absender.eigenerGruss  Die Mail schliesst bereits mit Gruss
 *   und Namen - dann haengt die Signatur nur den Firmenblock an, sonst stuende
 *   der Gruss zweimal beim Kunden.
 */
export function signaturHtml({ name, email, telefon, eigenerGruss = false } = {}) {
  const n = sicher(name || ABSENDER_VORGABE.name)
  const e = sicher(email || ABSENDER_VORGABE.email)
  const t = sicher(telefon || ABSENDER_VORGABE.telefon)
  const position = sicher(positionFuer(name))

  // Nachgebaut aus der Signatur im Postfach, Zeile fuer Zeile: dieselben
  // Abstaende (eine Leerzeile, nicht zwei), dieselbe Schrift, und die Links in
  // Schwarz statt in der Hausfarbe. Das Trennzeichen in der Adresszeile ist
  // ein grosses I, kein Strich - so steht es dort.
  const SCHRIFT = 'font-size: 10pt; font-family: arial, helvetica, sans-serif;'
  const LEER = `<div style="${SCHRIFT}">&nbsp;</div>`
  const SCHWARZ = 'color: rgb(0, 0, 0);'

  // Vor dem Gruss eine Leerzeile, damit er nicht am Mailtext klebt. Bei
  // eigenerGruss steht der Gruss schon im Text und darunter folgt nur noch
  // die Position - die gehoert direkt unter den Namen, ohne Abstand.
  const kopf = eigenerGruss
    ? `<div style="${SCHRIFT}">${position}</div>`
    : `${LEER}
       <div style="${SCHRIFT}">Mit freundlichen Grüßen</div>
       ${LEER}
       <div style="${SCHRIFT}"><strong>${n}</strong></div>
       <div style="${SCHRIFT}">${position}</div>`

  return `
    <div style="${SCHRIFT}">
      ${kopf}
      ${LEER}
      <div style="${SCHRIFT}">
        <a href="https://www.sunsideai.de/"><img src="${BILD.logo}" alt="Sunside AI" width="189" height="41" /></a>
      </div>
      ${LEER}
      <div style="${SCHRIFT}">
        <a href="https://www.instagram.com/sunside.ai/"><img src="${BILD.instagram}" alt="Instagram" width="28" height="28" /></a>&nbsp;&nbsp;<a href="https://www.sunsideai.de/"><img src="${BILD.website}" alt="Website" width="28" height="28" /></a>
      </div>
      ${LEER}
      <div style="${SCHRIFT}"><strong>Sunside AI GbR</strong></div>
      <div style="${SCHRIFT}">
        Schiefer Berg 3 I&nbsp;38124 Braunschweig I&nbsp;Deutschland<br />
        E-Mail:&nbsp;<a style="${SCHWARZ}" href="mailto:${e}">${e}</a> I Tel: ${t}
      </div>
      <div style="${SCHRIFT}">
        <a style="${SCHWARZ}" href="https://www.sunsideai.de/">www.sunsideai.de&nbsp;</a>|
        <a style="${SCHWARZ}" href="https://sunsideai.de/jetzt-termin-buchen">Jetzt Termin buchen</a> |
        <a style="${SCHWARZ}" href="https://sachverstand-mit-herz.podigee.io/12-new-episode">Zur Podcast-Folge</a>
      </div>
      ${LEER}
      <div style="${SCHRIFT}">Geschäftsführung: Paul Probodziak und Niklas Schwerin</div>
      ${LEER}
      <div style="${SCHRIFT}">
        <a href="https://coursera.org/share/022de5be2d06363370a26f58d0993aa9"><img src="${BILD.ibm}" alt="IBM AI Developer" width="125" height="63" style="max-width: 100%;" /></a> <a href="https://www.credly.com/badges/a3fac4e4-90bd-4b9a-b318-dd70bc3aa95c/public_url"><img src="${BILD.make}" alt="Make" width="63" height="63" style="max-width: 100%;" /></a>
      </div>
      <div style="${SCHRIFT}">
        <em><strong>Wir sind zertifizierte IBM KI-Entwickler und Make Automatisierungsexperten.</strong></em>
      </div>
    </div>
  `
}
