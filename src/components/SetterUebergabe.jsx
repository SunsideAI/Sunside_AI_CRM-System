import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, AlertTriangle, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { STATUS } from '../../shared/status.js'
import {
  UEBERGABE_2, maske, reduzierterModus, istSv, GRUND_REDUZIERT, ANLEITUNG_REDUZIERT
} from '../../shared/felder.js'
import UebergabeFelder, { AnfragenBedarf, uebergabePruefen } from './UebergabeFelder'
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
  return werte
}

export default function SetterUebergabe({
  lead, onGespeichert, onAblauf,
  // Gesperrt heißt: nur ansehen. Die Schublade macht erst mit „Bearbeiten"
  // auf - in Opening und Closing ist es genauso, und niemand verstellt mehr
  // versehentlich den Ausgang eines Gesprächs.
  gesperrt = false,
  // Meldet der Schublade, ob hier unten schon eine gefüllte Hauptaktion steht.
  onHauptaktion,
  // Wird vor jedem eigenen Speichern aufgerufen, damit geänderte Kontaktdaten
  // im selben Zug mitgehen. Gibt false zurück, wenn etwas fehlt.
  vorSpeichern
}) {
  const status = lead?.status

  const [werte, setWerte] = useState(() => startwerte(lead))
  // Der gebuchte Termin, wie ihn der Terminwähler zurückgibt.
  const [termin, setTermin] = useState(
    lead?.termin_abschlussgespraech
      ? { start: lead.termin_abschlussgespraech, meetingLink: lead.meeting_link_abschluss || null,
          terminart: 'Video' }
      : null)
  // Der geführte Ablauf der Übergabe: erst die Angaben, dann der Termin.
  // null = normale Maske, 'felder' = Schritt 1, 'termin' = Schritt 2.
  const [ablauf, setAblaufStand] = useState(null)
  const setAblauf = (wert) => { setAblaufStand(wert); onAblauf?.(Boolean(wert)) }
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
  // Die Knöpfe gehören in die Fußleiste der Schublade, nicht mitten in die
  // Maske: Dort stehen sie in jedem Tab, und man sucht sie nicht zwischen den
  // Feldern. Gibt es keine Fußleiste (Termin-Ansicht), bleiben sie hier.
  const [fussNode, setFussNode] = useState(null)
  useEffect(() => { setFussNode(document.getElementById('schublade-aktionen')) }, [])
  const fehlerRef = useRef(null)
  const [offen, setOffen] = useState([])
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')

  // Nach einem Fehlversuch steht die Meldung weit weg vom Knopf in der
  // Fußleiste. Also in den Blick holen.
  useEffect(() => {
    if (fehler) fehlerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [fehler])

  const reduziert = reduzierterModus(werte)
  const ergebnis = werte.ergebnis_beratung
  const mitUebergabe = ['Auftrag', 'Nächster Schritt vereinbart'].includes(ergebnis)

  // Steht der Kontakt schon auf „geführt", gibt es keinen Ausgang mehr zu
  // wählen - die Maske beginnt dann beim Ergebnis.
  const fixerAusgang = status === STATUS.BERATUNG_GEFUEHRT

  // Eine gefüllte Aktion steht unten, sobald eine Seite des Ablaufs offen ist.
  const hatHauptaktion = !gesperrt && ['felder', 'geplatzt'].includes(ablauf)
  useEffect(() => { onHauptaktion?.(hatHauptaktion) }, [hatHauptaktion, onHauptaktion])

  // Nur die eigenen Spalten gehen an den Server, nie der mitgelesene Kontext.
  const eigene = () => Object.fromEntries(EIGENE_SPALTEN.map(k => [k, werte[k] ?? null]))

  // `still` heißt: speichern, aber den Aufrufer nicht benachrichtigen. Sonst
  // schlösse die Schublade mitten im Zug.
  const senden = async (updates, { still = false, meldeAls = null } = {}) => {
    // Erst die Kontaktdaten, dann das Gespräch: Sonst ginge eine gerade
    // korrigierte Nummer beim Übergeben verloren.
    if (vorSpeichern && (await vorSpeichern()) === false) return false
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

  // Gebucht ist, jetzt übergeben. Der Terminwähler ruft das nach der Buchung
  // auf; die Felder hat er vorher geprüft (vorPruefung), damit kein Termin im
  // Kalender des Kunden steht, zu dem es im CRM nichts gibt.
  // Jede Auswahl führt auf ihre eigene Seite: Der Setter wird geführt, statt
  // sich in einer langen Maske die passende Stelle zu suchen.
  const ausgangWaehlen = (wert) => {
    setAusgang(wert); setFehler(''); setMeldung('')
    if (wert === STATUS.BERATUNG_GEFUEHRT) setAblauf('ergebnis')
    else if (wert === VERSCHOBEN) setAblauf('verschoben')
    else if ([STATUS.NICHT_ERSCHIENEN, STATUS.TERMIN_ABGESAGT].includes(wert)) setAblauf('geplatzt')
    else setAblauf(null)
  }

  // Dasselbe eine Stufe tiefer: Das gewählte Ergebnis öffnet die Angaben.
  const ergebnisWaehlen = (neu) => {
    setWerte(neu); setOffen([]); setFehler('')
    if (neu.ergebnis_beratung) setAblauf('felder')
  }

  const uebergeben = async (gebucht) => {
    setTermin(gebucht); setAblauf(null)
    if (!(await gefuehrtSichern())) return
    await senden({
      ...eigene(),
      termin_abschlussgespraech: new Date(gebucht.start).toISOString(),
      meeting_link_abschluss: gebucht.meetingLink || null,
      status: STATUS.ABSCHLUSS_VEREINBART
    })
  }

  // Dieselbe Prüfung wie im Backend, nur bevor es weitergeht.
  const felderPruefen = () => {
    const pruefung = uebergabePruefen({ ...werte, termin_abschlussgespraech: 'gebucht' }, UEBERGABE_2)
    if (pruefung.vollstaendig) return null
    setOffen(pruefung.offen)
    return 'Zum Übergeben fehlen noch Angaben aus dem Gespräch: '
      + pruefung.offen.map(o => o.name).join(', ')
  }

  // Der eine Zug ohne Termin: vertagt oder abgesagt.
  const abschliessen = async () => {
    if (!ergebnis) {
      setFehler('Bitte das Ergebnis des Gesprächs wählen.')
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
    <div ref={fehlerRef} className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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

  // Die Angaben aus dem Gespräch. Im Übergabe-Fall stehen sie im Terminwähler,
  // hinter dem gewählten Termin — genau wie im Opening die Übergabe 1.
  const felder = (
    <div className="space-y-4">
      <div>
        {/* Im geführten Ablauf steht die Überschrift schon im Kopf der Seite. */}
        {!ablauf && <h4 className="abschnitt-titel">Übergabe an den Closer</h4>}
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
        ohne={['ergebnis_beratung']}
        einschub={{ notizen_setting: notizEinschub }}
      />

      <AnfragenBedarf werte={werte} />
    </div>
  )

  // Das Ergebnis des Gesprächs, als eigene Auswahl. Die Wahl führt weiter.
  const ergebnisFeld = (
    <UebergabeFelder
      bereich={UEBERGABE_2}
      werte={werte}
      onChange={ergebnisWaehlen}
      offen={offen}
      nur={['ergebnis_beratung']}
    />
  )

  // Knöpfe gehören in die Fußleiste der Schublade; nur ohne Schublade
  // (Vorschau, Test) stehen sie unter der Maske.
  const mitAktionen = (inhalt, knoepfe = null) => (
    <>
      {inhalt}
      {/* Nur ansehen heißt: keine Knöpfe. Gespeichert wird erst, wenn die
          Schublade mit „Bearbeiten" aufgemacht wurde. */}
      {gesperrt || !knoepfe ? null : fussNode ? createPortal(knoepfe, fussNode) : (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">{knoepfe}</div>
      )}
    </>
  )

  // Jede Seite trägt denselben Kopf: wo bin ich, und wie heißt dieser Schritt.
  const gesamt = mitUebergabe ? 3 : 2
  const kopf = (titel, nummer = null) => (
    <div>
      {nummer && (
        <p className="text-label-sm text-on-surface-variant">Schritt {nummer} von {gesamt}</p>
      )}
      <h4 className="abschnitt-titel">{titel}</h4>
    </div>
  )

  const zurueckKnopf = (ziel, text = 'Zurück') => (
    <button onClick={() => { setFehler(''); setAblauf(ziel) }} className="fuss-leise">
      <ChevronLeft className="w-4 h-4" /> {text}
    </button>
  )

  const zwischenstandKnopf = (
    <button onClick={zwischenstand} disabled={laeuft} className="fuss-neben">
      Zwischenstand speichern
    </button>
  )

  // ── Seite: Ergebnis des Gesprächs ────────────────────────────────────────
  if (ablauf === 'ergebnis') {
    return mitAktionen(
      <div className="space-y-4">
        {kopf('Ergebnis des Gesprächs', 1)}
        <fieldset disabled={gesperrt} className="space-y-4 min-w-0">{ergebnisFeld}</fieldset>
        <p className="text-xs text-gray-500">
          Die Auswahl führt weiter: Bei einem nächsten Schritt zum Termin mit dem
          Closer, sonst zu den Angaben aus dem Gespräch.
        </p>
        {fehlerKasten}
      </div>,
      <>{zurueckKnopf(null)}{zwischenstandKnopf}</>
    )
  }

  // ── Seite: Angaben aus dem Gespräch ──────────────────────────────────────
  if (ablauf === 'felder') {
    const weiter = mitUebergabe
      ? (
        <button
          onClick={() => {
            const m = felderPruefen()
            if (m) { setFehler(m); return }
            setFehler(''); setAblauf('termin')
          }}
          className="fuss-haupt"
        >
          Weiter zum Termin <ChevronRight className="w-4 h-4" />
        </button>
      )
      : (
        <button onClick={abschliessen} disabled={laeuft} className="fuss-haupt">
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {knopfText}
        </button>
      )

    return mitAktionen(
      <div className="space-y-4">
        {kopf('Angaben aus dem Gespräch', 2)}
        <fieldset disabled={gesperrt} className="space-y-4 min-w-0">{felder}</fieldset>
        {fehlerKasten}
        {meldung && <p className="text-sm text-green-700">{meldung}</p>}
      </div>,
      <>{zurueckKnopf(fixerAusgang ? null : 'ergebnis')}{zwischenstandKnopf}{weiter}</>
    )
  }

  // ── Seite: Termin mit dem Closer ─────────────────────────────────────────
  if (ablauf === 'termin') {
    // Die Hauptaktion sitzt im Terminwähler: Sie bucht und übergibt in einem
    // Zug. Unten steht nur der Weg zurück zu den Angaben.
    return mitAktionen(
      <div className="space-y-4">
        {kopf('Termin mit dem Closer', 3)}
        <TerminPicker
          lead={leadFuerPicker}
          zweck="abschluss"
          nurBuchen
          vorPruefung={felderPruefen}
          knopfText="Termin buchen und an den Closer übergeben"
          onTerminBooked={uebergeben}
        />
        {fehlerKasten}
      </div>,
      zurueckKnopf('felder', 'Zurück zu den Angaben')
    )
  }

  // ── Seite: Termin verschoben ─────────────────────────────────────────────
  if (ablauf === 'verschoben') {
    return mitAktionen(
      <div className="space-y-4">
        {kopf('Neuer Termin für das Beratungsgespräch')}
        <p className="text-xs text-gray-500">
          Der Status bleibt „Beratungsgespräch vereinbart"; nur Datum und Uhrzeit
          ändern sich. Das Gespräch bleibt telefonisch.
        </p>
        <TerminPicker
          zweck="beratung"
          lead={leadFuerPicker}
          hotLeadId={lead?.id}
          onTerminBooked={() => { setAusgang(''); setAblauf(null); onGespeichert?.({ verschoben: true }) }}
        />
        {fehlerKasten}
      </div>,
      zurueckKnopf(null)
    )
  }

  // ── Seite: Termin geplatzt (nicht erschienen oder abgesagt) ──────────────
  if (ablauf === 'geplatzt') {
    const fall = AUSGAENGE.find(a => a.wert === ausgang)
    return mitAktionen(
      <div className="space-y-4">
        {kopf(fall?.name || 'Termin geplatzt')}
        <div className="flex gap-2 p-3 bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg
                        text-body-sm text-on-surface">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <div className="space-y-1">
            <p>
              Der Kontakt geht damit zurück an den Opener: Er steht im Opening unter
              „Setting-Termine neu vereinbaren" und wartet dort auf einen neuen Termin.
            </p>
            <p>
              Bei dir bleibt er unter „Geplatzt" sichtbar — von dort kannst du selbst
              ein neues Beratungsgespräch legen.
            </p>
            {fall?.hinweis && <p className="text-on-surface-variant">{fall.hinweis}</p>}
          </div>
        </div>
        {fehlerKasten}
      </div>,
      <>
        {zurueckKnopf(null)}
        <button onClick={() => senden({ status: ausgang })} disabled={laeuft} className="fuss-haupt">
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {fall?.knopf}
        </button>
      </>
    )
  }

  // ── Basisseite ───────────────────────────────────────────────────────────
  // Schon dokumentiert: Der Ausgang steht fest, es geht direkt um das Ergebnis.
  if (fixerAusgang) {
    return mitAktionen(
      <fieldset disabled={gesperrt} className="space-y-4 min-w-0">
        {ergebnisFeld}
        <p className="text-xs text-gray-500">
          Die Auswahl führt weiter zu den Angaben aus dem Gespräch.
        </p>
        {fehlerKasten}
        {meldung && <p className="text-sm text-green-700">{meldung}</p>}
        <div className="pt-4 border-t border-outline-variant/50 mt-2">
          <RueckgabeKnopf hotLead={lead} onErledigt={onGespeichert} />
        </div>
      </fieldset>
    )
  }

  if (status !== STATUS.BERATUNG_VEREINBART) return null

  return mitAktionen(
    <fieldset disabled={gesperrt} className="space-y-3 min-w-0">
      <p className="feld-hinweis mt-0">
        Direkt nach dem Termin festhalten. Nur so zählen Erscheinungsquote
        und Termin-Vergütung. Nichts auszuwählen heißt: offen.
      </p>

      {/* Die Auswahl selbst ist der Weg weiter - einen Knopf daneben braucht
          es nicht. */}
      <select
        value={ausgang}
        onChange={e => ausgangWaehlen(e.target.value)}
        className="input-field disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {AUSGAENGE.map(a => (
          <option key={a.wert || 'offen'} value={a.wert}>{a.name}</option>
        ))}
      </select>

      {fehlerKasten}
      {meldung && <p className="text-sm text-green-700">{meldung}</p>}

      {/* Reicht der Erstanruf nicht aus, geht der Kontakt zurück an den Opener. */}
      <div className="pt-4 border-t border-outline-variant/50 mt-2">
        <RueckgabeKnopf hotLead={lead} onErledigt={onGespeichert} />
      </div>
    </fieldset>
  )
}
