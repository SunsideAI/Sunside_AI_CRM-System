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
 *
 * Der Name der Umgebungsvariablen ist bewusst tolerant: der Signing Key wurde
 * bisher nirgends gelesen, und ein falsch geratener Name waere schlimmer als
 * gar keine Pruefung - er wuerde still durchlassen, waehrend alle glauben, die
 * Tuer sei zu. Deshalb werden mehrere gaengige Schreibweisen akzeptiert und
 * der gefundene Name protokolliert (nur der Name, nie der Wert).
 */
const CALENDLY_NAMEN = [
  'CALENDLY_WEBHOOK_SECRET',
  'CALENDLY_SIGNING_KEY',
  'CALENDLY_WEBHOOK_SIGNING_KEY',
  'CALENDLY_WEBHOOK_SIGNING_SECRET',
  'CALENDLY_SECRET'
]

export function calendlyEcht(event) {
  const name = CALENDLY_NAMEN.find(n => process.env[n])
  if (!name) {
    console.warn('Kein Calendly-Signaturschluessel gefunden. Gesucht unter: '
      + CALENDLY_NAMEN.join(', ') + ' - Webhook wird UNGEPRUEFT angenommen.')
    return true
  }
  const geheim = process.env[name]

  const kopf = event.headers?.['calendly-webhook-signature']
       || event.headers?.['Calendly-Webhook-Signature'] || ''
  const teile = Object.fromEntries(
    kopf.split(',').map(s => s.trim().split('=')).filter(p => p.length === 2))

  if (!teile.t || !teile.v1) {
    console.error(`Calendly-Webhook ohne Signaturkopf (Schluessel ${name} ist gesetzt)`)
    return false
  }

  // Wiedereinspielen aelterer Aufrufe ausschliessen (3 Minuten Fenster).
  const alter = Math.abs(Date.now() / 1000 - Number(teile.t))
  if (!Number.isFinite(alter) || alter > 180) {
    console.error('Calendly-Webhook zu alt oder mit unbrauchbarem Zeitstempel')
    return false
  }

  const erwartet = crypto.createHmac('sha256', geheim)
    .update(`${teile.t}.${event.body || ''}`).digest('hex')

  const a = Buffer.from(erwartet)
  const b = Buffer.from(teile.v1)
  const passt = a.length === b.length && crypto.timingSafeEqual(a, b)
  if (!passt) console.error(`Calendly-Signatur stimmt nicht (geprueft gegen ${name})`)
  return passt
}

/**
 * Signiert eine Rueckruf-Adresse fuer einen eigenen Dienst.
 *
 * Der SEO-Dienst bekommt von uns nur eine callback_url und kein Geheimnis - er
 * kann sich also gar nicht ausweisen. Statt eines Geheimnisses, das niemand
 * kennt, legen wir den Nachweis in die Adresse, die wir ihm ohnehin geben.
 * Braucht keine Umgebungsvariable.
 */
export function nachweisErzeugen(kennung) {
  const key = geheimnis()
  if (!key) return null
  return crypto.createHmac('sha256', key)
    .update(`rueckruf:${kennung}`).digest('hex').slice(0, 32)
}

// Rueckrufe zu Analysen, die vor der Umstellung gestartet wurden, tragen noch
// keinen Nachweis. Sie werden bis zu diesem Zeitpunkt angenommen, danach nicht
// mehr. Kein Schalter, keine Variable - die Uebergangsfrist laeuft von selbst ab.
const UEBERGANG_BIS = Date.parse('2026-09-14T00:00:00Z')

export function nachweisPruefen(kennung, nachweis) {
  const erwartet = nachweisErzeugen(kennung)
  if (!erwartet) return false

  if (!nachweis) {
    if (Date.now() < UEBERGANG_BIS) {
      console.warn('Rueckruf ohne Nachweis angenommen (Uebergangsfrist bis 14.09.2026):', kennung)
      return true
    }
    console.error('Rueckruf ohne Nachweis abgewiesen:', kennung)
    return false
  }

  const a = Buffer.from(erwartet)
  const b = Buffer.from(String(nachweis))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
