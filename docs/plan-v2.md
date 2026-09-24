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
  „Anrufe pro Woche" erscheint nur, wenn Erreichbarkeit Thema war (Häkchen, E9).
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

**Board nachgezogen am 21.09.** (E10). Drei Stellen waren veraltet und sind jetzt korrigiert:
1. **F24, Block Erstanruf:** stand noch auf „Berufsgruppe", Einfachauswahl plus Priorisiert-Häkchen
   und „Vom Kunden bestätigt". Jetzt auf dem Stand des Feedbacks (1.1), dazu Investitionsrahmen als
   Freitext (E4) und das Häkchen „Erreichbarkeit war Thema" (E9).
2. **Ticket 12 „Nachfass-Serien-Motor"** mit Tag 0/4/10/21/35 ist als überholt markiert, weil die
   Regel vom 15.09. in F25.1 ihn ersetzt.
3. **Ticket-Status mit Commit:** 6, 10, 11, 14 und 15 sind gebaut (`097a2c4`, `c0dd56b`, `b7930c1`,
   `dfc91e1`, `10f1af6`, `6fe1d8a`). Ticket 7 ist gebaut, aber der Folgetermin wurde gestrichen
   (`6795449`, `51f4a50`, `4fa3610`). Bei Ticket 13 fehlt ein Beleg für die Mahnstufe-3-Endstation,
   das vor dem Go-live prüfen. Alles liegt auf `osc-umbau` und ist noch nicht veröffentlicht. Offen
   sind 9 (entspricht Phase 3) und 16–18 (Phase 1 und 4).

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
- „Investitionsrahmen" wird Freitext und bleibt Gate (E4, entschieden 21.09.).
- **Häkchen „Erreichbarkeit war Thema"** im Zeit-Zahlenblock blendet „Anrufe pro Woche" ein (E9).

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
| E2 | ~~Ziel-Werte kurz oder lang?~~ | **entschieden 21.09.:** lange Werte wie in F24 und im Code, „Noch nicht besprochen" als Wert. „Nicht erhoben" ist nur der Ziel-Status, der die Fragesätze steuert. |
| E3 | ~~Zählen die Zahlenfelder zu den Gates?~~ | **geklärt durch Ticket 16:** nein. Die fünf Gates sind Problem, Wer mitentscheidet, Erfolgskriterien, Investitionsrahmen und Abschlusstermin. Die Zahlen sind Pflicht mit Warnung. |
| E4 | ~~Investitionsrahmen Freitext oder Betrag?~~ | **entschieden 21.09.:** das Feedback gilt, Freitext. Bleibt Gate. `rahmen_ausgewichen` entfällt; bestehende Beträge werden als Text übernommen. |
| E5 | ~~Entscheider und Erfolgskriterien trennen?~~ | **geklärt durch Ticket 16:** ja, eigenes Feld. Bestehende Einträge in `entscheider_messlatte` bleiben beim Entscheider und werden nicht automatisch geteilt. |
| E6 | Vorerfahrung ist Gate, hat aber den Wert „nicht gefragt" | ein Gate, das man mit „nicht gefragt" erfüllt, blockiert nichts |
| E7 | Material für Kaufinteressenten (Video, VSL, Fallstudie van Hoorn?) | ohne das bleibt ein Segment ohne Empfehlung |
| E8 | Welche Felder sollen in Calendly noch abgefragt werden, und wer pflegt es? | Feedback verlangt „so wenig wie notwendig", der Unternehmensname muss mit |
| E9 | ~~Auslöser für „Anrufe pro Woche"?~~ | **entschieden 21.09.:** Häkchen „Erreichbarkeit war Thema" im Zeit-Zahlenblock, nur bei Ziel Zeitersparnis. |
| E10 | ~~Board nachziehen?~~ | **erledigt 21.09.:** F24 mit Branche, Ziel als Mehrfachauswahl, „Priorisiertes Ziel", umbenannten Feldern, neuem Notizfeld im Erstanruf, Investitionsrahmen als Freitext und dem Häkchen „Erreichbarkeit war Thema". In F25.4 sind die Tickets 6, 10, 11, 14 und 15 als gebaut markiert, 7 und 13 als gebaut mit Abweichung, 9 als offen und 12 als überholt, jeweils mit Commit. Die neuen Zeilen stehen am Ende der F24-Tabelle, weil sich Zeilen dort nicht verschieben lassen. |

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
Phase 1. Danach kommt Phase 1, offen ist dafür nur noch E6. Phase 2 läuft nebenher,
Phase 3 sobald die Felder stehen, dann 4 und 5, und erst danach das Go-live-Fenster.

