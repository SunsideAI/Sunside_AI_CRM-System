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
import Verlauf from '../components/Verlauf'
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
          {/* input-field und der runde Neu-laden-Knopf wie in Opening —
              vorher standen hier eigene Klassen, die fast, aber nicht ganz
              gleich aussahen. */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
            <input
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Firma, Name, Ort suchen..."
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={laden}
            disabled={laedt}
            aria-label="Neu laden"
            className="p-2.5 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors shadow-ambient-sm shrink-0"
          >
            <RefreshCw className={`w-5 h-5 text-on-surface-variant ${laedt ? 'animate-spin' : ''}`} />
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

      {/* Liste. Dieselbe Tabelle wie in Opening und Closing: gleiche
          Kopfzeile, gleiche Zeilenfarben im Wechsel, gleiche Regeln dafür,
          welche Spalte auf schmalen Schirmen wegfällt. Vorher stand hier eine
          Kartenliste — dieselbe Arbeit sah je nach Tab anders aus. */}
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
          <table className="w-full">
            <thead>
              <tr className="bg-surface-container">
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                  Art
                </th>
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                  Unternehmen
                </th>
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                  Ansprechpartner
                </th>
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">
                  Ort
                </th>
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                  Termin
                </th>
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sichtbar.map((lead, index) => {
                const ueberfaellig = istVorbei(lead.terminDatum)
                  && lead.status === STATUS.BERATUNG_VEREINBART
                return (
                  <tr
                    key={lead.id}
                    onClick={() => { setGewaehlt(lead); setMailOffen(false); setTerminOffen(false) }}
                    className={`table-row cursor-pointer ${index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}
                  >
                    <td className="px-4 py-4">
                      <div className={`p-1.5 rounded-lg inline-flex ${
                        lead.status === STATUS.BERATUNG_GEFUEHRT
                          ? 'bg-success-container text-success'
                          : lead.status === STATUS.BERATUNG_VEREINBART
                          ? 'bg-secondary-container text-primary'
                          : 'bg-error-container text-error'
                      }`}>
                        {lead.terminart === 'Video'
                          ? <Video className="w-4 h-4" />
                          : <Phone className="w-4 h-4" />}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-on-surface truncate max-w-[22rem]">
                        {lead.unternehmen || 'Ohne Namen'}
                      </div>
                      {/* Auf schmalen Schirmen fehlen die eigenen Spalten —
                          dann steht der Ansprechpartner hier mit drunter. */}
                      <div className="text-body-sm text-on-surface-variant truncate md:hidden">
                        {[lead.ansprechpartnerVorname, lead.ansprechpartnerNachname].filter(Boolean).join(' ')}
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell text-body-sm text-on-surface-variant">
                      {[lead.ansprechpartnerVorname, lead.ansprechpartnerNachname].filter(Boolean).join(' ') || '—'}
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell text-body-sm text-on-surface-variant">
                      {lead.ort || '—'}
                    </td>

                    <td className="px-4 py-4">
                      <div className={`text-body-sm flex items-center gap-1.5 ${
                        ueberfaellig ? 'text-warning font-medium' : 'text-on-surface-variant'
                      }`}>
                        {ueberfaellig && <AlertCircle className="w-4 h-4 shrink-0" />}
                        {terminText(lead.terminDatum)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
                        {lead.status === STATUS.BERATUNG_GEFUEHRT && (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        )}
                        {anzeigeName(lead.status)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

            {/* Die Strecke des Kontakts: was wann passiert ist. */}
            <details className="border border-outline-variant rounded-lg">
              <summary className="px-3 py-2 cursor-pointer text-label-lg text-on-surface">
                Verlauf
              </summary>
              <div className="px-3 pb-3">
                <Verlauf hotLeadId={gewaehlt.id} leadId={gewaehlt.originalLeadId} />
              </div>
            </details>

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
                    zweck="beratung"
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
