import { useState, useEffect } from 'react'
import { Users, Loader2, Send, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { STATUS } from '../../shared/status.js'

// Der Setter-Pool: Beratungsgespräche, für die noch niemand eingeteilt ist.
//
// Gleiche Mechanik wie der Closer-Pool (F6), nur eine Stufe früher. Bewerben
// statt zugreifen - ein Admin entscheidet. Wer den Kontakt selbst am Telefon
// hatte, wird dem Admin dabei sichtbar markiert.

export default function SetterPool({ onGeaendert }) {
  const { user, isSetter, isAdmin } = useAuth()
  const [termine, setTermine] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [beworben, setBeworben] = useState({})
  const [sendet, setSendet] = useState(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => { laden() }, [])

  const laden = async () => {
    setLaedt(true)
    try {
      const antwort = await fetch('/.netlify/functions/hot-leads?pool=setter')
      const daten = await antwort.json()
      // Nur was noch bevorsteht - vergangene Termine ohne Setter sind ein Fall
      // für den Alarm, nicht für die Bewerbung.
      const offen = (daten.hotLeads || []).filter(l =>
        l.status === STATUS.BERATUNG_VEREINBART &&
        l.terminDatum && new Date(l.terminDatum) > new Date())
      setTermine(offen.sort((a, b) => new Date(a.terminDatum) - new Date(b.terminDatum)))
    } catch (e) {
      setFehler('Pool konnte nicht geladen werden: ' + e.message)
    } finally {
      setLaedt(false)
    }
  }

  const bewerben = async (lead) => {
    setSendet(lead.id); setFehler('')
    try {
      const antwort = await fetch('/.netlify/functions/hot-lead-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stufe: 'Setter', hotLeadId: lead.id })
      })
      const daten = await antwort.json()
      if (!antwort.ok) { setFehler(daten.error || 'Bewerbung fehlgeschlagen'); return }
      setBeworben(b => ({ ...b, [lead.id]: true }))
      onGeaendert?.()
    } catch (e) {
      setFehler('Netzwerkfehler: ' + e.message)
    } finally {
      setSendet(null)
    }
  }

  if (!isSetter() && !isAdmin()) return null
  if (laedt) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Pool wird geladen …
      </div>
    )
  }
  if (termine.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-purple-600" />
        <h3 className="font-medium text-gray-900">
          Beratungsgespräche ohne Setter ({termine.length})
        </h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Ein Admin teilt zu. Wer den Kontakt selbst am Telefon hatte, wird dabei
        sichtbar markiert — das ist kein Hindernis, nur Transparenz.
      </p>

      {fehler && <p className="mb-3 text-sm text-red-600">{fehler}</p>}

      <div className="space-y-2">
        {termine.map(lead => {
          const eigeneVorarbeit = lead.openerId === user?.id
          return (
            <div key={lead.id}
                 className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {lead.unternehmen || 'Ohne Namen'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(lead.terminDatum).toLocaleString('de-DE', {
                    weekday: 'short', day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
                  })} Uhr
                  {lead.openerName && <> · gelegt von {lead.openerName}</>}
                  {eigeneVorarbeit && (
                    <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                      dein Erstanruf
                    </span>
                  )}
                </div>
              </div>

              {beworben[lead.id] ? (
                <span className="flex items-center gap-1 text-sm text-green-700 shrink-0">
                  <Check className="w-4 h-4" /> beworben
                </span>
              ) : (
                <button
                  onClick={() => bewerben(lead)}
                  disabled={sendet === lead.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white
                             rounded-lg hover:bg-purple-700 disabled:opacity-50 shrink-0"
                >
                  {sendet === lead.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                  Übernehmen
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
