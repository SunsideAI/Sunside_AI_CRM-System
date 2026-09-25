import {
  FELDER, UEBERGABE_1, UEBERGABE_2, maske, uebergabePruefen, beschriftung, brancheSprache
} from '../../shared/felder.js'

// Was die Vorstufe aufgenommen hat, zum Lesen, nicht zum Ändern.
//
// Beschriftungen kommen aus shared/felder.js, derselben Quelle wie das
// Eingabeformular. Zwei Listen von Feldnamen wären zwei Wahrheiten.

// Leere Felder werden weggelassen. Ein Blatt, das zur Hälfte aus „–" besteht,
// liest niemand zu Ende; was fehlt, sagt die Zeile darunter in einem Satz.
function hatWert(wert, art) {
  if (wert === null || wert === undefined) return false
  if (art === 'checkbox') return wert === true
  if (art === 'janein') return wert === true || wert === false
  if (art === 'liste' || art === 'mehrfach') return Array.isArray(wert) && wert.length > 0
  return String(wert).trim() !== ''
}

function Wert({ feld, wert, lead }) {
  if (feld.art === 'janein') return <>{wert ? 'Ja' : 'Nein'}</>
  if (feld.art === 'checkbox') return <>Ja</>
  if (feld.art === 'liste') return <>{wert.join(', ')}</>
  if (feld.art === 'mehrfach') {
    return <>{wert.map(w => brancheSprache(w, lead) + (w === lead?.ziel_prioritaet ? ' (priorisiert)' : '')).join(', ')}</>
  }
  if (feld.art === 'zahl') {
    const herkunft = lead?.zahlen_kennzeichen?.[feld.schluessel]
    return <>{Number(wert).toLocaleString('de-DE')}{herkunft && <span className="text-on-surface-variant"> ({herkunft})</span>}</>
  }
  // Freitext steht wörtlich da, dafür wurde er wörtlich aufgenommen.
  if (feld.art === 'freitext') return <>„{String(wert)}"</>
  return <>{brancheSprache(String(wert), lead)}</>
}

function Block({ titel, bereich, lead }) {
  const eintraege = maske(bereich)
    .filter(f => !(bereich === UEBERGABE_2 && f.schluessel === 'mobilnummer'))
    // Was gefüllt ist, wird gezeigt, auch wenn das Feld heute ausgeblendet wäre:
    // Korrigiert der Setter das Ziel, bleibt die alte Zahl lesbar.
    .filter(f => hatWert(lead?.[f.schluessel], f.art))

  // Altbestand: Vor dem 21.09. standen Entscheider und Erfolgskriterien in
  // einem Feld. Wer es damals ausgefüllt hat, soll es weiter lesen können.
  if (bereich === UEBERGABE_2 && hatWert(lead?.entscheider_messlatte, 'freitext')) {
    eintraege.push({ ...FELDER.entscheider_messlatte, schluessel: 'entscheider_messlatte' })
  }

  const fehlend = uebergabePruefen(lead, bereich).offen.length

  if (eintraege.length === 0) {
    return (
      <div className="text-body-sm text-outline italic">
        {titel}: nichts aufgenommen
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="abschnitt-titel">{titel}</div>
      <dl className="space-y-2">
        {eintraege.map(feld => (
          <div key={feld.schluessel}>
            <dt className="text-label-sm text-on-surface-variant">{beschriftung(feld, lead).name}</dt>
            <dd className="text-body-sm text-on-surface break-words">
              <Wert feld={feld} wert={lead[feld.schluessel]} lead={lead} />
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
 *                    Setters, mehr braucht niemand, um zu entscheiden, ob er
 *                    sich bewirbt.
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

      {/* Die gerechnete Zahl. Sie steht später im Strategiepapier, hier schon,
          damit der Closer nicht selbst nachrechnet. */}
      {anfragen ? (
        <div className="p-3 bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg">
          <div className="text-body-sm text-on-surface">
            {brancheSprache('Nötige Eigentümeranfragen pro Monat', lead)}: <strong>{Number(anfragen).toLocaleString('de-DE')}</strong>
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
