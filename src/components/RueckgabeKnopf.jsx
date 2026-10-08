import { useState, useEffect, useRef } from 'react'
import { Undo2, Loader2 } from 'lucide-react'
import { ruecknahmeZiel, anzeigeName } from '../../shared/status.js'

/**
 * „Zurück an den Vorgänger" — genau eine Stufe, mit Pflicht-Grund.
 *
 * Aus F24: „Wenn wichtige Infos fehlen, geht der Kontakt mit einem Satz
 * Begründung zurück. Das ist kein Vorwurf, sondern hält die Qualität der
 * Übergaben hoch." Der Ton der Oberfläche folgt dem — kein Warnrot, keine
 * Fehlermeldung.
 *
 * Eigene Aktion und kein gewöhnlicher Statuswechsel: Nur so bleibt die
 * Rückgabequote zählbar.
 */
/* Zwei Bauweisen, eine Komponente.

   Im Setting steht der Knopf am Ende des Formulars und oeffnet sich selbst.
   Im Closing gehoert er ins Aktionsmenue der Fussleiste - dort stand er
   vorher oben unter den Kontaktdaten, vor allem, was man wirklich sucht.
   Wird `offen` von aussen gesetzt, zeigt die Komponente keinen eigenen Knopf
   mehr, sondern nur noch den Dialog. */
export default function RueckgabeKnopf({ hotLead, onErledigt, offen: vonAussen, onSchliessen }) {
  const gesteuert = vonAussen !== undefined
  const [offenIntern, setOffenIntern] = useState(false)
  const offen = gesteuert ? vonAussen : offenIntern
  const schliessen = () => gesteuert ? onSchliessen?.() : setOffenIntern(false)
  const [grund, setGrund] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const kasten = useRef(null)

  /* Aus dem Menue in der Fussleiste geoeffnet, steht der Dialog weiter oben
     in der Schublade - ausserhalb des Blickfelds. Also hinscrollen. */
  useEffect(() => {
    if (offen && gesteuert) kasten.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [offen, gesteuert])

  const ziel = ruecknahmeZiel(hotLead?.status)
  if (!ziel) return null   // aus dieser Stufe gibt es keinen Schritt zurück

  const zurueckgeben = async () => {
    if (!grund.trim()) { setFehler('Bitte einen Satz zur Begründung.'); return }
    setLaeuft(true); setFehler('')
    try {
      const antwort = await fetch('/.netlify/functions/hot-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'zurueck-an-vorgaenger',
          hotLeadId: hotLead.id,
          grund: grund.trim()
        })
      })
      const daten = await antwort.json()
      if (!antwort.ok) { setFehler(daten.error || 'Rückgabe fehlgeschlagen'); return }
      schliessen(); setGrund('')
      onErledigt?.()
    } catch (e) {
      setFehler('Netzwerkfehler: ' + e.message)
    } finally {
      setLaeuft(false)
    }
  }

  if (!offen) {
    // Von aussen gesteuert: Der Knopf steckt im Menue, hier bleibt nichts.
    if (gesteuert) return null
    return (
      <button
        onClick={() => setOffenIntern(true)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <Undo2 className="w-4 h-4" />
        Zurück an den Vorgänger
      </button>
    )
  }

  return (
    <div ref={kasten} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
      <p className="text-sm text-gray-700">
        Der Kontakt geht zurück auf „{anzeigeName(ziel)}". Der Vorgänger bekommt
        eine Nachricht mit deiner Begründung.
      </p>
      <textarea
        rows={2}
        value={grund}
        onChange={e => setGrund(e.target.value)}
        placeholder="Was fehlt?"
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary"
      />
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      <div className="flex gap-2">
        <button
          onClick={zurueckgeben}
          disabled={laeuft}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 text-white
                     rounded-lg hover:bg-gray-900 disabled:opacity-50"
        >
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
          Zurückgeben
        </button>
        <button
          onClick={() => { schliessen(); setFehler('') }}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
