import { useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Ein Kommentar an den Kontakt - das Einzige, was noch geht, wenn der Kontakt
// eine Stufe weiter ist.
//
// Wer ihn abgegeben hat, erfährt trotzdem noch Dinge: Der Kunde ruft zurück,
// eine Mail kommt an, jemand erzählt etwas am Telefon. Das gehört an den
// Kontakt, auch wenn der Setter am Abschluss nichts mehr zu ändern hat.
//
// Geschrieben wird in den Lead, nicht in den Hot Lead: Dort liegt der
// Kommentarverlauf, den alle drei Stufen lesen.

export default function KommentarKasten({ leadId, onGespeichert }) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState('')
  const [gespeichert, setGespeichert] = useState(false)

  if (!leadId) return null

  const speichern = async () => {
    if (!text.trim()) return
    setSpeichert(true); setFehler(''); setGespeichert(false)
    try {
      const antwort = await fetch('/.netlify/functions/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          updates: {},
          historyEntry: {
            action: 'kommentar',
            details: text.trim(),
            userName: user?.vor_nachname || ''
          }
        })
      })
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({}))
        throw new Error(daten.error || 'Kommentar konnte nicht gespeichert werden')
      }
      setText(''); setGespeichert(true)
      onGespeichert?.()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="feld-label" htmlFor="kommentar-kasten">Kommentar hinzufügen</label>
      <textarea
        id="kommentar-kasten"
        value={text}
        onChange={e => { setText(e.target.value); setGespeichert(false) }}
        rows={3}
        placeholder="Was du noch erfahren hast…"
        className="textarea-field"
      />
      {fehler && <p className="text-body-sm text-error">{fehler}</p>}
      <div className="flex items-center justify-end gap-3">
        {gespeichert && <span className="text-body-sm text-success">Gespeichert.</span>}
        <button
          type="button"
          onClick={speichern}
          disabled={speichert || !text.trim()}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {speichert ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          Kommentar speichern
        </button>
      </div>
    </div>
  )
}
