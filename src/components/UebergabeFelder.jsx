import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { FELDER, uebergabePruefen } from '../../shared/felder.js'

// Die Felder einer Übergabe. Beschriftungen und Hilfetexte kommen wortgleich
// aus shared/felder.js (Quelle: Miro F24) - hier steht kein eigener Text.
//
// Die Hilfetexte sind bewusst als Tooltip und nicht als Dauertext gesetzt:
// Wer die Maske täglich benutzt, soll nicht jedes Mal durch Erklärungen
// scrollen; wer unsicher ist, findet sie an Ort und Stelle.

function Hilfe({ text }) {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        className="text-gray-400 hover:text-primary align-middle ml-1"
        aria-label="Hilfe zu diesem Feld"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* Der Hilfetext saß vorher als 288 px breite Box absolut am Symbol.
          Steht das Symbol rechts in der schmalen Schublade, ragte die Box
          über den Rand — und machte damit das ganze Fenster waagerecht
          scrollbar.

          Jetzt ist es keine schwebende Box mehr, sondern eine Zeile unter
          dem Feldnamen: Sie nimmt die Breite, die da ist, und kann per
          Bauart nirgends überstehen. Dass sie die Felder darunter
          verschiebt, ist der Preis — und der richtige: Ein Hilfetext wird
          gelesen und wieder zugeklappt, ein waagerechter Scrollbalken
          bleibt. */}
      {offen && (
        <span className="block mt-1 mb-1 p-2.5 text-xs leading-relaxed font-normal
                         bg-gray-900 text-white rounded-lg">
          {text}
        </span>
      )}
    </>
  )
}

export default function UebergabeFelder({ bereich, werte, onChange, offen = [] }) {
  const fehlt = new Set(offen.map(o => o.schluessel || o))
  const eintraege = Object.entries(FELDER).filter(([, f]) => f.bereich === bereich)

  const setzen = (schluessel, wert) => onChange({ ...werte, [schluessel]: wert })

  // Dieselbe Hülle wie in jedem anderen Tab. `fehlt` markiert, was der Server
  // bemängelt hat - die Farbe dafür steht bei den Formular-Bausteinen, nicht
  // hier, sonst hätte jedes Formular seine eigene Fehlerfarbe.
  const rahmen = (schluessel, mehrzeilig = false) =>
    `${mehrzeilig ? 'textarea-field' : 'input-field'}${fehlt.has(schluessel) ? ' fehlt' : ''}`

  return (
    <div className="space-y-4">
      {eintraege.map(([schluessel, feld]) => {
        const wert = werte?.[schluessel]

        // "Kunde wollte keine Zahlen nennen" schaltet die Zahlenfelder aus -
        // leer ist dann die richtige Antwort, nicht eine Lücke.
        const abgeschaltet = werte?.keine_zahlen &&
          ['zuwachs_auftraege', 'abschlussquote', 'ist_auftraege'].includes(schluessel)

        return (
          <div key={schluessel} className={abgeschaltet ? 'opacity-40' : ''}>
            <label className="feld-label">
              {feld.name}
              {feld.pflicht && <span className="text-red-500 ml-0.5">*</span>}
              <Hilfe text={feld.hilfe} />
            </label>

            {feld.art === 'auswahl' && (
              <select
                value={wert ?? ''}
                disabled={abgeschaltet}
                onChange={e => setzen(schluessel, e.target.value || null)}
                className={`select-field${fehlt.has(schluessel) ? ' fehlt' : ''}`}
              >
                <option value="">Bitte wählen</option>
                {feld.optionen.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {feld.art === 'janein' && (
              <div className="flex gap-2">
                {[['Ja', true], ['Nein', false]].map(([text, w]) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => setzen(schluessel, w)}
                    className={`px-4 py-2 rounded-lg border text-sm ${
                      wert === w
                        ? 'bg-primary text-white border-primary'
                        : fehlt.has(schluessel)
                          ? 'border-red-400 bg-red-50 text-gray-700'
                          : 'bg-white text-gray-700 hover:border-secondary'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}

            {feld.art === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={wert === true}
                  onChange={e => setzen(schluessel, e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span>{feld.name}</span>
              </label>
            )}

            {feld.art === 'freitext' && (
              <textarea
                rows={2}
                value={wert ?? ''}
                onChange={e => setzen(schluessel, e.target.value)}
                className={rahmen(schluessel, true)}
                placeholder="Wörtlich, nicht zusammengefasst"
              />
            )}

            {(feld.art === 'zahl' || feld.art === 'betrag') && (
              <input
                type="number"
                inputMode="decimal"
                disabled={abgeschaltet}
                min={feld.min}
                max={feld.max}
                step={feld.art === 'betrag' ? '0.01' : '1'}
                value={wert ?? ''}
                /* min/max sind nur ein Hinweis an die Pfeiltasten - tippen
                   laesst sich trotzdem alles. Hier stand "-3 gewuenschte
                   Auftraege pro Jahr", und die Bedarfsrechnung machte daraus
                   negative Anfragen pro Monat. Deshalb wird der Wert beim
                   Eintippen in die Spanne gezogen. */
                onChange={e => {
                  if (e.target.value === '') return setzen(schluessel, null)
                  let zahl = Number(e.target.value)
                  if (Number.isNaN(zahl)) return
                  if (feld.min !== undefined) zahl = Math.max(feld.min, zahl)
                  if (feld.max !== undefined) zahl = Math.min(feld.max, zahl)
                  setzen(schluessel, zahl)
                }}
                className={rahmen(schluessel)}
              />
            )}

            {feld.art === 'telefon' && (
              <input
                type="tel"
                value={wert ?? ''}
                onChange={e => setzen(schluessel, e.target.value)}
                className={rahmen(schluessel)}
                placeholder="01xx ..."
              />
            )}

            {feld.art === 'liste' && (
              <input
                type="text"
                value={Array.isArray(wert) ? wert.join(', ') : (wert ?? '')}
                onChange={e => setzen(schluessel,
                  e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                className={rahmen(schluessel)}
                placeholder="Mit Komma trennen"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Die berechnete Anzeige, damit der Setter seine Zahl im Gespräch vorlesen kann. */
export function AnfragenBedarf({ werte }) {
  const zuwachs = Number(werte?.zuwachs_auftraege)
  const quote = Number(werte?.abschlussquote)
  if (!zuwachs || !quote || quote <= 0) return null

  const proMonat = Math.round((zuwachs / (quote / 10) / 12) * 10) / 10
  const bereich = proMonat < 2 ? 'unter 2' : proMonat <= 4 ? '2 bis 4' : 'über 4'

  return (
    <div className="mt-4 p-3 bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg text-sm">
      <div className="text-gray-700">
        Nötige Anfragen pro Monat: <strong>{proMonat.toLocaleString('de-DE')}</strong>
        <span className="text-gray-500"> ({bereich})</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Berechnet. Dieselbe Zahl steht später im Strategiepapier.
      </div>
    </div>
  )
}

export { uebergabePruefen }
