import { useState } from 'react'
import { CheckCircle2, CalendarPlus, Loader2, AlertTriangle, Save, Info } from 'lucide-react'
import { STATUS } from '../../shared/status.js'
import {
  UEBERGABE_2, maske, reduzierterModus, istSv, GRUND_REDUZIERT, ANLEITUNG_REDUZIERT
} from '../../shared/felder.js'
import UebergabeFelder, { AnfragenBedarf } from './UebergabeFelder'
import FragenVorschlag from './FragenVorschlag'
import RueckgabeKnopf from './RueckgabeKnopf'
import TerminPicker from './TerminPicker'

// Die Ansicht des Setters: Ausgang festhalten, dokumentieren, Abschlussgespräch
// legen. Sie hängt am Termin und nicht in der Closing-Ansicht, weil der Setter
// dort keinen Zugang hat.
//
// Ein Formular, ein Speichern: Erst wird eingetragen, am Ende in einem Zug
// gespeichert. Die Maske folgt dem Gespräch (Entscheidung Niklas, 20.09.),
// die Felder und ihre Reihenfolge stehen in shared/felder.js.

// Verschieben ist kein Zielstatus, sondern ein neuer Termin. Der Wert existiert
// nur in diesem Auswahlfeld und wird nie gespeichert.
const VERSCHOBEN = 'verschoben'

// Deckungsgleich mit UEBERGAENGE[BERATUNG_VEREINBART] in shared/status.js.
const AUSGAENGE = [
  { wert: '', name: 'Noch offen, bitte Ausgang wählen' },
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
    hinweis: 'Sagt der Kunde über Calendly ab, trägt das System es selbst ein. Hier nur für Absagen am Telefon.'
  },
  {
    wert: VERSCHOBEN,
    name: 'Termin verschoben',
    hinweis: 'Der neue Termin wird gleich hier gebucht; der Status bleibt „vereinbart".'
  }
]

// Was der Setter in dieser Maske schreibt. Die Anzeige der versendeten
// Unterlagen füllt das System, sie wird nie zurückgeschrieben.
const EIGENE_SPALTEN = [...new Set(
  maske(UEBERGABE_2).filter(f => !f.anzeige).map(f => f.schluessel)
)].concat('zahlen_kennzeichen')

// Was aus dem Erstanruf mitkommt und nur mitliest: Es entscheidet über
// Sichtbarkeit, Fragesätze und den reduzierten Modus.
const KONTEXT = [
  'berufsgruppe', 'branche_andere', 'vorhaben', 'ziele', 'ziel_prioritaet', 'ziel_priorisiert',
  'schmerzpunkt_wortlaut', 'vorerfahrung', 'vorerfahrung_wortlaut', 'material_versendet'
]

function startwerte(lead) {
  const werte = Object.fromEntries(
    [...KONTEXT, ...EIGENE_SPALTEN].map(k => [k, lead?.[k] ?? null]))
  // Vorbelegt heißt: Was der Opener wörtlich notiert hat, steht schon im Feld,
  // der Setter bestätigt oder vertieft es.
  for (const feld of maske(UEBERGABE_2)) {
    if (feld.vorbelegt && !String(werte[feld.schluessel] ?? '').trim() && lead?.[feld.vorbelegt]) {
      werte[feld.schluessel] = lead[feld.vorbelegt]
    }
  }
  // Fast jedes Beratungsgespräch endet mit einem Abschlusstermin.
  if (!werte.ergebnis_beratung) werte.ergebnis_beratung = 'Nächster Schritt vereinbart'
  return werte
}

