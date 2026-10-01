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
 * Die Position unter dem Namen.
 *
 * Wer das Unternehmen gegruendet hat, steht auch so da; alle anderen sind
 * KI-Entwickler. Verglichen wird ohne Ruecksicht auf Gross- und
 * Kleinschreibung und auf doppelte Leerzeichen, weil der Name aus dem
 * Benutzerprofil kommt und dort schon mal zwei davon stehen.
 */
const GRUENDER = ['paul probodziak', 'niklas schwerin']

export function positionFuer(name) {
  const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return GRUENDER.includes(n) ? 'Gründer' : 'KI-Entwickler'
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

  // Die Position gehoert zum Namen. Schliesst die Mail schon mit eigenem
  // Gruss, steht der Name oben im Text - dann steht die Position direkt
  // darunter, damit sie nicht verloren geht.
  const position = sicher(positionFuer(name))
  const gruss = eigenerGruss
    ? `<div style="font-weight: bold; margin-bottom: 2px;">${position}</div>`
    : `<div style="margin-bottom: 5px;">Mit freundlichen Grüßen</div>
      <div style="font-weight: bold; margin-bottom: 2px;">${n}</div>
      <div style="margin-bottom: 2px;">${position}</div>`

  return `
    <div style="margin-top: 30px; font-family: Arial, sans-serif; font-size: 10pt;">
      ${gruss}
      <div style="color: #666; margin-bottom: 15px;">KI-Entwicklung für Immobilienmakler</div>

      <img src="${BILD.logo}" alt="Sunside AI" style="height: 32px; margin-bottom: 10px;" />

      <div style="margin-bottom: 15px;">
        <a href="https://www.instagram.com/sunside.ai/" style="text-decoration: none; margin-right: 8px;">
          <img src="${BILD.instagram}" alt="Instagram" style="width: 24px; height: 24px; vertical-align: middle;" />
        </a>
        <a href="https://www.sunsideai.de" style="text-decoration: none;">
          <img src="${BILD.website}" alt="Website" style="width: 24px; height: 24px; vertical-align: middle;" />
        </a>
      </div>

      <div style="font-weight: bold; font-size: 9pt;">Sunside AI GbR</div>
      <div style="font-size: 9pt; color: #666;">
        Schiefer Berg 3 | 38124 Braunschweig | Deutschland<br />
        E-Mail: ${e} | Tel: ${t}<br />
        <a href="https://www.sunsideai.de" style="color: ${SIGNATUR_FARBE};">www.sunsideai.de</a> |
        <a href="https://sunsideai.de/#kontakt" style="color: ${SIGNATUR_FARBE}; margin-left: 4px;">Jetzt Termin buchen</a> |
        <a href="https://sachverstand-mit-herz.podigee.io/12-new-episode" style="color: ${SIGNATUR_FARBE}; margin-left: 4px;">Zur Podcast-Folge</a>
      </div>
      <div style="font-size: 9pt; color: #888; margin-top: 5px;">Geschäftsführung: Paul Probodziak und Niklas Schwerin</div>

      <div style="margin-top: 15px;">
        <img src="${BILD.ibm}" alt="IBM AI Developer" style="height: 48px; margin-right: 8px; vertical-align: middle;" />
        <img src="${BILD.make}" alt="Make Badge" style="height: 48px; vertical-align: middle;" />
      </div>
      <div style="font-size: 9pt; color: #666; margin-top: 8px; font-style: italic;">
        <strong>Wir sind zertifizierte IBM KI-Entwickler und Make Automatisierungsexperten.</strong>
      </div>
    </div>
  `
}
