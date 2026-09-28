// Zeigt und verwaltet die Calendly-Webhooks der Organisation.
//
// Anlass: Am 28.09.2026 wurde ein gerade uebergebener Kontakt 2,5 Sekunden
// nach der Uebergabe wieder auf "Termin verschoben" zurueckgesetzt. Ursache
// war der Webhook der Produktion: Er hoert auf dieselben Calendly-Ereignisse,
// laeuft mit dem alten Code (main kennt weder shared/status.js noch das Feld
// termin_abschlussgespraech) und schreibt in dieselbe Datenbank. Welche
// Webhooks registriert sind, zeigt Calendly nirgends in der Oberflaeche - nur
// ueber die API. Deshalb dieses Skript.
//
// Aufruf:
//   CALENDLY_API_KEY=... node scripts/calendly-webhooks.mjs
//   CALENDLY_API_KEY=... node scripts/calendly-webhooks.mjs --anlegen <url>
//   CALENDLY_API_KEY=... node scripts/calendly-webhooks.mjs --loeschen <uri>
//
// Ohne Flag passiert nichts ausser Lesen. Die beiden schreibenden Flags
// fragen vorher nach.

const SCHLUESSEL = process.env.CALENDLY_API_KEY
if (!SCHLUESSEL) {
  console.error('CALENDLY_API_KEY fehlt. Der Schluessel steht in den Netlify-Umgebungsvariablen')
  console.error('der Seite crmsunsideai (Site settings > Environment variables).')
  process.exit(2)
}

const kopf = { Authorization: `Bearer ${SCHLUESSEL}`, 'Content-Type': 'application/json' }

async function hole(pfad, optionen = {}) {
  const antwort = await fetch(`https://api.calendly.com${pfad}`, { headers: kopf, ...optionen })
  const text = await antwort.text()
  let daten = null
  try { daten = text ? JSON.parse(text) : null } catch { daten = { rohtext: text } }
  if (!antwort.ok) {
    throw new Error(`${antwort.status} ${pfad}: ${daten?.message || daten?.title || text.slice(0, 200)}`)
  }
  return daten
}

// Die Organisation steht am angemeldeten Benutzer.
const ich = await hole('/users/me')
const organisation = ich.resource.current_organization
console.log(`Organisation: ${organisation}`)
console.log(`Angemeldet als: ${ich.resource.name} <${ich.resource.email}>\n`)

const [flag, wert] = process.argv.slice(2)

if (flag === '--anlegen') {
  if (!wert) { console.error('Ziel-URL fehlt.'); process.exit(2) }
  const neu = await hole('/webhook_subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      url: wert,
      events: ['invitee.created', 'invitee.canceled'],
      organization: organisation,
      scope: 'organization'
    })
  })
  console.log('Angelegt:', neu.resource.uri, '->', neu.resource.callback_url)
  process.exit(0)
}

if (flag === '--loeschen') {
  if (!wert) { console.error('URI des Webhooks fehlt.'); process.exit(2) }
  const kurz = wert.split('/').pop()
  await hole(`/webhook_subscriptions/${kurz}`, { method: 'DELETE' })
  console.log('Geloescht:', wert)
  process.exit(0)
}

// Ohne Flag: nur zeigen.
const liste = await hole(
  `/webhook_subscriptions?organization=${encodeURIComponent(organisation)}&scope=organization`)

if (!liste.collection?.length) {
  console.log('Kein Webhook registriert.')
  process.exit(0)
}

for (const w of liste.collection) {
  const ziel = w.callback_url || ''
  const wohin = ziel.includes('osc-umbau') ? 'VORSCHAU (neuer Code)'
    : ziel.includes('crmsunsideai') ? 'PRODUKTION (alter Code)'
    : 'fremd'
  console.log(`${wohin}`)
  console.log(`  Ziel:      ${ziel}`)
  console.log(`  Ereignisse:${(w.events || []).join(', ')}`)
  console.log(`  Zustand:   ${w.state}`)
  console.log(`  Angelegt:  ${w.created_at}`)
  console.log(`  URI:       ${w.uri}\n`)
}
