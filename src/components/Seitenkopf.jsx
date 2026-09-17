import { RefreshCw } from 'lucide-react'

// Der Kopf einer Seite: Titel und Unterzeile links, Bedienelemente rechts.
//
// Gemessen über alle Tabs waren die Umschalter 36, 40 oder 48 Pixel hoch und
// der Aktualisieren-Knopf gab es in vier Größen — einmal mit Beschriftung,
// dreimal ohne. Beim Tabwechsel sprang die Zeile deshalb sichtbar.
//
// Vorbild ist der Termine-Kopf, der als einziger durchgehend stimmte.

export default function Seitenkopf({ titel, unterzeile, children }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-headline-lg font-display text-on-surface">{titel}</h1>
        {unterzeile && (
          <p className="text-body-md text-on-surface-variant mt-2">{unterzeile}</p>
        )}
      </div>

      {/* Auf schmalen Schirmen darf die Reihe waagerecht scrollen statt zu
          brechen — sonst steht der Titel plötzlich über drei Zeilen Knöpfen. */}
      {children && (
        <div className="w-full lg:w-auto overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="flex items-center gap-3 min-w-max">{children}</div>
        </div>
      )}
    </div>
  )
}

/**
 * Eine Gruppe von Umschaltern.
 *
 * @param eintraege [{ wert, name, kurz, icon, zahl }]
 */
export function Umschalter({ eintraege, wert, onWechsel }) {
  const sichtbar = (eintraege || []).filter(Boolean)
  if (sichtbar.length === 0) return null

  return (
    <div className="umschalter">
      {sichtbar.map(e => {
        const aktiv = e.wert === wert
        return (
          <button
            key={e.wert}
            type="button"
            onClick={() => onWechsel(e.wert)}
            className={`umschalter-knopf${aktiv ? ' aktiv' : ''}`}
          >
            {e.icon && <e.icon className="w-4 h-4 mr-1.5" />}
            {/* Auf schmalen Schirmen die Kurzform, sofern es eine gibt. */}
            {e.kurz ? (
              <>
                <span className="hidden sm:inline">{e.name}</span>
                <span className="sm:hidden">{e.kurz}</span>
              </>
            ) : e.name}
            {e.zahl !== undefined && e.zahl !== null && (
              <span className="umschalter-zahl">{e.zahl}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Der Aktualisieren-Knopf. Überall gleich gross und gleich beschriftet. */
export function Aktualisieren({ onClick, laeuft, beschriftet = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={laeuft}
      aria-label="Aktualisieren"
      title="Aktualisieren"
      className={`kopf-knopf${beschriftet ? '' : ' kopf-knopf-symbol'}`}
    >
      <RefreshCw className={`w-4 h-4 ${laeuft ? 'animate-spin' : ''}`} />
      {beschriftet && 'Aktualisieren'}
    </button>
  )
}
