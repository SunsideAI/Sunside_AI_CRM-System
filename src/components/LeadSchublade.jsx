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

export function Pille({ icon: Icon, children, href }) {
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

/**
 * Wer den Kontakt in welcher Stufe hat: Opener, Setter, Closer, in dieser
 * Reihenfolge und in jedem Tab mit denselben Namen. Leere fallen weg.
 * Vorher hieß der Opener in einem Tab „Vertriebler", im nächsten „Erstanruf",
 * und im Closing fehlte er ganz.
 */
export function Rollen({ opener, setter, closer }) {
  const liste = [['Opener', opener], ['Setter', setter], ['Closer', closer]]
    .map(([name, wert]) => [name, Array.isArray(wert) ? wert.filter(Boolean).join(', ') : wert])
    .filter(([, wert]) => wert)
  if (liste.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {liste.map(([name, wert]) => <Rollenpille key={name} name={name} wert={wert} />)}
    </div>
  )
}

/**
 * Die Zahlen zur Website. Zugeklappt, weil sie selten gebraucht werden;
 * im Opening offen, dort sind sie der Einstieg ins Telefonat.
 */
/**
 * Die Website-Zahlen eines Kontakts, fertig zum Anzeigen.
 *
 * Stand vorher dreimal verschieden im Code: Opening rechnete Schwellen für die
 * Farbe, Closing zeigte dieselbe Zahl schwarz und in anderer Reihenfolge,
 * Setting zeigte sie gar nicht. Formatierung und Schwellen gehören an eine
 * Stelle, sonst heißt dieselbe Zahl in zwei Tabs etwas anderes.
 */
export function webZahlen(lead) {
  if (!lead) return null
  const rate = lead.absprungrate == null ? null : parseFloat(lead.absprungrate) * 100
  return {
    besucher: lead.monatlicheBesuche != null ? lead.monatlicheBesuche.toLocaleString('de-DE') : null,
    mehrwert: lead.mehrwert != null
      ? `${lead.mehrwert.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €` : null,
    absprungrate: rate == null ? null : `${Math.round(rate)}%`,
    absprungrateFarbe: rate == null ? undefined
      : rate > 60 ? 'text-error' : rate > 40 ? 'text-warning' : 'text-success',
    leads: lead.anzahlLeads ?? null
  }
}

export function Statistik({ werte, anfangsOffen = false }) {
  const [offen, setOffen] = useState(anfangsOffen)
  if (!werte) return null

  const zeilen = [
    ['Besucher/Monat', werte.besucher, 'text-on-surface'],
    ['Mehrwert', werte.mehrwert, 'text-success'],
    ['Absprungrate', werte.absprungrate, werte.absprungrateFarbe || 'text-warning'],
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
      {/* Dieselbe Darstellung wie Kontaktdaten und Termin: Name klein darüber,
          Wert darunter. Vorher standen die Zahlen groß in einem eigenen weißen
          Kasten und lasen sich wie ein fremdes Bauteil in der Schublade. Die
          Farbe bleibt — sie sagt, ob eine Zahl gut oder schlecht ist. */}
      {offen && (
        <Angaben>
          {zeilen.map(([name, wert, farbe]) => (
            <Angabe key={name} name={name}>
              <span className={farbe}>{wert}</span>
            </Angabe>
          ))}
        </Angaben>
      )}
    </Abschnitt>
  )
}

/**
 * @param nurArbeit  Während eines geführten Ablaufs (Setting: Übergabe an den
 *                   Closer) zeigt die Schublade nur den Arbeitsbereich. Sonst
 *                   stünde der Ablauf zwischen Kontaktdaten und Verlauf, und
 *                   man sucht beim Ausfüllen die Stelle wieder, an der man war.
 *                   Im Opening wechselt die Schublade genauso auf eine eigene
 *                   Seite, sobald der Terminwähler offen ist.
 * @param kontaktFelder  Die Kontaktdaten zum Ändern. Ist etwas übergeben,
 *                   stehen im ersten Abschnitt Eingabefelder statt der festen
 *                   Angaben und Pillen — wie im Opening, wenn dort
 *                   „Bearbeiten" gedrückt ist. Die Rollen bleiben sichtbar.
 */
export default function LeadSchublade({
  offen, onClose, titel, untertitel, nurArbeit = false,
  kontakt = {}, kontaktFelder = null,
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
    <SlideDrawer isOpen={offen} onClose={onClose} title={titel}
                 untertitel={untertitel || kontakt.kategorie}
                 width={breite} fuss={fuss}>
      {/* 1 — Kontaktdaten */}
      {!nurArbeit && (
      <Abschnitt titel="Kontaktdaten" icon={UserIcon}>
        {/* Beim Ändern bleibt der Status stehen: Er gehört zum Kontakt, ist
            aber nichts, was man hier von Hand setzt. */}
        {kontaktFelder && kontakt.statusFeld && (
          <Angaben><Angabe name="Status">{kontakt.statusFeld}</Angabe></Angaben>
        )}

        {kontaktFelder || (
        <>
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
        </>
        )}

        {kontakt.rollen && <Rollen {...kontakt.rollen} />}
      </Abschnitt>
      )}

      {/* 2 — Termin */}
      {!nurArbeit && termin && (
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
      {!nurArbeit && <Statistik werte={statistik} />}

      {/* 4 — Übergabe */}
      {!nurArbeit && uebergabe && (
        <Abschnitt titel="Übergabe" icon={ClipboardList}>
          {uebergabe}
        </Abschnitt>
      )}

      {/* 5 — Der Arbeitsbereich. Das Einzige, was sich je Tab unterscheiden
             darf: Hier steht, was in DIESER Stufe zu tun ist. */}
      {children && (
        <Abschnitt titel={nurArbeit ? null : arbeitsTitel} icon={arbeitsIcon}>
          {children}
        </Abschnitt>
      )}

      {/* 6 — Verlauf */}
      {!nurArbeit && verlauf && (
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
