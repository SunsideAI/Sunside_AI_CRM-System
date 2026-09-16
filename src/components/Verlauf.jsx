import { useState, useEffect } from 'react'
import {
  Loader2, Phone, Mail, Calendar, CalendarX, CalendarClock, CheckCircle2,
  MessageSquare, Bell, XCircle, Trophy, Pencil, Euro, FileSearch, RotateCcw, Circle
} from 'lucide-react'

/**
 * Die Zeitleiste eines Kontakts — was wann passiert ist.
 *
 * Bis hierher stand alles als Text im Kommentarfeld, oben angehängt. Das
 * ließ sich lesen, aber nicht überblicken: Wann wurde er kontaktiert, wann
 * ging welche Mail raus, wann wurde der Termin verschoben.
 */

// Jede Art bekommt Symbol und Farbe. Die Farbe trägt keine Wertung außer bei
// gewonnen und verloren — dort ist sie die Aussage.
const ARTEN = {
  kontaktiert:       { symbol: Phone,         farbe: 'text-primary',    name: 'Kontaktiert' },
  anruf:             { symbol: Phone,         farbe: 'text-primary',    name: 'Anwahl' },
  mail:              { symbol: Mail,          farbe: 'text-primary',    name: 'E-Mail' },
  termin:            { symbol: Calendar,      farbe: 'text-primary',    name: 'Termin' },
  termin_verschoben: { symbol: CalendarClock,  farbe: 'text-warning',    name: 'Verschoben' },
  termin_abgesagt:   { symbol: CalendarX,      farbe: 'text-error',      name: 'Abgesagt' },
  ergebnis:          { symbol: CheckCircle2,   farbe: 'text-on-surface-variant', name: 'Ergebnis' },
  notiz:             { symbol: MessageSquare,  farbe: 'text-on-surface-variant', name: 'Notiz' },
  wiedervorlage:     { symbol: Bell,           farbe: 'text-on-surface-variant', name: 'Wiedervorlage' },
  verloren:          { symbol: XCircle,        farbe: 'text-error',      name: 'Verloren' },
  gewonnen:          { symbol: Trophy,         farbe: 'text-success',    name: 'Gewonnen' },
  feld_geaendert:    { symbol: Pencil,         farbe: 'text-on-surface-variant', name: 'Geändert' },
  angebot:           { symbol: Euro,           farbe: 'text-primary',    name: 'Angebot' },
  analyse:           { symbol: FileSearch,     farbe: 'text-primary',    name: 'Analyse' },
  zurueckgesetzt:    { symbol: RotateCcw,      farbe: 'text-on-surface-variant', name: 'Zurückgesetzt' },
  status:            { symbol: CheckCircle2,   farbe: 'text-primary',    name: 'Status' },
  rueckgabe:         { symbol: RotateCcw,      farbe: 'text-warning',    name: 'Rückgabe' },
  zuteilung:         { symbol: RotateCcw,      farbe: 'text-on-surface-variant', name: 'Zuteilung' },
  sonstiges:         { symbol: Circle,         farbe: 'text-on-surface-variant', name: 'Eintrag' }
}

// Nicht jede Art einzeln zur Auswahl stellen — das wären achtzehn Knöpfe.
// Vier Gruppen decken ab, wonach man wirklich sucht.
const GRUPPEN = [
  { wert: '',          name: 'Alles' },
  { wert: 'kontaktiert,anruf,mail', name: 'Kontakt' },
  { wert: 'termin,termin_verschoben,termin_abgesagt', name: 'Termine' },
  { wert: 'notiz',     name: 'Notizen' }
]

const datum = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
const uhrzeit = (iso) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export default function Verlauf({ leadId, hotLeadId }) {
  const [eintraege, setEintraege] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [gruppe, setGruppe] = useState('')
  const [vollstaendig, setVollstaendig] = useState(true)

  useEffect(() => { laden() }, [leadId, hotLeadId, gruppe])

  const laden = async () => {
    if (!leadId && !hotLeadId) return
    setLaedt(true); setFehler('')
    try {
      const p = new URLSearchParams()
      if (hotLeadId) p.append('hotLeadId', hotLeadId)
      else p.append('leadId', leadId)
      if (gruppe) p.append('art', gruppe)

      const antwort = await fetch(`/.netlify/functions/verlauf?${p}`)
      const daten = await antwort.json()
      if (!antwort.ok) throw new Error(daten.error || 'Verlauf konnte nicht geladen werden')
      setEintraege(daten.verlauf || [])
      setVollstaendig(daten.vollstaendig !== false)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaedt(false)
    }
  }

  if (laedt) {
    return (
      <div className="flex items-center gap-2 py-6 text-on-surface-variant text-body-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Verlauf wird geladen …
      </div>
    )
  }

  if (fehler) {
    return <div className="py-4 text-body-sm text-error">{fehler}</div>
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {GRUPPEN.map(g => (
          <button
            key={g.wert}
            onClick={() => setGruppe(g.wert)}
            className={`px-3 py-1 rounded-full text-label-sm transition-colors ${
              gruppe === g.wert
                ? 'bg-primary text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {eintraege.length === 0 ? (
        <div className="py-6 text-center text-body-sm text-on-surface-variant">
          {gruppe ? 'Nichts in dieser Auswahl.' : 'Für diesen Kontakt ist noch nichts festgehalten.'}
        </div>
      ) : (
        <ol className="relative">
          {/* Die durchgehende Linie macht aus Einträgen eine Strecke. */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-outline-variant" aria-hidden="true" />

          {eintraege.map((e, i) => {
            const art = ARTEN[e.art] || ARTEN.sonstiges
            const Symbol = art.symbol
            const vorher = eintraege[i - 1]
            const neuerTag = !vorher || datum(vorher.wann) !== datum(e.wann)

            return (
              <li key={`${e.wann}-${i}`} className="relative pl-8 pb-4">
                <span className={`absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full
                                  bg-surface flex items-center justify-center ${art.farbe}`}>
                  <Symbol className="w-4 h-4" />
                </span>

                {neuerTag && (
                  <div className="text-label-sm text-on-surface-variant mb-0.5">{datum(e.wann)}</div>
                )}

                <div className="text-body-sm text-on-surface">{e.titel}</div>

                <div className="text-label-sm text-on-surface-variant mt-0.5">
                  {uhrzeit(e.wann)} Uhr · {art.name}
                  {e.akteur && <> · {e.akteur}</>}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {!vollstaendig && (
        <div className="text-label-sm text-on-surface-variant pt-2 border-t border-outline-variant">
          Es werden die neuesten 500 Einträge gezeigt. Ältere gibt es, sie stehen
          im Kommentarfeld.
        </div>
      )}
    </div>
  )
}
