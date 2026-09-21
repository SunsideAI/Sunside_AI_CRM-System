import { useState, useEffect } from 'react'
import { Loader2, CalendarClock, AlertTriangle, Video, Phone } from 'lucide-react'

// Welchem Gespräch dient welche Calendly-Terminart? (Ticket 7)
//
// Warum das nötig ist: Der Terminwähler sucht die Terminart bisher allein
// danach, ob sie „video" oder „phone" ist — nicht danach, wozu sie dient.
// Solange es nur das Beratungsgespräch in zwei Varianten gab, ging das gut.
// Mit der 45-Minuten-Terminart fürs Abschlussgespräch träfe find() je nach
// Reihenfolge die falsche, ohne dass es jemand merkt.
//
// Deshalb bekommt hier jede Terminart ihren Zweck. Video oder Telefon wählt
// der Buchende weiterhin selbst — nur eben innerhalb des richtigen Zwecks.

const SCHLUESSEL = 'calendly_terminart_zuordnung'

const ZWECKE = [
  { wert: '',          name: 'nicht zugeordnet' },
  { wert: 'beratung',  name: 'Beratungsgespräch' },
  { wert: 'abschluss', name: 'Abschlussgespräch' }
]

export default function TerminartenZuordnung() {
  const [zuordnung, setZuordnung] = useState({})
  const [arten, setArten] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')
  const [kalenderFehler, setKalenderFehler] = useState('')

  useEffect(() => { laden() }, [])

  const laden = async () => {
    setLaedt(true)
    try {
      const [e, k] = await Promise.all([
        fetch('/.netlify/functions/einstellungen').then(r => r.json()).catch(() => ({})),
        fetch('/.netlify/functions/calendar?action=calendly-event-types')
          .then(r => r.json()).catch(() => ({}))
      ])

      // Ein kaputter Wert darf die Seite nicht mitreißen.
      let gespeichert = {}
      try { gespeichert = JSON.parse(e?.einstellungen?.[SCHLUESSEL]?.wert || '{}') || {} }
      catch { gespeichert = {} }
      setZuordnung(gespeichert)

      if (k?.success && Array.isArray(k.eventTypes)) setArten(k.eventTypes)
      else setKalenderFehler('Die Terminarten konnten nicht von Calendly geladen werden.')
    } catch (err) {
      setFehler('Laden fehlgeschlagen: ' + err.message)
    } finally {
      setLaedt(false)
    }
  }

  const setzen = async (uri, zweck) => {
    const neu = { ...zuordnung }
    if (zweck) neu[uri] = zweck; else delete neu[uri]

    setSpeichert(true); setFehler('')
    try {
      const antwort = await fetch('/.netlify/functions/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schluessel: SCHLUESSEL, wert: JSON.stringify(neu) })
      })
      const daten = await antwort.json()
      if (!antwort.ok) { setFehler(daten.error || 'Speichern fehlgeschlagen'); return }
      setZuordnung(neu)
    } catch (err) {
      setFehler('Netzwerkfehler: ' + err.message)
    } finally {
      setSpeichert(false)
    }
  }

  if (laedt) {
    return (
      <div className="card-elevated p-6 flex items-center gap-2 text-on-surface-variant">
        <Loader2 className="w-4 h-4 animate-spin" /> Terminarten werden geladen …
      </div>
    )
  }

  const zaehle = z => arten.filter(a => zuordnung[a.uri] === z).length

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-5 h-5 text-primary" />
        <h3 className="text-title-md text-on-surface">Terminarten</h3>
      </div>
      <p className="text-body-sm text-on-surface-variant mb-4">
        Wozu jede Calendly-Terminart dient. Solange nichts zugeordnet ist,
        bleibt alles wie bisher, und der Buchende wählt aus allen.
      </p>

      {fehler && (
        <div className="flex gap-2 mb-4 p-3 bg-error-container rounded-lg text-body-sm text-error">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {fehler}
        </div>
      )}
      {kalenderFehler && (
        <div className="flex gap-2 mb-4 p-3 bg-warning-container rounded-lg text-body-sm text-on-surface">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {kalenderFehler}
        </div>
      )}

      <div className="space-y-3">
        {arten.map(a => (
          <div key={a.uri}
               className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-container rounded-lg">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium text-sm text-on-surface">
                {a.type === 'video'
                  ? <Video className="w-4 h-4 text-on-surface-variant" />
                  : <Phone className="w-4 h-4 text-on-surface-variant" />}
                <span className="truncate">{a.name}</span>
              </div>
              <div className="text-body-sm text-on-surface-variant mt-0.5">
                {a.duration} Minuten · {a.type === 'video' ? 'Video' : 'Telefonisch'}
              </div>
            </div>

            <select
              value={zuordnung[a.uri] || ''}
              disabled={speichert}
              onChange={e => setzen(a.uri, e.target.value)}
              className="p-2 rounded-lg border border-outline-variant bg-surface-container-lowest
                         text-body-md disabled:opacity-50"
            >
              {ZWECKE.map(z => <option key={z.wert} value={z.wert}>{z.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Die Warnung, die zählt: Ein Zweck ohne Terminart lässt sich nicht
          buchen, und ein Zweck ohne Video- UND Telefon-Variante zwingt alle
          in dieselbe Form. */}
      <div className="text-label-sm text-on-surface-variant mt-4 space-y-1">
        <div>Beratungsgespräch: {zaehle('beratung')} Terminart(en) zugeordnet</div>
        <div>Abschlussgespräch: {zaehle('abschluss')} Terminart(en) zugeordnet</div>
        {zaehle('abschluss') === 0 && (
          <div className="text-on-surface">
            Ohne zugeordnete Terminart wird der Abschlusstermin weiterhin von
            Hand eingetragen.
          </div>
        )}
      </div>
    </div>
  )
}
