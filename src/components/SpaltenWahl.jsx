import { useState, useEffect, useRef } from 'react'
import { GripVertical, X, Plus, RotateCcw } from 'lucide-react'
import { spaltenFuer, standardSpalten } from '../../shared/spalten.js'

// Welche Spalten stehen in meiner Liste, und in welcher Reihenfolge?
//
// Vorher war das fest verdrahtet: Wer im Closing den Paketnamen sehen wollte,
// konnte nichts tun, und wer die Website-Zahlen nie braucht, schleppte sie
// mit. Die Auswahl gehört dem Benutzer und wird in der Datenbank gehalten
// (users.preferences), gilt also auch am nächsten Rechner.
//
// Sortiert wird mit der Maus: Eintrag greifen, an die neue Stelle ziehen.
// Die beiden festen Spalten (Art, Unternehmen) bleiben vorn, damit die Zeile
// auch beim Scrollen nach rechts noch zu erkennen ist.

/**
 * @param stufe     'opening' | 'setting' | 'closing'
 * @param auswahl   aktuelle Schlüssel (geordnet) oder null für den Standard
 * @param onAendern (schluessel|null) => void — null setzt zurück
 * @param speichert zeigt den Spinner, solange geschrieben wird
 */
export default function SpaltenWahl({ stufe, auswahl, onAendern, speichert = false }) {
  const [offen, setOffen] = useState(false)
  const [gezogen, setGezogen] = useState(null)
  const kasten = useRef(null)

  useEffect(() => {
    if (!offen) return
    const zu = (e) => { if (kasten.current && !kasten.current.contains(e.target)) setOffen(false) }
    document.addEventListener('mousedown', zu)
    return () => document.removeEventListener('mousedown', zu)
  }, [offen])

  const waehlbar = spaltenFuer(stufe).filter(s => !s.fest)
  const aktuell = (auswahl && auswahl.length ? auswahl : standardSpalten(stufe))
    .filter(k => waehlbar.some(s => s.schluessel === k))
  const offenStehend = waehlbar.filter(s => !aktuell.includes(s.schluessel))
  const nameVon = (k) => waehlbar.find(s => s.schluessel === k)?.name || k

  const entfernen = (k) => onAendern(aktuell.filter(x => x !== k))
  const hinzufuegen = (k) => onAendern([...aktuell, k])

  const ablegenAuf = (ziel) => {
    if (!gezogen || gezogen === ziel) return
    const ohne = aktuell.filter(k => k !== gezogen)
    const stelle = ohne.indexOf(ziel)
    ohne.splice(stelle < 0 ? ohne.length : stelle, 0, gezogen)
    onAendern(ohne)
    setGezogen(null)
  }

  return (
    <div className="relative" ref={kasten}>
      {/* Gleiche Regel wie beim Filter-Knopf: feste Breite, kein Spinner,
          der das Layout verschiebt. */}
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-busy={speichert}
        className="filter-knopf min-w-[7rem] justify-start"
      >
        Spalten
      </button>

      {offen && (
        <div className="absolute right-0 z-30 mt-2 w-72 card-elevated p-4 space-y-4">
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
              Angezeigt — zum Sortieren ziehen
            </p>
            <ul className="space-y-1">
              {aktuell.map(k => (
                <li
                  key={k}
                  draggable
                  onDragStart={() => setGezogen(k)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => ablegenAuf(k)}
                  onDragEnd={() => setGezogen(null)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-container
                              cursor-grab active:cursor-grabbing ${
                                gezogen === k ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-4 h-4 text-outline shrink-0" />
                  <span className="text-body-sm text-on-surface flex-1 truncate">{nameVon(k)}</span>
                  <button
                    type="button"
                    onClick={() => entfernen(k)}
                    aria-label={`${nameVon(k)} ausblenden`}
                    className="p-1 rounded hover:bg-surface-container-high"
                  >
                    <X className="w-3.5 h-3.5 text-on-surface-variant" />
                  </button>
                </li>
              ))}
              {aktuell.length === 0 && (
                <li className="text-body-sm text-on-surface-variant">
                  Nur Art und Unternehmen.
                </li>
              )}
            </ul>
          </div>

          {offenStehend.length > 0 && (
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
                Verfügbar
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {offenStehend.map(s => (
                  <li key={s.schluessel}>
                    <button
                      type="button"
                      onClick={() => hinzufuegen(s.schluessel)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                 hover:bg-surface-container text-left"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-body-sm text-on-surface-variant truncate">{s.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => onAendern(null)}
            className="flex items-center gap-2 text-label-sm text-primary hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Zurück zum Standard
          </button>
        </div>
      )}
    </div>
  )
}
