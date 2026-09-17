import { useState } from 'react'
import {
  Phone, Mail, Globe, MapPin, User as UserIcon, Calendar, Video,
  BarChart3, ClipboardList, History, ChevronDown
} from 'lucide-react'
import SlideDrawer from './SlideDrawer'
import Verlauf from './Verlauf'
import { Abschnitt, Angabe, Angaben } from './Formular'

// Die Schublade eines Kontakts — ein Gerüst für Opening, Setting, Closing und
// Follow-Up.
//
// Gleiche Klassen reichen nicht. Vorher trug jeder Tab dieselben Bausteine in
// einer anderen Reihenfolge: die Aktionen mal oben, mal in der Fußleiste, mal
// mittendrin; der Verlauf mal an zweiter Stelle, mal ganz unten, mal
// zugeklappt über allem; Follow-Up zeigte die Kontaktdaten als Liste ganz
// ohne Überschrift. Wer den Tab wechselte, musste jedes Mal neu suchen.
//
// Deshalb steht die Reihenfolge hier und nicht in vier Dateien:
//
//   1. Kontaktdaten   — wer ist das, wie erreiche ich ihn
//   2. Termin         — wann
//   3. Website-Zahlen — die Kennzahlen zum Betrieb
//   4. Übergabe       — was die Stufen davor aufgenommen haben
//   5. Arbeitsbereich — was ICH hier zu tun habe (je Tab verschieden)
//   6. Verlauf        — was bisher geschah
//   ── Fußleiste ──   — die Aktionen, immer unten rechts
//
// Nur Punkt 5 unterscheidet sich zwischen den Tabs. Das ist die eigentliche
// Arbeit und darf verschieden sein — alles andere nicht.

/**
 * Alles vor dem ersten datierten Eintrag: der Rest aus einer aelteren
 * Migration, den die Zeitleiste bewusst nicht uebernimmt. Stand wortgleich
 * in Opening und Closing - hier einmal, damit beide dasselbe zeigen.
 */
