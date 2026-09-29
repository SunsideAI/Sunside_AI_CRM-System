import { useState } from 'react'
import { UserMinus, Loader2 } from 'lucide-react'
import { useMeldung } from './Meldungen'

/**
 * Einen Kontakt zurueck in den Pool geben.
 *
 * Wer merkt, dass er ein Gespraech nicht fuehren kann - keine Zeit, kein
 * Draht, falsche Branche -, soll ihn abgeben koennen, statt ihn liegen zu
 * lassen. Der Kontakt wird wieder frei, und wer mag, bewirbt sich darauf.
 *
 * Es ist dieselbe Sache in Setting und Closing, nur mit anderer Rolle:
 * Der Setter gibt das Beratungsgespraech ab, der Closer das
 * Abschlussgespraech. Deshalb ein Bauteil mit zwei Stufen statt zweimal
 * derselbe Dialog - das Closing hatte seinen als Popup ueber der Schublade,
 * was sonst nirgends mehr vorkommt.
 */

const STUFEN = {
  setting: {
    feld: 'setterName',
    wer: 'Setter',
    satz: 'Der Kontakt wird wieder für alle Setter im Pool verfügbar.',
    // Im Setting gibt es keine Rundmail an die Kollegen, also auch kein
    // Grundfeld: Ein Text, den niemand zu lesen bekaeme, ist Blindleistung.
    mitGrund: false
  },
  closing: {
    feld: 'closerName',
    wer: 'Closer',
    satz: 'Der Kontakt wird wieder für alle Closer im Pool verfügbar. Alle Closer werden per E-Mail benachrichtigt.',
    mitGrund: true
  }
}

export default function LeadFreigabe({ lead, stufe, onFertig, onAbbrechen }) {
  const [grund, setGrund] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const meldung = useMeldung()
  const art = STUFEN[stufe] || STUFEN.closing

  const freigeben = async () => {
    if (!lead) return
    setLaeuft(true)
    try {
      const antwort = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: lead.id,
          updates: { [art.feld]: '' }    // leer heisst: zurueck in den Pool
        })
      })
      const daten = await antwort.json()
      if (!antwort.ok) throw new Error(daten.message || daten.error || 'Freigeben fehlgeschlagen')

      meldung.erfolg(`${lead.unternehmen || 'Der Kontakt'} ist wieder im Pool.`)
      onFertig?.(grund.trim())
    } catch (f) {
      meldung.fehler(f.message)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-warning-container rounded-full flex items-center justify-center shrink-0">
          <UserMinus className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h3 className="text-title-sm text-on-surface">Kontakt freigeben?</h3>
          <p className="text-body-sm text-on-surface-variant">{lead?.unternehmen}</p>
        </div>
      </div>

      <p className="text-body-md text-on-surface-variant">{art.satz}</p>

      {art.mitGrund && (
        <div>
          <label className="feld-label">Grund <span className="text-on-surface-variant">(freiwillig)</span></label>
          <textarea
            value={grund}
            onChange={e => setGrund(e.target.value)}
            rows={3}
            placeholder={`Warum gibst du den Kontakt zurück? Das steht in der Mail an die ${art.wer}.`}
            className="textarea-field"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onAbbrechen} disabled={laeuft} className="fuss-leise">
          Abbrechen
        </button>
        <button type="button" onClick={freigeben} disabled={laeuft} className="fuss-haupt">
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
          Freigeben
        </button>
      </div>
    </div>
  )
}
