import { useState } from 'react'
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import {
  maske, uebergabePruefen, istSichtbar, istGate, beschriftung, svSprache,
  noetigeAnfragen, ABSCHNITT_UNTERTITEL, ZIEL, AUSWAHL
} from '../../shared/felder.js'

// Die Felder einer Übergabe. Namen, Fragesätze und Hilfetexte kommen aus
// shared/felder.js, hier steht kein eigener Text.
//
// Unter dem Feldnamen steht dauerhaft der Satz aus dem Skript, der die
// Antwort für dieses Feld auslöst (Entscheidung Niklas, 20.09.). Alles
// Übrige liegt im Aufklapper hinter dem Fragezeichen.
//
// Zwei Textarten, auf den ersten Blick unterscheidbar: Sätze in
// Anführungszeichen werden gesprochen, eine Zeile „Hinweis" ist eine
// Anweisung und wird nie vorgelesen.

/** Das Fragezeichen am Feldnamen. Der Text selbst steht in HilfeText. */
function HilfeKnopf({ offen, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`align-middle ml-1 transition-colors ${offen ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
      aria-label="Mehr zu diesem Feld"
      aria-expanded={offen}
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  )
}

/**
 * Der aufgeklappte Hilfetext: ein ruhiger Hinweis in der Breite der Maske,
 * hell und mit Akzentlinie, damit er zur Maske gehört und nicht wie ein
 * Fremdkörper darüber liegt. Er steht unter dem Fragesatz, direkt über der
 * Eingabe, damit Satz und Feldname zusammenbleiben.
 */
function HilfeText({ text }) {
  // „Wozu:" trennt, was der Setter tun soll, von dem, wofür das Feld gebraucht
  // wird. Abgesetzt liest sich beides schneller als ein Block.
  const [anleitung, wozu] = String(text).split(/\s*Wozu:\s*/)
  return (
    <div className="mb-2 pl-3 pr-3 py-2 space-y-1.5 text-xs leading-relaxed
                    text-on-surface-variant bg-surface-container-low rounded-r-lg
                    border-l-2 border-primary-fixed-dim">
      {anleitung && <p>{anleitung}</p>}
      {wozu && <p><span className="font-medium text-on-surface">Wozu: </span>{wozu}</p>}
    </div>
  )
}

/** Der Satz am Feld. Gesprochenes ruhig und grau, Anweisungen in Bernstein. */
function Frage({ frage, rolle }) {
  if (!frage) return null
  return (
    <div className="mb-1.5 space-y-0.5">
      {frage.vorsatz && <p className="text-xs text-gray-400 leading-snug">{frage.vorsatz}</p>}
      {frage.satz && <p className="text-xs text-gray-600 leading-snug">{frage.satz}</p>}
      {frage.hinweis && (
        <p className="text-xs text-amber-700 leading-snug">
          <span className="font-medium">{rolle}-Hinweis (nicht vorlesen):</span> {frage.hinweis}
        </p>
      )}
    </div>
  )
}

/** „Vom Kunden genannt" oder „geschätzt", auf derselben Zeile wie die Zahl. */
function Kennzeichen({ schluessel, werte, onChange, disabled }) {
  const alle = werte?.zahlen_kennzeichen || {}
  return (
    <select
      value={alle[schluessel] || ''}
      disabled={disabled}
      onChange={e => onChange({ ...alle, [schluessel]: e.target.value || undefined })}
      className="select-field w-40 shrink-0"
      aria-label="Herkunft der Zahl"
    >
      <option value="">Herkunft?</option>
      {AUSWAHL.kennzeichen.map(k => <option key={k} value={k}>{k}</option>)}
    </select>
  )
}

function Eingabe({ feld, wert, werte, setzen, fehlt, abgeschaltet }) {
  const s = feld.schluessel
  const klasse = (basis) => `${basis}${fehlt ? ' fehlt' : ''}`
  const optionen = typeof feld.optionen === 'function' ? feld.optionen(werte) : (feld.optionen || [])

  if (feld.anzeige) {
    const liste = Array.isArray(wert) ? wert : []
    return (
      <p className="text-body-sm text-on-surface-variant">
        {liste.length ? liste.join(', ') : 'Noch nichts versendet. Das System trägt es beim Senden ein.'}
      </p>
    )
  }

  switch (feld.art) {
    case 'auswahl':
      return (
        <select
          value={wert ?? ''}
          disabled={abgeschaltet}
          onChange={e => setzen(s, e.target.value || null)}
          className={klasse('select-field')}
        >
          <option value="">Bitte wählen</option>
          {optionen.map(o => <option key={o} value={o}>{svSprache(o, werte)}</option>)}
        </select>
      )

    case 'mehrfach': {
      const gewaehlt = Array.isArray(wert) ? wert : []
      // „Noch nicht besprochen" schließt die anderen aus und umgekehrt.
      const umschalten = (o) => {
        if (gewaehlt.includes(o)) return setzen(s, gewaehlt.filter(x => x !== o))
        if (o === ZIEL.OFFEN) return setzen(s, [ZIEL.OFFEN])
        return setzen(s, gewaehlt.filter(x => x !== ZIEL.OFFEN).concat(o))
      }
      return (
        <div className={`space-y-1.5 ${fehlt ? 'p-2 rounded-lg border border-red-400 bg-red-50' : ''}`}>
          {optionen.map(o => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={gewaehlt.includes(o)}
                onChange={() => umschalten(o)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <span>{svSprache(o, werte)}</span>
            </label>
          ))}
        </div>
      )
    }

    case 'janein':
      return (
        <div className="flex gap-2">
          {[['Ja', true], ['Nein', false]].map(([text, w]) => (
            <button
              key={text}
              type="button"
              onClick={() => setzen(s, w)}
              className={`px-4 py-2 rounded-lg border text-sm ${
                wert === w
                  ? 'bg-primary text-white border-primary'
                  : fehlt
                    ? 'border-red-400 bg-red-50 text-gray-700'
                    : 'bg-white text-gray-700 hover:border-secondary'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
      )

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={wert === true}
            onChange={e => setzen(s, e.target.checked)}
            className="w-4 h-4 rounded text-primary focus:ring-primary"
          />
          <span>Ja</span>
        </label>
      )

    case 'freitext':
      return (
        <textarea
          rows={feld.zeilen || 2}
          value={wert ?? ''}
          onChange={e => setzen(s, e.target.value)}
          className={klasse('textarea-field')}
        />
      )

    case 'text':
      return (
        <input
          type="text"
          value={wert ?? ''}
          disabled={abgeschaltet}
          onChange={e => setzen(s, e.target.value)}
          className={klasse('input-field')}
        />
      )

    case 'telefon':
      return (
        <input
          type="tel"
          value={wert ?? ''}
          onChange={e => setzen(s, e.target.value)}
          className={klasse('input-field')}
          placeholder="01xx ..."
        />
      )

    case 'zahl':
      return (
        <input
          type="number"
          inputMode="decimal"
          disabled={abgeschaltet}
          min={feld.min}
          max={feld.max}
          step="1"
          value={wert ?? ''}
          /* min/max sind nur ein Hinweis an die Pfeiltasten, tippen lässt sich
             trotzdem alles. Deshalb wird der Wert beim Eintippen in die Spanne
             gezogen: „-3 gewünschte Aufträge" machte die Bedarfsrechnung
             negativ. */
          onChange={e => {
            if (e.target.value === '') return setzen(s, null)
            let zahl = Number(e.target.value)
            if (Number.isNaN(zahl)) return
            if (feld.min !== undefined) zahl = Math.max(feld.min, zahl)
            if (feld.max !== undefined) zahl = Math.min(feld.max, zahl)
            setzen(s, zahl)
          }}
          className={klasse('input-field')}
        />
      )

    default:
      return null
  }
}

