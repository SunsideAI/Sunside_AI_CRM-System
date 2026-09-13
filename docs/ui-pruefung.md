# UI-Prüfung der Vorschau, 12.09.2026

Durchgang mit Playwright über alle acht Seiten, je in 1440×900 und 390×844,
angemeldet als reiner Setter. Geprüft wurde auf: waagerechtes Überlaufen,
herausragende und abgeschnittene Elemente, zu kleine Bedienelemente, Knöpfe
ohne Beschriftung, Fehler in der Browserkonsole und fehlgeschlagene Aufrufe.

## Gefunden und behoben

### 1. Jeder Dialog hatte einen unsichtbaren Hintergrund

`bg-scrim/50` stand an **acht** Stellen im Code — Schublade, Mitarbeiter-
Verwaltung, Closer-Pool, Kalender-Detail, Dashboard, Follow-Up, Opening.
Die Farbe `scrim` war im Tailwind-Config nie definiert, die Klasse erzeugte
also **keine einzige CSS-Regel**. Die Seite darunter blieb voll sichtbar,
der Dialog wirkte wie ein Darstellungsfehler.

Nachweis im gebauten CSS: vorher kein Treffer, jetzt
`.bg-scrim\/50{background-color:#151c2780}`.

### 2. Ein unauflösbarer Name lieferte den gesamten Bestand

`hot-leads` GET behandelte einen `setterName`/`closerName`/`openerName`,
der sich nicht zu einer Nutzer-ID auflösen ließ, als *kein Filter* statt als
*keine Treffer*. Ein Setter ohne einen einzigen Termin sah dadurch 144
„Anstehend" und 305 Kontakte — die Pipeline aller Kollegen.

Die Abfrage liefert jetzt eine leere Liste. Sie schließt zu, nicht auf.

### 3. Das Dashboard kannte die Setter-Rolle nicht

Ein Setter passte in keine der Anzeige-Bedingungen und sah **eine** Kachel
in einem Raster für vier; der Rest der Seite war leer. Ergänzt: „Meine
Beratungsgespräche", „Abschlüsse Monat" (die Schnittstelle zählt Gewonnene
über `closer_id` *oder* `setter_id` — die Zahl stimmt für beide Rollen) und
der Schnellzugriff auf den Setting-Tab.

### 4. Ein Setter wurde als Closer gemeldet

`userRole` wurde als `Admin | Coldcaller | Closer` berechnet — für einen
Setter fiel das auf `Closer`. Die Function wertet die Rolle heute nicht aus,
die falsche Angabe wartet aber nur darauf, es zu tun.

### 5. Der Scrollbalken erschien erst beim Nachladen

`scrollbar-gutter: stable` wirkt nur auf Scroll-Container; `<html>` stand auf
`overflow-y: visible`, der Platz wurde also nie reserviert. Eine Seite, die
leer startet und mit den Daten wächst, bekam ihren Balken mitten im Laden —
alles Mittige sprang um dessen halbe Breite. Behoben mit `overflow-y: scroll`.

Dazu die Kopfzeile von `fixed` auf `sticky`: Ein fixierter Kopf richtet sich
an der Fensterkante aus, der Inhalt an der Dokumentkante — zwei verschiedene
Breiten, sobald ein Balken Platz braucht.

## Geprüft und in Ordnung

- **Rollensperre der Seiten.** Ein reiner Setter, der `/opening`, `/closing`,
  `/finanzen` oder `/follow-up` direkt aufruft, landet auf `/dashboard`.
- **Kein waagerechtes Überlaufen** auf keiner Seite, in keiner der beiden
  Breiten.
- **Keine abgeschnittenen Texte** ohne `truncate`, keine Knöpfe ohne
  Beschriftung, keine Bedienelemente unter 24 px.

## Zwei Fehlalarme meiner eigenen Prüfung

Beide erwähnt, weil sie sonst beim nächsten Durchgang wieder auftauchen:

- **„Element ragt heraus"** bei `div.absolute.-right-6` auf mehreren Seiten.
  Das ist der Zierkreis der Hero-Kachel. Sein Layout-Kasten ragt hinaus, der
  Elternkasten hat aber `overflow-hidden` — sichtbar ist nichts.
  `getBoundingClientRect()` weiß nichts von Beschneidung.
- **„Anfrage fehlgeschlagen"** beim Dashboard-Aufruf: `ERR_ABORTED` durch den
  doppelten Mount im Entwicklungsmodus. Der zweite Aufruf kommt mit 200.

### 6. „Meine Leads im Closing" zeigte dem Opener nichts

Der Block ist mit Absicht für alle Rollen da: Opener und Setter sollen sehen,
was in der nächsten Phase mit den Kontakten passiert, die sie übergeben haben.
Er fragte aber nur als **Closer** und als **Setter** ab.

Vor dem Umbau fiel das nicht auf, weil `setter_id` auf den zeigte, der den
Termin gebucht hatte — also auf den Opener. Seit dem Umbau meint `setter_id`
wirklich den Setter, und der Opener hängt an `opener_id`. Damit sah genau die
Rolle nichts, für die der Block gedacht ist. Dritte Abfrage über `openerName`
ergänzt.

Gefunden nicht durch die Prüfung, sondern durch einen Hinweis von Paul: Ich
hatte den Block zuerst für falsch platziert gehalten und auf Closer begrenzt.
Das war meine Fehldeutung — die Absicht war eine andere, und dahinter lag der
eigentliche Fehler.

## Nicht behoben, weil es eine Entscheidung ist

Im Setting-Tab steht der Block „Beratungsgespräche ohne Setter" **über** der
Seitenüberschrift. Jede andere Seite beginnt mit ihrem Titel. Das war
Absicht — der Pool ist das Dringendste —, sieht aber uneinheitlich aus.
Soll er unter die Überschrift?
