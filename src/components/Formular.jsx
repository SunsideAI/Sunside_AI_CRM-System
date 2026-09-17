// Die Bausteine eines Formulars — ein Aufbau für alle Tabs.
//
// Bis hierher schrieb jeder Tab seine Formulare selbst aus: zehn Varianten für
// eine Feldbeschriftung, sechs für ein Eingabefeld. Das war keine Schlamperei,
// sondern das übliche Auseinanderlaufen über die Zeit — nur merkt es der,
// der zwischen Opening und Closing wechselt, sofort.
//
// Die Klassen stehen in index.css, damit auch Stellen davon profitieren, die
// (noch) kein JSX-Bauteil benutzen. Hier ist nur die Hülle drumherum.

/**
 * Ein Abschnitt mit Überschrift. Die Trennlinie zwischen zwei Abschnitten
 * setzt das CSS (`.abschnitt + .abschnitt`) — so gibt es über dem ersten
 * keine, ohne dass es irgendwo ein `index === 0` gäbe.
 */
export function Abschnitt({ titel, icon: Icon, aktion, children }) {
  return (
    <section className="abschnitt">
      {titel && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="abschnitt-titel flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" />}
            {titel}
          </h3>
          {aktion}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Ein Feld: Beschriftung oben, Eingabe darunter, Erklärung unten.
 *
 * Immer in dieser Reihenfolge und nie nebeneinander — zwei Spalten lesen sich
 * in einer 500 px breiten Schublade schlechter als eine.
 */
export function Feld({ name, pflicht, hinweis, fehler, htmlFor, children }) {
  return (
    <div>
      {name && (
        <label className="feld-label" htmlFor={htmlFor}>
          {name}
          {pflicht && <span className="feld-pflicht">*</span>}
        </label>
      )}
      {children}
      {fehler
        ? <span className="feld-hinweis text-error">{fehler}</span>
        : hinweis && <span className="feld-hinweis">{hinweis}</span>}
    </div>
  )
}

/**
 * Zwei Felder nebeneinander, auf schmalen Schirmen untereinander. Für Paare,
 * die zusammengehören — Vor- und Nachname, von und bis.
 */
export function Paar({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
}

/** Nur lesen: Beschriftung und Wert, ohne Eingabefeld. */
export function Angabe({ name, children, breit = false }) {
  return (
    <div className={breit ? 'sm:col-span-2 min-w-0' : 'min-w-0'}>
      <p className="feld-label mb-0.5">{name}</p>
      <div className="text-body-md text-on-surface break-words">{children ?? '–'}</div>
    </div>
  )
}

/** Mehrere Angaben als Raster — die übliche Kopfzeile einer Schublade. */
export function Angaben({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
}

/**
 * Die Fußleiste. Bleibt beim Scrollen stehen, damit "Speichern" nicht
 * gesucht werden muss.
 */
export function Fuss({ children }) {
  return <div className="formular-fuss">{children}</div>
}
