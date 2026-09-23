import { useState, useEffect } from 'react'
import { Users, Video, Phone, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { STATUS } from '../../shared/status.js'
import LeadPool from './LeadPool'
import Uebergabeblatt, { UEBERGABE_1 } from './Uebergabeblatt'

// Der Setter-Pool: Beratungsgespräche, für die noch niemand eingeteilt ist.
//
// Aufbau, Tabelle und Schublade kommen aus LeadPool und sehen darum aus wie im
// Opening und im Closing. Anders ist nur die Aktion: Der Setter nimmt sich den
// Termin selbst, ein Admin muss nichts freigeben (Stand 23.09.2026). Wer den
// Kontakt selbst am Telefon hatte, wird dabei sichtbar markiert.

// `alsAnsicht` heisst: Der Pool ist die Seite, nicht ein Kasten darueber.
// Dann traegt die Kopfzeile der Seite den Titel, und hier waere er doppelt.
// `onAnzahl` meldet die Zahl nach oben, damit der Umschalter sie zeigen kann,
// ohne dieselbe Abfrage ein zweites Mal zu stellen.
export default function SetterPool({ onGeaendert, onAnzahl, alsAnsicht = false }) {
  const { user, isSetter, isAdmin } = useAuth()
  const [termine, setTermine] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [beworben, setBeworben] = useState({})
  const [sendet, setSendet] = useState(null)
  const [fehler, setFehler] = useState('')

  // Erst fragen, wer hier sitzt: Der Pool gehoert den Settern, und der Server
  // antwortet allen anderen mit 403.
  const zustaendig = isSetter() || isAdmin()
  useEffect(() => { if (zustaendig) laden() }, [zustaendig])

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
      const sortiert = offen.sort((a, b) => new Date(a.terminDatum) - new Date(b.terminDatum))
      setTermine(sortiert)
      onAnzahl?.(sortiert.length)
    } catch (e) {
      setFehler('Pool konnte nicht geladen werden: ' + e.message)
    } finally {
      setLaedt(false)
    }
  }

  const uebernehmen = async (eintrag, schliessen) => {
    const lead = eintrag.roh
    setSendet(lead.id); setFehler('')
    try {
      const antwort = await fetch('/.netlify/functions/hot-lead-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stufe: 'Setter', hotLeadId: lead.id })
      })
      const daten = await antwort.json()
      if (!antwort.ok) { setFehler(daten.error || 'Übernehmen fehlgeschlagen'); return }
      // Die Function sagt, was passiert ist: direkt übernommen oder beworben.
      // Das hängt am Schalter in den Einstellungen, den das Frontend nicht
      // kennen muss.
      setBeworben(b => ({ ...b, [lead.id]: daten.direkt ? 'uebernommen' : 'beworben' }))
      schliessen?.()
      onGeaendert?.()
    } catch (e) {
      setFehler('Netzwerkfehler: ' + e.message)
    } finally {
      setSendet(null)
    }
  }

  if (!zustaendig) return null
  // Als Kasten über dem Kalender: Ist nichts da, steht dort auch nichts.
  if (!alsAnsicht && !laedt && termine.length === 0) return null

  const eintraege = termine.map(l => ({
    id: l.id,
    unternehmen: l.unternehmen,
    untertitel: [l.kategorie, l.ort].filter(Boolean).join(' · '),
    ansprechpartner: [l.ansprechpartnerVorname, l.ansprechpartnerNachname].filter(Boolean).join(' '),
    ort: l.ort,
    terminDatum: l.terminDatum,
    art: { icon: l.terminart === 'Video' ? Video : Phone },
    hinweis: l.openerId === user?.id
      ? 'dein Erstanruf'
      : l.openerName ? `gelegt von ${l.openerName}` : null,
    roh: l
  }))

  const pool = (
    <LeadPool
      kompakt={!alsAnsicht}
      eintraege={eintraege}
      laedt={laedt}
      fehler={fehler}
      leerText="Kein Beratungsgespräch wartet auf einen Setter."
      leerIcon={Users}
      aktion={{ text: 'Übernehmen', icon: CheckCircle2 }}
      laufend={sendet}
      erledigt={beworben}
      onAktion={uebernehmen}
      schublade={(e) => ({
        kontakt: {
          ansprechpartner: e.ansprechpartner,
          statusFeld: 'Beratungsgespräch vereinbart',
          telefon: e.roh.telefon,
          email: e.roh.email,
          website: e.roh.website,
          ort: e.roh.ort,
          rollen: { opener: e.roh.openerName }
        },
        termin: {
          datum: e.terminDatum && new Date(e.terminDatum).toLocaleString('de-DE', {
            weekday: 'long', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
          }) + ' Uhr',
          art: e.roh.terminart || 'Telefonisch'
        },
        uebergabe: <Uebergabeblatt lead={e.roh} bereiche={[UEBERGABE_1]} />,
        verlauf: { hotLeadId: e.roh.id, leadId: e.roh.originalLeadId }
      })}
    />
  )

  if (alsAnsicht) return pool

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="text-title-md font-medium text-on-surface">
          Beratungsgespräche ohne Setter ({termine.length})
        </h3>
      </div>
      {pool}
    </div>
  )
}
