import { useState, useEffect, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'

// Die Nebenaktionen einer Schublade unter einem Knopf.
//
// Im Closing standen fünf gleich grosse Knöpfe nebeneinander in der
// Fussleiste. Bei 500 px Breite brachen zwei davon mitten im Wort um („Neuer /
// Termin", „An Pool / freigeben") und schoben sich ineinander. Fünf gleich
// laute Aktionen sind ausserdem keine Hilfe: Eine davon ist die, die man
// meistens will, die anderen vier sind Zubehör.
//
// Also: die Hauptaktion bleibt sichtbar, der Rest kommt hierher.

export default function Aktionsmenue({ eintraege, beschriftung = 'Weitere' }) {
  const [offen, setOffen] = useState(false)
  const huelle = useRef(null)

  // Klick daneben schliesst. Ohne das bliebe das Menü offen stehen, während
  // man längst woanders ist.
  useEffect(() => {
    if (!offen) return
    const zu = (e) => { if (!huelle.current?.contains(e.target)) setOffen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOffen(false) }
    document.addEventListener('mousedown', zu)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', zu)
      document.removeEventListener('keydown', esc)
    }
  }, [offen])

  const sichtbar = (eintraege || []).filter(Boolean)
  if (sichtbar.length === 0) return null

  return (
    <div className="relative" ref={huelle}>
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={offen}
        className="flex items-center gap-2 px-4 py-2 whitespace-nowrap text-on-surface-variant
                   border border-outline-variant rounded-xl hover:bg-surface-container transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
        {beschriftung}
      </button>

      {/* Nach oben, nicht nach unten: Das Menü hängt an der Fussleiste, unter
          ihr ist kein Platz mehr. */}
      {offen && (
        <div
          role="menu"
          className="absolute bottom-full right-0 mb-2 w-60 py-1 bg-surface-container-lowest
                     rounded-xl shadow-ambient-lg border border-outline-variant z-50"
        >
          {sichtbar.map((e, i) => (
            <button
              key={e.name || i}
              type="button"
              role="menuitem"
              onClick={() => { setOffen(false); e.onClick?.() }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-body-md
                          hover:bg-surface-container transition-colors ${
                            e.warnung ? 'text-warning' : 'text-on-surface'
                          }`}
            >
              {e.icon && <e.icon className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{e.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
