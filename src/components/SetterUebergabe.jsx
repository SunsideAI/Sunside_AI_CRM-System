import { useState } from 'react'
import { CheckCircle2, CalendarPlus, Loader2, AlertTriangle } from 'lucide-react'
import { STATUS } from '../../shared/status.js'
import { UEBERGABE_2 } from '../../shared/felder.js'
import UebergabeFelder, { AnfragenBedarf } from './UebergabeFelder'
import RueckgabeKnopf from './RueckgabeKnopf'

// Die Ansicht des Setters: Termin bestätigen, dokumentieren, Abschlussgespräch
// legen. Sie hängt am Termin und nicht in der Closing-Ansicht, weil der Setter
// dort keinen Zugang hat (Rolle Closer/Admin).

const FELDER_2 = [
  'zuwachs_auftraege', 'abschlussquote', 'quote_art', 'ist_auftraege',
  'keine_zahlen', 'entscheider_messlatte', 'investitionsrahmen',
  'rahmen_ausgewichen', 'schmerzpunkt_vertieft', 'bedarf_wortlaut',
  'offene_huerde', 'material_versendet'
]

export default function SetterUebergabe({ lead, onGespeichert }) {
  const [werte, setWerte] = useState(() =>
    Object.fromEntries(FELDER_2.map(k => [k, lead?.[k] ?? null])))
  const [terminAbschluss, setTerminAbschluss] = useState(
    lead?.termin_abschlussgespraech ? lead.termin_abschlussgespraech.slice(0, 16) : '')
  const [laeuft, setLaeuft] = useState(false)
  const [offen, setOffen] = useState([])
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')

  const status = lead?.status

  const senden = async (updates) => {
    setLaeuft(true); setFehler(''); setMeldung(''); setOffen([])
    try {
      const antwort = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotLeadId: lead.id, updates })
      })
      const daten = await antwort.json()

      if (!antwort.ok) {
        if (antwort.status === 422 && daten.error === 'uebergabe_unvollstaendig') {
          setOffen(daten.offen || [])
          setFehler(daten.message)
        } else if (antwort.status === 409) {
          setFehler(daten.error)
        } else {
          setFehler(daten.error || daten.message || 'Konnte nicht gespeichert werden')
        }
        return false
      }

      setMeldung('Gespeichert')
      onGespeichert?.()
      return true
    } catch (e) {
      setFehler('Netzwerkfehler: ' + e.message)
      return false
    } finally {
      setLaeuft(false)
    }
  }

  // Stufe 1: der Termin hat stattgefunden
  if (status === STATUS.BERATUNG_VEREINBART) {
    return (
      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium text-gray-900 mb-1">Nach dem Gespräch</h4>
        <p className="text-xs text-gray-500 mb-3">
          Direkt nach dem Gespräch anklicken. Nur so zählen Erscheinungsquote und
          Termin-Vergütung. Kein Klick und kein Nicht-erschienen heißt: offen.
        </p>
        <button
          onClick={() => senden({ status: STATUS.BERATUNG_GEFUEHRT })}
          disabled={laeuft}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                     hover:bg-primary-container disabled:opacity-50"
        >
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Termin fand statt
        </button>
        {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
      </div>
    )
  }

  // Stufe 2: dokumentieren und das Abschlussgespräch legen
  if (status !== STATUS.BERATUNG_GEFUEHRT) return null

  const buchen = async () => {
    if (!terminAbschluss) {
      setFehler('Bitte Datum und Uhrzeit des Abschlussgesprächs eintragen.')
      return
    }
    await senden({
      ...werte,
      termin_abschlussgespraech: new Date(terminAbschluss).toISOString(),
      status: STATUS.ABSCHLUSS_VEREINBART
    })
  }

  return (
    <div className="border-t pt-4 mt-4 space-y-4">
      <div>
        <h4 className="font-medium text-gray-900">Übergabe an den Closer</h4>
        <p className="text-xs text-gray-500 mt-1">
          Der Closer baut sein Strategiepapier aus diesen Angaben. Was hier fehlt,
          fehlt ihm im Gespräch.
        </p>
      </div>

      <UebergabeFelder
        bereich={UEBERGABE_2}
        werte={werte}
        onChange={(w) => { setWerte(w); setOffen([]) }}
        offen={offen}
      />

      <AnfragenBedarf werte={werte} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Abschlussgespräch am <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          value={terminAbschluss}
          onChange={e => setTerminAbschluss(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-gray-500">
          Vorerst von Hand. Die Buchung über den Sammel-Kalender kommt mit dem
          Kalender-Umbau.
        </p>
      </div>

      <button
        onClick={buchen}
        disabled={laeuft}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                   hover:bg-primary-container disabled:opacity-50"
      >
        {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
        Abschlussgespräch buchen
      </button>

      {fehler && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>{fehler}</p>
            {offen.length > 0 && (
              <ul className="mt-1 list-disc list-inside">
                {offen.map(o => <li key={o.schluessel}>{o.name}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
      {meldung && <p className="text-sm text-green-700">{meldung}</p>}

      {/* Reicht der Erstanruf nicht aus, geht der Kontakt zurück an den Opener. */}
      <div className="pt-2 border-t">
        <RueckgabeKnopf hotLead={lead} onErledigt={onGespeichert} />
      </div>
    </div>
  )
}
