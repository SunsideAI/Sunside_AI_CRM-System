import { FELDER, UEBERGABE_1, UEBERGABE_2 } from '../../shared/felder.js'

// Was die Vorstufe aufgenommen hat — zum Lesen, nicht zum Ändern.
//
// Der Setter füllt zwölf Pflichtfelder aus, bevor er das Abschlussgespräch
// legen darf. Angezeigt wurden sie danach nirgends: Der Closer bekam einen
// Termin und ein Kommentarfeld. Die Arbeit des Setters lag in der Datenbank
// und niemand sah sie — das ist der Grund für dieses Blatt.
//
// Beschriftungen kommen aus shared/felder.js, derselben Quelle wie das
// Eingabeformular. Zwei Listen von Feldnamen wären zwei Wahrheiten.

// Leere Felder werden weggelassen. Ein Blatt, das zur Hälfte aus „–" besteht,
// liest niemand zu Ende; was fehlt, sagt der Balken darunter in einem Satz.
function hatWert(wert, art) {
  if (wert === null || wert === undefined) return false
  if (art === 'checkbox') return wert === true
  if (art === 'janein') return wert === true || wert === false
  if (art === 'liste') return Array.isArray(wert) && wert.length > 0
  return String(wert).trim() !== ''
}

function Wert({ feld, wert }) {
  if (feld.art === 'janein') return <>{wert ? 'Ja' : 'Nein'}</>
  if (feld.art === 'checkbox') return <>Ja</>
  if (feld.art === 'liste') return <>{wert.join(', ')}</>
  if (feld.art === 'betrag') return <>{Number(wert).toLocaleString('de-DE')} €</>
  if (feld.art === 'zahl') return <>{Number(wert).toLocaleString('de-DE')}</>
  // Freitext steht wörtlich da — dafür wurde er wörtlich aufgenommen.
  if (feld.art === 'freitext') return <>„{String(wert)}"</>
  return <>{String(wert)}</>
}

function Block({ titel, bereich, lead }) {
  const eintraege = Object.entries(FELDER)
    .filter(([, f]) => f.bereich === bereich)
    .filter(([k, f]) => hatWert(lead?.[k], f.art))

  const fehlend = Object.entries(FELDER)
    .filter(([, f]) => f.bereich === bereich && f.pflicht)
    .filter(([k, f]) => !hatWert(lead?.[k], f.art)).length

  if (eintraege.length === 0) {
    return (
      <div className="text-body-sm text-outline italic">
        {titel}: nichts aufgenommen
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-label-sm font-medium text-on-surface-variant uppercase tracking-wide">
        {titel}
      </div>
      <dl className="space-y-2">
        {eintraege.map(([schluessel, feld]) => (
          <div key={schluessel}>
            <dt className="text-label-sm text-on-surface-variant">{feld.name}</dt>
            <dd className="text-body-sm text-on-surface break-words">
              <Wert feld={feld} wert={lead[schluessel]} />
            </dd>
          </div>
        ))}
      </dl>
      {fehlend > 0 && (
        <p className="text-label-sm text-warning">
          {fehlend === 1 ? 'Ein Pflichtfeld fehlt' : `${fehlend} Pflichtfelder fehlen`}
        </p>
      )}
    </div>
  )
}

/**
 * @param lead        Hot Lead mit den Übergabefeldern
 * @param bereiche    Welche Übergaben gezeigt werden. Im Pool reicht die des
 *                    Setters — mehr als das braucht niemand, um zu entscheiden,
 *                    ob er sich bewirbt.
 */
export default function Uebergabeblatt({ lead, bereiche = [UEBERGABE_1, UEBERGABE_2] }) {
  const anfragen = lead?.noetige_anfragen

  return (
    <div className="space-y-5">
      {bereiche.includes(UEBERGABE_1) && (
        <Block titel="Aus dem Erstanruf" bereich={UEBERGABE_1} lead={lead} />
      )}
      {bereiche.includes(UEBERGABE_2) && (
        <Block titel="Aus dem Beratungsgespräch" bereich={UEBERGABE_2} lead={lead} />
      )}

      {/* Die gerechnete Zahl. Sie steht später im Strategiepapier — hier
          schon, damit der Closer nicht selbst nachrechnet. */}
      {anfragen ? (
        <div className="p-3 bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg">
          <div className="text-body-sm text-on-surface">
            Nötige Anfragen pro Monat: <strong>{Number(anfragen).toLocaleString('de-DE')}</strong>
            {lead?.anfragen_bereich && (
              <span className="text-on-surface-variant"> ({lead.anfragen_bereich})</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { UEBERGABE_1, UEBERGABE_2 }
