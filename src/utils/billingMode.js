// Automatischer billing_mode für Hot Leads beim Closing.
// Wird beim PATCH auf status='Abgeschlossen' im selben Payload mitgeschickt,
// damit der DB-Trigger, der die Bridge anstößt, sofort den korrekten Modus liest.
//
// Manuelle Overrides (provision_partner, manual_external, reference) haben
// Vorrang - deriveBillingMode kommt nur zum Einsatz wenn kein Modus explizit
// gewählt wurde ("auto").
export function deriveBillingMode(setup, retainer) {
  const s = Number(setup) || 0
  const r = Number(retainer) || 0
  if (s > 0 && r > 0) return 'standard'         // Setup + monatlicher Retainer
  if (s > 0 && r === 0) return 'one_time_paid'  // Nur Setup, kein Retainer
  if (s === 0 && r > 0) return 'recurring_only' // Nur Retainer (z.B. nach Gratis-Setup)
  return 'none'                                  // Fallback
}

export const BILLING_MODE_LABELS = {
  auto: 'Automatisch (aus Setup + Retainer ableiten)',
  standard: 'Standard – Setup + monatlicher Retainer',
  one_time_paid: 'Einmalzahlung – nur Setup',
  recurring_only: 'Nur Retainer – kein Setup',
  provision_partner: 'Provisions-Vermittler – Provision pro vermitteltem Lead',
  manual_external: 'Extern abgerechnet – manuelle Rechnung außerhalb CRM',
  reference: 'Referenzkunde – keine Abrechnung',
  none: 'Kein Abrechnungsmodell (wird von Bridge übersprungen)',
}
