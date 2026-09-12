// Zugang zu Googles Schnittstellen ueber einen dauerhaften Aktualisierungs-
// Schluessel (Refresh Token).
//
// Warum nicht ein Dienstkonto: Die Meet-Raeume gehoeren einem persoenlichen
// Google-Konto, nicht einer Organisation. Ein Dienstkonto koennte sie ohne
// domainweite Delegierung nicht anfassen - die gibt es bei einem privaten
// Konto nicht. Also einmalige Zustimmung des Kontoinhabers, danach laeuft es
// ohne Zutun weiter.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

let zwischenspeicher = { token: null, gueltig_bis: 0 }

/** Holt ein kurzlebiges Zugangs-Token. Wird zwischengespeichert. */
export async function googleToken() {
  const id     = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  const refresh = process.env.GOOGLE_REFRESH_TOKEN

  if (!id || !secret || !refresh) {
    throw new Error('Google-Zugang unvollstaendig: GOOGLE_CLIENT_ID, '
      + 'GOOGLE_CLIENT_SECRET und GOOGLE_REFRESH_TOKEN muessen gesetzt sein')
  }

  // Eine Minute Sicherheitsabstand, damit kein Aufruf mit einem Token
  // losgeht, das unterwegs ablaeuft.
  if (zwischenspeicher.token && Date.now() < zwischenspeicher.gueltig_bis - 60_000) {
    return zwischenspeicher.token
  }

  const antwort = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: 'refresh_token'
    })
  })

  const daten = await antwort.json()
  if (!antwort.ok) {
    throw new Error('Google-Token abgelehnt: ' + (daten.error_description || daten.error || antwort.status))
  }

  zwischenspeicher = {
    token: daten.access_token,
    gueltig_bis: Date.now() + (daten.expires_in || 3600) * 1000
  }
  return zwischenspeicher.token
}

/**
 * Loest Calendlys Weiterleitung auf und gibt den Meeting-Code zurueck.
 *
 * Der im CRM gespeicherte Link ist calendly.com/events/<id>/google_meet. Er
 * leitet ohne Anmeldung auf meet.google.com/<code> weiter. Direkt gespeicherte
 * Meet-Adressen werden ebenfalls erkannt.
 */
export async function meetCodeErmitteln(link) {
  if (!link) return null

  const direkt = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i.exec(link)
  if (direkt) return direkt[1].toLowerCase()

  if (!link.includes('calendly.com')) return null

  // Nicht folgen, sondern die Weiterleitung selbst lesen: So bleibt es bei
  // einem Aufruf, und ein zwischenzeitlicher Umbau bei Calendly faellt auf,
  // statt still eine falsche Seite zu liefern.
  const antwort = await fetch(link, { redirect: 'manual' })
  const ziel = antwort.headers.get('location') || ''
  const treffer = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i.exec(ziel)
  return treffer ? treffer[1].toLowerCase() : null
}

/**
 * Stellt einen Meet-Raum auf "offen": Wer den Link hat, kommt direkt hinein,
 * ohne dass ein Organisator einlaesst.
 *
 * Rueckgabe: { ok: true } oder { ok: false, grund, dauerhaft }
 * dauerhaft = true bedeutet: erneut versuchen hat keinen Zweck.
 */
export async function meetRaumOeffnen(meetCode) {
  const token = await googleToken()

  const antwort = await fetch(
    `https://meet.googleapis.com/v2/spaces/${meetCode}?updateMask=config.accessType`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ config: { accessType: 'OPEN' } })
    }
  )

  if (antwort.ok) return { ok: true }

  const text = await antwort.text()

  // 403 und 404 wiederholen sich nicht von selbst: Entweder deckt die
  // Schnittstelle dieses Konto nicht ab, oder der Raum gehoert ihm nicht.
  // Ein Wiederholungslauf wuerde nur Rauschen erzeugen.
  const dauerhaft = antwort.status === 403 || antwort.status === 404 || antwort.status === 400

  return {
    ok: false,
    dauerhaft,
    grund: `${antwort.status} ${text.slice(0, 300)}`
  }
}
