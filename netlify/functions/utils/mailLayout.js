// Das eine Gesicht aller Mails, die das CRM an das Team schickt.
//
// Vorher baute jede Function ihr eigenes HTML: sechs Kopffarben, Farbverläufe,
// die Outlook nicht zeigt, Emojis als Logo, "ae" statt "ä", keine Text-Fassung.
// Und fast nirgends wurde maskiert - der Name aus dem öffentlichen
// E-Book-Formular ging ungeprüft ins HTML.
//
// Hier steht der Aufbau einmal. Eine Function beschreibt nur noch, WAS die
// Mail sagt; WIE sie aussieht, entscheidet dieser Baustein.
//
// Nicht für Kundenmails: Die schreibt der Vertrieb persönlich (send-email.js).

import { ABSENDER_SYSTEM } from './mail.js'

export const CRM_URL = 'https://crmsunsideai.netlify.app'

const FIRMA = 'Sunside AI GbR · Schiefer Berg 3 · 38124 Braunschweig'

/** Zustand als Etikett. Farbe nur hier - nie als Kopfbalken. */
const TON = {
  aktion:  { bg: '#F0DBFF', fg: '#460E74' },
  warnung: { bg: '#FDF0D2', fg: '#8A5300' },
  problem: { bg: '#FCE3E3', fg: '#A32020' },
  erfolg:  { bg: '#D9F5EA', fg: '#0E7A55' },
  info:    { bg: '#EEEDF2', fg: '#44474F' }
}

const SCHRIFT = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const TITEL = "Manrope,Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function maskieren(wert) {
  return String(wert ?? '').replace(/[&<>"']/g, z => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]
  ))
}

// Hervorhebung im Fließtext. Markiert wird mit Steuerzeichen statt mit
// **Sternchen**: Die Werte stammen oft aus Formularen, und ein Name mit
// Sternchen haette sonst die Formatierung verschoben.
const AUF = '\u0001'
const ZU = '\u0002'
const ohneMarken = wert => String(wert ?? '').replace(/[\u0001\u0002]/g, '')

/** Hebt einen Wert im Fließtext hervor. */
export const fett = wert => `${AUF}${ohneMarken(wert)}${ZU}`

// Alles wird maskiert; nur die eigenen Marken werden zu <strong>.
function absatzHtml(text) {
  return maskieren(text)
    .replace(/\u0001([^\u0002]*)\u0002/g, '<strong style="color:#151C27;font-weight:600;">$1</strong>')
    .replace(/[\u0001\u0002]/g, '')
    .replace(/\n/g, '<br>')
}

const absatzText = text => ohneMarken(text)

/** Betreff nach Schema "Bereich · Was passiert ist". Ohne Emoji, einzeilig. */
export function betreff(bereich, text) {
  return `${bereich} · ${text}`.replace(/\s+/g, ' ').trim()
}

/**
 * Baut eine Systemmail.
 *
 * @param {object} m
 * @param {string} m.bereich      Opening, Setting, Closing, Termine, Leitung, Konto
 * @param {keyof TON} m.ton       aktion | warnung | problem | erfolg | info
 * @param {string} m.zustand      Text im Etikett, z. B. "Zu erledigen"
 * @param {string} m.titel
 * @param {string} m.einleitung   ein bis zwei Sätze, Hervorhebung mit fett()
 * @param {Array<[string, string, ('alt'|undefined)?]>} [m.fakten]
 * @param {[string, string]} [m.hervorgehoben]  Beschriftung und Wert, groß
 * @param {[string, string]} [m.knopf]          Beschriftung und Pfad im CRM
 * @param {string} [m.hinweis]
 * @param {string} m.grund        warum der Empfänger die Mail bekommt
 * @returns {{ html: string, text: string }}
 */