export function altbestand(kommentar) {
  const k = kommentar || ''
  if (/^\[\d{2}\.\d{2}\.\d{4}/.test(k)) return ''
  return (k.split(/\n(?=\[\d{2}\.\d{2}\.\d{4})/)[0] || '').trim()
}

function Pille({ icon: Icon, children, href }) {
  const inhalt = (
    <>
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-body-sm truncate">{children}</span>
    </>
  )
  const klasse = 'flex items-center gap-2 px-3 py-2 bg-surface-container rounded-lg max-w-full'
  return href
    ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined}
         rel="noopener noreferrer"
         className={`${klasse} hover:bg-surface-container-high transition-colors`}>{inhalt}</a>
    : <div className={klasse}>{inhalt}</div>
}

function Rollenpille({ name, wert }) {
  if (!wert) return null
  return (
    <span className="px-3 py-1.5 bg-primary-fixed text-primary rounded-full text-label-sm">
      {name}: {wert}
    </span>
  )
}

/** Die Zahlen zur Website. Zugeklappt, weil sie selten gebraucht werden. */
function Statistik({ werte }) {
  const [offen, setOffen] = useState(false)
  if (!werte) return null

  const zeilen = [
    ['Besucher/Monat', werte.besucher, 'text-on-surface'],
    ['Mehrwert', werte.mehrwert, 'text-success'],
    ['Absprungrate', werte.absprungrate, 'text-warning'],
    ['Leads/Monat', werte.leads, 'text-primary']
  ].filter(([, w]) => w !== null && w !== undefined && w !== '')

  if (zeilen.length === 0) return null

  return (
    <Abschnitt
      titel="Website-Statistiken"
      icon={BarChart3}
      aktion={
        <button type="button" onClick={() => setOffen(o => !o)}
                aria-label={offen ? 'Zuklappen' : 'Aufklappen'}
                className="p-1 rounded hover:bg-surface-container">
          <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${offen ? 'rotate-180' : ''}`} />
        </button>
      }
    >
      {offen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface-container-lowest
                        rounded-xl border border-outline-variant">
          {zeilen.map(([name, wert, farbe]) => (
            <div key={name}>
              <p className="text-label-sm text-on-surface-variant">{name}</p>
              <p className={`text-title-md font-medium ${farbe}`}>{wert}</p>
            </div>
          ))}
        </div>
      )}
    </Abschnitt>
  )
}

export default function LeadSchublade({
  offen, onClose, titel,
  kontakt = {},
  termin,
  statistik,
  uebergabe,
  verlauf,
  arbeitsTitel,
  arbeitsIcon,
  fuss,
  breite = 'max-w-2xl',
  children
}) {
  return (
    <SlideDrawer isOpen={offen} onClose={onClose} title={titel} width={breite} fuss={fuss}>
      {/* 1 — Kontaktdaten */}
      <Abschnitt titel="Kontaktdaten" icon={UserIcon}>
        <Angaben>
          <Angabe name="Ansprechpartner">{kontakt.ansprechpartner || null}</Angabe>
          {kontakt.statusFeld
            ? <Angabe name="Status">{kontakt.statusFeld}</Angabe>
            : <Angabe name="Kategorie">{kontakt.kategorie || null}</Angabe>}
        </Angaben>

        {(kontakt.telefon || kontakt.email || kontakt.website || kontakt.ort) && (
          <div className="flex flex-wrap gap-2">
            {kontakt.telefon && (
              <Pille icon={Phone} href={`tel:${kontakt.telefon}`}>{kontakt.telefon}</Pille>
            )}
            {kontakt.email && (
              <Pille icon={Mail} href={`mailto:${kontakt.email}`}>{kontakt.email}</Pille>
            )}
            {kontakt.website && (
              <Pille icon={Globe}
                     href={kontakt.website.startsWith('http') ? kontakt.website : `https://${kontakt.website}`}>
                Website
              </Pille>
            )}
            {kontakt.ort && <Pille icon={MapPin}>{kontakt.ort}</Pille>}
          </div>
        )}

        {(kontakt.rollen || []).some(r => r?.wert) && (
          <div className="flex flex-wrap gap-2">
            {kontakt.rollen.map(r => <Rollenpille key={r.name} {...r} />)}
          </div>
        )}
      </Abschnitt>

      {/* 2 — Termin */}
      {termin && (
        <Abschnitt titel="Termin" icon={Calendar}>
          <Angaben>
            <Angabe name="Datum & Uhrzeit">{termin.datum || null}</Angabe>
            <Angabe name="Terminart">{termin.art || null}</Angabe>
          </Angaben>
          {termin.zusatz}
          {termin.link && (
            <a href={termin.link} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-2 p-3 bg-primary-fixed/30 border border-primary-fixed-dim
                          rounded-lg text-primary hover:bg-secondary-container">
              <Video className="w-4 h-4" /> Video-Meeting beitreten
            </a>
          )}
        </Abschnitt>
      )}

      {/* 3 — Website-Zahlen */}
      <Statistik werte={statistik} />

      {/* 4 — Übergabe */}
      {uebergabe && (
        <Abschnitt titel="Übergabe" icon={ClipboardList}>
          {uebergabe}
        </Abschnitt>
      )}

      {/* 5 — Der Arbeitsbereich. Das Einzige, was sich je Tab unterscheiden
             darf: Hier steht, was in DIESER Stufe zu tun ist. */}
      {children && (
        <Abschnitt titel={arbeitsTitel} icon={arbeitsIcon}>
          {children}
        </Abschnitt>
      )}

      {/* 6 — Verlauf */}
      {verlauf && (
        <Abschnitt titel="Verlauf" icon={History}>
          <Verlauf hotLeadId={verlauf.hotLeadId} leadId={verlauf.leadId} />
          {verlauf.altbestand && (
            <>
              <div className="text-label-sm text-on-surface-variant">Ältere Notizen ohne Datum</div>
              <div className="bg-surface-container-lowest rounded-xl p-4 max-h-[250px] overflow-y-auto">
                <p className="text-body-sm text-on-surface whitespace-pre-line">{verlauf.altbestand}</p>
              </div>
            </>
          )}
        </Abschnitt>
      )}
    </SlideDrawer>
  )
}
