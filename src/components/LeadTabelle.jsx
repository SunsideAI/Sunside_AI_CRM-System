import { useState, useMemo } from 'react'
import {
  Phone, Mail, Video, CheckCircle2, Circle, User as UserIcon,
  Calendar, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare
} from 'lucide-react'
import { spaltenAus } from '../../shared/spalten.js'
import { sortiere } from '../utils/zeile.js'

// Die Liste einer Stufe — eine Tabelle für Opening, Setting und Closing.
//
// Welche Spalten es gibt, steht in shared/spalten.js; was in einer Zeile
// steht, normiert src/utils/zeile.js. Hier geht es nur noch ums Aussehen:
// Kopfzeile mit Sortierung, Zebra-Zeilen, Karten auf schmalen Schirmen.
//
// Sortieren konnte man vorher nirgends. Jetzt überall gleich: Klick auf den
// Kopf sortiert, der zweite Klick dreht um, leere Werte stehen hinten.

const SYMBOLE = {
  video: Video,
  telefon: Phone,
  kontaktiert: CheckCircle2,
  offen: Circle
}

const TOENE = {
  gut: 'bg-success-container text-success',
  schlecht: 'bg-error-container text-error',
  neutral: 'bg-secondary-container text-primary'
}

const AB = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

// Bei vielen Spalten wird waagerecht gescrollt. Damit dann noch zu erkennen
// ist, zu wem eine Zeile gehört, bleiben Symbol und Unternehmen stehen. Sie
// brauchen dafür eine eigene Hintergrundfarbe, sonst scheint der Rest durch.
const HAFTEND = ['sticky left-0 z-20 w-14', 'sticky left-14 z-20']

function datumText(wert, mitZeit = true) {
  if (!wert) return null
  const d = new Date(wert)
  if (Number.isNaN(d.getTime())) return String(wert)
  return d.toLocaleString('de-DE', {
    weekday: mitZeit ? 'short' : undefined,
    day: '2-digit', month: '2-digit',
    year: mitZeit ? undefined : '2-digit',
    hour: mitZeit ? '2-digit' : undefined,
    minute: mitZeit ? '2-digit' : undefined,
    timeZone: 'Europe/Berlin'
  }) + (mitZeit ? ' Uhr' : '')
}

const geld = (wert) => wert == null ? null
  : `${Number(wert).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`

