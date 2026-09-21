import { useEffect, useState } from 'react'
import { Lightbulb, RefreshCw, Loader2 } from 'lucide-react'

// Die Bubble über dem Notizfeld: ein Vorschlag, welche Fragen zu diesem Fall
// passen. Nicht bearbeitbar, sie füllt kein Feld. Erzeugt wird einmal beim
// ersten Öffnen, danach kommen die gespeicherten Fragen; neue nur auf Knopfdruck.

export default function FragenVorschlag({ lead }) {
  const [fragen, setFragen] = useState(null)
  const [quelle, setQuelle] = useState(null)
  const [laeuft, setLaeuft] = useState(false)

  const holen = async (neu = false) => {
    if (!lead?.id) return
    setLaeuft(true)
    try {
      const res = await fetch('/.netlify/functions/fragen-vorschlag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotLeadId: lead.id, neu })
      })
      const daten = await res.json()
      if (res.ok && Array.isArray(daten.fragen)) {
        setFragen(daten.fragen)
        setQuelle(daten.quelle)
      }
    } catch {
      // Ohne Verbindung bleibt die letzte Fassung stehen.
    } finally {
      setLaeuft(false)
    }
  }

  useEffect(() => { holen(false) }, [lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-3 rounded-lg border border-primary-fixed-dim bg-primary-fixed/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-on-surface">Vorschlag: Diese Fragen passen zu diesem Fall</p>
            <p className="text-xs text-gray-500">Du entscheidest, was du fragst.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => holen(true)}
          disabled={laeuft}
          className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 shrink-0"
        >
          {laeuft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Neue Vorschläge
        </button>
      </div>

      {fragen === null ? (
        <p className="mt-2 text-xs text-gray-500">Vorschläge werden erstellt …</p>
      ) : (
        <ol className="mt-2 space-y-1 list-decimal list-inside text-sm text-gray-700">
          {fragen.map((f, i) => <li key={i}>„{f}"</li>)}
        </ol>
      )}

      {quelle === 'basis' && (
        <p className="mt-2 text-xs text-gray-500">
          Das ist die allgemeine Basis. Die fallbezogenen Vorschläge waren gerade nicht erreichbar.
        </p>
      )}
    </div>
  )
}
