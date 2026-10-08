import { statusBasisVonLead, statusZusatzVonLead } from '../../shared/status.js'

/**
 * Der Stand eines Kontakts: Pille, und darunter was ihn genauer macht.
 *
 * „Beratungsgespräch geführt" trägt drei verschiedene Kontakte — den noch
 * nicht dokumentierten, den vertagten und den übergebenen. Welcher es ist,
 * stand bisher nur im Detailfeld. Jetzt steht es unter der Pille.
 *
 * Warum nicht in der Pille: Sie bricht nicht um (whitespace-nowrap), und
 * „Beratungsgespräch geführt · Entscheidung vertagt" sprengte in einer Zeile
 * jede Spalte.
 *
 * Der Zusatz trägt den Warnton, die Pille behält ihren: Das Gespräch IST
 * geführt — grün ist richtig. Offen ist nur, wie es weitergeht, und das steht
 * in der zweiten Zeile.
 */
export default function StatusAnzeige({ lead, stufe = null, farbe = '', text = null }) {
  const basis = text ?? statusBasisVonLead(lead, stufe)
  const zusatz = statusZusatzVonLead(lead)

  if (!basis) return null

  return (
    <span className="inline-flex flex-col items-start gap-1 min-w-0">
      <span className={`inline-flex px-2.5 py-1 rounded-full text-label-sm whitespace-nowrap
        ${farbe || 'bg-surface-container text-on-surface-variant'}`}>
        {basis}
      </span>
      {zusatz && (
        <span className="inline-flex items-center gap-1.5 pl-1 text-label-sm text-warning whitespace-nowrap">
          {/* Ein kurzer Strich statt eines zweiten Etiketts: Der Zusatz
              gehört zur Pille darüber, er steht nicht neben ihr. */}
          <span aria-hidden="true" className="w-2.5 h-px bg-current opacity-50 flex-shrink-0" />
          {zusatz}
        </span>
      )}
    </span>
  )
}