---

## Stand 21.09., abends

Umgesetzt, lokal committet, **noch nicht gepusht** (kein Vorschau-Build, nichts veröffentlicht):

| Phase | Commit | Was |
|---|---|---|
| 1 und 4 | `0b7840b` | Felder nach Feedback und Spezifikation, Setting in Gesprächsreihenfolge mit Fragesätzen, fünf Gates, reduzierter Modus, Sachverständigen-Sprache, Fragen-Bubble mit gespeichertem Modellaufruf. Nebenbei: Sachverständige bekamen nie ihre Mail-Fassung (Vergleich auf „Sachverständige" statt „Sachverständiger"). |
| 3 | `2aaffbb` | 18 Vorlagen wortgleich aus der Mailstrecken-Datei (Skript `scripts/vorlagen-einpflegen.mjs`), eine Empfehlung je Anlass, Platzhalter aus den Übergabefeldern, Versandsperre bei offenen Platzhaltern, Video-Links in den Einstellungen. Nebenbei: kein doppelter Gruß mehr in Kundenmails, Links in der Hausfarbe. |
| 5 | `bac8c48` | Versuchszähler, Termin schlägt Mail, Abschied nach fünf, Pflicht-Datum und Grund bei „wiedervorlagefähig", fünf neue Fristen im stündlichen Lauf (Schalter, aus bis Go-live), zwei neue Auswertungen. |
| 2 | `ea8fb49` | 41 sichtbare Gedankenstrich-Sätze umformuliert. Die Tooltips stammen jetzt aus der Spezifikation; Pauls eigene Fassung steht noch aus. |

In der Datenbank eingespielt (gemeinsam mit Produktion, alles additiv): `20260921_osc_felder_v2.sql`,
`20260921_osc_mailvorlagen.sql`, `20260921_osc_nachfassen_fristen.sql`, dazu die 18 Vorlagen.
Geprüft: Der veröffentlichte Stand liest keine der geänderten Spalten und sieht die neuen
Vorlagen-Kategorien nicht.

**Nachweis bisher:** 31 Logikprüfungen der Felder, Empfehlungs- und Platzhalterlogik per Node,
Build, `npm run pruefe`, Testlauf der Fristen in einer zurückgerollten Transaktion. **Noch
offen: der Durchlauf im Browser auf der Vorschau.** Dafür muss gepusht werden.

**Offen:**
- Video- und VSL-Links in den Einstellungen eintragen (sonst sperrt der Mail-Dialog den Versand).
- Käufer-Übergangsfassung der Segment-Mail (in Freigabe), Material Kaufinteressenten (E7), Calendly-Felder (E8).
- 15-Minuten-Erinnerung, wenn nach der Buchung keine Segment-Mail rausging (Ticket 9, Rest).
- Nebenbefund: Die Vorlage „Ergebnisse & Live-Beispiel" steht seit der Umbenennung auf
  „Opening" und ist im veröffentlichten Stand (Kategorie „Kaltakquise") nicht mehr zu sehen.
- Go-live: zusätzlich `osc_fristen_aktiv` auf „an" stellen.

## Test auf der Vorschau, 22.09.

Gepusht, getestet mit Playwright gegen die Vorschau, Testdaten danach vollständig entfernt.

