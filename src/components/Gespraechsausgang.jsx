import { useState } from 'react'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AUSWAHL } from '../../shared/felder.js'

/**
 * Was ist aus dem Abschlussgespräch geworden?
 *
 * Die Felder dafür gab es längst in der Datenbank — gespraechsausgang,
 * zugesagter_schritt, nachfass_grund — nur keine Stelle, sie zu füllen. Der
 * Ausgang eines Abschlussgesprächs blieb damit unerfasst, und daran hängen
 * die Rückgabequote und die Empfehlung fürs Nachfassen.
 *
 * Ein Folgetermin wird hier bewusst NICHT gebucht (Entscheidung 16.09.2026).
 * Es bleibt bei zwei Terminen in der Kette: Beratung und Abschluss. Was
 * danach geschieht, entscheidet der Closer selbst — das CRM hält fest, was
 * vereinbart wurde, und terminiert es nicht.
 */
export default function Gespraechsausgang({ lead, onGespeichert }) {
  const [ausgang, setAusgang] = useState(lead?.gespraechsausgang || '')
  const [schritt, setSchritt] = useState(lead?.zugesagter_schritt || '')
  const [grund, setGrund] = useState(lead?.nachfass_grund || '')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [fertig, setFertig] = useState(false)

  // Wer nicht abgeschlossen und nicht abgesagt hat, wird nachgefasst — und
  // dafür entscheidet die Diagnose die Tonlage.
  const brauchtDiagnose = ausgang && ausgang !== 'Auftrag' && ausgang !== 'Absage'

  const speichern = async () => {
    if (!ausgang) { setFehler('Bitte den Ausgang des Gesprächs wählen.'); return }
    if (brauchtDiagnose && !grund) {
      setFehler('Bitte die Diagnose wählen. Sie bestimmt, was das System zum Nachfassen vorschlägt.')
      return
    }

    setLaeuft(true); setFehler('')
    try {
      const antwort = await fetch('/.netlify/functions/hot-leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotLeadId: lead.id,
          updates: {
            gespraechsausgang: ausgang,
            zugesagter_schritt: schritt || null,
            nachfass_grund: brauchtDiagnose ? grund : null
          }
        })
      })
      const daten = await antwort.json()
      if (!antwort.ok) { setFehler(daten.error || 'Speichern fehlgeschlagen'); return }
      setFertig(true)
      onGespeichert?.()
    } catch (e) {
      setFehler('Netzwerkfehler: ' + e.message)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="abschnitt-trenner">
      <h3 className="abschnitt-titel mb-3">
        Ausgang des Abschlussgesprächs
      </h3>

      {fehler && (
        <div className="flex gap-2 mb-3 p-3 bg-error-container rounded-lg text-body-sm text-error">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {fehler}
        </div>
      )}
      {fertig && (
        <div className="flex gap-2 mb-3 p-3 bg-success-container rounded-lg text-body-sm text-on-surface">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> Festgehalten.
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="feld-label">
            Wie ist das Gespräch ausgegangen?
          </label>
          <div className="flex flex-wrap gap-2">
            {AUSWAHL.gespraechsausgang.map(w => (
              <button
                key={w}
                type="button"
                onClick={() => { setAusgang(w); setFehler(''); setFertig(false) }}
                className={`px-3 py-1.5 rounded-full text-label-lg transition-colors ${
                  ausgang === w
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {ausgang && ausgang !== 'Auftrag' && (
          <div>
            <label className="feld-label">
              Was wurde zugesagt? <span className="text-on-surface-variant font-normal">(wörtlich)</span>
            </label>
            <input
              type="text"
              value={schritt}
              onChange={e => setSchritt(e.target.value)}
              placeholder="z. B. Er spricht bis Freitag mit seinem Partner"
              className="input-field"
            />
          </div>
        )}

        {brauchtDiagnose && (
          <div>
            <label className="feld-label">
              Diagnose <span className="text-error">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {AUSWAHL.nachfass_grund.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => { setGrund(w); setFehler('') }}
                  className={`px-3 py-2 rounded-lg text-left text-body-sm transition-colors ${
                    grund === w
                      ? 'bg-secondary-container text-on-surface'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              Sie bestimmt die Tonlage des Nachfassens und welches Stück das
              System vorschlägt — nicht, wie oft du dich meldest.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={speichern}
          disabled={laeuft}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {laeuft && <Loader2 className="w-4 h-4 animate-spin" />}
          Ausgang festhalten
        </button>
      </div>
    </div>
  )
}
