import { useState } from 'react'
import { CheckCircle2, CalendarPlus, Loader2, AlertTriangle, Save } from 'lucide-react'
import { STATUS } from '../../shared/status.js'
import { UEBERGABE_2 } from '../../shared/felder.js'
import UebergabeFelder, { AnfragenBedarf } from './UebergabeFelder'
import RueckgabeKnopf from './RueckgabeKnopf'
import TerminPicker from './TerminPicker'

// Die Ansicht des Setters: Ausgang festhalten, dokumentieren, Abschlussgespräch
// legen. Sie hängt am Termin und nicht in der Closing-Ansicht, weil der Setter
// dort keinen Zugang hat (Rolle Closer/Admin).
//
// Ein Formular, ein Speichern. Vorher schrieb der Knopf sofort den Status und
// zeigte ERST DANACH die Felder — der Kontakt stand also auf „geführt", bevor
// irgendetwas dokumentiert war. Wer dann abbrach, hinterliess einen Stand, den
// niemand mehr als offen erkannte. Jetzt wird erst eingetragen und am Ende in
// einem Zug gespeichert.

// Verschieben ist kein Zielstatus, sondern ein neuer Termin - der Wert
// existiert nur in diesem Auswahlfeld und wird nie gespeichert.
const VERSCHOBEN = 'verschoben'

// Deckungsgleich mit UEBERGAENGE[BERATUNG_VEREINBART] in shared/status.js.
const AUSGAENGE = [
  { wert: '', name: 'Noch offen — Ausgang wählen' },
  {
    wert: STATUS.BERATUNG_GEFUEHRT,
    name: 'Hat stattgefunden',
    hinweis: 'Unten eintragen, was im Gespräch herauskam. Gespeichert wird erst am Ende.'
  },
  {
    wert: STATUS.NICHT_ERSCHIENEN,
    name: 'Kunde nicht erschienen',
    knopf: 'Als nicht erschienen festhalten',
    hinweis: 'Der Kontakt landet unter „Geplatzt". Von dort lässt sich ein neuer Termin legen.'
  },
  {
    wert: STATUS.TERMIN_ABGESAGT,
    name: 'Termin abgesagt',
    knopf: 'Absage festhalten',
    hinweis: 'Sagt der Kunde über Calendly ab, trägt das System es selbst ein — hier nur für Absagen am Telefon.'
  },
  {
    wert: VERSCHOBEN,
    name: 'Termin verschoben',
    hinweis: 'Der neue Termin wird gleich hier gebucht; der Status bleibt „vereinbart".'
  }
]

const FELDER_2 = [
  'zuwachs_auftraege', 'abschlussquote', 'quote_art', 'ist_auftraege',
  'keine_zahlen', 'entscheider_messlatte', 'investitionsrahmen',
  'rahmen_ausgewichen', 'schmerzpunkt_vertieft', 'bedarf_wortlaut',
  'offene_huerde', 'material_versendet'
]

