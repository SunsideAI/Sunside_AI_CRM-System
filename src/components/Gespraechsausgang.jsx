import { useState } from 'react'
import { CalendarPlus, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AUSWAHL } from '../../shared/felder.js'
import TerminPicker from './TerminPicker'

/**
 * Was ist aus dem Abschlussgespräch geworden?
 *
 * Die Felder dafür gab es längst in der Datenbank — gespraechsausgang,
 * zugesagter_schritt, nachfass_grund — nur keine Stelle, sie zu füllen. Der
 * Ausgang eines Abschlussgesprächs blieb damit unerfasst, und daran hängt
 * einiges: die Rückgabequote, die Empfehlung fürs Nachfassen, und der
 * Folgetermin.
 *
 * Aus Teil D der Ressourcen-Datei: „Ein gebuchter Termin schlägt jede Mail.
 * Der beste Ausgang von ‚Wird nachgefasst' ist der noch im Abschlussgespräch
 * gebuchte Follow-Up-Termin." Deshalb steht der Terminwähler direkt am
 * Ausgang „Nächster Schritt vereinbart" — nicht in einem späteren Menü.
 */
export default function Gespraechsausgang({ lead, onGespeichert }) {
  const [ausgang, setAusgang] = useState(lead?.gespraechsausgang || '')
  const [schritt, setSchritt] = useState(lead?.zugesagter_schritt || '')
  const [grund, setGrund] = useState(lead?.nachfass_grund || '')
  const [termin, setTermin] = useState(
    lead?.termin_folgetermin
      ? { start: lead.termin_folgetermin, meetingLink: lead.meeting_link_folgetermin || null }
      : null)
  const [waehlerOffen, setWaehlerOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [fertig, setFertig] = useState(false)

  // Nur bei diesem Ausgang ist ein Folgetermin die Sache; bei einem Auftrag
  // gibt es nichts nachzufassen, bei einer Absage nichts zu terminieren.
  const brauchtTermin = ausgang === 'Nächster Schritt vereinbart'
  // Wer nicht abgeschlossen und nicht abgesagt hat, wird nachgefasst — und
  // dafür entscheidet die Diagnose die Tonlage.
  const brauchtDiagnose = ausgang && ausgang !== 'Auftrag' && ausgang !== 'Absage'

  const speichern = async () => {
    if (!ausgang) { setFehler('Bitte den Ausgang des Gesprächs wählen.'); return }
    if (brauchtTermin && !termin?.start) {
      setFehler('„Nächster Schritt vereinbart" ohne Termin ist keiner — bitte buchen.')
      return
    }
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
            nachfass_grund: brauchtDiagnose ? grund : null,
            termin_folgetermin: termin?.start ? new Date(termin.start).toISOString() : null,
            meeting_link_folgetermin: termin?.meetingLink || null
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
    <div className="border-t border-outline-variant pt-6">
      <h3 className="text-label-lg font-medium text-on-surface-variant uppercase tracking-wide mb-3">
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
          <label className="block text-body-sm font-medium text-on-surface mb-2">
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
            <label className="block text-body-sm font-medium text-on-surface mb-1">
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

        {brauchtTermin && (
          <div>
            <label className="block text-body-sm font-medium text-on-surface mb-2">
              Folgetermin <span className="text-error">*</span>
            </label>

            {termin?.start ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-success-container rounded-lg">
                <div className="text-body-sm text-on-surface">
                  {new Date(termin.start).toLocaleString('de-DE', {
                    weekday: 'long', day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })} Uhr
                </div>
                <button
                  type="button"
                  onClick={() => { setTermin(null); setWaehlerOffen(true) }}
                  className="text-label-sm text-primary hover:underline shrink-0"
                >
                  ändern
                </button>
              </div>
            ) : waehlerOffen ? (
              <TerminPicker
                lead={{
                  id: lead?.originalLeadId,
                  unternehmen: lead?.unternehmen,
                  unternehmensname: lead?.unternehmen,
                  email: lead?.email,
                  telefon: lead?.telefonnummer,
                  ansprechpartnerVorname: lead?.ansprechpartnerVorname,
                  ansprechpartnerNachname: lead?.ansprechpartnerNachname,
                  stadt: lead?.ort
                }}
                zweck="folgetermin"
                nurBuchen
                onTerminBooked={(t) => { setTermin(t); setWaehlerOffen(false); setFehler('') }}
                onCancel={() => setWaehlerOffen(false)}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setWaehlerOffen(true)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <CalendarPlus className="w-4 h-4" /> Folgetermin buchen
                </button>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Ein gebuchter Termin schlägt jede Nachfass-Mail. Solange er
                  steht, geht nur die Einladung raus.
                </p>
              </>
            )}
          </div>
        )}

        {brauchtDiagnose && (
          <div>
            <label className="block text-body-sm font-medium text-on-surface mb-2">
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