function Feld({ feld, werte, setzen, fehlt, rolle }) {
  const { name, hilfe, frage } = beschriftung(feld, werte)
  const [hilfeOffen, setHilfeOffen] = useState(false)
  const wert = werte?.[feld.schluessel]

  // „Kunde wollte keine Zahlen nennen" schaltet die Zahlenfelder aus: Leer ist
  // dann die richtige Antwort, keine Lücke.
  const abgeschaltet = werte?.keine_zahlen === true && Boolean(feld.kennzeichen)
  const hinweisZumWert = feld.wertHinweis?.[wert]

  return (
    <div className={abgeschaltet ? 'opacity-40' : ''}>
      <label className="feld-label">
        {name}
        {istGate(feld, werte) && <span className="text-red-500 ml-0.5">*</span>}
        {hilfe && <HilfeKnopf offen={hilfeOffen} onClick={() => setHilfeOffen(o => !o)} />}
      </label>
      <Frage frage={frage} rolle={rolle} />
      {hilfeOffen && hilfe && <HilfeText text={hilfe} />}

      {feld.kennzeichen ? (
        <div className="flex gap-2">
          <div className="flex-1">
            <Eingabe feld={feld} wert={wert} werte={werte} setzen={setzen} fehlt={fehlt} abgeschaltet={abgeschaltet} />
          </div>
          <Kennzeichen
            schluessel={feld.schluessel}
            werte={werte}
            disabled={abgeschaltet}
            onChange={(k) => setzen('zahlen_kennzeichen', k)}
          />
        </div>
      ) : (
        <Eingabe feld={feld} wert={wert} werte={werte} setzen={setzen} fehlt={fehlt} abgeschaltet={abgeschaltet} />
      )}

      {hinweisZumWert && <p className="mt-1 text-xs text-amber-700">{hinweisZumWert}</p>}
    </div>
  )
}