export default function SetterUebergabe({ lead, onGespeichert }) {
  const status = lead?.status

  const [werte, setWerte] = useState(() =>
    Object.fromEntries(FELDER_2.map(k => [k, lead?.[k] ?? null])))
  // Der gebuchte Termin, wie ihn der Terminwähler zurückgibt.
  const [termin, setTermin] = useState(
    lead?.termin_abschlussgespraech
      ? { start: lead.termin_abschlussgespraech, meetingLink: lead.meeting_link_abschluss || null,
          terminart: 'Video' }
      : null)
  const [waehlerOffen, setWaehlerOffen] = useState(false)
  // Steht der Kontakt schon auf „geführt", ist der Ausgang entschieden — dann
  // beginnt die Maske direkt bei der Dokumentation.
  const [ausgang, setAusgang] = useState(
    status === STATUS.BERATUNG_GEFUEHRT ? STATUS.BERATUNG_GEFUEHRT : '')
  // Ob der Statuswechsel auf „geführt" schon geschrieben ist. Nur nötig, weil
  // die Übergangsmatrix den Sprung von „vereinbart" direkt auf
  // „Abschlussgespräch vereinbart" nicht zulässt — zu Recht, das Gespräch hat
  // ja stattgefunden. Ein Knopfdruck, zwei Schreibvorgänge.
  const [gefuehrtGeschrieben, setGefuehrtGeschrieben] = useState(
    status === STATUS.BERATUNG_GEFUEHRT)
  const [laeuft, setLaeuft] = useState(false)
  const [offen, setOffen] = useState([])
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')

  // `still` heisst: speichern, aber den Aufrufer nicht benachrichtigen. Sonst
  // schlösse die Schublade mitten im Zug — nach dem ersten von zwei Schreib-
  // vorgängen oder nach einem Zwischenstand.
  const senden = async (updates, { still = false } = {}) => {
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
        } else if (antwort.status === 422 && daten.error === 'wert_ausserhalb_der_spanne') {
          setOffen(daten.felder || [])
          setFehler('Diese Angaben liegen ausserhalb des Möglichen: ' + daten.message)
        } else if (antwort.status === 409) {
          setFehler(daten.error)
        } else {
          setFehler(daten.error || daten.message || 'Konnte nicht gespeichert werden')
        }
        return false
      }

      if (!still) onGespeichert?.(updates)
      return true
    } catch (e) {
      setFehler('Netzwerkfehler: ' + e.message)
      return false
    } finally {
      setLaeuft(false)
    }
  }

  const leadFuerPicker = {
    id: lead?.originalLeadId || lead?.lead_id,
    unternehmen: lead?.unternehmen,
    unternehmensname: lead?.unternehmen,
    email: lead?.email,
    telefon: lead?.telefon || lead?.telefonnummer,
    ansprechpartnerVorname: lead?.ansprechpartnerVorname,
    ansprechpartnerNachname: lead?.ansprechpartnerNachname,
    stadt: lead?.ort
  }

  // Der eine Zug am Ende: Dokumentation, Termin und beide Statuswechsel.
  const uebergeben = async () => {
    if (!termin?.start) {
      setFehler('Bitte zuerst einen Termin für das Abschlussgespräch buchen.')
      return
    }

    // Schritt 1 — das Gespräch hat stattgefunden, samt allem Eingetragenen.
    // Entfällt, wenn der Kontakt schon auf „geführt" steht.
    if (!gefuehrtGeschrieben) {
      const ok = await senden({ ...werte, status: STATUS.BERATUNG_GEFUEHRT }, { still: true })
      if (!ok) return
      setGefuehrtGeschrieben(true)
    }

    // Schritt 2 — die Übergabe. Hier greift das Gate im Backend: Fehlt ein
    // Pflichtfeld, bleibt der Kontakt auf „geführt" und die Eingaben sind
    // gespeichert. Nachtragen und erneut drücken genügt.
    await senden({
      ...werte,
      termin_abschlussgespraech: new Date(termin.start).toISOString(),
      meeting_link_abschluss: termin.meetingLink || null,
      status: STATUS.ABSCHLUSS_VEREINBART
    })
  }

  const zwischenstand = async () => {
    const ok = await senden({ ...werte }, { still: true })
    if (ok) setMeldung('Zwischenstand gespeichert. Der Status bleibt unverändert.')
  }

  const fehlerKasten = fehler && (
    <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p>{fehler}</p>
        {offen.length > 0 && (
          <ul className="mt-1 list-disc list-inside">
            {offen.map(o => <li key={o.schluessel}>{o.name || o.schluessel}</li>)}
          </ul>
        )}
      </div>
    </div>
  )

  // Die Dokumentation — dieselbe Maske, ob der Ausgang gerade gewählt wurde
  // oder der Kontakt schon auf „geführt" steht.
  const dokumentation = (
    <div className="space-y-4">
      <div>
        <h4 className="abschnitt-titel">Übergabe an den Closer</h4>
        <p className="feld-hinweis">
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
        <label className="feld-label">
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
            lead={leadFuerPicker}
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={uebergeben}
          disabled={laeuft}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                     hover:bg-primary-container disabled:opacity-50"
        >
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Speichern und an den Closer übergeben
        </button>

        {/* Für den, der mitten im Ausfüllen unterbrochen wird. Schreibt nur die
            Felder — der Ausgang bleibt offen, der Kontakt bleibt in der Liste. */}
        <button
          onClick={zwischenstand}
          disabled={laeuft}
          className="flex items-center gap-2 px-3 py-2 text-label-lg text-primary
                     hover:bg-primary-fixed/30 rounded-lg disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Zwischenstand speichern
        </button>
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Erst mit dem Übergeben wandert der Kontakt weiter: Der Termin steht dann
        in Calendly und im Closer-Pool, und deine Liste ist ihn los.
      </p>

      {fehlerKasten}
      {meldung && <p className="text-sm text-green-700">{meldung}</p>}

      {/* Reicht der Erstanruf nicht aus, geht der Kontakt zurück an den Opener. */}
      <div className="pt-2">
        <RueckgabeKnopf hotLead={lead} onErledigt={onGespeichert} />
      </div>
    </div>
  )

  // Schon dokumentiert: kein Auswahlfeld mehr, der Ausgang steht fest.
  if (status === STATUS.BERATUNG_GEFUEHRT) {
    return <div>{dokumentation}</div>
  }

  if (status !== STATUS.BERATUNG_VEREINBART) return null

  const gewaehlt = AUSGAENGE.find(a => a.wert === ausgang)

  return (
    <div className="space-y-3">
      {/* Keine eigene Ueberschrift: Der Abschnitt der Schublade heisst
          bereits "Beratungsgespraech". */}
      <p className="feld-hinweis mt-0">
        Direkt nach dem Termin festhalten. Nur so zählen Erscheinungsquote
        und Termin-Vergütung — nichts auszuwählen heißt: offen.
      </p>

      <select
        value={ausgang}
        onChange={e => { setAusgang(e.target.value); setFehler(''); setMeldung('') }}
        className="input-field"
      >
        {AUSGAENGE.map(a => (
          <option key={a.wert || 'offen'} value={a.wert}>{a.name}</option>
        ))}
      </select>

      {gewaehlt?.hinweis && (
        <p className="text-xs text-gray-500">{gewaehlt.hinweis}</p>
      )}

      {/* Hat stattgefunden: Die Maske klappt auf, gespeichert wird unten. */}
      {ausgang === STATUS.BERATUNG_GEFUEHRT && (
        <div className="pt-2">{dokumentation}</div>
      )}

      {/* Verschieben ist kein Status, sondern ein neuer Termin. Deshalb
          oeffnet sich hier der Terminwaehler statt eines Speichern-Knopfes:
          Der alte Termin faellt in Calendly weg, der neue steht danach in
          derselben Zeile. */}
      {ausgang === VERSCHOBEN && (
        <TerminPicker
          zweck="beratung"
          lead={leadFuerPicker}
          hotLeadId={lead?.id}
          onTerminBooked={() => { setAusgang(''); onGespeichert?.({ verschoben: true }) }}
          onCancel={() => setAusgang('')}
        />
      )}

      {/* Nicht erschienen und abgesagt: Es gibt nichts weiter einzutragen,
          also ist der eine Knopf hier schon der ganze Zug. */}
      {[STATUS.NICHT_ERSCHIENEN, STATUS.TERMIN_ABGESAGT].includes(ausgang) && (
        <>
          <button
            onClick={() => senden({ status: ausgang })}
            disabled={laeuft}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                       hover:bg-primary-container disabled:opacity-50"
          >
            {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {gewaehlt?.knopf}
          </button>
          {fehlerKasten}
        </>
      )}

      {!ausgang && fehlerKasten}
    </div>
  )
}
