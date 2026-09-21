# Plan v2 — nach dem Testlauf vom 21.09.2026

Grundlage sind drei Dokumente und ein Testlauf:

| Quelle | Stand | liegt unter |
|---|---|---|
| Feedback aus dem Test, Opening und Setting | 21.09.2026 | `docs/ressourcen/2026-09-21-feedback-test-v2.txt` (Text) und die `.docx` daneben |
| CRM-Feldspezifikation | Inhalt bis 20.09.2026 | `docs/ressourcen/2026-08-28-crm-feldspezifikation.md` |
| Ressourcen und Mailstrecken (Paket 4) | Inhalt bis 16.09.2026 | `docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md` |
| Miro F23–F25 (Soll-Prozess, Feldtabelle, Mail-Übersicht, Schema-Delta, Status-Übergänge, Tickets) | gelesen 21.09.2026, Tickets 16–18 vom 20.09. | Board „Sunside AI CRM — Prozess- & Systemlandkarte" (`uXjVH0WcKV0=`), Abgleich im nächsten Abschnitt |

Die Feldspezifikation nennt Miro als verbindliche Quelle für die Reihenfolge der Felder, und das
Feedback verweist ausdrücklich darauf („Siehe mitgelieferte md und Miro-Board").

---

## Was Miro ergänzt (Abgleich vom 21.09.)

**Kurz:** Für die Setting-Maske bringt Miro nichts, was nicht schon in der Feldspezifikation steht.
Die F24-Tabelle und Block 3 der Spezifikation stimmen wörtlich überein, auch die neue Spalte
„Sichtbar am Feld". Neu sind die drei Bauaufträge vom 20.09. (Tickets 16–18), die Mail-Regeln aus
F25.1 und die Übergangsmatrix F25.3. Drei Stellen auf dem Board sind veraltet.

**Setting-Maske (Ticket 16, 17, 18). Punkte, die im Plan bisher fehlten, stehen jetzt in 1.2:**
- Gates von sechs auf **fünf**: Problem im Wortlaut, Wer mitentscheidet, Erfolgskriterien,
  Investitionsrahmen, Abschlusstermin. Die Zahlenfelder sind Pflicht (Warnung), kein Gate, und
  „Kunde wollte keine Zahlen nennen" hebt den ganzen Zahlenblock auf.
- **Erfolgskriterien bekommen ein eigenes Feld** („Was passieren müsste, damit es sich gelohnt hat").
  Heute stecken sie mit dem Entscheider in `entscheider_messlatte`.
- **Raus aus der Setter-Maske:** das Häkchen „fragt von sich aus nach Preis" (bleibt im Opening),
  das Ja/Nein zum Vorabschluss (die offene Hürde wird optionaler Freitext), „Versendete Unterlagen"
  wird reine Anzeige.
- **Neu in der Setter-Maske:** Mobilnummer (vorbelegt, Pflicht nur wenn leer, Fragesatz nur bei
  leerem Feld) und ein **eigenes „Ergebnis des Gesprächs" für den Setter**. Zu prüfen ist, ob
  `gespraechsausgang` heute nur das Abschlussgespräch meint. Dann braucht es eine zweite Spalte.
- **Fragesatz am Feld:** genau eine Variante sichtbar, gesteuert von „Ziel bestätigt oder
  korrigiert", und sie wechselt mit, wenn der Setter das Ziel im Gespräch ändert. Zwei Textarten:
  Sie-Satz in Anführungszeichen zum Vorlesen, „Setter-Hinweis" anders eingefärbt. Einen Vorsatz
  gibt es nur an zwei Feldern (bisherige Versuche, offene Hürde).
- **Sichtbarkeitsregeln:** „Aufträge im letzten Jahr" ist bei Ziel Kaufinteressenten ausgeblendet.
  „Anrufe pro Woche" erscheint nur, wenn Erreichbarkeit Thema war (Auslöser ist offen, siehe E9).
  Die Kennzeichen „genannt/geschätzt" stehen auf derselben Zeile wie die Eingabe.

**Fragen-Bubble (Ticket 17).** Sie steht **über dem Notizfeld**, nicht über dem ganzen
Arbeitsbereich. Sie erscheint bei „andere", bei Vorhaben **und bei Sachverständigen**, dort mit
voller Maske. Beim ersten Öffnen läuft genau ein Modellaufruf, das Ergebnis wird gespeichert, und
es gibt eine Schaltfläche „Neue Vorschläge". In den Prompt gehen nur Branche, Vorhaben-Wortlaut,
Problem-Wortlaut und Ziel, keine Namen, keine Firma und keine Kontaktdaten. Heraus kommen höchstens
sieben Fragen in Sie-Form. Fällt der Aufruf aus, erscheint die Basis unverändert. Die Bubble füllt
nie ein Feld. Nötig sind ein Zeitlimit und eine Protokollierung ohne Kundendaten.

**Mails (F25.1).** Das Nachfassen läuft **ohne getaktete Serie** (Regel vom 15.09.): Das CRM legt
das passende Stück vor, der Closer wählt Zeitpunkt und Reihenfolge, und ein gebuchter Folgetermin
pausiert das Nachfassen. Der Code ist schon so gebaut (Commit `3dc7c19`). Dazu kommen feste Regeln:
Event-Namen „Bestandsaufnahme mit Sunside AI" und „Ihr persönliches Konzept mit Sunside AI",
Team-Signatur ohne Personennamen in Calendly-Mails und SMS, keine Terminzeiten in Mails, `{VSL-Link}`
als verlinktes Wort, drei Versand-Vermerke an der Bestätigungsmail („Was ich mitgenommen habe",
„gestern" am Folgetag). Noch **in Freigabe** sind die Käufer-Übergangsfassung der Segment-Mail und
drei Texte für die Themen-Bausteine im Nachfassen.

**Veraltet auf dem Board:**
1. **F24, Block Erstanruf:** Dort stehen noch „Berufsgruppe", Einfachauswahl plus
   Priorisiert-Häkchen und „Vom Kunden bestätigt". Das Feedback vom 21.09. ist neuer und gilt
   (1.1).
2. **Ticket 12 „Nachfass-Serien-Motor"** mit Tag 0/4/10/21/35: Die Regel vom 15.09. in F25.1 hat
   es überholt.
3. **Ticket-Status:** Laut Commits sind 6, 10, 11, 13, 14 und 15 gebaut (`097a2c4`, `c0dd56b`,
   `b7930c1`, `dfc91e1`, `6fe1d8a`). Auf dem Board stehen sie noch offen. Ticket 7 ist teilweise
   gebaut: Das Abschlussgespräch wird inzwischen echt gebucht (`0af4180`). Wirklich offen sind 9
   (Empfehlungsfenster und Vorlagen-Import, entspricht Phase 3) und 16–18 (Phase 1 und 4).

---

## Zustand der Arbeitskopien (vor dem ersten Schritt geklärt)

- Die Arbeitskopie unter `/tmp/crmnach` hat die automatische Aufräumung von macOS am 21.09. um
  00:11 zerstört. **Kein Verlust:** Der gesamte Stand liegt auf `origin/osc-umbau`, Commit
  `c208aeb`. Gearbeitet wird ab jetzt in `CRM-arbeit` neben dem Repo, nicht mehr in `/tmp`.
- Der lokale Branch `osc-umbau-farben` trägt einen Commit, der nicht auf origin liegt:
  „Clear the last default-violet leftovers" vom 12.09. Er ist **gegenstandslos** — die dort
  behandelten Stellen sind im aktuellen Stand längst auf der Hausfarbe, die Mailvorlagen wurden
  inzwischen komplett ersetzt. Geprüft: null Treffer für die alten Violett-Werte.

---

## Phase 0 — Was im Test kaputt war (sofort, hängt an keiner Entscheidung)

**0.1 Die Calendly-Buchung scheitert nach der Buchung.**
Reihenfolge im Code ist falsch: Der Calendly-Termin wird gebucht, und **erst danach** prüft der
Server die Pflichtfelder der Übergabe 1 (`TerminPicker.jsx`, 422-Zweig nach dem Buchen). Fehlt ein
Feld, entsteht ein Termin im Kalender des Kunden, aber kein Kontakt im CRM. Genau das beschreibt
das Feedback zweimal („Calendly Buchung ist fehlgeschlagen", „Diesen Hinweis sieht man kaum").
→ Prüfung vor die Buchung ziehen, fehlende Felder am Knopf anzeigen und im Formular markieren.

**0.2 „Termin mit Closer buchen" heißt jetzt „Termin mit Setter buchen"** (drei Stellen in
`Opening.jsx`). Der Opener übergibt an den Setter, nicht an den Closer.

**0.3 Die Terminart-Zuordnung ist unvollständig.** In Calendly gibt es drei Terminarten,
zugeordnet sind zwei: „Abschlussgespräch" und „Kostenloses Beratungsgespräch". **„Unverbindliches
Beratungsgespräch" fehlt** — bei einer Buchung darüber weiß der Webhook nicht, welches Gespräch
gemeint ist.

**0.4 Das Notizfeld im Termin-Dialog verschwindet dort** und taucht am Ende der Übergabe wieder
auf (Feedback: „Notizfeld hier ist Quatsch, weil er im Folgenden noch Infos ausfüllen muss").

*Nachweis:* echte Testbuchung auf der Vorschau, einmal mit vollständigen und einmal mit fehlenden
Pflichtfeldern.

---

## Phase 1 — Die Felder neu schneiden (der große Block)

Quelle: Feldspezifikation, Abschnitt „Setting-Maske" in der Fassung vom 20.09., plus die
Umbenennungen aus dem Feedback. Die Spezifikation und der gebaute Stand weichen an rund
25 Stellen voneinander ab.

**1.1 Übergabe 1, Opening**
- „Berufsgruppe" → **„Branche"**, bei „andere" ein Freitextfeld dazu.
- „Was der Kunde erreichen will" wird **Mehrfachauswahl mit einem priorisierten Ziel** (heute
  Einfachauswahl plus Häkchen). Das priorisierte Ziel steuert Testimonial und VSL.
- „Bisherige Versuche und Anbieter" → **„Bisherige Versuche und Anbieter zur Lösung des
  Problems"**, rutscht direkt hinter „Größtes Problem", zusammen mit „Wer oder was genau".
- „Vom Kunden bestätigt" → **„Termin vom Kunden bestätigt"**.
- **Neu:** Entscheider (Name und Funktion), Termin als Datum/Uhrzeit-Feld, Notizfeld am Ende.
- **Neu, berechnet:** Häkchen A und B, Tiefe. Häkchen C bleibt der einzige Handklick und nur im
  Opening (im Setting seit 20.09. abgeschafft).

**1.2 Setting-Maske**
- Neuzuschnitt auf 13 Felder mit fünf Gates laut Spezifikation.
- **Zielabhängige Zahlenblöcke:** Eigentümer (Zuwachs, Quote), Kaufinteressenten (Objekte im Jahr,
  ernsthafte Anfragen je Objekt), Zeit (Zeitfresser, Stunden pro Woche, Anrufe pro Woche).
- **Reduzierter Modus:** Branche „andere" oder Vorhaben = ja hebt die inhaltlichen Gates auf, es
  blockiert nur noch der Abschlusstermin. Dann **nur dort** erscheint das Notizfeld, mit einer
  Zeile, warum.
- **Übersetzung für Sachverständige:** aus „Eigentümeranfragen" werden „Bewertungsanfragen", und
  zwar in jedem Fragesatz, Tooltip und Rechenergebnis.
  Miro löst das nur in der Bubble. Das Feedback verlangt mehr und ist neuer, deshalb gilt es auch
  für Feldnamen und Fragesätze.
- **Die Fragen aus dem Skript** stehen am Feld, nicht nur im Tooltip, nach den Regeln aus Ticket 18
  (eine Variante je Ziel, Sie-Satz und Setter-Hinweis getrennt eingefärbt, kein Schalter zum
  Ausblenden).
- **Eigenes Feld für die Erfolgskriterien**, getrennt vom Entscheider (Ticket 16, ersetzt E5).
- **Raus:** das Preis-Häkchen, das Ja/Nein zum Vorabschluss. „Versendete Unterlagen" wird Anzeige.
- **Rein:** Mobilnummer (Pflicht nur wenn leer) und ein eigenes Ergebnis des Beratungsgesprächs.
- „Investitionsrahmen" wird Freitext (Feedback). Spezifikation und Miro sagen „Betrag oder
  ausgewichen". Siehe Entscheidung E4.

**1.3 Datenbank**
Neue Spalten für die neuen Felder, Umbenennungen für die geänderten, Migration im selben Fenster
wie die übrigen. Bestehende Daten bleiben lesbar.

**1.4 Zwei Gates entschärfen**
`material_versendet` und `offene_huerde` blockieren heute die Übergabe. Die Spezifikation stuft
beide herab: Das eine füllt das System selbst, das andere ist optional.

*Nachweis:* Formularlauf Opening → Setting auf der Vorschau, je einmal vollständig, einmal mit
leeren Gates, einmal im reduzierten Modus; dazu die Gegenprobe, dass alte Kontakte weiter lesbar
sind.

---

## Phase 2 — Sprache

**2.1 Humanizer-Durchgang.** 67 Textstellen in 19 Dateien tragen Gedankenstriche im
KI-Muster, dazu die üblichen Wendungen. Die Oberfläche soll klingen, als hätte sie ein Mensch
geschrieben.

**2.2 Tooltips und Hilfetexte neu.** 24 Hilfetexte hängen heute an den Feldern. Sie sollen
erklären, was ein Dritter verstehen kann, und die Felder sollen ohne Tooltip verständlich sein.
Paul liefert die Texte nach, ich ziehe sie ein und gehe sie mit ihm durch.

*Nachweis:* Wortliste vorher/nachher, Screenshots je Maske.

---

## Phase 3 — Mails

**3.1 Vorlagenkatalog** aus Paket 4 anlegen: die vier Segment-Mails (Eigentümer, Kaufinteressenten,
Automatisierung, Sachverständige), die Vorhaben-Fassung, die Bestätigungsmail nach dem Setting mit
ihren vier Magnet-Einschüben, das Nachfass-Toolkit (acht Vorlagen), Abschied und Ablehnung.
Wortlaut kommt unverändert aus dem Dokument, das bleibt die redaktionelle Quelle.

**3.2 Empfehlung statt Suche.** Im Opening schlägt das CRM die passende Mail vor — Eigentümer:
Streil, Automatisierung und Sachverständige: Beier, Kaufinteressenten: offen (E7). Nach dem Setting
entsprechend das VSL, bei Automatisierung getrennt nach Propstack und Pipedrive. Eine Empfehlung,
eine Zeile Begründung, ein Klick in die vorbefüllte Mail. Nichts geht automatisch raus.

**3.3 Regeln maschinell:** ein Hauptinhalt, höchstens ein Beleg, genau ein nächster Schritt; jedes
Stück je Kontakt nur einmal (Abgleich gegen „zuletzt gesendetes Material"); das feste Anreden- und
Gruß-Schema; keine Uhrzeit und kein Datum für kommende Termine; keine Emojis.

**3.4 Signatur der Kundenmails** vereinheitlichen — der Rest aus der letzten Runde.

*Nachweis:* `scripts/mails-vorschau.mjs` um die neuen Vorlagen erweitern, alle Fassungen rendern
und automatisch prüfen (Betreffschema, Platzhalter, Emojis, Textfassung).

---

## Phase 4 — Hilfen im Gespräch

**4.1 Fragen-Bubble im Setting.** Aus Branche oder genanntem Vorhaben schlägt die KI wenige Fragen
nach dem CLOSER-Framework vor (Ziel, Problem, bisherige Versuche, was er bräuchte, Messlatte in
einem halben Jahr, Budget, Entscheider). Nicht bearbeitbar, **über dem Notizfeld**, als Hilfe beim
Zuhören. Sie erscheint bei „andere", bei Vorhaben und bei Sachverständigen. Die technischen
Leitplanken aus Ticket 17 stehen oben im Miro-Abgleich: ein gespeicherter Aufruf, keine
Kundendaten im Prompt, Rückfall auf die Basis.

**4.2 Die Mail-Bausteine** aus der letzten Runde auf die neuen Felder umstellen.

*Nachweis:* an echten Kontakten, mit sichtbarer Grundlage; ohne Angaben kein erfundener Text.

---

## Phase 5 — Nachfassen und Auswertung

- Zähler und Fristen: höchstens fünf Versuche, 48 Stunden nach geplatztem Termin, 14 Tage beim
  Zweifler, Wiedervorlage nach sechs Monaten oder zum genannten Zeitpunkt.
- „Ein gebuchter Termin schlägt jede Mail": steht ein Termin, ruht das Nachfassen.
- „Verloren, wiedervorlagefähig" mit Pflicht-Datum und Grund.
- Zwei Auswertungen, die es heute nicht gibt: **Vorgänge ohne einen einzigen Termin in der
  Zukunft** und **Anteil der Beratungsgespräche mit ausgesprochenem Bedarf**.

*Nachweis:* Gegenrechnung per SQL, wie bei den Dashboards.

---

## Phase 6 — Go-live

Unverändert, aber **nach** Phase 1 bis 3: Huuswert auf „Gewonnen", `main` veröffentlichen,
`20260913_osc_statuskette.sql`, `20260913_osc_setter_rueckwirkend.sql`,
`20260918_osc_rollenzuschnitt.sql`, danach die Kontrollabfragen. Vorher live zu gehen hieße, die
Masken zweimal zu bauen.

---

## Entscheidungen, die ich brauche

| # | Frage | Warum sie blockiert |
|---|---|---|
| E1 | ~~Zugang zum Miro-Board~~ | **erledigt 21.09.**, Board gelesen |
| E2 | Ziel-Werte: kurz („Eigentümer") oder lang („Mehr Eigentümer-Anfragen")? Und heißt der Ausweichwert „nicht erhoben" oder „noch nicht besprochen"? | Wert steht in der Datenbank und in jeder Mailregel. **Vorschlag nach Miro:** lange Werte wie in F24 und im Code, „Noch nicht besprochen" als Wert. „Nicht erhoben" ist in F24 nur der Ziel-Status, der die Fragesätze steuert. |
| E3 | ~~Zählen die Zahlenfelder zu den Gates?~~ | **geklärt durch Ticket 16:** nein. Die fünf Gates sind Problem, Wer mitentscheidet, Erfolgskriterien, Investitionsrahmen und Abschlusstermin. Die Zahlen sind Pflicht mit Warnung. |
| E4 | Investitionsrahmen: Freitext (Feedback) oder Betrag mit „ausgewichen" (Spezifikation und Miro)? | zwei gegen eins, aber das Feedback ist das neueste. Bleibt offen. |
| E5 | ~~Entscheider und Erfolgskriterien trennen?~~ | **geklärt durch Ticket 16:** ja, eigenes Feld. Bestehende Einträge in `entscheider_messlatte` bleiben beim Entscheider und werden nicht automatisch geteilt. |
| E6 | Vorerfahrung ist Gate, hat aber den Wert „nicht gefragt" | ein Gate, das man mit „nicht gefragt" erfüllt, blockiert nichts |
| E7 | Material für Kaufinteressenten (Video, VSL, Fallstudie van Hoorn?) | ohne das bleibt ein Segment ohne Empfehlung |
| E8 | Welche Felder sollen in Calendly noch abgefragt werden, und wer pflegt es? | Feedback verlangt „so wenig wie notwendig", der Unternehmensname muss mit |
| E9 | Woran erkennt die Maske, dass Erreichbarkeit Thema war, damit „Anrufe pro Woche" erscheint? | Miro nennt keinen Auslöser. Vorschlag: ein kleines Häkchen „Erreichbarkeit war Thema" im Zeit-Zahlenblock. |
| E10 | Soll ich das Board nachziehen: F24-Erstanruf auf den Stand des Feedbacks, Tickets 6, 10, 11, 13, 14 und 15 auf erledigt, Ticket 12 als überholt markieren? | Das Board ist die Quelle fürs Team. Wer es liest, sieht sonst einen falschen Stand. |

---

## Blockaden, die nicht bei mir liegen

- **Freigaben** in F25.1: Käufer-Übergangsfassung der Segment-Mail und drei Texte für die
  Themen-Bausteine im Nachfassen. Die Struktur lässt sich bauen, die Texte kommen nach der Freigabe.
- **Assets:** VSL Eigentümergewinnung, VSL Automatisierung (Propstack/Pipedrive), Käufer-Video,
  Webinar und die Voicebot-Nummer sind laut Paket 4 noch nicht fertig. Bis dahin gelten die
  Übergangsfassungen (Loom-Video, Beier-Referenzschreiben, van-Hoorn-Fallstudie).
- **Tooltip-Texte** liefert Paul nach.

---

## Reihenfolge in einem Satz

Phase 0 ist bis auf das Notizfeld erledigt (`742f793`, `41ff088`). Das Notizfeld wandert in
Phase 1. Danach kommt Phase 1 zusammen mit den offenen Entscheidungen E2, E4, E6 und E9, Phase 2 nebenher,
Phase 3 sobald die Felder stehen, dann 4 und 5, und erst danach das Go-live-Fenster.
