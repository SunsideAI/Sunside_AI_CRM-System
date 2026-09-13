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

### 7. Die Schublade klebte an der Kante

Der Titel war eingerückt, der Inhalt darunter stand bündig am linken Rand:
`SlideDrawer` gab seinem Inhaltsbereich keinen Innenabstand, und der einzige
Aufrufer setzte auch keinen. Jetzt trägt ihn die Schublade selbst, wie die
Kopfzeile darüber ihn schon hatte.

### 8. Ein abgesagter Termin blieb beim Setter hängen

Eine Absage änderte nur den Status. `setter_id` blieb stehen — der Kontakt hing
bei jemandem, für den es nichts zu tun gab, und der Opener, der neu terminieren
muss, sah ihn nicht als seinen. Beide Wege stellen den Setter jetzt frei, der
Calendly-Webhook und die Statusänderung von Hand, und schreiben dazu ein
Ereignis `setter_freigestellt`, damit die frühere Zuordnung belegt bleibt. Der
Termin-Zeitstempel bleibt erhalten: Er beweist, dass es einen Termin gab.

Der Pool filtert zusätzlich serverseitig, statt sich auf das Frontend zu
verlassen — ein abgesagter Termin steht nicht zur Bewerbung.

Nachgewiesen am lebenden System: Testkontakt mit Setter angelegt, über die
Schnittstelle abgesagt, danach `setter_freigestellt = true`, `opener_bleibt =
true`, Termin erhalten, zwei Ereignisse geschrieben, nicht mehr im Pool.

### 9. Ein PATCH ohne `updates` endete in einer 500

Fehlte das Feld, lief die Funktion weiter und scheiterte erst an
`updates.kommentar` — mit einer internen Meldung, aus der niemand ablesen kann,
was am Aufruf falsch war. Jetzt eine 400 mit klarem Text.

### 10. Mein eigener Pool-Filter leerte den Pool

Beim Beheben von Punkt 8 verglich ich gegen den **gespeicherten** Status. Der
Bestand trägt in der Datenbank aber noch `Lead`; die neue Bezeichnung entsteht
erst beim Ausliefern. Der Pool ging dadurch von sieben Einträgen auf null.
`beideSchreibweisen()` gibt es genau dafür — `follow-up.js` benutzt es an zwei
Stellen bereits. Der `status`-Parameter der Abfrage hatte dieselbe Lücke.

Gefunden, weil ich nach der Änderung nachgesehen habe statt sie anzunehmen.

### 11. Der Pool stand über der Seitenüberschrift

Jede andere Seite beginnt mit ihrem Titel. Der Pool steht jetzt darunter.
