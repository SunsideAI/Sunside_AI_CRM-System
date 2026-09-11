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
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        onBlur={() => setOffen(false)}
        className="text-gray-400 hover:text-purple-600"
        aria-label="Hilfe zu diesem Feld"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {offen && (
        <span className="absolute z-50 left-0 top-6 w-72 p-3 text-xs leading-relaxed
                         bg-gray-900 text-white rounded-lg shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

export default function UebergabeFelder({ bereich, werte, onChange, offen = [] }) {
  const fehlt = new Set(offen.map(o => o.schluessel || o))
  const eintraege = Object.entries(FELDER).filter(([, f]) => f.bereich === bereich)

  const setzen = (schluessel, wert) => onChange({ ...werte, [schluessel]: wert })

  const rahmen = (schluessel) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
      fehlt.has(schluessel) ? 'border-red-400 bg-red-50' : ''
    }`

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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {feld.name}
              {feld.pflicht && <span className="text-red-500 ml-0.5">*</span>}
              <Hilfe text={feld.hilfe} />
            </label>

            {feld.art === 'auswahl' && (
              <select
                value={wert ?? ''}
                disabled={abgeschaltet}
                onChange={e => setzen(schluessel, e.target.value || null)}
                className={rahmen(schluessel)}
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
                        ? 'bg-purple-600 text-white border-purple-600'
                        : fehlt.has(schluessel)
                          ? 'border-red-400 bg-red-50 text-gray-700'
                          : 'bg-white text-gray-700 hover:border-purple-400'
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
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <span>{feld.name}</span>
              </label>
            )}

            {feld.art === 'freitext' && (
              <textarea
                rows={2}
                value={wert ?? ''}
                onChange={e => setzen(schluessel, e.target.value)}
                className={rahmen(schluessel)}
                placeholder="Wörtlich, nicht zusammengefasst"
              />
            )}

            {(feld.art === 'zahl' || feld.art === 'betrag') && (
              <input
                type="number"
                inputMode="decimal"
                disabled={abgeschaltet}
                value={wert ?? ''}
                onChange={e => setzen(schluessel, e.target.value === '' ? null : Number(e.target.value))}
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
    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm">
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
