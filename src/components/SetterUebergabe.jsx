import { useState } from 'react'
import { CheckCircle2, CalendarPlus, Loader2, AlertTriangle } from 'lucide-react'
import { STATUS } from '../../shared/status.js'
import { UEBERGABE_2 } from '../../shared/felder.js'
import UebergabeFelder, { AnfragenBedarf } from './UebergabeFelder'
import RueckgabeKnopf from './RueckgabeKnopf'
import TerminPicker from './TerminPicker'

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
  // Der gebuchte Termin, wie ihn der Terminwähler zurückgibt.
  const [termin, setTermin] = useState(
    lead?.termin_abschlussgespraech
      ? { start: lead.termin_abschlussgespraech, meetingLink: lead.meeting_link_abschluss || null,
          terminart: 'Video' }
      : null)
  const [waehlerOffen, setWaehlerOffen] = useState(false)
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
      onGespeichert?.(updates)
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
          Danach öffnet sich hier die Übergabe an den Closer.
        </p>
        <button
          onClick={() => senden({ status: STATUS.BERATUNG_GEFUEHRT })}
          disabled={laeuft}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                     hover:bg-primary-container disabled:opacity-50"
        >
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Beratungsgespräch hat stattgefunden
        </button>
        {fehler && <p className="mt-2 text-sm text-red-600">{fehler}</p>}
      </div>
    )
  }

  // Stufe 2: dokumentieren und das Abschlussgespräch legen
  if (status !== STATUS.BERATUNG_GEFUEHRT) return null

  // Erst wenn der Termin steht, geht alles zusammen raus: die zwölf Felder,
  // der Termin und der Statuswechsel. Ein Zug, ein Gate — sonst bliebe bei
  // fehlenden Feldern ein gebuchter Termin ohne Übergabe zurück.
  const buchen = async () => {
    if (!termin?.start) {
      setFehler('Bitte zuerst einen Termin für das Abschlussgespräch buchen.')
      return
    }
    await senden({
      ...werte,
      termin_abschlussgespraech: new Date(termin.start).toISOString(),
      meeting_link_abschluss: termin.meetingLink || null,
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
          Abschlussgespräch <span className="text-red-500">*</span>
        </label>

        {termin?.start ? (
          <div className="flex items-center justify-between gap-3 p-3 bg-success-container rounded-lg">
            <div className="text-body-sm text-on-surface">
              {new Date(termin.start).toLocaleString('de-DE', {
                weekday: 'long', day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
              })} Uhr
              {termin.terminart && <> · {termin.terminart}</>}
            </div>
            <button
              type="button"
              onClick={() => { setTermin(null); setWaehlerOffen(true) }}
              className="text-label-sm text-primary hover:underline shrink-0"
            >
              ändern
            </button>
          </div>
        ) : waehlerOffen ? (
          <TerminPicker
            lead={{
              id: lead?.originalLeadId || lead?.lead_id,
              unternehmen: lead?.unternehmen,
              unternehmensname: lead?.unternehmen,
              email: lead?.email,
              telefon: lead?.telefonnummer,
              ansprechpartnerVorname: lead?.ansprechpartnerVorname,
              ansprechpartnerNachname: lead?.ansprechpartnerNachname,
              stadt: lead?.ort
            }}
            zweck="abschluss"
            nurBuchen
            onTerminBooked={(t) => { setTermin(t); setWaehlerOffen(false); setFehler('') }}
            onCancel={() => setWaehlerOffen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setWaehlerOffen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <CalendarPlus className="w-4 h-4" /> Termin buchen
          </button>
        )}

        <p className="mt-1 text-xs text-gray-500">
          Gebucht wird über Calendly, in der Terminart fürs Abschlussgespräch.
          Der Kunde bekommt Einladung und Einwahllink automatisch.
        </p>
      </div>

      <button
        onClick={buchen}
        disabled={laeuft}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                   hover:bg-primary-container disabled:opacity-50"
      >
        {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        An den Closer übergeben
      </button>
      <p className="-mt-2 text-xs text-gray-500">
        Der Termin steht dann in Calendly und im Closer-Pool. Der Kontakt
        verlässt damit deine Liste.
      </p>

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