| Bereich | Ergebnis |
|---|---|
| Schnittstellen (Gates, Ziel-Ableitung, reduzierter Modus, Wiedervorlage, Fragen-Vorschlag, Vorlagen, Auswertungen, Links) | 31/31 |
| Setting-Maske (Abschnitte, Fragesätze, Zahlenblock, Knopf je Ergebnis, Mail-Empfehlung, Versandsperre, reduzierter Modus, Sachverständige) | 40/40 |
| Opening (Übergabe-Felder, Reihenfolge, Mehrfachauswahl, Priorität, „andere", E6, Buchung stoppt vor Calendly) | 18/18 |
| Closing (Ausgang nach dem Laden, Nachfass-Empfehlung mit Zähler, Anrede, Abschied, Wiedervorlage-Felder) | 13/13 |
| Dashboards und Einstellungen, Konsole ohne Fehler | 6/6 |

Dabei korrigiert: Die Beschriftung „Mit ausgesprochenem Bedarf" wurde in der Kachel abgeschnitten (`0962199`).

**Nicht im Browser getestet**, weil dafür ein echter Calendly-Termin oder ein echter Mailversand nötig wäre:
das Empfehlungsfenster direkt nach einer echten Buchung, die Übergabe mit echter Buchung des
Abschlussgesprächs und das Hochzählen der Versuche beim Senden. Die Logik dahinter ist per
Schnittstelle und Node geprüft. Miro-Tickets 9 (teilweise), 16, 17 und 18 sind als gebaut markiert.

## Geführte Übergabe im Setting, 23.09.

Rückmeldung: Im Setting öffnete sich nach „Hat stattgefunden" alles auf derselben Seite. Der
Setter soll geführt werden wie im Opening — erst die Angaben, dann der Termin.

Jetzt: „Termin mit Closer buchen" schaltet die Schublade auf eine eigene Seite.

| Schritt | Inhalt | Fußleiste |
|---|---|---|
| 1 von 2 | Angaben aus dem Gespräch | Zurück · Zwischenstand speichern · **Weiter zum Termin** |
| 2 von 2 | Termin mit dem Closer, Video fest, höchstens eine Woche | Zurück zu den Angaben, Buchen im Wähler |

Fehlt eine Pflichtangabe, hält Schritt 1 an — vor jeder Calendly-Anfrage. Während des Ablaufs
zeigt die Schublade nur diesen einen Weg: keine Kontaktdaten, kein Verlauf, keine Mail-Aktion,
ein einziger Weg zurück je Seite.

Dabei gefunden und behoben:

- Die Schublade hat den Arbeitsbereich beim Seitenwechsel **neu aufgebaut**, dadurch ging der
  begonnene Schritt samt Eingaben verloren (`b6fe26b`). Die Abschnitte werden jetzt einzeln
  ausgeblendet, statt den Baum umzubauen.
- Im Terminwähler standen bis zu drei Wege zurück (Kopfzeile, „Abbrechen", Fußleiste). „Abbrechen"
  erscheint nur noch, wo es auch einen Empfänger hat.
- `.fuss-leise` hatte kein Flex-Layout: Das Symbol im Knopf rutschte in eine eigene Zeile.

**Nachweis (Playwright gegen die Vorschau, 23.09.):** 22/22 Prüfungen — Seitenwechsel, Kopfzeilen,
Fußleisten samt Knopfklassen, Sperre ohne Angaben, erhaltene Eingaben beim Zurückgehen, keine
Terminart-Auswahl, kein Setter-Häkchen, kein Schreib- oder Buchungsaufruf. Dazu unverändert grün:
Rollenprüfung Setter-Häkchen 3/3, Schubladen in Opening, Setting und Closing ohne Schreibzugriff.

**Weiterhin nicht im Browser getestet:** die tatsächliche Buchung des Abschlussgesprächs (erzeugt
einen echten Calendly-Termin) und „Zwischenstand speichern" (schreibt in einen echten Datensatz).

## Gleicher Aufbau in Opening, Setting und Closing, 23.09.

Gemessen mit Playwright über alle drei Schubladen. Gefunden und behoben:

| Befund | Vorher | Jetzt |
|---|---|---|
| Website-Zahlen | Opening nutzte das Bauteil, Closing hatte eine eigene Kopie (weißer Kasten, andere Reihenfolge, keine Farbschwellen), Setting zeigte sie gar nicht | Ein Bauteil `Statistik` mit `webZahlen(lead)`; überall dieselbe Stelle, Reihenfolge, Farbe. Ohne Zahlen entfällt der Abschnitt in allen drei gleich |
| Kontaktdaten ändern | Opening: nur Telefon, E-Mail, Website — kein Ort, Name weiter unten im Arbeitsbereich. Closing: andere Reihenfolge und Beschriftung. Setting: gar nicht änderbar | Ein Bauteil `KontaktFelder`: Ansprechpartner, Telefon, E-Mail (Pflicht), Website, Ort — in allen drei gleich |
| Ort speichern | Ging nur über Hot-Leads; `leads.js` kannte das Feld nicht | `stadt` ist im Lead-Update ergänzt |
| E-Mail-Regel | Opening speicherte eine geleerte Adresse, Setting und Closing sperrten unterschiedlich | Eine Regel: Was beim Öffnen in der Maske stand, darf nicht geleert werden. Derselbe Hinweistext überall |
| Bearbeiten-Maske im Opening | Wurde beim Auswählen des Kontakts gefüllt, nicht beim Bearbeiten — nach Zwischenspeichern stand dort ein alter Stand | `bearbeitenStarten()` füllt aus dem Kontakt, wie in Setting und Closing |
| Fußleiste | Setting hatte keinen Bearbeiten-Knopf | Überall „Bearbeiten"; im Bearbeiten-Modus überall Abbrechen (leise) + Speichern (gefüllt) |

Gefüllt ist immer genau die Aktion, die in dieser Stufe die Arbeit ist: im Opening und Closing
„Bearbeiten", im Setting die Dokumentation des Beratungsgesprächs. „Bearbeiten" ist dort deshalb
eine Nebenaktion (umrandet), sonst stünden zwei gefüllte Knöpfe nebeneinander.

**Nachweis:** 47/47 Prüfungen über die drei Tabs (Abschnittsfolge, Zahlen-Darstellung,
Knopfklassen, gleiche Kontaktmaske, E-Mail-Regel, Abbrechen ohne Schreibzugriff), dazu unverändert
grün: geführte Übergabe 22/22, Kontakt-Bearbeitung im Setting 16/16 (mit echtem Speichern und
Zurückstellen auf dem eigenen Datensatz), Rollenprüfung 3/3.

## Setting: ansehen, bearbeiten, geführt entscheiden — 23.09. (Stand 2)

Zwei Rückmeldungen: Die Knöpfe unten waren farblos, und der Ausgang ließ sich verstellen, ohne
„Bearbeiten" zu drücken. Dazu die Vorgabe, dass jede Auswahl auf eine eigene Seite führt.

**Ansehen und Bearbeiten.** Die Schublade ist erst einmal nur Ansicht: Das Auswahlfeld und die
ganze Gesprächsmaske sind gesperrt (ein `fieldset`, kein Feld muss davon wissen), und unten stehen
„E-Mail an den Kontakt" (umrandet) und **„Bearbeiten" (gefüllt)** — wie in Opening und Closing.
Erst danach lässt sich etwas ändern. Geänderte Kontaktdaten gehen beim Speichern der Maske
automatisch mit, damit eine gerade korrigierte Nummer nicht verloren geht.

**Eine Seite je Auswahl.** Kein Knopf neben dem Feld mehr: Die Wahl selbst führt weiter.

| Auswahl | Seite | Aktion unten |
|---|---|---|
| Hat stattgefunden | Ergebnis des Gesprächs (1 von 2 bzw. 3) | Zurück · Zwischenstand |
| → Nächster Schritt / Auftrag | Angaben aus dem Gespräch (2 von 3) | Zurück · Zwischenstand · **Weiter zum Termin** |
| → weiter | Termin mit dem Closer (3 von 3), Video fest | Zurück zu den Angaben, Buchen im Wähler |
| → Vertagt / Absage | Angaben aus dem Gespräch (2 von 2) | Zurück · Zwischenstand · **Speichern und abschließen** |
| Termin verschoben | Neuer Termin, telefonisch | Zurück, Buchen im Wähler |
| Nicht erschienen / abgesagt | Was jetzt passiert: zurück an den Opener, sichtbar unter „Geplatzt" | Zurück · **Festhalten** |

Während einer solchen Seite zeigt die Schublade nichts anderes — keine Kontaktdaten, kein Verlauf,
ein Weg zurück. Die Vorbelegung des Ergebnisfeldes ist entfallen, sonst führte die Auswahl nicht.

**Nachweis (Playwright, Vorschau):** Seiten je Auswahl 15/15, Sperre und Fußleiste 12/12, geführte
Übergabe 22/22, Kontakt-Bearbeitung 16/16, Konsistenz über die drei Tabs 47/47 — in allen Läufen
kein Schreib- oder Buchungsaufruf außer dem einen geprüften Speichern.

## Pools: eine Ansicht für alle drei Stufen — 23.09.

Vorher war jeder Pool anders gebaut: Der Closer-Pool eine Tabelle mit eigener, handgeschriebener
Schublade, der Setter-Pool graue Kästen, der E-Book-Pool Karten mit orangem Ladebalken und
amberfarbenem Etikett. In beiden Kästen-Pools gab es **keinen Klick** — wer wissen wollte, wer der
Kontakt ist, musste ihn erst übernehmen.

Jetzt kommt alles aus `src/components/LeadPool.jsx`:

- dieselbe Tabelle wie in jeder Liste (Art · Unternehmen · Ansprechpartner · Ort · Termin · Hinweis),
- Klick auf die Zeile öffnet die gewohnte Schublade mit Kontaktdaten, Termin, Website-Zahlen,
  Übergabe und Verlauf,
- die Aktion steht unten in der Fußleiste, gefüllt, genau eine,
- Laden und Leerzustand halten die Höhe, in Hausfarben statt Orange.

Unterschiedlich ist allein die Aktion, wie besprochen: **Übernehmen** im Opening (E-Book) und im
Setting — dort nimmt man sich den Kontakt selbst —, **Bewerben** im Closing, wo ein Admin zuteilt.

**Nachweis (Playwright, Vorschau):** 15/15 über die drei Tabs — Umschalter, Spalten, Klick öffnet
die Schublade, genau eine gefüllte Aktion mit dem richtigen Wort, keine Fremdfarben, kein
Schreibaufruf. Setter-Pool mit drei Einträgen vollständig durchgespielt; E-Book- und Closer-Pool
waren leer, dort ist der Leerzustand geprüft (gleiche Komponente, gleicher Aufbau). Regression
unverändert grün: Konsistenz 47/47, Setting-Seiten 15/15, Sperre 12/12.

## Listen: ein Spaltenkatalog, eine Tabelle, eigene Spalten je Benutzer — 23.09.

**Schritt 1 — angleichen.** Opening, Setting und Closing haben jetzt dieselbe Tabelle
(`src/components/LeadTabelle.jsx`). Welche Spalten es gibt, steht in `shared/spalten.js`; woher
die Werte kommen, übersetzt `src/utils/zeile.js` einmal je Stufe. Vorher hieß dieselbe Sache in
jedem Tab anders (`unternehmensname`/`unternehmen`, `stadt`/`ort`, „Vertriebler"/„Coldcaller"),
Closing hatte zweimal eine Spalte „Status", und sortieren konnte man nirgends.

| | Standardspalten |
|---|---|
| Opening | Art · Unternehmen · Ansprechpartner · Ort · Kontakt · Ergebnis · Letzte Aktivität |
| Setting | Art · Unternehmen · Ansprechpartner · Ort · Termin · Status |
| Closing | Art · Unternehmen · Ansprechpartner · Ort · Termin · Status · Zuständig · Setter |

Dazu überall: Klick auf den Spaltenkopf sortiert (zweiter Klick dreht um, Leeres steht hinten),
Karten statt Tabelle auf schmalen Schirmen, waagerechtes Scrollen bei vielen Spalten.

**Schritt 2 — konfigurierbar.** Über der Liste steht „Spalten": ausblenden, hinzufügen und die
Reihenfolge per Ziehen ändern. Gespeichert wird je Benutzer in `users.preferences` (die Spalte
gab es längst, benutzt hat sie niemand) über `netlify/functions/tabellen-spalten.js` — die
Einstellung gilt damit auf jedem Gerät. „Zurück zum Standard" räumt wieder auf. Art und
Unternehmen bleiben vorn, damit die Zeile beim Scrollen zuzuordnen bleibt.

Zusätzlich wählbar sind die Felder, die die APIs längst liefern: Quelle, Terminart, Bundesland,
Opener/Setter/Closer, Website-Zahlen (Besucher, Mehrwert, Absprungrate, Leads), Deal-Werte
(Paket, Setup, Retainer, Laufzeit) sowie Fristen (Wiedervorlage, zugesagt bis, Angebot verschickt,
Nachfass-Schritt, Nicht erschienen, Mobilnummer).

**Nachweis (Playwright, Vorschau):** Tabellen 12/12 (Spalten je Stufe, Sortierung dreht um, Klick
öffnet die Schublade), Spaltenwahl 7/7 (hinzufügen, ausblenden, Reihenfolge per Ziehen, überlebt
den Seitenwechsel, Zurücksetzen). Regression unverändert grün: Pools 15/15, Konsistenz 47/47,
Setting-Seiten 15/15, Sperre 12/12.

Dabei gefunden: Die neue Function las die Benutzerkennung aus dem falschen Feld des
Sitzungs-Helfers (`inhalt` statt `nutzer`) — fiel als 502 im Browsertest auf und ist behoben.

### Nachtrag Spaltenwahl und Scrollen

- Der Knopf „Spalten" sieht jetzt aus wie ein Filter (neue Klasse `.filter-knopf`: gleicher heller
  Grund, gleiche Höhe, derselbe Pfeil rechts) und steht am rechten Ende der Filterzeile — er
  steuert die Darstellung, nicht die Auswahl. Das eigene Symbol ist entfallen.
- Bei vielen Spalten wird waagerecht gescrollt; Symbol und Unternehmen bleiben dabei stehen
  (`position: sticky`), damit jede Zeile zuzuordnen bleibt.

**Nachweis:** 15/15 über die drei Tabs — Knopfklasse, Position rechts der Filter, gleiche Höhe,
erste Spalte bleibt beim Scrollen an Ort und Stelle, Unternehmen bleibt sichtbar. Regression:
Spaltenwahl 7/7, Tabellen 12/12, Konsistenz 47/47.

## Schritt 3: Filter zum Zusammenstellen — 23.09.

Gefiltert wurde bisher mit festen Auswahlfeldern: im Opening fünf, in Setting und Closing je eines,
und immer nur „ist gleich". Wer alles außer „Kein Interesse" sehen wollte, musste jeden anderen
Wert einzeln durchgehen.

Jetzt steht neben „Spalten" der Knopf „Filter", in derselben grauen Optik. Ein Filter besteht aus
Feld, Vergleich und Wert; bis zu sechs gelten zusammen (`shared/filter.js`):

| Feldart | Vergleiche |
|---|---|
| Text, Name, Status | ist · ist nicht · enthält · enthält nicht · ist leer · ist gefüllt |
| Zahl, Geld, Prozent | ist · ist nicht · größer als · kleiner als · ist leer · ist gefüllt |
| Datum | vor dem · nach dem · ist leer · ist gefüllt |

Gefiltert wird über dieselben Felder wie die Spalten — also auch über alles, was man zusätzlich
einblenden kann. Werte schlägt die Liste aus dem vor, was gerade drinsteht. Gespeichert wird je
Benutzer zusammen mit den Spalten in `users.preferences`.

**Wo gerechnet wird:** Setting und Closing haben ihre 615 Datensätze im Browser, dort filtert die
Oberfläche selbst. Das Opening blättert serverseitig durch 28.853 Leads — dort gehen die Filter
als Bedingungen mit in die Abfrage (`netlify/functions/leads.js`), sonst würde nur die sichtbare
Seite durchsucht. Für „meine Leads" läuft die Abfrage dabei über einen Join auf die
Zuweisungstabelle, weil eine Liste mit tausend IDs die URL sprengt.

**Nachweis (Playwright, Vorschau):** 10/10 — „ist nicht" schließt nachweislich aus, der Zähler am
Knopf stimmt, bei sechs Filtern ist Hinzufügen gesperrt, „Alle entfernen" stellt den Stand wieder
her; im Opening geht der Filter an den Server, danach stehen dort nur noch passende Orte, vorher
waren es andere. Regression grün: Spaltenwahl 7/7, Tabellen 12/12, Scrollen und Knopfoptik 15/15,
Konsistenz 47/47, Pools 15/15. Die Testeinstellungen sind danach wieder entfernt.

### Nachtrag: Land, Kontaktiert und das Merken der Filter

- **Land** fehlte im Filter und ist ergänzt (Opening), dazu **Kontaktiert** (Ja/Nein). In der
  Datenbank stehen die vollen Namen „Deutschland", „Österreich", „Schweiz" — die Vorschlagsliste
  bietet genau diese an.
- Im Opening werden nur Felder angeboten, die der Server auch beantworten kann. „Letzte Aktivität"
  und „Zuständig" stehen dort nicht zur Wahl: Ein Filter, der still nichts tut, ist schlimmer als
  keiner.
- **Gemerkt wird bis zur Änderung.** Filter und Spalten liegen in `users.preferences`; nach dem
  Neuladen geht der gespeicherte Filter wieder in die Abfrage und steht unverändert im Panel.

Dabei behoben: Im Opening konnte eine verspätete Antwort einer älteren Abfrage das gerade
gefilterte Ergebnis überschreiben. Jeder Ladelauf zählt jetzt mit, und nur der jüngste darf
schreiben; Ansicht und Filter werden beim Laden frisch gelesen statt aus der Fassung von vorhin.

**Nachweis:** 8/8 (Land im Filter, nur serverfähige Felder, Land filtert nachweislich, Filter
überlebt das Neuladen in Abfrage und Panel, Setting nach Seitenwechsel), dazu Filter 10/10,
Spalten 7/7, Tabellen 12/12, Konsistenz 47/47.

**Wichtiger Befund am Rande:** Mehrere Dateien lagen im Repository **abgeschnitten** — `leads.js`
endete mitten im Code, ebenso `SetterUebergabe.jsx` und `UebergabeFelder.jsx`. Ursache ist die
iCloud-Auslagerung auf dem Desktop: Beim Committen wurde nur der geladene Teil erfasst. Der
vollständige Stand ist wiederhergestellt; vor jedem Push gehört ein Blick auf `git diff HEAD`.

## Kalender: informieren statt dokumentieren — 24.09.

Die Seitenansicht im Kalender enthielt die komplette Setter-Maske: Ausgang wählen, zwölf
Übergabefelder, Zwischenstand speichern. Der Kalender war damit ein zweites Setting — mit dem
Unterschied, dass die Maske dort seit dem Umbau der Schubladen nicht mehr in eine Fußleiste
hängen konnte und entsprechend zerrissen aussah.

Jetzt ist die Seitenansicht dieselbe Schublade wie überall (`LeadSchublade`), nur ohne
Arbeitsbereich:

- **Kontaktdaten** mit Ansprechpartner, Status, Telefon, E-Mail, Ort und den Rollen
  (Opener · Setter · Closer)
- **Termin** mit Tag, Zeitraum und Art, dazu die Kennzeichen aus dem Kalenderraster
  („Mein Closing", „Mein Beratungsgespräch", „Von mir gebucht", „Abschlussgespräch noch ohne
  Closer", bei Wiedervorlagen „Zugewiesen an …")
- **Verlauf**
- Unten: „E-Mail an den Kontakt" und — gefüllt — „Im Setting öffnen" bzw. „Im Closing öffnen",
  bei Wiedervorlagen „Im Opening öffnen". Gearbeitet wird in der Stufe, zu der der Termin gehört.

**Nachweis (Playwright, Vorschau):** 8/8 — Termin im Raster öffnet die Schublade, Kontaktdaten,
Termin mit Zeitraum und Verlauf stehen drin, keine Dokumentationsmaske und kein Auswahlfeld mehr,
Fußleiste mit genau einer gefüllten Aktion, keine Fehler in der Konsole. Regression: Pools 15/15,
Konsistenz 47/47, Setting-Seiten 15/15, Pool-Kasten über dem Kalender unverändert.
