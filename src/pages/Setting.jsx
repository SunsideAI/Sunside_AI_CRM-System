import { useState, useEffect } from 'react'
import {
  Search, Calendar, Phone, Video, Loader2, User as UserIcon,
  CheckCircle2, AlertCircle, Users, Mail, RefreshCw, X, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { STATUS, anzeigeName } from '../../shared/status.js'
import LeadSchublade from '../components/LeadSchublade'
import SetterUebergabe from '../components/SetterUebergabe'
import SetterPool from '../components/SetterPool'
import EmailComposer from '../components/EmailComposer'
import TerminPicker from '../components/TerminPicker'
import Uebergabeblatt, { UEBERGABE_1 } from '../components/Uebergabeblatt'

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
  // 'meine' oder 'pool' — dieselbe Umschaltung wie im Closing. Der Pool war
  // vorher ein Block ueber der Liste; als eigene Ansicht ist er dort, wo man
  // ihn sucht, und die Zahl daneben sagt, ob sich das Hinsehen lohnt.
  const [ansicht, setAnsicht] = useState('meine')
  const [poolAnzahl, setPoolAnzahl] = useState(0)
  const [seite, setSeite] = useState(1)
  const [hinweis, setHinweis] = useState('')

  // Was nach einer Speicherung passiert - und das ist der Punkt, an dem der
  // Prozess vorher abriss.
  //
  // Nach "Beratungsgespräch hat stattgefunden" wurde die Schublade geschlossen
  // und die Liste neu geladen. Der Kontakt stand danach auf "geführt", der
  // Filter aber auf "Anstehend" - er war schlicht weg. Die Übergabemaske mit
  // den zwölf Feldern und der Terminbuchung lag hinter einem Filter, von dem
  // niemand wusste, dass er ihn jetzt braucht.
  //
  // Jetzt bleibt die Schublade offen und zeigt den nächsten Schritt: Der Setter
  // kommt aus dem Telefonat und schreibt weiter, ohne zu suchen.
  const nachSpeichern = (updates) => {
    laden(); poolZaehlen()

    if (updates?.status === STATUS.BERATUNG_GEFUEHRT) {
      setGewaehlt(g => (g ? { ...g, ...updates } : g))
      setFilter('zu_tun')
      setSeite(1)
      setHinweis('')
      return
    }

    const name = gewaehlt?.unternehmen || 'Der Kontakt'

    if (updates?.status === STATUS.ABSCHLUSS_VEREINBART) {
      setHinweis(`${name} ist an den Closer übergeben. Das Abschlussgespräch steht im Closer-Pool.`)
    }

    // Geplatzt: Der Kontakt wechselt in einen Filter, den man gerade nicht
    // ansieht. Ohne den Wechsel waere er wieder einfach weg - derselbe Fehler
    // wie nach "hat stattgefunden", nur eine Abzweigung weiter.
    if ([STATUS.NICHT_ERSCHIENEN, STATUS.TERMIN_ABGESAGT].includes(updates?.status)) {
      setFilter('geplatzt')
      setSeite(1)
      setHinweis(updates.status === STATUS.NICHT_ERSCHIENEN
        ? `${name} ist nicht erschienen und steht jetzt unter „Geplatzt".`
        : `Die Absage für ${name} ist festgehalten. Der Kontakt steht unter „Geplatzt".`)
    }

    if (updates?.verschoben) {
      setHinweis(`Der Termin mit ${name} ist neu gelegt.`)
    }

    setGewaehlt(null)
  }

  // Wie im Closing: zehn je Seite. Vorher standen alle Zeilen auf einmal da —
  // bei 312 Gesprächen ist das keine Liste mehr, sondern eine Wand.
  const PRO_SEITE = 10

  useEffect(() => { laden(); poolZaehlen() }, [ansicht])

  // Die Zahl im Umschalter muss stimmen, BEVOR man umschaltet — sonst stünde
  // dort 0, und niemand sähe, dass etwas wartet. Dieselbe Bedingung wie im
  // Pool selbst: bevorstehend und ohne Setter.
  const poolZaehlen = async () => {
    try {
      const antwort = await fetch('/.netlify/functions/hot-leads?pool=setter')
      const daten = await antwort.json()
      const offen = (daten.hotLeads || []).filter(l =>
        l.status === STATUS.BERATUNG_VEREINBART &&
        l.terminDatum && new Date(l.terminDatum) > new Date())
      setPoolAnzahl(offen.length)
    } catch {
      // Zahl bleibt, wie sie war — ein Zähler ist kein Grund für eine Meldung.
    }
  }

  const laden = async () => {
    setLaedt(true); setFehler('')
    try {
      // Admins sehen alles, sonst die eigenen. Der Server prüft das noch
      // einmal — der Filter hier ist Bequemlichkeit, keine Absicherung.
      // "Alle" holt ohne Setter-Filter — sonst sähe ein Admin dort dasselbe
      // wie unter "Meine Leads".
      const pfad = (isAdmin() && ansicht === 'alle')
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

  // Blättern wie im Closing: Seite begrenzen, damit ein Filterwechsel nicht
  // auf einer Seite landet, die es nicht mehr gibt.
  const seitenGesamt = Math.max(1, Math.ceil(sichtbar.length / PRO_SEITE))
  const sichereSeite = Math.min(seite, seitenGesamt)
  const beginn = (sichereSeite - 1) * PRO_SEITE
  const geblaettert = sichtbar.slice(beginn, beginn + PRO_SEITE)

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
      {/* Kopfzeile mit Umschalter — gebaut wie im Closing. */}
      <div className="seitenkopf">
        <div>
          <h1 className="text-headline-lg font-display text-on-surface">
            {ansicht === 'pool' ? 'Setter-Pool' : 'Setting'}
            {ansicht === 'alle' && ' (alle Gespräche)'}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            {ansicht === 'pool'
              ? 'Beratungsgespräche, die der Opener gelegt hat — noch ohne Setter'
              : ansicht === 'alle'
                ? 'Alle Beratungsgespräche, unabhängig vom Setter'
                : 'Deine Beratungsgespräche — halten, dokumentieren, an den Closer übergeben.'}
          </p>
        </div>

        <div className="w-full sm:w-auto overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="umschalter">
            <button
              onClick={() => setAnsicht('meine')}
              className={`umschalter-knopf ${
                ansicht === 'meine'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <UserIcon className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Meine Leads</span>
              <span className="sm:hidden">Meine</span>
            </button>
            <button
              onClick={() => setAnsicht('pool')}
              className={`umschalter-knopf ${
                ansicht === 'pool'
                  ? 'aktiv'
                  : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
              }`}
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              Pool
              <span className="umschalter-zahl">{poolAnzahl}</span>
            </button>
            {isAdmin() && (
              <button
                onClick={() => { setAnsicht('alle'); setSeite(1) }}
                className={`umschalter-knopf ${
                  ansicht === 'alle'
                    ? 'aktiv'
                    : 'text-on-surface-variant hover:text-primary hover:bg-primary-fixed/30'
                }`}
              >
                <Users className="w-4 h-4 mr-1.5" />
                Alle
              </button>
            )}
          </div>
        </div>
      </div>

      {fehler && (
        <div className="bg-error-container rounded-xl p-4 text-error">{fehler}</div>
      )}

      {hinweis && (
        <div className="flex items-start gap-3 bg-success-container rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <p className="text-body-md text-on-surface flex-1">{hinweis}</p>
          <button
            type="button"
            onClick={() => setHinweis('')}
            aria-label="Meldung schließen"
            className="text-on-surface-variant hover:text-on-surface shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pool-Ansicht: die Übergabe vom Opener. SetterPool meldet, wie viele
          es sind — sonst stünde im Umschalter eine Zahl, die niemand pflegt. */}
      {ansicht === 'pool' ? (
        <SetterPool
          onGeaendert={() => { laden(); poolZaehlen(); setAnsicht('meine') }}
          onAnzahl={setPoolAnzahl}
          alsAnsicht
        />
      ) : (
      <>

      {/* Filter & Suche — Zeile für Zeile dieselbe Hülle wie im Closing. */}
      <div className="card p-5 space-y-4">
        {/* Zeile 1: Suche + Aktualisieren */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
              type="text"
              placeholder="Firma, Name, Ort suchen..."
              value={suche}
              onChange={e => { setSuche(e.target.value); setSeite(1) }}
              className="input-field pl-10 pr-10"
            />
            {suche && (
              <button
                type="button"
                onClick={() => { setSuche(''); setSeite(1) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            onClick={laden}
            disabled={laedt}
            aria-label="Neu laden"
            className="kopf-knopf kopf-knopf-symbol"
          >
            <RefreshCw className={`w-4 h-4 ${laedt ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Zeile 2: Filter. Auswahlfeld wie im Closing — die Zahl bleibt
            trotzdem sichtbar, sie stand vorher auf den Pillen und ist zu
            nützlich, um sie beim Angleichen wegzuwerfen. */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); setSeite(1) }}
            className="select-field w-full sm:w-auto sm:min-w-[200px] text-body-sm py-2.5"
          >
            {FILTER.map(f => (
              <option key={f.wert} value={f.wert}>{f.name} ({zaehler(f.wert)})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste. Dieselbe Tabelle wie in Opening und Closing: gleiche
          Kopfzeile, gleiche Zeilenfarben im Wechsel, gleiche Regeln dafür,
          welche Spalte auf schmalen Schirmen wegfällt. Vorher stand hier eine
          Kartenliste — dieselbe Arbeit sah je nach Tab anders aus. */}
      <div className="card-elevated overflow-hidden min-h-[600px]">
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
          <>
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
              {geblaettert.map((lead, index) => {
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

          {sichtbar.length > PRO_SEITE && (
            <div className="px-4 md:px-6 py-3 md:py-4 bg-surface-container/50 flex items-center justify-between">
              <span className="text-body-sm text-on-surface-variant">
                {beginn + 1}-{Math.min(beginn + PRO_SEITE, sichtbar.length)} von {sichtbar.length}
              </span>
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  type="button"
                  onClick={() => setSeite(p => Math.max(1, p - 1))}
                  disabled={sichereSeite === 1}
                  className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                </button>
                <span className="text-body-sm text-on-surface px-2">
                  {sichereSeite} / {seitenGesamt}
                </span>
                <button
                  type="button"
                  onClick={() => setSeite(p => Math.min(seitenGesamt, p + 1))}
                  disabled={sichereSeite === seitenGesamt}
                  className="p-2 bg-surface-container-lowest rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      </>
      )}

      {/* Detailansicht — Aufbau und Reihenfolge kommen aus LeadSchublade,
          damit sie in jedem Tab dieselben sind. Tab-eigen ist nur der
          Arbeitsbereich: hier der Ausgang des Beratungsgesprächs. */}
      <LeadSchublade
        offen={!!gewaehlt}
        onClose={() => { setGewaehlt(null); setMailOffen(false); setTerminOffen(false) }}
        titel={gewaehlt?.unternehmen || 'Kontakt'}
        untertitel={[gewaehlt?.kategorie, gewaehlt?.ort].filter(Boolean).join(' · ')}
        kontakt={{
          ansprechpartner: [gewaehlt?.ansprechpartnerVorname, gewaehlt?.ansprechpartnerNachname]
            .filter(Boolean).join(' '),
          statusFeld: gewaehlt ? anzeigeName(gewaehlt.status) : null,
          telefon: gewaehlt?.telefon,
          email: gewaehlt?.email,
          website: gewaehlt?.website,
          ort: gewaehlt?.ort,
          rollen: [
            { name: 'Erstanruf', wert: gewaehlt?.openerName },
            { name: 'Setter', wert: gewaehlt?.setterName }
          ]
        }}
        termin={gewaehlt ? {
          datum: terminText(gewaehlt.terminDatum),
          art: gewaehlt.terminart || 'Telefonisch',
          link: gewaehlt.meeting_link
        } : null}
        uebergabe={gewaehlt && <Uebergabeblatt lead={gewaehlt} bereiche={[UEBERGABE_1]} />}
        verlauf={gewaehlt && { hotLeadId: gewaehlt.id, leadId: gewaehlt.originalLeadId }}
        arbeitsTitel="Beratungsgespräch"
        arbeitsIcon={Users}
        fuss={gewaehlt && (
          <button
            onClick={() => setMailOffen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 border border-primary-fixed-dim
                       text-primary rounded-lg hover:bg-primary-fixed/30"
          >
            <Mail className="w-4 h-4" /> E-Mail an den Kontakt
          </button>
        )}
      >
        {gewaehlt && (
          <>
            {mailOffen && (
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
            )}

            {/* Geplatzte Termine: neu legen */}
            {[STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN].includes(gewaehlt.status) && (
              terminOffen ? (
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
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" /> Neuen Termin buchen
                </button>
              )
            )}

            <SetterUebergabe lead={gewaehlt} onGespeichert={nachSpeichern} />
          </>
        )}
      </LeadSchublade>
    </div>
  )
}

export default Setting
