// Sitzungs-Token: signiert, serverseitig geprueft.
//
// Vorher kam die Identitaet als user_id aus der Query - frei waehlbar durch den
// Aufrufer. Jede Rollenpruefung im Frontend war damit wirkungslos, weil sich
// jeder als jeder ausgeben konnte. Ab hier stammt die Identitaet ausschliesslich
// aus diesem Token.
//
// HS256 von Hand, damit keine neue Abhaengigkeit noetig ist.

import crypto from 'node:crypto'

const LAUFZEIT_STUNDEN = 12

function geheimnis() {
  // Bevorzugt ein eigenes Sitzungsgeheimnis. Fehlt es, wird eines aus dem
  // Service-Key abgeleitet - der liegt in Netlify ohnehin vor. So braucht der
  // Rollout keine neue Umgebungsvariable, und der Key selbst verlaesst den
  // Server nie (nur sein Ableitungsergebnis signiert).
  const eigen = process.env.SESSION_SECRET
  if (eigen && eigen.length >= 32) return Buffer.from(eigen, 'utf8')

  const basis = process.env.SUPABASE_SERVICE_KEY
  if (!basis) return null
  return crypto.hkdfSync('sha256', Buffer.from(basis, 'utf8'),
    Buffer.from('sunside-crm-session', 'utf8'),
    Buffer.from('v1', 'utf8'), 32)
}

const b64 = (buf) => Buffer.from(buf).toString('base64url')

function signieren(daten, key) {
  return b64(crypto.createHmac('sha256', key).update(daten).digest())
}

/** Erzeugt ein Token fuer einen angemeldeten Nutzer. */
export function tokenErzeugen(user) {
  const key = geheimnis()
  if (!key) throw new Error('Kein Sitzungsgeheimnis verfuegbar')

  const kopf = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const inhalt = b64(JSON.stringify({
    sub: user.id,
    rollen: Array.isArray(user.rolle) ? user.rolle : [user.rolle].filter(Boolean),
    name: user.vor_nachname || '',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + LAUFZEIT_STUNDEN * 3600
  }))
  return `${kopf}.${inhalt}.${signieren(`${kopf}.${inhalt}`, key)}`
}

/** Prueft ein Token. Gibt den Inhalt zurueck oder null. */
export function tokenPruefen(token) {
  const key = geheimnis()
  if (!key || typeof token !== 'string') return null

  const teile = token.split('.')
  if (teile.length !== 3) return null

  const erwartet = signieren(`${teile[0]}.${teile[1]}`, key)
  const a = Buffer.from(erwartet)
  const b = Buffer.from(teile[2])
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let inhalt
  try {
    inhalt = JSON.parse(Buffer.from(teile[1], 'base64url').toString('utf8'))
  } catch { return null }

  if (!inhalt?.sub) return null
  if (!inhalt.exp || inhalt.exp * 1000 < Date.now()) return null

  return inhalt
}

/** Liest das Token aus dem Authorization-Kopf eines Netlify-Events. */
export function sitzung(event) {
  const kopf = event?.headers?.authorization || event?.headers?.Authorization || ''
  const treffer = /^Bearer\s+(.+)$/i.exec(kopf.trim())
  return treffer ? tokenPruefen(treffer[1]) : null
}

const KOPFZEILEN = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

/**
 * Verlangt eine gueltige Sitzung, optional mit einer der genannten Rollen.
 * Rueckgabe: { nutzer } bei Erfolg, { antwort } mit fertiger Fehlerantwort sonst.
 */
export function anmeldungVerlangen(event, rollen = null) {
  const inhalt = sitzung(event)

  if (!inhalt) {
    return {
      antwort: {
        statusCode: 401,
        headers: KOPFZEILEN,
        body: JSON.stringify({ error: 'Nicht angemeldet', code: 'sitzung_ungueltig' })
      }
    }
  }

  if (rollen && rollen.length > 0) {
    const eigene = inhalt.rollen || []
    if (!rollen.some(r => eigene.includes(r))) {
      return {
        antwort: {
          statusCode: 403,
          headers: KOPFZEILEN,
          body: JSON.stringify({ error: 'Keine Berechtigung fuer diesen Vorgang' })
        }
      }
    }
  }

  return {
    nutzer: {
      id: inhalt.sub,
      rollen: inhalt.rollen || [],
      name: inhalt.name || '',
      istAdmin: (inhalt.rollen || []).some(r => r === 'Admin' || r === 'Geschäftsführer')
    }
  }
}

export const corsKopf = KOPFZEILEN

// ---------------------------------------------------------------------------
// Aufrufe von aussen (Webhooks, Callbacks). Die tragen kein Sitzungs-Token,
// sondern weisen sich ueber ein geteiltes Geheimnis aus.
// ---------------------------------------------------------------------------

/**
 * Prueft die Calendly-Signatur (Kopf: "t=<zeit>,v1=<hmac>").
 * Ohne gesetztes CALENDLY_WEBHOOK_SECRET wird durchgelassen und gewarnt -
 * sonst waere der Terminfluss ab dem Deploy tot. Sobald das Geheimnis in
 * Netlify steht, ist die Tuer zu.
 */
export function calendlyEcht(event) {
  const geheim = process.env.CALENDLY_WEBHOOK_SECRET
  if (!geheim) {
    console.warn('CALENDLY_WEBHOOK_SECRET fehlt - Webhook wird UNGEPRUEFT angenommen')
    return true
  }

  const kopf = event.headers?.['calendly-webhook-signature']
       || event.headers?.['Calendly-Webhook-Signature'] || ''
  const teile = Object.fromEntries(
    kopf.split(',').map(s => s.trim().split('=')).filter(p => p.length === 2))

  if (!teile.t || !teile.v1) return false

  // Wiedereinspielen aelterer Aufrufe ausschliessen (3 Minuten Fenster).
  const alter = Math.abs(Date.now() / 1000 - Number(teile.t))
  if (!Number.isFinite(alter) || alter > 180) return false

  const erwartet = crypto.createHmac('sha256', geheim)
    .update(`${teile.t}.${event.body || ''}`).digest('hex')

  const a = Buffer.from(erwartet)
  const b = Buffer.from(teile.v1)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Prueft ein geteiltes Geheimnis im Authorization-Kopf (Rueckrufe eigener
 * Dienste). Gleiche Uebergangsregel wie oben.
 */
export function rueckrufEcht(event, umgebungsName) {
  const geheim = process.env[umgebungsName]
  if (!geheim) {
    console.warn(`${umgebungsName} fehlt - Rueckruf wird UNGEPRUEFT angenommen`)
    return true
  }
  const kopf = (event.headers?.authorization || event.headers?.Authorization || '').trim()
  const treffer = /^Bearer\s+(.+)$/i.exec(kopf)
  if (!treffer) return false
  const a = Buffer.from(geheim)
  const b = Buffer.from(treffer[1])
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
