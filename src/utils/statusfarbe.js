import { STATUS, IST_VERLOREN, normalisiere, statusBasisVonLead } from '../../shared/status.js'

/**
 * Welche Farbe die Statuspille eines Kontakts trägt.
 *
 * Gemessen wird am ANGEZEIGTEN Stand, nicht am gespeicherten Wert. Beides
 * kann auseinanderlaufen: Hinkt der Status der Übergabe hinterher, steht in
 * der Pille „Abschlussgespräch vereinbart", während lead.status noch einen
 * Beratungswert trägt. Vorher kam der Text von der einen Quelle und die Farbe
 * von der anderen.
 *
 * Dazu las die Farbwahl den rohen Wert und verglich ihn wörtlich. Bei den
 * alten Statuswerten („Lead", „Im Closing") traf sie deshalb keinen Zweig —
 * die Pille blieb grau.
 *
 * Grün heißt: Dieser Schritt ist geschafft. Für den Setter ist ein
 * vereinbartes Abschlussgespräch das Ziel, nicht bloß ein Zwischenstand.
 */
export function statusFarbe(lead, stufe = null) {
  const s = normalisiere(lead?.status)
  // Der angezeigte Stand schlägt den gespeicherten: siehe statusBasisVonLead.
  const uebergeben = statusBasisVonLead(lead, stufe) === STATUS.ABSCHLUSS_VEREINBART

  if (IST_VERLOREN.includes(s)) return 'bg-error-container text-error'
  if ([STATUS.TERMIN_ABGESAGT, STATUS.NICHT_ERSCHIENEN].includes(s)) {
    return 'bg-error-container text-error'
  }
  if (uebergeben
      || [STATUS.BERATUNG_GEFUEHRT, STATUS.GEWONNEN, 'Abgeschlossen',
          STATUS.ANGEBOT_UNTERSCHRIEBEN].includes(s)) {
    return 'bg-success-container text-success'
  }
  if (s === STATUS.WIRD_NACHGEFASST) return 'bg-warning-container text-warning'
  return 'bg-secondary-container text-primary'
}
