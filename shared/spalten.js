// Der Spaltenkatalog der Listen — eine Quelle für Opening, Setting und Closing.
//
// Vorher hatte jede Stufe ihre eigene Tabelle: Opening sieben Spalten, Setting
// sechs, Closing acht, darunter zweimal „Status" nebeneinander. Gleiche Dinge
// hießen verschieden („Vertriebler", „Coldcaller", „Closer"), die Sortierung
// war dreimal anders, und wer eine Spalte vermisste, konnte nichts tun.
//
// Hier steht, welche Spalten es gibt, wie sie heißen und wo sie standardmäßig
// stehen. Das Aussehen einer Zelle entscheidet `art`, gerendert wird es in
// src/components/LeadTabelle.jsx. Welche Werte eine Zeile mitbringt, normiert
// src/utils/zeile.js — je Stufe einmal, danach heißt überall dasselbe gleich.

export const STUFE = {
  OPENING: 'opening',
  SETTING: 'setting',
  CLOSING: 'closing'
}

// art:
//   symbol   — Icon-Kachel (Terminart oder Status)
//   titel    — Unternehmen samt Untertitel; trägt auf schmalen Schirmen mehr
//   text     — schlichter Text
//   kontakt  — Telefon und E-Mail untereinander
//   datum    — Datum mit Uhrzeit, mit Hinweis wenn überfällig
//   tag      — Datum ohne Uhrzeit
//   badge    — farbiger Status
//   geld     — Betrag in Euro
//   zahl     — Zahl, rechtsbündig
//   prozent  — Prozentwert
//   person   — Name mit Personen-Symbol
//   verlauf  — der letzte Eintrag aus dem Verlauf
//
// ab: ab welcher Breite die Spalte erscheint (Tailwind-Stufe). Ohne Angabe
// steht sie immer.
export const SPALTEN = [
  // ── Das Gerüst: steht überall und lässt sich nicht abwählen ──────────────
  { schluessel: 'art', name: 'Art', art: 'symbol', fest: true,
    stufen: ['opening', 'setting', 'closing'] },
  { schluessel: 'unternehmen', name: 'Unternehmen', art: 'titel', fest: true,
    stufen: ['opening', 'setting', 'closing'] },

  // ── Standard je Stufe ────────────────────────────────────────────────────
  { schluessel: 'ansprechpartner', name: 'Ansprechpartner', art: 'text', ab: 'md',
    stufen: ['opening', 'setting', 'closing'], standard: ['opening', 'setting', 'closing'] },
  { schluessel: 'ort', name: 'Ort', art: 'text', ab: 'lg',
    stufen: ['opening', 'setting', 'closing'], standard: ['opening', 'setting', 'closing'] },
  { schluessel: 'kontakt', name: 'Kontakt', art: 'kontakt', ab: 'xl',
    stufen: ['opening', 'setting', 'closing'], standard: ['opening', 'closing'] },
  { schluessel: 'termin', name: 'Termin', art: 'datum',
    stufen: ['setting', 'closing'], standard: ['setting', 'closing'] },
  { schluessel: 'ergebnis', name: 'Ergebnis', art: 'badge',
    stufen: ['opening'], standard: ['opening'] },
  { schluessel: 'status', name: 'Status', art: 'badge',
    stufen: ['setting', 'closing'], standard: ['setting', 'closing'] },
  { schluessel: 'zustaendig', name: 'Zuständig', art: 'person', ab: 'lg',
    stufen: ['opening', 'setting', 'closing'], standard: ['closing'] },
  { schluessel: 'aktivitaet', name: 'Letzte Aktivität', art: 'verlauf', ab: 'xl',
    stufen: ['opening'], standard: ['opening'] },

  // ── Wählbar: Herkunft und Rollen ─────────────────────────────────────────
  { schluessel: 'quelle', name: 'Quelle', art: 'text', ab: 'lg',
    stufen: ['opening', 'setting', 'closing'] },
  { schluessel: 'terminart', name: 'Terminart', art: 'text', ab: 'lg',
    stufen: ['setting', 'closing'] },
  { schluessel: 'bundesland', name: 'Bundesland', art: 'text', ab: 'xl',
    stufen: ['setting', 'closing'] },
  { schluessel: 'opener', name: 'Opener', art: 'person', ab: 'lg',
    stufen: ['setting', 'closing'] },
  { schluessel: 'setter', name: 'Setter', art: 'person', ab: 'lg',
    stufen: ['setting', 'closing'] },
  { schluessel: 'closer', name: 'Closer', art: 'person', ab: 'lg',
    stufen: ['closing'] },

  // ── Wählbar: Website-Zahlen ──────────────────────────────────────────────
  { schluessel: 'besucher', name: 'Besucher/Monat', art: 'zahl', ab: 'lg',
    stufen: ['opening', 'setting', 'closing'] },
  { schluessel: 'mehrwert', name: 'Mehrwert', art: 'geld', ab: 'lg',
    stufen: ['opening', 'setting', 'closing'] },
  { schluessel: 'absprungrate', name: 'Absprungrate', art: 'prozent', ab: 'xl',
    stufen: ['opening', 'setting', 'closing'] },
  { schluessel: 'leads_pro_monat', name: 'Leads/Monat', art: 'zahl', ab: 'xl',
    stufen: ['opening', 'setting', 'closing'] },

  // ── Wählbar: Deal-Werte ──────────────────────────────────────────────────
  { schluessel: 'paketname', name: 'Paket', art: 'text', ab: 'lg',
    stufen: ['closing'] },
  { schluessel: 'setup', name: 'Setup', art: 'geld', ab: 'lg', stufen: ['closing'] },
  { schluessel: 'retainer', name: 'Retainer', art: 'geld', ab: 'lg', stufen: ['closing'] },
  { schluessel: 'laufzeit', name: 'Laufzeit', art: 'text', ab: 'xl', stufen: ['closing'] },

  // ── Wählbar: Fristen und Nachfassen ──────────────────────────────────────
  { schluessel: 'wiedervorlage', name: 'Wiedervorlage', art: 'tag', ab: 'lg',
    stufen: ['opening', 'closing'] },
  { schluessel: 'zugesagt_bis', name: 'Zugesagt bis', art: 'tag', ab: 'lg',
    stufen: ['closing'] },
  { schluessel: 'angebot_verschickt', name: 'Angebot verschickt', art: 'tag', ab: 'xl',
    stufen: ['closing'] },
  { schluessel: 'nachfass_schritt', name: 'Nachfass-Schritt', art: 'zahl', ab: 'xl',
    stufen: ['closing'] },
  { schluessel: 'no_shows', name: 'Nicht erschienen', art: 'zahl', ab: 'xl',
    stufen: ['setting', 'closing'] },
  { schluessel: 'mobilnummer', name: 'Mobilnummer', art: 'text', ab: 'xl',
    stufen: ['setting', 'closing'] }
]

/** Alle Spalten, die in dieser Stufe überhaupt zur Wahl stehen. */
export function spaltenFuer(stufe) {
  return SPALTEN.filter(s => s.stufen.includes(stufe))
}

/** Die Spalten, die ohne eigene Auswahl stehen: Gerüst plus Standard. */
export function standardSpalten(stufe) {
  return spaltenFuer(stufe)
    .filter(s => s.fest || (s.standard || []).includes(stufe))
    .map(s => s.schluessel)
}

/** Aus gespeicherten Schlüsseln die Spalten in Katalogreihenfolge. */
export function spaltenAus(stufe, schluessel) {
  const gewaehlt = Array.isArray(schluessel) && schluessel.length
    ? new Set(schluessel)
    : new Set(standardSpalten(stufe))
  return spaltenFuer(stufe).filter(s => s.fest || gewaehlt.has(s.schluessel))
}
