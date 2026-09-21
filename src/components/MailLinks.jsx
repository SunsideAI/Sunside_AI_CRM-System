import { useState, useEffect } from 'react'
import { Loader2, Link as LinkIcon, AlertTriangle, Check } from 'lucide-react'

// Die Links, die in die Mailvorlagen eingesetzt werden: {Video-Link} in der
// Segment-Mail nach dem Erstanruf, {VSL-Link} in der Bestätigungsmail nach dem
// Beratungsgespräch. Welcher Link zu welchem Kontakt gehört, entscheidet das
// Segment (shared/mailvorlagen.js). Leer heißt: Der Platzhalter bleibt stehen,
// und der Mail-Dialog lässt nicht senden, bis ihn jemand von Hand füllt.

const LINKS = [
  { schluessel: 'link_video_streil', titel: 'Video Michael Streil', wofuer: 'Segment-Mail Eigentümer; bei Kaufinteressenten, solange das Käufer-Video fehlt' },
  { schluessel: 'link_video_beier', titel: 'Video Patrick Beier', wofuer: 'Segment-Mail Automatisierung, Sachverständige und Vorhaben' },
  { schluessel: 'link_video_kaeufer', titel: 'Käufer-Video', wofuer: 'Segment-Mail Kaufinteressenten, sobald es gedreht ist' },
  { schluessel: 'link_vsl_eigentuemer', titel: 'VSL Eigentümergewinnung', wofuer: 'Bestätigungsmail Eigentümer; bis zum Dreh das Loom-Video' },
  { schluessel: 'link_vsl_automatisierung', titel: 'VSL Automatisierung', wofuer: 'Bestätigungsmail Automatisierung, Vorhaben und Sachverständige' },
  { schluessel: 'link_vsl_propstack', titel: 'VSL Automatisierung, Propstack', wofuer: 'Fassung für Propstack-Kunden, zum Austauschen in der Mail' },
  { schluessel: 'link_vsl_pipedrive', titel: 'VSL Automatisierung, Pipedrive', wofuer: 'Fassung für Pipedrive-Kunden, zum Austauschen in der Mail' },
  { schluessel: 'link_vsl_kaeufer', titel: 'VSL Kaufinteressenten', wofuer: 'Bestätigungsmail Kaufinteressenten (noch offen)' }
]

export default function MailLinks() {
  const [werte, setWerte] = useState({})
  const [laedt, setLaedt] = useState(true)
  const [gespeichert, setGespeichert] = useState(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    fetch('/.netlify/functions/einstellungen')
      .then(r => r.json())
      .then(d => setWerte(Object.fromEntries(
        Object.entries(d.einstellungen || {}).map(([k, v]) => [k, v.wert || '']))))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false))
  }, [])

  const speichern = async (schluessel) => {
    setFehler(''); setGespeichert(null)
    try {
      const antwort = await fetch('/.netlify/functions/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schluessel, wert: werte[schluessel] || '' })
      })
      const daten = await antwort.json()
      if (!antwort.ok) throw new Error(daten.error || 'Speichern fehlgeschlagen')
      setGespeichert(schluessel)
    } catch (e) {
      setFehler(e.message)
    }
  }

  if (laedt) {
    return (
      <div className="card-elevated p-6 flex items-center gap-2 text-on-surface-variant">
        <Loader2 className="w-4 h-4 animate-spin" /> Links werden geladen …
      </div>
    )
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center gap-2 mb-1">
        <LinkIcon className="w-5 h-5 text-primary" />
        <h3 className="font-medium text-on-surface">Videos in den Mails</h3>
      </div>
      <p className="text-body-sm text-on-surface-variant mb-5">
        Diese Links setzt das CRM in die Mailvorlagen ein. Fehlt einer, muss ihn der Absender von Hand einfügen.
      </p>

      {fehler && (
        <div className="flex gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {fehler}
        </div>
      )}

      <div className="space-y-3">
        {LINKS.map(({ schluessel, titel, wofuer }) => (
          <div key={schluessel} className="p-4 bg-surface-container rounded-lg">
            <div className="font-medium text-sm text-on-surface">{titel}</div>
            <div className="text-xs text-on-surface-variant mb-2">{wofuer}</div>
            <div className="flex gap-2">
              <input
                type="url"
                value={werte[schluessel] || ''}
                onChange={e => { setWerte(w => ({ ...w, [schluessel]: e.target.value })); setGespeichert(null) }}
                onBlur={() => speichern(schluessel)}
                placeholder="https://…"
                className="input-field flex-1"
              />
              {gespeichert === schluessel && <Check className="w-5 h-5 text-green-600 self-center" aria-label="gespeichert" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
