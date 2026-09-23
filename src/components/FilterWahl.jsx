import { useState, useEffect, useRef, useId } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { filterFelder, vergleicheFuer, VERGLEICHE, MAX_FILTER } from '../../shared/filter.js'

// Filter bauen: Feld, Vergleich, Wert — und davon bis zu sechs.
//
// Die festen Auswahlfelder von früher konnten nur „ist gleich". Wer alles
// außer „Kein Interesse" sehen wollte, musste jeden anderen Wert einzeln
// durchgehen. Jetzt gibt es „ist nicht", „enthält", „größer als", „vor dem"
// und „ist leer" — und mehrere Bedingungen gelten zusammen.
//
// Aufbau und Optik wie bei der Spaltenwahl: ein Knopf in Filter-Grau, darunter
// ein Kasten. Gespeichert wird je Benutzer, zusammen mit den Spalten.

/**
 * @param stufe     'opening' | 'setting' | 'closing'
 * @param filter    [{ feld, vergleich, wert }]
 * @param onAendern (liste) => void
 * @param zeilen    für Wertvorschläge aus dem, was gerade in der Liste steht
 * @param speichert Spinner, solange geschrieben wird
 */
export default function FilterWahl({ stufe, filter = [], onAendern, zeilen = [], speichert = false }) {
  const [offen, setOffen] = useState(false)
  const kasten = useRef(null)
  const listenId = useId()

  useEffect(() => {
    if (!offen) return
    const zu = (e) => { if (kasten.current && !kasten.current.contains(e.target)) setOffen(false) }
    document.addEventListener('mousedown', zu)
    return () => document.removeEventListener('mousedown', zu)
  }, [offen])

  const felder = filterFelder(stufe)
  const spalteVon = (schluessel) => felder.find(f => f.schluessel === schluessel)

  const aendern = (i, teil) => {
    const neu = filter.map((f, x) => x === i ? { ...f, ...teil } : f)
    // Passt der Vergleich nicht mehr zum Feld, nimm den ersten passenden.
    if (teil.feld) {
      const moeglich = vergleicheFuer(spalteVon(teil.feld)?.art)
      if (!moeglich.includes(neu[i].vergleich)) neu[i].vergleich = moeglich[0]
    }
    onAendern(neu)
  }

  const hinzufuegen = () => {
    const erstes = felder[0]
    if (!erstes || filter.length >= MAX_FILTER) return
    onAendern([...filter, { feld: erstes.schluessel, vergleich: vergleicheFuer(erstes.art)[0], wert: '' }])
    setOffen(true)
  }

  const entfernen = (i) => onAendern(filter.filter((_, x) => x !== i))

  /** Was in dieser Spalte tatsächlich vorkommt — als Vorschlagsliste. */
  const vorschlaege = (schluessel) => {
    const gesehen = new Set()
    for (const z of zeilen) {
      const w = z?.[schluessel]
      if (w === null || w === undefined || typeof w === 'object') continue
      const s = String(w).trim()
      if (s) gesehen.add(s)
      if (gesehen.size > 40) break
    }
    return [...gesehen].sort((a, b) => a.localeCompare(b, 'de'))
  }

  return (
    <div className="relative" ref={kasten}>
      <button type="button" onClick={() => setOffen(o => !o)} className="filter-knopf">
        {speichert && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Filter{filter.length ? ` · ${filter.length}` : ''}
      </button>

      {offen && (
        <div className="absolute right-0 z-30 mt-2 w-[26rem] max-w-[92vw] card-elevated p-4 space-y-3">
          {filter.length === 0 && (
            <p className="text-body-sm text-on-surface-variant">
              Noch kein Filter. Jede Bedingung, die du hinzufügst, muss zutreffen.
            </p>
          )}

          {filter.map((f, i) => {
            const spalte = spalteVon(f.feld)
            const moeglich = vergleicheFuer(spalte?.art)
            const brauchtWert = VERGLEICHE[f.vergleich]?.wert
            const liste = `${listenId}-${i}`
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={f.feld}
                  onChange={(e) => aendern(i, { feld: e.target.value })}
                  className="select-field w-auto min-w-[8.5rem] text-body-sm py-2"
                >
                  {felder.map(s => (
                    <option key={s.schluessel} value={s.schluessel}>{s.name}</option>
                  ))}
                </select>

                <select
                  value={f.vergleich}
                  onChange={(e) => aendern(i, { vergleich: e.target.value })}
                  className="select-field w-auto min-w-[7.5rem] text-body-sm py-2"
                >
                  {moeglich.map(v => (
                    <option key={v} value={v}>{VERGLEICHE[v].name}</option>
                  ))}
                </select>

                {brauchtWert && (
                  <>
                    <input
                      type={['datum', 'tag'].includes(spalte?.art) ? 'date'
                        : ['zahl', 'geld', 'prozent'].includes(spalte?.art) ? 'number' : 'text'}
                      value={f.wert || ''}
                      list={liste}
                      onChange={(e) => aendern(i, { wert: e.target.value })}
                      placeholder="Wert"
                      className="input-field w-auto flex-1 min-w-[7rem] text-body-sm py-2"
                    />
                    <datalist id={liste}>
                      {vorschlaege(f.feld).map(v => <option key={v} value={v} />)}
                    </datalist>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => entfernen(i)}
                  aria-label="Filter entfernen"
                  className="p-1.5 rounded hover:bg-surface-container"
                >
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={hinzufuegen}
              disabled={filter.length >= MAX_FILTER}
              className="flex items-center gap-2 text-label-sm text-primary hover:underline
                         disabled:opacity-50 disabled:no-underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Filter hinzufügen{filter.length >= MAX_FILTER ? ` (höchstens ${MAX_FILTER})` : ''}
            </button>

            {filter.length > 0 && (
              <button
                type="button"
                onClick={() => onAendern([])}
                className="text-label-sm text-on-surface-variant hover:text-on-surface"
              >
                Alle entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