export default function SetterUebergabe({ lead, onGespeichert }) {
  const status = lead?.status

  const [werte, setWerte] = useState(() => startwerte(lead))
  // Der gebuchte Termin, wie ihn der Terminwähler zurückgibt.
  const [termin, setTermin] = useState(
    lead?.termin_abschlussgespraech
      ? { start: lead.termin_abschlussgespraech, meetingLink: lead.meeting_link_abschluss || null,
          terminart: 'Video' }
      : null)
  const [waehlerOffen, setWaehlerOffen] = useState(false)
  // Steht der Kontakt schon auf „geführt", ist der Ausgang entschieden, und
  // die Maske beginnt direkt bei der Dokumentation.
  const [ausgang, setAusgang] = useState(
    status === STATUS.BERATUNG_GEFUEHRT ? STATUS.BERATUNG_GEFUEHRT : '')
  // Ob der Statuswechsel auf „geführt" schon geschrieben ist. Die
  // Übergangsmatrix lässt den Sprung von „vereinbart" direkt auf
  // „Abschlussgespräch vereinbart" nicht zu, zu Recht: Das Gespräch hat ja
  // stattgefunden. Ein Knopfdruck, zwei Schreibvorgänge.
  const [gefuehrtGeschrieben, setGefuehrtGeschrieben] = useState(
    status === STATUS.BERATUNG_GEFUEHRT)
  const [laeuft, setLaeuft] = useState(false)
  const [offen, setOffen] = useState([])
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')

  const reduziert = reduzierterModus(werte)
  const ergebnis = werte.ergebnis_beratung
  const mitUebergabe = ['Auftrag', 'Nächster Schritt vereinbart'].includes(ergebnis)

  // Nur die eigenen Spalten gehen an den Server, nie der mitgelesene Kontext.
  const eigene = () => Object.fromEntries(EIGENE_SPALTEN.map(k => [k, werte[k] ?? null]))

  // `still` heißt: speichern, aber den Aufrufer nicht benachrichtigen. Sonst
  // schlösse die Schublade mitten im Zug.
  const senden = async (updates, { still = false, meldeAls = null } = {}) => {
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
          setFehler('Diese Angaben liegen außerhalb des Möglichen: ' + daten.message)
        } else if (antwort.status === 409) {
          setFehler(daten.error)
        } else {
          setFehler(daten.error || daten.message || 'Konnte nicht gespeichert werden')
        }
        return false
      }

      if (!still) onGespeichert?.(meldeAls || updates)
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

  // Erst „geführt" schreiben, falls noch nicht geschehen. Entfällt, wenn der
  // Kontakt schon dort steht.
  const gefuehrtSichern = async () => {
    if (gefuehrtGeschrieben) return true
    const ok = await senden({ ...eigene(), status: STATUS.BERATUNG_GEFUEHRT }, { still: true })
    if (ok) setGefuehrtGeschrieben(true)
    return ok
  }

  // Der eine Zug am Ende, je nach Ergebnis des Gesprächs.
  const abschliessen = async () => {
    if (!ergebnis) {
      setFehler('Bitte das Ergebnis des Gesprächs wählen.')
      return
    }

    if (mitUebergabe) {
      if (!termin?.start) {
        setOffen([{ schluessel: 'termin_abschlussgespraech', name: 'Abschlussgespräch am' }])
        setFehler('Bitte zuerst einen Termin für das Abschlussgespräch buchen.')
        return
      }
      if (!(await gefuehrtSichern())) return
      // Hier greift das Gate im Backend: Fehlt ein Gate-Feld, bleibt der
      // Kontakt auf „geführt" und die Eingaben sind gespeichert. Nachtragen
      // und erneut drücken genügt.
      await senden({
        ...eigene(),
        termin_abschlussgespraech: new Date(termin.start).toISOString(),
        meeting_link_abschluss: termin.meetingLink || null,
        status: STATUS.ABSCHLUSS_VEREINBART
      })
      return
    }

    if (ergebnis === 'Vertagt ohne festen Schritt') {
      // Kein Abschlusstermin: Der Setter fasst binnen 48 Stunden nach. Der
      // Kontakt bleibt deshalb bei ihm, in „Zu dokumentieren".
      if (!(await gefuehrtSichern())) return
      await senden({ ...eigene() }, { meldeAls: { vertagt: true } })
      return
    }

    if (ergebnis === 'Absage') {
      if (!(await gefuehrtSichern())) return
      await senden({ ...eigene(), status: STATUS.VERLOREN_ENDGUELTIG })
    }
  }

  const zwischenstand = async () => {
    const ok = await senden({ ...eigene() }, { still: true })
    if (ok) setMeldung('Zwischenstand gespeichert. Der Status bleibt unverändert.')
  }

  const knopfText = mitUebergabe
    ? 'Speichern und an den Closer übergeben'
    : ergebnis === 'Vertagt ohne festen Schritt'
      ? 'Speichern, ich fasse binnen 48 Stunden nach'
      : ergebnis === 'Absage'
        ? 'Speichern und als Absage abschließen'
        : 'Speichern'

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

  // Das Abschlussgespräch. Kein Feld der Maske, sondern der Terminwähler; es
  // steht an seinem Platz im Gespräch, direkt vor der Mobilnummer.
  const terminFehlt = offen.some(o => o.schluessel === 'termin_abschlussgespraech')
  const terminBlock = mitUebergabe && (
    <div className="mb-4">
      <label className="feld-label">
        Abschlussgespräch am <span className="text-red-500">*</span>
      </label>
      <p className="mb-1.5 text-xs text-gray-600">„Haben Sie Ihren Kalender gerade offen?"</p>

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
          onTerminBooked={(t) => { setTermin(t); setWaehlerOffen(false); setFehler(''); setOffen([]) }}
          onCancel={() => setWaehlerOffen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setWaehlerOffen(true)}
          className={`btn-primary inline-flex items-center gap-2 ${terminFehlt ? 'ring-2 ring-red-400' : ''}`}
        >
          <CalendarPlus className="w-4 h-4" /> Termin buchen
        </button>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Höchstens eine Woche voraus. Gebucht wird über Calendly, in der Terminart fürs
        Abschlussgespräch; der Kunde bekommt Einladung und Einwahllink automatisch.
      </p>
    </div>
  )

  // Über dem Notizfeld: im reduzierten Modus der Grund und die Anleitung, bei
  // anderer Branche, Vorhaben und Sachverständigen der Fragen-Vorschlag.
  const mitVorschlag = Boolean(reduziert) || istSv(werte)
  const notizEinschub = (mitVorschlag || reduziert) && (
    <div className="mb-4 space-y-3">
      {mitVorschlag && <FragenVorschlag lead={lead} />}
      {reduziert && (
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p>{GRUND_REDUZIERT[reduziert]}</p>
            <p className="mt-1 text-xs">
              <span className="font-medium">Bitte mitschreiben:</span> {ANLEITUNG_REDUZIERT[reduziert]}
            </p>
          </div>
        </div>
      )}
    </div>
  )

  // Die Dokumentation: dieselbe Maske, ob der Ausgang gerade gewählt wurde
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
        einschub={{ mobilnummer: terminBlock, notizen_setting: notizEinschub }}
      />

      <AnfragenBedarf werte={werte} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={abschliessen}
          disabled={laeuft}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg
                     hover:bg-primary-container disabled:opacity-50"
        >
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {knopfText}
        </button>

        {/* Für den, der mitten im Ausfüllen unterbrochen wird. Schreibt nur die
            Felder; der Ausgang bleibt offen, der Kontakt bleibt in der Liste. */}
        <button
          onClick={zwischenstand}
          disabled={laeuft}
          className="flex items-center gap-2 px-3 py-2 text-label-lg text-primary
                     hover:bg-primary-fixed/30 rounded-lg disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Zwischenstand speichern
        </button>
      </div>
      {mitUebergabe && (
        <p className="-mt-2 text-xs text-gray-500">
          Erst mit dem Übergeben wandert der Kontakt weiter: Der Termin steht dann
          in Calendly und im Closer-Pool, und deine Liste ist ihn los.
        </p>
      )}

      {fehlerKasten}
      {meldung && <p className="text-sm text-green-700">{meldung}</p>}

      {/* Reicht der Erstanruf nicht aus, geht der Kontakt zurück an den Opener. */}
      <div className="pt-4 border-t border-outline-variant/50 mt-2">
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
      <p className="feld-hinweis mt-0">
        Direkt nach dem Termin festhalten. Nur so zählen Erscheinungsquote
        und Termin-Vergütung. Nichts auszuwählen heißt: offen.
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

      {ausgang === STATUS.BERATUNG_GEFUEHRT && (
        <div className="pt-4 border-t border-outline-variant/50 mt-2">{dokumentation}</div>
      )}

      {/* Verschieben ist kein Status, sondern ein neuer Termin. */}
      {ausgang === VERSCHOBEN && (
        <TerminPicker
          zweck="beratung"
          lead={leadFuerPicker}
          hotLeadId={lead?.id}
          onTerminBooked={() => { setAusgang(''); onGespeichert?.({ verschoben: true }) }}
          onCancel={() => setAusgang('')}
        />
      )}

      {/* Nicht erschienen und abgesagt: Es gibt nichts weiter einzutragen. */}
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