/**
 * @param bereich   UEBERGABE_1 oder UEBERGABE_2
 * @param werte     der Stand des Formulars; für die Sichtbarkeit zählt auch,
 *                  was aus dem Erstanruf mitkommt (Branche, Vorhaben, Ziele)
 * @param offen     Gate-Felder, die der Server oder die Vorprüfung bemängelt
 * @param einschub  Inhalt, der vor einem Feld erscheint: { [schluessel]: node }
 * @param nur       nur diese Felder zeigen
 * @param ohne      diese Felder auslassen
 *
 * `nur` und `ohne` braucht das Setting: Das Ergebnis des Gesprächs steht dort
 * vor der Terminbuchung, alles Übrige danach im Terminwähler.
 */
export default function UebergabeFelder({ bereich, werte, onChange, offen = [], einschub = {}, nur = null, ohne = [] }) {
  const [nebenbeiOffen, setNebenbeiOffen] = useState(false)
  const fehlt = new Set(offen.map(o => o.schluessel || o))
  const rolle = bereich.includes('Opener') ? 'Opener' : 'Setter'

  const setzen = (schluessel, wert) => onChange({ ...werte, [schluessel]: wert })

  const sichtbar = maske(bereich)
    .filter(f => istSichtbar(f, werte))
    .filter(f => (nur ? nur.includes(f.schluessel) : true) && !ohne.includes(f.schluessel))

  // Nach Abschnitten gruppieren, Reihenfolge wie in der Maske.
  const gruppen = []
  for (const feld of sichtbar) {
    const titel = feld.abschnitt || null
    const letzte = gruppen[gruppen.length - 1]
    if (letzte && letzte.titel === titel) letzte.felder.push(feld)
    else gruppen.push({ titel, felder: [feld] })
  }

  return (
    <div className="space-y-6">
      {gruppen.map(({ titel, felder }) => {
        const nebenbei = titel === 'Nur wenn es im Gespräch fiel'
        const inhalt = (
          <div className="space-y-4">
            {felder.map(feld => (
              <div key={feld.schluessel}>
                {einschub[feld.schluessel]}
                <Feld feld={feld} werte={werte} setzen={setzen} fehlt={fehlt.has(feld.schluessel)} rolle={rolle} />
              </div>
            ))}
          </div>
        )

        if (!titel) return <div key="ohne">{inhalt}</div>

        if (nebenbei) {
          // Zugeklappt vorbelegt: Diese Felder füllt man nur, wenn die Zahl fiel.
          return (
            <div key={titel} className="border border-outline-variant/50 rounded-lg">
              <button
                type="button"
                onClick={() => setNebenbeiOffen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700"
              >
                {nebenbeiOffen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {titel}
              </button>
              {nebenbeiOffen && <div className="px-3 pb-3">{inhalt}</div>}
            </div>
          )
        }

        return (
          <section key={titel} className="space-y-3">
            <div>
              <h5 className="text-label-lg font-medium text-on-surface">{titel}</h5>
              {ABSCHNITT_UNTERTITEL[titel] && (
                <p className="text-xs text-gray-600">{ABSCHNITT_UNTERTITEL[titel]}</p>
              )}
            </div>
            {inhalt}
          </section>
        )
      })}
    </div>
  )
}

/** Die berechnete Anzeige, damit der Setter seine Zahl im Gespräch vorlesen kann. */
export function AnfragenBedarf({ werte }) {
  const proMonat = noetigeAnfragen(werte)
  if (proMonat === null || werte?.ziel !== ZIEL.EIGENTUEMER) return null
  const bereich = proMonat < 2 ? 'unter 2' : proMonat <= 4 ? '2 bis 4' : 'über 4'

  return (
    <div className="p-3 bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg text-sm">
      <div className="text-gray-700">
        {svSprac