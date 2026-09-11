// Die Rollen des Vertriebs - eine Quelle für Frontend und Functions.
//
// Aus zwei mach drei (Miro F23): Die heutigen Coldcaller werden Opener, der
// Setter wird erstmals aktiv vergeben, der Closer bleibt.
//
// Coldcaller steht weiter in der Liste, weil 18 aktive Nutzer ihn tragen. Wer
// ihn hat, darf, was ein Opener darf - sonst wäre am Tag der Umstellung die
// Kaltakquise für alle zu. Der Wert verschwindet, wenn die letzten Nutzer
// umgetragen sind, nicht vorher.

export const ROLLE = {
  OPENER:           'Opener',
  SETTER:           'Setter',
  CLOSER:           'Closer',
  ADMIN:            'Admin',
  GESCHAEFTSFUEHRER:'Geschäftsführer',
  COLDCALLER:       'Coldcaller'   // Übergang, gleichbedeutend mit Opener
}

/** Reihenfolge für Auswahllisten - der Prozess von vorn nach hinten. */
export const ROLLEN_VERGEBBAR = [
  ROLLE.OPENER,
  ROLLE.SETTER,
  ROLLE.CLOSER,
  ROLLE.ADMIN,
  ROLLE.GESCHAEFTSFUEHRER
]

export const ROLLEN_ALLE = [...ROLLEN_VERGEBBAR, ROLLE.COLDCALLER]

export const ROLLE_BESCHREIBUNG = {
  [ROLLE.OPENER]: 'Kaltakquise bis zum gelegten Termin. Füllt die Übergabe 1.',
  [ROLLE.SETTER]: 'Hält das Beratungsgespräch und füllt die Übergabe 2.',
  [ROLLE.CLOSER]: 'Führt das Abschlussgespräch und fasst nach.',
  [ROLLE.ADMIN]: 'Verwaltet Mitarbeiter, Zuteilungen und Anfragen.',
  [ROLLE.GESCHAEFTSFUEHRER]: 'Sieht zusätzlich die Zahlen.',
  [ROLLE.COLDCALLER]: 'Alte Bezeichnung des Openers. Wird abgelöst.'
}

const liste = (rollen) =>
  Array.isArray(rollen) ? rollen : (rollen ? [rollen] : [])

export function hatRolle(rollen, gesucht) {
  return liste(rollen).includes(gesucht)
}

/** Opener und Coldcaller sind dieselbe Aufgabe unter zwei Namen. */
export function istOpener(rollen) {
  return hatRolle(rollen, ROLLE.OPENER) || hatRolle(rollen, ROLLE.COLDCALLER)
}

export function istSetter(rollen)  { return hatRolle(rollen, ROLLE.SETTER) }
export function istCloser(rollen)  { return hatRolle(rollen, ROLLE.CLOSER) }

/** Leitung: darf verwalten und zuteilen. */
export function istLeitung(rollen) {
  return hatRolle(rollen, ROLLE.ADMIN) || hatRolle(rollen, ROLLE.GESCHAEFTSFUEHRER)
}

/**
 * Wer darf welche Seite öffnen. Die Prüfung im Frontend ist nur Bequemlichkeit -
 * verbindlich ist die Rollenprüfung in den Functions.
 */
export const SEITEN_ZUGANG = {
  kaltakquise:   [ROLLE.OPENER, ROLLE.COLDCALLER, ROLLE.ADMIN],
  termine:       null,                                   // alle Angemeldeten
  closing:       [ROLLE.CLOSER, ROLLE.ADMIN],
  'follow-up':   [ROLLE.CLOSER, ROLLE.ADMIN],
  finanzen:      [ROLLE.GESCHAEFTSFUEHRER],
  einstellungen: [ROLLE.ADMIN]
}