export function systemMail(m) {
  const ton = TON[m.ton] || TON.info
  const fakten = (m.fakten || []).filter(([, wert]) => wert !== undefined && wert !== null && String(wert).trim() !== '')
  const link = m.knopf ? (m.knopf[1].startsWith('http') ? m.knopf[1] : CRM_URL + m.knopf[1]) : null

  const zeilen = fakten.map(([k, v, stil]) => `
              <tr>
                <td style="padding:7px 12px 7px 0;width:38%;vertical-align:top;font:400 13px/1.45 ${SCHRIFT};color:#6B6878;">${maskieren(k)}</td>
                <td style="padding:7px 0;vertical-align:top;font:${stil === 'alt' ? '400' : '600'} 14px/1.45 ${SCHRIFT};color:${stil === 'alt' ? '#8C8898' : '#151C27'};${stil === 'alt' ? 'text-decoration:line-through;' : ''}">${absatzHtml(v)}</td>
              </tr>`).join('')

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${maskieren(m.titel)}</title>
<style>
  @media (max-width:620px){ .karte{padding:24px 20px!important} .aussen{padding:20px 12px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:#F4F2F7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${maskieren(absatzText(m.einleitung))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F2F7;">
  <tr><td class="aussen" align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      <tr><td style="padding:0 4px 16px;font:800 20px/1 ${TITEL};color:#460E74;letter-spacing:-0.01em;">Sunside <span style="font-weight:400;color:#151C27;">CRM</span></td></tr>
      <tr><td class="karte" style="background:#FFFFFF;border:1px solid #E6E1EE;border-radius:12px;padding:32px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font:600 12px/1 ${SCHRIFT};color:#6B6878;letter-spacing:0.06em;text-transform:uppercase;padding-right:10px;">${maskieren(m.bereich)}</td>
          <td style="background:${ton.bg};color:${ton.fg};font:600 12px/1 ${SCHRIFT};padding:5px 10px;border-radius:999px;">${maskieren(m.zustand)}</td>
        </tr></table>
        <h1 style="margin:16px 0 10px;font:700 22px/1.3 ${TITEL};color:#151C27;letter-spacing:-0.01em;">${maskieren(m.titel)}</h1>
        <p style="margin:0 0 22px;font:400 15px/1.6 ${SCHRIFT};color:#3E3B49;">${absatzHtml(m.einleitung)}</p>
        ${m.hervorgehoben ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:#F8F6FB;border:1px solid #EEEAF3;border-radius:10px;">
          <tr><td align="center" style="padding:18px;">
            <div style="font:400 12px/1.4 ${SCHRIFT};color:#6B6878;margin-bottom:6px;">${maskieren(m.hervorgehoben[0])}</div>
            <div style="font:600 22px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#151C27;letter-spacing:0.08em;">${maskieren(m.hervorgehoben[1])}</div>
          </td></tr>
        </table>` : ''}
        ${zeilen ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;background:#F8F6FB;border:1px solid #EEEAF3;border-radius:10px;">
          <tr><td style="padding:12px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${zeilen}
            </table>
          </td></tr>
        </table>` : ''}
        ${link ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:#460E74;border-radius:8px;">
            <a href="${maskieren(link)}" style="display:inline-block;padding:13px 22px;font:600 15px/1 ${SCHRIFT};color:#FFFFFF;text-decoration:none;border-radius:8px;">${maskieren(m.knopf[0])}</a>
          </td>
        </tr></table>` : ''}
        ${m.hinweis ? `<p style="margin:22px 0 0;font:400 13px/1.55 ${SCHRIFT};color:#6B6878;">${absatzHtml(m.hinweis)}</p>` : ''}
      </td></tr>
      <tr><td style="padding:18px 4px 0;font:400 12px/1.6 ${SCHRIFT};color:#8C8898;">
        ${maskieren(m.grund)}<br>${FIRMA}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    `SUNSIDE CRM · ${m.bereich} · ${m.zustand}`,
    '',
    m.titel,
    '',
    absatzText(m.einleitung),
    ...(m.hervorgehoben ? ['', `${m.hervorgehoben[0]}: ${m.hervorgehoben[1]}`] : []),
    ...(fakten.length ? ['', ...fakten.map(([k, v, stil]) => `${k}: ${absatzText(v)}${stil === 'alt' ? ' (alt)' : ''}`)] : []),
    ...(link ? ['', `${m.knopf[0]}: ${link}`] : []),
    ...(m.hinweis ? ['', absatzText(m.hinweis)] : []),
    '',
    '--',
    m.grund,
    FIRMA
  ].join('\n')

  return { html, text }
}

/**
 * Verschickt eine Systemmail über Resend - immer vom System-Absender.
 * Gibt die Antwort zurück, oder null, wenn kein Schlüssel konfiguriert ist.
 */
export async function systemMailSenden({ an, betreff: betreffZeile, mail }) {
  const schluessel = process.env.RESEND_API_KEY
  if (!schluessel) {
    console.log('[mailLayout] RESEND_API_KEY nicht konfiguriert - keine Mail:', betreffZeile)
    return null
  }
  const empfaenger = (Array.isArray(an) ? an : [an]).filter(Boolean)
  if (empfaenger.length === 0) return null

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ABSENDER_SYSTEM,
      to: empfaenger,
      subject: betreffZeile,
      html: mail.html,
      text: mail.text
    })
  })
}
