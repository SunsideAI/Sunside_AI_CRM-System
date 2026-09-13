import { useState, useEffect } from 'react'
import {
  Search, Calendar, Phone, Video, Loader2, User, Building2, MapPin,
  CheckCircle2, AlertCircle, Users, Mail, RefreshCw
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { STATUS, anzeigeName } from '../../shared/status.js'
import SlideDrawer from '../components/SlideDrawer'
import SetterUebergabe from '../components/SetterUebergabe'
import SetterPool from '../components/SetterPool'
import EmailComposer from '../components/EmailComposer'
import TerminPicker from '../components/TerminPicker'

// Die Arbeitsfläche des Setters — aufgebaut wie Opening und Closing.
//
// Bisher lag das alles in den Terminen, als Seitenbereich am Kalender. Das ist
// für den Kalender richtig, aber keine Arbeitsfläche: Der Setter braucht eine
// Liste seiner Kontakte, nicht einen Monat mit Kästchen.
//
// Was er hier tut: Termin fand statt, Gespräch dokumentieren, Abschlussgespräch
// legen, schreiben, zurückgeben.

// Die Stufen, in denen der Setter zuständig ist. Danach übernimmt der Closer.
const MEINE_STUFEN = [
  STATUS.BERATUNG_VEREINBART,
  STATUS.BERATUNG_GEFUEHRT,
  STATUS.TERMIN_ABGESAGT,
  STATUS.NICHT_ERSCHIENEN
]

const FILTER = [
  { wert: 'offen',    name: 'Anstehend',   stufen: [STATUS.BERATUNG_VEREINBART] },
  { wert: 'zu_tun',   name: 'Zu dokumentieren', stufen: [STATUS.BERATUNG_GEFUEHRT] },
  { wert: 'geplatzt', name: 'Geplatzt',    stufen: [STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN] },
  { wert: 'alle',     name: 'Alle',        stufen: MEINE_STUFEN }
]

function Setting() {
  const { user, isSetter, isAdmin } = useAuth()

  const [kontakte, setKontakte] = useState([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('offen')
  const [gewaehlt, setGewaehlt] = useState(null)
  const [mailOffen, setMailOffen] = useState(false)
  const [terminOffen, setTerminOffen] = useState(false)

  useEffect(() => { laden() }, [])

  const laden = async () => {
    setLaedt(true); setFehler('')
    try {
      // Admins sehen alles, sonst die eigenen. Der Server prüft das noch
      // einmal — der Filter hier ist Bequemlichkeit, keine Absicherung.
      const pfad = isAdmin()
        ? '/.netlify/functions/hot-leads'
        : `/.netlify/functions/hot-leads?setterName=${encodeURIComponent(user?.vor_nachname || '')}`

      const antwort = await fetch(pfad)
      const daten = await antwort.json()
      if (!antwort.ok) throw new Error(daten.error || 'Laden fehlgeschlagen')

      setKontakte((daten.hotLeads || []).filter(l => MEINE_STUFEN.includes(l.status)))
    } catch (e) {
      setFehler(e.message)
    } finally {
      setLaedt(false)
    }
  }

  if (!isSetter() && !isAdmin()) {
    return (
      <div className="card-elevated p-8 text-center">
        <Users className="w-10 h-10 text-on-surface-variant mx-auto mb-3" />
        <h2 className="text-title-md text-on-surface mb-1">Kein Zugang zum Setting</h2>
        <p className="text-body-md text-on-surface-variant">
          Diese Ansicht ist für Setter. Ein Admin kann dir die Rolle geben.
        </p>
      </div>
    )
  }

  const stufen = FILTER.find(f => f.wert === filter)?.stufen || MEINE_STUFEN
  const suchbegriff = suche.trim().toLowerCase()

  const sichtbar = kontakte
    .filter(l => stufen.includes(l.status))
    .filter(l => !suchbegriff
      || (l.unternehmen || '').toLowerCase().includes(suchbegriff)
      || `${l.ansprechpartnerVorname || ''} ${l.ansprechpartnerNachname || ''}`.toLowerCase().includes(suchbegriff))
    .sort((a, b) => new Date(a.terminDatum || 0) - new Date(b.terminDatum || 0))

  const zaehler = (wert) => {
    const s = FILTER.find(f => f.wert === wert)?.stufen || []
    return kontakte.filter(l => s.includes(l.status)).length
  }

  const terminText = (iso) => {
    if (!iso) return 'ohne Termin'
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    }) + ' Uhr'
  }

  const istVorbei = (iso) => iso && new Date(iso) < new Date()

  return (
    <div className="space-y-8">
      {/* Die Seite beginnt mit ihrem Titel, wie jede andere auch. Der Pool
          stand vorher darueber, weil er das Dringendste ist - das las sich
          aber, als gehoere er zu keiner Seite. */}
      <div>
        <h1 className="text-headline-md text-on-surface">Setting</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Deine Beratungsgespräche — halten, dokumentieren, an den Closer übergeben.
        </p>
      </div>

      {/* Beratungsgespräche ohne Setter — dieselbe Ansicht wie an den Terminen */}
      <SetterPool onGeaendert={laden} />

      {fehler && (
        <div className="bg-error-container rounded-xl p-4 text-error">{fehler}</div>
      )}

      {/* Filter und Suche — gleiches Layout wie Opening und Closing */}
      <div className="card-elevated p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Firma oder Ansprechpartner"
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={laden}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-surface-container"
          >
            <RefreshCw className="w-4 h-4" /> Neu laden
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {FILTER.map(f => (
            <button
              key={f.wert}
              onClick={() => setFilter(f.wert)}
              className={`px-3 py-1.5 rounded-full text-label-lg transition-colors ${
                filter === f.wert
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {f.name} ({zaehler(f.wert)})
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="card-elevated overflow-hidden min-h-[400px]">
        {laedt ? (
          <div className="flex items-center justify-center py-20 text-on-surface-variant">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Wird geladen …
          </div>
        ) : sichtbar.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            {filter === 'offen'
              ? 'Keine anstehenden Beratungsgespräche.'
              : 'Nichts in dieser Ansicht.'}
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {sichtbar.map(lead => (
              <button
                key={lead.id}
                onClick={() => { setGewaehlt(lead); setMailOffen(false); setTerminOffen(false) }}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-container transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  lead.status === STATUS.BERATUNG_GEFUEHRT ? 'bg-amber-100' :
                  lead.status === STATUS.BERATUNG_VEREINBART ? 'bg-secondary-container' : 'bg-rose-100'
                }`}>
                  {lead.terminart === 'Video'
                    ? <Video className="w-5 h-5 text-on-surface-variant" />
                    : <Phone className="w-5 h-5 text-on-surface-variant" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-medium text-on-surface truncate">
                    {lead.unternehmen || 'Ohne Namen'}
                  </div>
                  <div className="text-body-sm text-on-surface-variant truncate">
                    {[lead.ansprechpartnerVorname, lead.ansprechpartnerNachname].filter(Boolean).join(' ')}
                    {lead.ort && <> · {lead.ort}</>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-body-sm ${
                    istVorbei(lead.terminDatum) && lead.status === STATUS.BERATUNG_VEREINBART
                      ? 'text-amber-700 font-medium' : 'text-on-surface-variant'
                  }`}>
                    {terminText(lead.terminDatum)}
                  </div>
                  <div className="text-label-sm text-on-surface-variant">
                    {anzeigeName(lead.status)}
                  </div>
                </div>

                {/* Der Termin ist vorbei, aber niemand hat bestätigt, dass er
                    stattfand — das ist die Arbeit, die hier liegt. */}
                {istVorbei(lead.terminDatum) && lead.status === STATUS.BERATUNG_VEREINBART && (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                {lead.status === STATUS.BERATUNG_GEFUEHRT && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detailansicht */}
      <SlideDrawer
        isOpen={!!gewaehlt}
        onClose={() => { setGewaehlt(null); setMailOffen(false); setTerminOffen(false) }}
        title={gewaehlt?.unternehmen || 'Kontakt'}
        width="max-w-2xl"
      >
        {gewaehlt && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-body-md">
              <div>
                <p className="text-body-sm text-on-surface-variant">Ansprechpartner</p>
                <p className="text-on-surface">
                  {[gewaehlt.ansprechpartnerVorname, gewaehlt.ansprechpartnerNachname]
                    .filter(Boolean).join(' ') || '–'}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-on-surface-variant">Termin</p>
                <p className="text-on-surface">{terminText(gewaehlt.terminDatum)}</p>
              </div>
              {gewaehlt.telefon && (
                <div>
                  <p className="text-body-sm text-on-surface-variant">Telefon</p>
                  <a href={`tel:${gewaehlt.telefon}`} className="text-primary hover:underline">
                    {gewaehlt.telefon}
                  </a>
                </div>
              )}
              {gewaehlt.email && (
                <div className="min-w-0">
                  <p className="text-body-sm text-on-surface-variant">E-Mail</p>
                  <p className="text-on-surface truncate">{gewaehlt.email}</p>
                </div>
              )}
            </div>

            {gewaehlt.meeting_link && (
              <a
                href={gewaehlt.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 p-3 bg-primary-fixed/30 border border-primary-fixed-dim
                           rounded-lg text-primary hover:bg-secondary-container"
              >
                <Video className="w-4 h-4" /> Video-Meeting beitreten
              </a>
            )}

            {/* Was der Opener aufgenommen hat — der Setter geht damit ins Gespräch */}
            {(gewaehlt.schmerzpunkt_wortlaut || gewaehlt.ziel) && (
              <div className="p-3 bg-surface-container rounded-lg space-y-2">
                <p className="text-label-lg text-on-surface">Aus dem Erstanruf</p>
                {gewaehlt.ziel && (
                  <p className="text-body-sm text-on-surface-variant">
                    <span className="text-on-surface">Ziel:</span> {gewaehlt.ziel}
                  </p>
                )}
                {gewaehlt.schmerzpunkt_wortlaut && (
                  <p className="text-body-sm text-on-surface-variant">
                    <span className="text-on-surface">Größtes Problem:</span> „{gewaehlt.schmerzpunkt_wortlaut}"
                  </p>
                )}
                {gewaehlt.berufsgruppe && (
                  <p className="text-body-sm text-on-surface-variant">
                    <span className="text-on-surface">Berufsgruppe:</span> {gewaehlt.berufsgruppe}
                  </p>
                )}
              </div>
            )}

            {/* Schreiben geht immer, unabhängig von der Stufe */}
            <div className="border-t pt-4">
              {mailOffen ? (
                <EmailComposer
                  hotLeadId={gewaehlt.id}
                  lead={{
                    id: gewaehlt.originalLeadId || gewaehlt.id,
                    unternehmensname: gewaehlt.unternehmen,
                    email: gewaehlt.email,
                    telefon: gewaehlt.telefon,
                    ort: gewaehlt.ort,
                    ansprechpartnerVorname: gewaehlt.ansprechpartnerVorname,
                    ansprechpartnerNachname: gewaehlt.ansprechpartnerNachname
                  }}
                  user={user}
                  inline={true}
                  kategorie="Setting"
                  onClose={() => setMailOffen(false)}
                  onSent={() => setMailOffen(false)}
                />
              ) : (
                <button
                  onClick={() => setMailOffen(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-primary-fixed-dim
                             text-primary rounded-lg hover:bg-primary-fixed/30"
                >
                  <Mail className="w-4 h-4" /> E-Mail an den Kontakt
                </button>
              )}
            </div>

            {/* Geplatzte Termine: neu legen */}
            {[STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN].includes(gewaehlt.status) && (
              <div className="border-t pt-4">
                {terminOffen ? (
                  <TerminPicker
                    lead={{ id: gewaehlt.originalLeadId, unternehmensname: gewaehlt.unternehmen }}
                    hotLeadId={gewaehlt.id}
                    onTerminBooked={() => { setTerminOffen(false); setGewaehlt(null); laden() }}
                    onCancel={() => setTerminOffen(false)}
                  />
                ) : (
                  <button
                    onClick={() => setTerminOffen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white
                               rounded-lg hover:bg-orange-600"
                  >
                    <Calendar className="w-4 h-4" /> Neuen Termin buchen
                  </button>
                )}
              </div>
            )}

            {/* Termin fand statt, Übergabe an den Closer, Rückgabe */}
            <SetterUebergabe
              lead={gewaehlt}
              onGespeichert={() => { setGewaehlt(null); laden() }}
            />
          </div>
        )}
      </SlideDrawer>
    </div>
  )
}

export default Setting
