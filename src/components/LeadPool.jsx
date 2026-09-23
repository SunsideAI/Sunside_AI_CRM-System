import { useState } from 'react'
import { Loader2, Check, Users } from 'lucide-react'
import LeadSchublade from './LeadSchublade'

// Die Pool-Ansicht — eine für Opening, Setting und Closing.
//
// Vorher war jeder Pool anders gebaut: Der Closer-Pool eine Tabelle mit eigener
// Schublade, der Setter-Pool und der E-Book-Pool graue Kästen ganz ohne Klick.
// Wer im Pool wissen wollte, wer der Kontakt überhaupt ist, musste ihn erst
// übernehmen. Hier ist es wie in jeder anderen Liste des CRM: Zeile anklicken,
// Schublade lesen, unten handeln.
//
// Was sich je Stufe unterscheidet, ist allein die Aktion: übernehmen, wo man
// sich den Kontakt selbst nimmt, bewerben, wo ein Admin zuteilt.

/**
 * @param eintraege  Normalisierte Zeilen:
 *                   { id, unternehmen, ansprechpartner, ort, terminDatum,
 *                     terminart, art, hinweis, roh }
 * @param aktion     { text, icon, erledigtText } — der Knopf in der Fußleiste.
 * @param laufend    Die id, auf der gerade gearbeitet wird (Spinner).
 * @param erledigt   { [id]: 'uebernommen' | 'beworben' } — schon erledigt.
 * @param schublade  (eintrag) => Props für LeadSchublade (kontakt, termin, …).
 */
export default function LeadPool({
  eintraege = [],
  laedt = false,
  fehler = '',
  leerText = 'Hier wartet gerade niemand.',
  leerIcon: LeerIcon = Users,
  aktion,
  laufend = null,
  erledigt = {},
  onAktion,
  schublade,
  // Als Kasten über einer anderen Seite (Termine) trägt der Pool nicht die
  // Höhe der Seite - sonst schöbe er den Kalender aus dem Bild.
  kompakt = false
}) {
  const [gewaehlt, setGewaehlt] = useState(null)
  const hoehe = kompakt ? '' : 'min-h-[600px]'

  // Die Höhe bleibt gleich, egal ob geladen, leer oder voll: Sonst springt
  // beim Umschalten die Seite.
  if (laedt) {
    return (
      <div className={`card-elevated ${hoehe} flex items-center justify-center gap-2
                      text-on-surface-variant text-body-sm`}>
        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Pool wird geladen …
      </div>
    )
  }

  if (!eintraege.length) {
    return (
      <div className={`card-elevated ${hoehe} flex flex-col items-center justify-center
                      text-center text-on-surface-variant`}>
        <LeerIcon className="w-10 h-10 mb-3 text-outline" />
        <p className="text-body-md">{leerText}</p>
      </div>
    )
  }

  const mitTermin = eintraege.some(e => e.terminDatum)
  const offen = gewaehlt && !erledigt[gewaehlt.id]
  const stand = gewaehlt && erledigt[gewaehlt.id]

  const terminText = (wert) => wert
    ? new Date(wert).toLocaleString('de-DE', {
        weekday: 'short', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
      }) + ' Uhr'
    : '—'

  return (
    <>
      {fehler && <p className="mb-3 text-body-sm text-error">{fehler}</p>}

      <div className={`card-elevated overflow-hidden ${hoehe}`}>
        <div className="overflow-x-auto">
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
                {mitTermin && (
                  <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Termin
                  </th>
                )}
                <th className="px-4 py-3.5 text-left text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                  Hinweis
                </th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e, i) => {
                const Symbol = e.art?.icon
                return (
                  <tr
                    key={e.id}
                    onClick={() => setGewaehlt(e)}
                    className={`table-row cursor-pointer ${
                      i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface'}`}
                  >
                    <td className="px-4 py-4">
                      <div className="p-1.5 rounded-lg inline-flex bg-secondary-container text-primary">
                        {Symbol && <Symbol className="w-4 h-4" />}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-on-surface truncate max-w-[22rem]">
                        {e.unternehmen || 'Ohne Namen'}
                      </div>
                      {/* Auf schmalen Schirmen fehlen die eigenen Spalten. */}
                      <div className="text-body-sm text-on-surface-variant truncate md:hidden">
                        {e.ansprechpartner}
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden md:table-cell text-body-sm text-on-surface-variant">
                      {e.ansprechpartner || '—'}
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell text-body-sm text-on-surface-variant">
                      {e.ort || '—'}
                    </td>

                    {mitTermin && (
                      <td className="px-4 py-4 text-body-sm text-on-surface-variant whitespace-nowrap">
                        {terminText(e.terminDatum)}
                      </td>
                    )}

                    <td className="px-4 py-4 text-body-sm text-on-surface-variant">
                      {erledigt[e.id] ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="w-4 h-4" />
                          {erledigt[e.id] === 'uebernommen' ? 'übernommen' : 'beworben'}
                        </span>
                      ) : (e.hinweis || '—')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dieselbe Schublade wie überall: erst lesen, dann handeln. */}
      <LeadSchublade
        offen={Boolean(gewaehlt)}
        onClose={() => setGewaehlt(null)}
        titel={gewaehlt?.unternehmen || 'Kontakt'}
        untertitel={gewaehlt?.untertitel}
        {...(gewaehlt && schublade ? schublade(gewaehlt) : {})}
        fuss={gewaehlt && (
          stand ? (
            <span className="inline-flex items-center gap-1 text-body-sm text-success">
              <Check className="w-4 h-4" />
              {stand === 'uebernommen' ? 'Übernommen' : 'Beworben'}
            </span>
          ) : (
            <button
              onClick={() => onAktion?.(gewaehlt, () => setGewaehlt(null))}
              disabled={laufend === gewaehlt.id || !offen}
              className="fuss-haupt"
            >
              {laufend === gewaehlt.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : aktion?.icon && <aktion.icon className="w-4 h-4" />}
              {aktion?.text}
            </button>
          )
        )}
      />
    </>
  )
}
