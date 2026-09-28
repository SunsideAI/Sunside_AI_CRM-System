import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

/**
 * Die kurzen Meldungen oben rechts, die nach ein paar Sekunden gehen.
 *
 * Es gab drei Bauweisen davon: das Closing hatte eigene, die beiden
 * Verwaltungsseiten eine zweite in fremden Grüntönen, und an einigen Stellen
 * sprang stattdessen ein Browser-Dialog auf. Dreimal dieselbe Sache, dreimal
 * anders. Hier steht sie einmal: gleiche Farben, gleiche Form, gleiche Dauer,
 * gleiche Stelle.
 *
 * Benutzt wird sie über `useMeldung()`:
 *
 *   const meldung = useMeldung()
 *   meldung.erfolg('Termin gebucht')
 *   meldung.fehler('Das hat nicht geklappt')
 *   meldung.hinweis('Du hast dich bereits beworben')
 *
 * Fehler bleiben länger stehen als Erfolge: Wer etwas falsch gemacht hat,
 * braucht Zeit zum Lesen. Wer Erfolg hatte, arbeitet weiter.
 */

const MeldungKontext = createContext(null)

const ARTEN = {
  erfolg:  { symbol: CheckCircle2, kasten: 'bg-success-container', farbe: 'text-success',  dauer: 4000 },
  fehler:  { symbol: AlertCircle,  kasten: 'bg-error-container',   farbe: 'text-error',    dauer: 8000 },
  hinweis: { symbol: Info,         kasten: 'bg-primary-fixed',     farbe: 'text-primary',  dauer: 6000 }
}

function Meldung({ art, text, onSchliessen }) {
  const { symbol: Symbol, kasten, farbe } = ARTEN[art] || ARTEN.hinweis
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-ambient-lg
                  max-w-[min(26rem,calc(100vw-2rem))] ${kasten} animate-slide-up`}
    >
      <Symbol className={`w-5 h-5 shrink-0 mt-0.5 ${farbe}`} />
      <p className="text-body-md text-on-surface flex-1">{text}</p>
      <button
        type="button"
        onClick={onSchliessen}
        aria-label="Meldung schließen"
        className="shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function MeldungenProvider({ children }) {
  const [liste, setListe] = useState([])
  const naechste = useRef(0)

  const entfernen = useCallback((id) => {
    setListe(l => l.filter(m => m.id !== id))
  }, [])

  const zeigen = useCallback((art, text) => {
    if (!text) return
    const id = ++naechste.current
    setListe(l => [...l, { id, art, text }])
    return id
  }, [])

  const api = useRef(null)
  if (!api.current) {
    api.current = {
      erfolg:  (text) => zeigen('erfolg', text),
      fehler:  (text) => zeigen('fehler', text),
      hinweis: (text) => zeigen('hinweis', text),
      zeigen
    }
  }

  return (
    <MeldungKontext.Provider value={api.current}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
          {liste.map(m => (
            <Uhr key={m.id} dauer={ARTEN[m.art]?.dauer || 5000} onAblauf={() => entfernen(m.id)}>
              <Meldung art={m.art} text={m.text} onSchliessen={() => entfernen(m.id)} />
            </Uhr>
          ))}
        </div>,
        document.body
      )}
    </MeldungKontext.Provider>
  )
}

/** Blendet ihr Kind nach der Zeit aus. Eigene Komponente, damit jede Meldung
 *  ihre eigene Uhr hat und ein Nachzügler die erste nicht verlängert. */
function Uhr({ dauer, onAblauf, children }) {
  useEffect(() => {
    const t = setTimeout(onAblauf, dauer)
    return () => clearTimeout(t)
  }, [dauer, onAblauf])
  return children
}

export function useMeldung() {
  const kontext = useContext(MeldungKontext)
  // Ohne Provider (Tests, einzelne Vorschauen) darf nichts abstürzen.
  return kontext || { erfolg: () => {}, fehler: () => {}, hinweis: () => {}, zeigen: () => {} }
}

export default MeldungenProvider
