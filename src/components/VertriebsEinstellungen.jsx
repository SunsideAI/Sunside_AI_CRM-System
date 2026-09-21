import { useState, useEffect } from 'react'
import { Loader2, UserCheck, AlertTriangle } from 'lucide-react'

// Zwei Schalter: Muss auf einer Stufe beworben werden, oder darf direkt
// übernommen werden?
//
// Getrennt je Stufe, weil die Lage unterschiedlich sein kann: Beim Setting
// kann Tempo wichtiger sein als Auswahl, beim Closing umgekehrt.

const TEXTE = {
  bewerbung_pflicht_setter: {
    titel: 'Beratungsgespräche: Bewerbung nötig',
    an:  'Setter bewerben sich, ein Admin teilt zu.',
    aus: 'Setter übernehmen Beratungsgespräche direkt. Wer zuerst kommt, bekommt den Termin.'
  },
  bewerbung_pflicht_closer: {
    titel: 'Abschlussgespräche: Bewerbung nötig',
    an:  'Closer bewerben sich, ein Admin teilt zu.',
    aus: 'Closer übernehmen Leads direkt. Wer zuerst kommt, bekommt den Lead.'
  },
  osc_fristen_aktiv: {
    titel: 'Erinnerungen beim Nachfassen',
    an:  'Das CRM erinnert an geplatzte Termine nach 48 Stunden, vertagte Beratungen, stille Nachfass-Kontakte, den Zweifler nach 14 Tagen und den Abschied nach fünf Versuchen.',
    aus: 'Aus bis zum Go-live. Die übrigen Erinnerungen laufen unabhängig davon.'
  }
}

export default function VertriebsEinstellungen() {
  const [werte, setWerte] = useState(null)
  const [laedt, setLaedt] = useState(true)
  const [speichert, setSpeichert] = useState(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => { laden() }, [])

  const laden = async () => {
    try {
      const antwort = await fetch('/.netlify/functions/einstellungen')
      const daten = await antwort.json()
      if (!antwort.ok) throw new Error(daten.error || 'Laden fehlgeschlagen')
      setWerte(daten.einstellungen || {})
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaedt(false)
    }
  }

  const umschalten = async (schluessel, an) => {
    setSpeichert(schluessel); setFehler('')
    // Sofort anzeigen, damit der Schalter nicht klebt.
    setWerte(w => ({ ...w, [schluessel]: { ...w[schluessel], an } }))
    try {
      const antwort = await fetch('/.netlify/functions/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schluessel, an })
      })
      const daten = await antwort.json()
      if (!antwort.ok) throw new Error(daten.error || 'Speichern fehlgeschlagen')
    } catch (e) {
      setFehler(e.message)
      // Bei Fehler zurückdrehen - sonst zeigt die Oberfläche etwas an,
      // das so nicht gespeichert ist.
      setWerte(w => ({ ...w, [schluessel]: { ...w[schluessel], an: !an } }))
    } finally {
      setSpeichert(null)
    }
  }

  if (laedt) {
    return (
      <div className="card-elevated p-6 flex items-center gap-2 text-on-surface-variant">
        <Loader2 className="w-4 h-4 animate-spin" /> Einstellungen werden geladen …
      </div>
    )
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck className="w-5 h-5 text-primary" />
        <h3 className="font-medium text-on-surface">Zuteilung von Terminen</h3>
      </div>
      <p className="text-body-sm text-on-surface-variant mb-5">
        Je Stufe getrennt einstellbar.
      </p>

      {fehler && (
        <div className="flex gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {fehler}
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(TEXTE).map(([schluessel, text]) => {
          const an = werte?.[schluessel]?.an ?? true
          return (
            <div key={schluessel}
                 className="flex items-start justify-between gap-4 p-4 bg-surface-container rounded-lg">
              <div className="min-w-0">
                <div className="font-medium text-sm text-on-surface">{text.titel}</div>
                <div className="text-body-sm text-on-surface-variant mt-0.5">
                  {an ? text.an : text.aus}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={an}
                aria-label={text.titel}
                disabled={speichert === schluessel}
                onClick={() => umschalten(schluessel, !an)}
                className={`relative shrink-0 w-12 h-6 rounded-full transition-colors
                            disabled:opacity-50 ${an ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
                                  transition-transform ${an ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-on-surface-variant mt-4">
        Auch bei „direkt übernehmen" wird festgehalten, wer wann übernommen hat.
        Die Zuteilung bleibt nachvollziehbar, sie braucht nur keine Freigabe mehr.
      </p>
    </div>
  )
}
