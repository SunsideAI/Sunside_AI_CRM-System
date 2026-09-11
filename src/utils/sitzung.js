// Haengt das Sitzungs-Token an jeden Aufruf einer Netlify-Function.
//
// Bewusst als Umhuellung von window.fetch und nicht als eigene API-Schicht:
// die rund 20 Aufrufstellen im Frontend rufen fetch direkt auf. Eine zentrale
// Schicht haette jede einzelne Stelle umbauen muessen, mit dem Risiko, eine zu
// uebersehen - und genau eine uebersehene Stelle waere ein offenes Tor.

const FUNKTIONS_PFAD = '/.netlify/functions/'

// Ohne Anmeldung erreichbar - hier gibt es noch kein Token.
const OFFEN = ['auth', 'forgot-password', 'set-password', 'calendly-webhook']

function istFunktionsAufruf(url) {
  if (typeof url !== 'string') return false
  return url.startsWith(FUNKTIONS_PFAD) || url.includes(FUNKTIONS_PFAD)
}

function istOffen(url) {
  const name = url.split(FUNKTIONS_PFAD)[1]?.split(/[/?]/)[0]
  return OFFEN.includes(name)
}

function abmelden() {
  localStorage.removeItem('sunside_user')
  localStorage.removeItem('sunside_token')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

export function sitzungEinrichten() {
  const original = window.fetch.bind(window)

  window.fetch = async (eingabe, optionen = {}) => {
    const url = typeof eingabe === 'string' ? eingabe : eingabe?.url || ''

    if (istFunktionsAufruf(url) && !istOffen(url)) {
      const token = localStorage.getItem('sunside_token')
      if (token) {
        const kopf = new Headers(optionen.headers || (eingabe instanceof Request ? eingabe.headers : undefined))
        if (!kopf.has('Authorization')) kopf.set('Authorization', `Bearer ${token}`)
        optionen = { ...optionen, headers: kopf }
      }
    }

    const antwort = await original(eingabe, optionen)

    // Abgelaufene oder fehlende Sitzung: zurueck zur Anmeldung, statt den
    // Nutzer vor leeren Listen sitzen zu lassen.
    if (antwort.status === 401 && istFunktionsAufruf(url) && !istOffen(url)) {
      abmelden()
    }

    return antwort
  }
}