/** Der Inhalt einer Zelle, allein nach der Art der Spalte. */
function Zelle({ spalte, zeile, badgeFarbe }) {
  const wert = zeile[spalte.schluessel]
  if (wert === null || wert === undefined || wert === '') return <span className="text-outline">—</span>

  switch (spalte.art) {
    case 'symbol': {
      const Symbol = SYMBOLE[wert.zeichen] || Circle
      return (
        <div className={`p-1.5 rounded-lg inline-flex ${TOENE[wert.ton] || TOENE.neutral}`}>
          <Symbol className="w-4 h-4" />
        </div>
      )
    }

    case 'titel':
      return (
        <>
          <div className="font-medium text-on-surface truncate max-w-[22rem]">{wert.titel}</div>
          {/* Auf schmalen Schirmen fehlen die eigenen Spalten — dann steht das
              Wichtigste hier mit drunter. */}
          <div className="text-body-sm text-on-surface-variant truncate">
            {wert.unter}
          </div>
        </>
      )

    case 'kontakt':
      return (
        <div className="space-y-1">
          {wert.telefon && (
            <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[10rem]">{wert.telefon}</span>
            </div>
          )}
          {wert.email && (
            <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[10rem]">{wert.email}</span>
            </div>
          )}
        </div>
      )

    case 'datum': {
      const vorbei = new Date(wert) < new Date()
      return (
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
          vorbei ? 'text-warning' : 'text-on-surface-variant'}`}>
          {vorbei ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
          {datumText(wert)}
        </span>
      )
    }

    case 'tag':
      return <span className="whitespace-nowrap">{datumText(wert, false)}</span>

    case 'badge':
      return (
        <span className={`inline-flex px-2.5 py-1 rounded-full text-label-sm whitespace-nowrap ${
          badgeFarbe?.(wert, zeile, spalte) || 'bg-surface-container text-on-surface-variant'}`}>
          {wert}
        </span>
      )

    case 'person':
      return (
        <span className="inline-flex items-center gap-1.5">
          <UserIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[9rem]">{wert}</span>
        </span>
      )

    case 'verlauf':
      return (
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[14rem]">
            {wert.tag ? `${wert.tag} · ` : ''}{wert.text}
          </span>
        </span>
      )

    case 'geld': return <span className="whitespace-nowrap">{geld(wert)}</span>
    case 'zahl': return <span>{Number(wert).toLocaleString('de-DE')}</span>
    case 'prozent': return <span>{Math.round(Number(wert))}%</span>
    default: return <span className="truncate">{String(wert)}</span>
  }
}

/**
 * @param stufe      'opening' | 'setting' | 'closing'
 * @param zeilen     aus zeileAusLead()
 * @param auswahl    Spaltenschlüssel des Nutzers; leer = Standard der Stufe
 * @param onZeile    Klick auf eine Zeile (öffnet die Schublade)
 * @param badgeFarbe (wert, zeile) => Tailwind-Klassen für Status/Ergebnis
 * @param leer       Was steht da, wenn nichts gefunden wurde
 */
/**
 * @param sortierung   { spalte, ab } — wird sie übergeben, sortiert die Seite
 *                     selbst (über alle Zeilen, nicht nur die sichtbaren) und
 *                     bekommt Klicks über onSortierung gemeldet.
 * @param onSortierung (spalte) => void
 * @param nichtSortierbar  Schlüssel, nach denen sich hier nicht sortieren
 *                     lässt (im Opening alles, was der Server nicht kennt).
 */
export default function LeadTabelle({
  stufe, zeilen = [], auswahl = null, onZeile, badgeFarbe, leer = 'Nichts gefunden.',
  sortierung: vonAussen = null, onSortierung = null, nichtSortierbar = []
}) {
  const [eigene, setEigene] = useState({ spalte: null, ab: false })
  const sortierung = vonAussen || eigene
  const spalten = useMemo(() => spaltenAus(stufe, auswahl), [stufe, auswahl])

  // Sortiert die Seite selbst (kontrolliert), bleibt die Liste hier, wie sie
  // kommt - sonst würde zweimal sortiert.
  const sortiert = useMemo(() => {
    if (vonAussen) return zeilen
    const s = spalten.find(x => x.schluessel === eigene.spalte)
    return s ? sortiere(zeilen, s, eigene.ab) : zeilen
  }, [zeilen, spalten, eigene, vonAussen])

  const umschalten = (schluessel) => {
    if (nichtSortierbar.includes(schluessel)) return
    if (onSortierung) { onSortierung(schluessel); return }
    setEigene(s => s.spalte === schluessel
      ? { spalte: schluessel, ab: !s.ab }
      : { spalte: schluessel, ab: false })
  }

  if (!zeilen.length) {
    return (
      <div className="p-12 text-center text-on-surface-variant">
        <p className="text-body-md">{leer}</p>
      </div>
    )
  }

  return (
    <>
      {/* Schmale Schirme: Karten statt Tabelle, mit denselben Werten. */}
      <div className="md:hidden divide-y divide-outline-variant/60">
        {sortiert.map(z => (
          <button
            key={z.id}
            type="button"
            onClick={() => onZeile?.(z)}
            className="w-full text-left p-4 hover:bg-surface-container transition-colors"
          >
            <div className="flex items-start gap-3">
              <Zelle spalte={spalten[0]} zeile={z} badgeFarbe={badgeFarbe} />
              <div className="min-w-0 flex-1">
                <Zelle spalte={spalten[1]} zeile={z} badgeFarbe={badgeFarbe} />
                <div className="mt-2 space-y-1 text-body-sm text-on-surface-variant">
                  {spalten.slice(2, 5).map(s => (
                    <div key={s.schluessel} className="flex gap-2">
                      <span className="text-outline shrink-0">{s.name}:</span>
                      <Zelle spalte={s} zeile={z} badgeFarbe={badgeFarbe} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container">
              {spalten.map((s, i) => (
                <th
                  key={s.schluessel}
                  onClick={() => umschalten(s.schluessel)}
                  title={nichtSortierbar.includes(s.schluessel)
                    ? 'Nach dieser Spalte lässt sich hier nicht sortieren'
                    : 'Sortieren — noch ein Klick dreht die Richtung'}
                  className={`px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant
                              uppercase tracking-wider select-none group ${AB[s.ab] || ''}
                              ${nichtSortierbar.includes(s.schluessel)
                                ? 'cursor-default' : 'cursor-pointer hover:text-on-surface'}
                              ${s.fest ? `${HAFTEND[i] || ''} bg-surface-container` : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {s.name}
                    {/* Das Doppelpfeilchen sagt: Hier lässt sich sortieren. Beim
                        aktiven Feld zeigt der Pfeil die Richtung. */}
                    {sortierung.spalte === s.schluessel ? (
                      sortierung.ab
                        ? <ChevronDown className="w-3.5 h-3.5 text-primary" />
                        : <ChevronUp className="w-3.5 h-3.5 text-primary" />
                    ) : !nichtSortierbar.includes(s.schluessel) && (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-outline opacity-0
                                                 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortiert.map((z, i) => (
              <tr
                key={z.id}
                onClick={() => onZeile?.(z)}
                className={`table-row cursor-pointer ${
                  i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}
              >
                {spalten.map((s, si) => (
                  <td key={s.schluessel}
                      className={`px-4 py-4 text-body-sm text-on-surface-variant ${AB[s.ab] || ''}
                                  ${s.fest ? `${HAFTEND[si] || ''} ${
                                    i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}` : ''}`}>
                    <Zelle spalte={s} zeile={z} badgeFarbe={badgeFarbe} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
