# CRM-Feldspezifikation für den Vertriebsprozess

> **Bauauftrag für das CRM.** Diese Datei bündelt alle Felder, die der Prozess verlangt, mit Wertelisten, Pflichtstufen und Rechenregeln. Quellen: Prozess-Dokument (Übergaben, Gesprächsausgang), Beratungsgespräch-Skript (CRM-Anhang), Bewusstseinsstufen (Häkchen und Tiefe), Mailstrecken (Alltagsregel und Platzhalter). Bei Widersprüchen gilt das Vertriebshandbuch.
> Solange die Felder nicht gebaut sind, wird von Hand notiert; genau das soll diese Spezifikation beenden.

## Die drei Pflichtstufen

| Stufe | Bedeutung im Prozess | Bedeutung im CRM |
|---|---|---|
| **Gate** | Ohne dieses Feld geht die Übergabe nicht weiter, der Empfänger gibt zurück | Pflichtfeld, blockiert den Stage-Wechsel |
| **Pflicht** | Wird immer gefüllt, blockiert aber nichts | Pflichtfeld mit Warnung statt Blockade |
| **gemessen** | Wird ausgewertet, nicht geprüft | normales Feld, fließt in die Auswertung |
| **bedingt / optional** | Wird nur gefüllt, wenn der Anlass da war (Segment, Thema, Beobachtung, Speicher-Frage); leer ist kein Fehler | normales Feld ohne Warnung |

Nach dem Beratungsgespräch muss der Setter damit genau zwei Dinge aktiv füllen (den Zahlenblock und den Gesprächsausgang); die fünf Gates entstehen ohnehin im Gespräch, alles Übrige nur bei Anlass.

---

## Block 1: Übergabe 1 (Opening an Setting), fünf Felder

Gefüllt vom Opener direkt nach dem Kaltanruf. Alle fünf sind Gate für die Übergabe an den Setter.

| # | Feld | Typ | Werte / Format |
|---|---|---|---|
| 1.0 | Berufsgruppe | Auswahl | `Makler` · `Sachverständige` · `andere`; steuert die Segment-Mail: Sachverständige bekommen unabhängig vom Ziel die Beier-Fassung |
| 1.1 | Entscheider | Text | Name und Funktion |
| 1.2 | Ziel | Auswahl | `Eigentümer` · `Käufer` · `Zeit` · `nicht erhoben` |
| 1.2a | Ziel-Status | Auswahl | `priorisiert` · `genannt` (mehrere ohne Vorzug) |
| 1.3 | Schmerzpunkt im Wortlaut | Freitext | der Satz des Maklers, wörtlich; es dürfen mehrere Schmerzen darin stehen, der Setter priorisiert im Gespräch |
| 1.3a | Vorhaben | Ja/Nein | Ja, wenn er mit einem Plan statt einem Problem kommt („Ich will [Zielgruppe] erschließen"); ersetzt die Segment-Mail durch die Vorhaben-Mail (greift das Vorhaben wörtlich auf, Beier-Testimonial als Umsetzungs-Beweis) und steuert den KI-Audit-Weg |
| 1.4 | Vorerfahrung | Auswahl | `Dienstleister` · `eigenes Werkzeug` · `beides` · `keiner genannt` · `nicht gefragt` |
| 1.4a | Vorerfahrung im Wortlaut | Freitext | Name und was sie tun |
| 1.5 | Termin | Datum/Uhrzeit + Status + Telefon | Datum, Uhrzeit, `bestätigt` ja/nein, dazu die **Mobilnummer** aus dem Terminierungs-Schritt (Voraussetzung für die beiden SMS der Kette) |

**Wichtig für die Wertelisten:** `keiner genannt` und `nicht gefragt` sind zwei verschiedene Werte und dürfen nicht zusammenfallen (das eine setzt Häkchen B auf Nein, das andere lässt es offen). Dasselbe gilt für `nicht erhoben` beim Ziel. Ein geratenes Feld ist schlimmer als ein leeres.

## Block 2: Die Häkchen und die berechnete Tiefe

Nur Häkchen C ist ein Handklick, und den setzt seit dem 20.09.2026 **allein der Opener**: Im Setting fällt er weg, weil sein einziger Abnehmer die Tiefe 3 war und deren Sonderpfad am 03.09. abgeschafft wurde. A und B **berechnet das System aus den Feldern**; korrigiert das Setting ein Feld (etwa die Vorerfahrung), folgt das Häkchen von selbst, und die Tiefe rechnet sich neu.

| Feld | Typ | Quelle |
|---|---|---|
| Häkchen A (konkretes Problem benannt, zitierbar) | Ja/Nein, **berechnet** | „Schmerzpunkt im Wortlaut" gefüllt = Ja |
| Häkchen B (Anbieter, Werkzeug oder eigener Versuch genannt) | Ja/Nein, **berechnet** | Vorerfahrung: Dienstleister/Werkzeug/beides = Ja · keiner genannt = Nein · nicht gefragt = unbekannt. Ein Maklerprogramm allein setzt B **nicht** (Hilfetext am Feld Vorerfahrung) |
| Häkchen C (fragt von sich aus nach Preis, Ablauf, Start) | Ja/Nein, **Handklick**, nur im Erstanruf | jederzeit im Kaltanruf; setzt dort die Materialtiefe vor dem ersten Versand |
| **Tiefe** (berechnet) | `1 Grundlage` · `2 Beweis` · `3 Angebot` | C gesetzt → immer Tiefe 3. Sonst: A nein/B nein → 1 · A ja/B nein → 1 · A nein/B ja → 2 · A ja/B ja → 2 |

Die Tiefe ist Regie-Wissen für Setter und Closer und richtet das Nachfassen aus; Material im Hauptstrang steuert sie nicht (dort führt das Segment). In der Setting-Maske ist sie **reine Anzeige**, niemand füllt sie.

## Block 3: Die Setting-Maske (Beratungsgespräch), dreizehn Felder in Gesprächsreihenfolge

Gefüllt vom Setter während und direkt nach dem Beratungsgespräch. Fünf Gates. Zwei der dreizehn Felder kosten fast nichts: Die Mobilnummer ist aus dem Erstanruf vorbelegt, und das Ergebnis des Gesprächs ist ein Klick, der fast immer auf „Nächster Schritt vereinbart" steht.

**Drei Bauregeln (Entscheidung Niklas, 20.09.2026):** Die Maske folgt dem Gespräch, nicht der Übergabe-Logik, und trägt die Gesprächsblöcke als Abschnittsüberschriften. Der Feldname ist die verkürzte Frage. **Und die Frage steht sichtbar am Feld, nicht im Tooltip:** Unter jedem Feldnamen steht der eine Satz aus dem Skript, der die Antwort auslöst, die in dieses Feld gehört. Der Setter erkennt jedes Feld an dem Satz, den er gerade gesagt hat, ohne dafür klicken oder ins Skript schauen zu müssen.

**Kopf der Maske, nur Anzeige: „Das hat der Kollege im Erstanruf notiert."** Die Karte zeigt **alles**, was der Opener erfasst hat, damit der Setter nichts doppelt fragt (die häufigste Beschwerde von Maklern in Termin zwei): Berufsgruppe · Ansprechpartner und Funktion · Was der Kunde erreichen will, mit dem Vermerk, ob er es selbst priorisiert hat · Größtes Problem in seinen Worten · Kunde hat ein konkretes eigenes Vorhaben · Bisherige Versuche und Anbieter, mit dem Wortlaut dazu · Beratungsgespräch am, bestätigt ja/nein · Mobilnummer · die berechnete Einschätzung „Wie weit ist der Kunde". Dazu die zwei Links aus der Vorbereitung: die SEO- und GEO-Analyse seiner Region und seine Website.

### Wie die Fragen am Feld stehen

Die Tabellen unten führen deshalb zwei Textspalten statt einer. **Sichtbar am Feld** steht dauerhaft in der Maske, unter dem Feldnamen, kleiner und ruhiger gesetzt. **Im Aufklapper** liegt alles Übrige und erscheint erst auf Klick. Nichts geht dabei verloren, die alten Hilfetexte werden nur geteilt.

**Was sichtbar wird:** genau ein Satz je Feld, wörtlich aus dem Skript. Nicht die Frage, die den Block eröffnet, sondern die, deren Antwort in dieses Feld gehört. Die übrigen Zitate, die Bedienregel und der Wozu-Absatz bleiben im Aufklapper.

**Zwei Textarten, auf den ersten Blick unterscheidbar.** Ein Satz in Sie-Form und Anführungszeichen wird gesprochen. Eine Zeile mit dem Vorsatz „Setter-Hinweis" ist eine Anweisung und wird nie vorgelesen; sie ist anders eingefärbt. Ohne diesen sichtbaren Unterschied liest früher oder später jemand eine Arbeitsanweisung ins Telefon.

**Ziel-Filterung.** An sechs Stellen hängt der Satz am Ziel des Kunden, an einer zusätzlich am Ziel-Status aus dem Erstanruf. Sichtbar ist immer genau eine Variante, gesteuert vom Feld „Ziel bestätigt oder korrigiert"; korrigiert der Setter das Ziel mitten im Gespräch, wechseln die Sätze mit. Die nicht gezeigten Varianten stehen im Aufklapper.

**Vorsatz nur an zwei Feldern.** Bei den bisherigen Versuchen und bei der offenen Hürde ist der Kernsatz allein unverständlich („Was müsste dafür noch geklärt sein?" hat ohne die Frage davor keinen Bezug). Dort steht eine zweite, schwächer gesetzte Zeile über dem Kernsatz. An allen anderen Feldern ist das nicht erlaubt, sonst hat am Ende jedes Feld seine Ausnahme.

**Drei Felder tragen keinen Fragesatz**, weil es im Skript keinen gibt: Notizen und Sonderthemen, Ergebnis des Gesprächs und im Zeit-Zahlenblock das Feld „Was die meiste Zeit frisst". Sie bekommen einen Setter-Hinweis statt einer erfundenen Frage.

**Kein Schalter zum Ausblenden.** Einer, den ein Setter einmal ausschaltet, hebt die ganze Maßnahme auf. Einzige Sparregel: Der Satz an der Mobilnummer erscheint nur, wenn das Feld leer ist, denn aus dem Erstanruf ist es fast immer gefüllt.

**Keinen Fragenkatalog über die Maske.** Die Sammlung aller Fragen an einem Ort bleibt dem Fall vorbehalten, in dem es kein Skript gibt: der Bubble weiter unten. Im Normalfall stünde sie neben den Feldern als zweite Baustelle, zwischen denen der Setter wieder zuordnen müsste.

### Der reduzierte Modus: wenn die Standardfragen nicht passen

**Auslöser** (beide aus dem Erstanruf, Entscheidung Niklas 20.09.2026): Berufsgruppe = `andere` **oder** Vorhaben = Ja. Der eine ist weder Makler noch Sachverständiger, der andere kommt mit einem fertigen Plan statt mit einem Problem. In beiden Fällen würden die Gesprächsfelder ihn ins falsche Raster zwingen.

**Was die Maske dann zeigt:** die Kopfkarte aus dem Erstanruf (unverändert), den Fragenvorschlag als Bubble, das **Notizfeld** (groß, mit fallbezogener Anleitung), **Abschlussgespräch am**, **Mobilnummer** und **Ergebnis des Gesprächs**. Alle inhaltlichen Gesprächsfelder sind ausgeblendet, alle Gates darauf aufgehoben; es blockiert nur noch der Abschlusstermin.

**Die Begründung steht sichtbar über dem Notizfeld**, damit der Setter weiß, warum seine Maske heute anders aussieht. Je nach Auslöser einer von zwei Sätzen, bei beiden gilt der Vorhaben-Satz:

> Dieser Kunde ist weder Makler noch Sachverständiger. Unsere Standardfragen passen deshalb nicht. Schreib frei mit, was du hörst; die Vorschläge oben helfen dir dabei.

> Dieser Kunde kommt mit einem konkreten eigenen Vorhaben statt mit einem Problem. Die Standardfragen passen deshalb nicht. Schreib frei mit, was du hörst; die Vorschläge oben helfen dir dabei.

**Die Anleitung im Notizfeld wechselt mit dem Auslöser.** Bei Vorhaben: was er genau vorhat (wörtlich), was am Ende dabei herauskommen soll, welche Systeme und Daten beteiligt sind, bis wann es stehen soll, was ihn die heutige Lösung kostet. Bei anderer Branche: was sein Geschäft ausmacht, wo seine Anfragen herkommen, was am meisten Zeit frisst, was er schon versucht hat, woran er Erfolg messen würde.

Ein eigener Vorhaben-Pfad mit sieben eigenen Feldern ist bewusst nicht gebaut: Ein großes Feld mit guter Anleitung schlägt sieben Felder, die auf jeden zweiten Fall nicht passen.

Die Fragesätze der Gesprächsfelder entfallen hier von selbst, weil die Felder ausgeblendet sind. Sichtbar bleiben nur die Sätze an Abschlussgespräch und Mobilnummer. An die Bubble gehört kein Fragesatz, sie besteht bereits aus Fragen.

### Der Fragenvorschlag: eine Bubble über dem Notizfeld

**Wo und wie:** ein nicht bearbeitbares Textfeld über dem Notizfeld, überschrieben mit „Vorschlag: Diese Fragen passen zu diesem Fall", darunter klein „Du entscheidest, was du fragst." Es ist ein Vorschlag im selben Sinn wie das empfohlene Nachfass-Stück: Das System schlägt vor, der Mensch entscheidet.

**Wann sie erscheint:** bei Berufsgruppe `andere` · bei Vorhaben = Ja · und bei Berufsgruppe `Sachverständiger`. Im dritten Fall bleibt die volle Maske stehen, die Bubble übersetzt nur die Sprache (Gutachten-Aufträge statt Objekte, Bewertungsanfragen statt Eigentümeranfragen). Damit ist der am 31.08. vertagte Punkt „Sachverständigen-Setting läuft übergangsweise mit Wort-Tausch" praktisch gelöst. Bei Maklern mit Standardziel erscheint sie nicht, dort führt das Skript.

**Wann sie erzeugt wird:** einmal, beim ersten Öffnen der Setter-Ansicht, und gespeichert. Eine Schaltfläche „Neue Vorschläge" erzeugt sie auf Wunsch neu. Kein Modell-Aufruf bei jedem Seitenaufruf, sonst sieht der Setter beim zweiten Blick andere Fragen.

**Was in den Prompt geht:** Berufsgruppe · Vorhaben im Wortlaut (falls vorhanden) · größtes Problem im Wortlaut · Ziel. **Keine Namen, keine Firma, keine Kontaktdaten.**

**Die Basis, auf der alles aufbaut** (Festlegung Niklas, 20.09.2026). Dies ist die Merkliste des Gerüsts, in genau dieser Reihenfolge:

> Was ist sein Ziel? · Was ist sein Problem? · Was hat er schon probiert, um es zu lösen? · Was bräuchte er, damit das besser läuft? · Woran würde er in einem halben Jahr festmachen, dass es sich gelohnt hat? · Was ist sein Budget? · Wer ist noch Entscheider?

**Was der Prompt verlangt:** höchstens sieben sprechbare Fragen in Sie-Form, die diese Basis in derselben Reihenfolge abbilden, jede auf den Fall übersetzt; keine Preise, keine erfundenen Zahlen, keine Zusagen. **Das Gerüst wird übersetzt, nicht erweitert:** Das Modell darf umformulieren, aber keine zusätzlichen Themen erfinden, sonst driftet die Methodik von Setter zu Setter auseinander.

**Fällt das Modell aus** (Zeitüberschreitung, Störung), zeigt die Bubble die Basis in sprechbarer Form, damit nie eine leere Bubble dasteht:

> Was wollen Sie erreichen? · Was läuft heute nicht so, wie es soll? · Was haben Sie schon versucht, um das zu lösen? · Was bräuchten Sie, damit das besser läuft? · Woran würden Sie in einem halben Jahr festmachen, dass es sich gelohnt hat? · Was wären Sie bereit zu investieren? · Wer entscheidet das bei Ihnen mit?

Zwei Vermerke zur Basis, damit niemand sie falsch zuordnet: Das CLOSER-Gerüst selbst kennt **weder eine Budget- noch eine Entscheider-Frage**; es hat in Schritt O nur die Vergangenheitsfrage „Was haben Sie dafür ausgegeben?". Beide Fragen sind Sunside-Ergänzungen aus dem Setting-Skript (Fragen 6 und 7) und bleiben es. Und die Quellenlage des Gerüsts ist die schwächste unserer Sammlung (nur Sekundärquellen), weshalb wir die Reihenfolge übernehmen, nicht die Einzelformulierungen.

**Die harte Leitplanke: Die KI schlägt nur Fragen vor.** Sie füllt kein Feld, formuliert keine Antwort vor und fasst nichts zusammen. Das folgt der bestehenden Festlegung unten in den Umsetzungshinweisen, dass die Wortlaut-Felder Freitext ohne Vorschläge sind: Eine sinngemäße Zusammenfassung zerstört genau den Wert, den das Kundenzitat später im Abschlussgespräch und in den Mails hat.

### Abschnitt „Anlass und Ziel"

| Feldname im CRM | Sichtbar am Feld | Im Aufklapper | Typ / Stufe |
|---|---|---|---|
| Ziel bestätigt oder korrigiert | **Wechselt mit dem Ziel-Status aus dem Erstanruf.** Priorisiert: „Mein Kollege hatte notiert, dass es Ihnen vor allem um … geht. Ist das weiterhin so?" · Genannt, aber ohne Vorrang: derselbe Satz, danach „Und wenn Sie nur eines davon bekommen könnten, welches?" · Nicht erhoben: „Und was sind Ihre Ziele für die nächsten zwölf Monate?" | Der Block beginnt mit „Was hat Sie dazu gebracht, sich das Gespräch und das Thema KI überhaupt anzuhören?"; in der Antwort steckt oft schon das Ziel und das Problem, das dann ins Feld darunter gehört. Die beiden Fassungen, die gerade nicht am Feld stehen. **Wozu:** Dieses eine Feld steuert den Rest des Gesprächs. Es entscheidet, welche zwei Zahlen gleich gefragt werden, wie die Budget-Frage lautet, welche Unterlagen du am Ende ankündigst und welches Video der Kunde bekommt. Korrigiere es sofort, wenn er etwas anderes sagt. | Auswahl wie im Erstanruf · Pflicht |

### Abschnitt „Problem und Versuche"

| Feldname im CRM | Sichtbar am Feld | Im Aufklapper | Typ / Stufe |
|---|---|---|---|
| Wo es am meisten hakt, wörtlich | „Und wo hakt es da heute am meisten?" · **Bei Ziel Zeitersparnis** stattdessen: „Was frisst bei Ihnen die meiste Zeit, die nichts mit Verkaufen zu tun hat?" | Einstieg in den Block: „Was könnte aktuell besser laufen?" Vertiefung, wenn die Antwort blass bleibt: „Woran merken Sie das im Alltag am deutlichsten?" Dazu die Fassung, die gerade nicht am Feld steht. **Wozu:** Der Closer beginnt sein Gespräch mit genau diesem Satz („Beim letzten Mal hatten Sie gesagt: …"), und er steht in jeder Nachfass-Mail. Eine Zusammenfassung von dir nützt dort nichts, sie klingt nach uns statt nach ihm. | Freitext, vorbelegt · **Gate** |
| Was er schon ausprobiert hat, und was dabei rauskam | **Vorsatz, wechselt mit dem Ziel:** bei Eigentümern „Wie kommen Ihre Eigentümer heute zu Ihnen?", bei Kaufinteressenten „Wie kommen Ihre Kaufinteressenten heute zu Ihnen?", bei Zeitersparnis kein Vorsatz. **Kernsatz:** „Und was haben Sie schon ausprobiert, um das zu lösen? Mit wem? Was kam dabei rum?" | Beiläufig hinterher: „Was haben Sie da ungefähr investiert?" Steht im Erstanruf ein Name: „Was genau machen die für Sie?" Nutzt er ein eigenes Werkzeug: „Wofür genau, und was bringt es Ihnen?" Die Antwort auf den Vorsatz gehört mit in dieses Feld. **Wozu:** Der Closer muss wissen, wovon sich unser Vorschlag unterscheiden muss, sonst kann er nicht sagen, warum es diesmal anders läuft. Und was der Kunde schon bezahlt hat, sagt mehr über sein Budget als jede Budget-Frage. | Freitext, vorbelegt · bedingt |
| Was er bräuchte, damit es besser läuft, wörtlich | „Was bräuchten Sie, damit das besser läuft?" | Nur ausfüllen, wenn der Satz wirklich gefallen ist. Fiel er schon früher im Gespräch, hier eintragen. **Wozu:** Das ist der einzige Satz, in dem der Kunde selbst eine Lösung ausspricht. Gespräche mit so einem Satz schließen deutlich häufiger ab, deshalb messen wir, wie oft er fällt. Steht hier nichts, war es eine Faktensammlung statt eines Beratungsgesprächs. | Freitext · gemessen |

### Abschnitt „Zahlen und Entscheidung"

Untertitel des Abschnitts, zum Vorlesen: „Damit unser Experte mit Ihren Zahlen rechnen kann und nicht mit irgendwelchen, zwei kurze Zahlenfragen."

Der Zahlenblock **wechselt mit dem Ziel**, immer genau zwei Zahlen, jede mit dem Kennzeichen `vom Kunden genannt` / `geschätzt`:

| Ziel | Feldname | Sichtbar am Feld | Im Aufklapper |
|---|---|---|---|
| Mehr Eigentümer-Anfragen | Wie viele Aufträge im Jahr dazukommen sollen | „Wo wollen Sie hin? Wie viele Aufträge sollen im Jahr dazukommen?" | **Wozu:** Aus dieser und der nächsten Zahl rechnet das System, wie viele Anfragen ihm im Monat fehlen. Diese eine Zahl trägt später das ganze Konzept, die Budget-Frage und das Abschlussgespräch. |
| Mehr Eigentümer-Anfragen | Von 10 Eigentümeranfragen werden Auftrag | „Von zehn Eigentümeranfragen, die bei Ihnen reinkommen, wie viele werden am Ende ein Auftrag?" | Vorspann, wenn er zögert: „Das ist von Büro zu Büro sehr verschieden, deshalb frage ich:" Schätzanker: „eher zwei von zehn oder eher vier?" **Wozu:** Zweiter Eingang derselben Rechnung. |
| Mehr Kaufinteressenten | Objekte im Jahr auf dem Markt | „Wie viele Objekte bringen Sie im Jahr ungefähr auf den Markt?" | **Wozu:** Grundlage der Rechnung, wie viel Zeit die Gucker kosten, und der Muster-Anzeige für eines seiner Objekte. |
| Mehr Kaufinteressenten | Von 10 Anfragen je Objekt sind ernsthaft | „Und von zehn Anfragen, die auf ein Objekt kommen, wie viele sind wirklich ernsthaft?" | Schätzanker wie oben. **Wozu:** Zeigt, wie viel Aussortier-Arbeit heute anfällt. |
| Zeitersparnis und Entlastung | Was die meiste Zeit frisst | *Setter-Hinweis:* Trag hier den Zeitfresser ein, den er eben genannt hat. | Keine eigene Frage: Die Antwort steht schon im Feld „Wo es am meisten hakt". **Wozu:** Der Eintrag ist die Überschrift seiner Automatisierungs-Kurzanalyse und der Platzhalter in der Stunden- und der Budget-Frage. |
| Zeitersparnis und Entlastung | Stunden dafür pro Woche | „Wie viele Stunden gehen dafür bei Ihnen in der Woche drauf?" | Vorspann: „Nur damit ich die Größenordnung habe:" **Wozu:** Die Stunden sind der Kern seiner Kurzanalyse und tauchen wörtlich in der Budget-Frage wieder auf. |
| Zeitersparnis, nur bei Telefonthema | Anrufe pro Woche | „Wie viele Anrufe bekommen Sie ungefähr in der Woche?" | Erscheint erst, wenn Erreichbarkeit im Gespräch ein Thema war, damit die Zusage von zwei Zahlen sichtbar bleibt. **Wozu:** Geht in die Rechnung ein, wie viele Anrufe heute unbeantwortet bleiben. |

Kennt er eine Zahl nicht, wird mit Schätzanker gearbeitet und `geschätzt` gekennzeichnet; das Kennzeichen ist wichtig, weil der Closer sonst mit einer Zahl argumentiert, die der Kunde nie gesagt hat. Es gehört auf dieselbe Zeile wie die Eingabe, sonst wird der Block zu hoch. Die Checkbox **„Kunde wollte keine Zahlen nennen"** bleibt, trägt keinen Fragesatz und hebt die Zahlen-Gates auf.

| Feldname im CRM | Sichtbar am Feld | Im Aufklapper | Typ / Stufe |
|---|---|---|---|
| Wer das mitentscheidet | „Wer entscheidet das bei Ihnen mit?" | Name und Rolle. Aus dem Erstanruf vorbelegt, hier ergänzen. **Wozu:** Ein Abschlussgespräch ohne den Entscheider endet fast immer mit „Ich muss das noch besprechen". Steht hier jemand Zusätzliches, lädst du ihn zum zweiten Termin mit ein. | Freitext, vorbelegt · **Gate** |
| Was passieren müsste, damit es sich gelohnt hat, wörtlich | „Was müsste passieren, damit Sie in einem halben Jahr sagen: die Zusammenarbeit hat sich gelohnt?" | **Wozu:** Mit genau diesem Satz schließt der Closer ab („und wichtig war Ihnen …"), und er wird zum messbaren Ergebnis im Strategiepapier. Ohne ihn verhandelt der Closer über Leistungen statt über sein Ziel. | Freitext · **Gate** |
| Was er bereit wäre zu investieren | **Wechselt mit dem Ziel**, weil die Frage das Budget an sein Ergebnis koppelt. Eigentümer: „Was wären Sie bereit zu investieren, vorausgesetzt es kommen wirklich … Eigentümeranfragen im Monat dazu?" · Kaufinteressenten: „… vorausgesetzt Sie bekommen zu jedem Objekt … ernsthafte, geprüfte Kaufinteressenten statt der Gucker?" · Zeitersparnis: „… vorausgesetzt wir spielen Ihnen die … Stunden die Woche wieder frei?" | Zweite Möglichkeit, wenn er ausweicht: „Angenommen, wir bekommen das hin … Was haben Sie sich dafür an Budget vorgestellt? Ich frage, weil es ein bisschen wie beim Autokauf ist: Fiat oder Porsche, beides bringt Sie ans Ziel, das eine schneller." Seine Zahl ist ein Rahmen, kein Angebot; keine Preise nennen. **Wozu:** Der Closer weiß damit, ob sein Vorschlag über dem Rahmen liegt, und kann das offen ansprechen, statt überrascht zu werden. Weicht der Kunde aus, dokumentieren und nicht verhandeln. | Betrag oder `Kunde ist ausgewichen` · **Gate** |

**Aufklappbar am Ende des Abschnitts, zugeklappt vorbelegt, Überschrift „Nur wenn es im Gespräch fiel":**

| Feldname im CRM | Sichtbar am Feld | Im Aufklapper |
|---|---|---|
| Aufträge im letzten Jahr | „Wie viele Objekte bringen Sie heute im Jahr auf den Markt?" | **Bei Ziel Kaufinteressenten wird dieses Feld ausgeblendet**, dort steht dieselbe Frage bereits als erste Zahl im Hauptblock. **Wozu:** Nur damit das Konzept „von 20 auf 28" heißen kann statt „8 mehr". Fehlt die Zahl, funktioniert es trotzdem. |
| Provision je Auftrag | „Was verdienen Sie im Schnitt an einem Auftrag?" | Bei Zögern: „Eine Größenordnung reicht mir völlig. Eher zehn oder eher zwanzigtausend?" **Wozu:** Mit seiner echten Zahl rechnet der Closer im Abschluss den Mehrumsatz vor. Ohne sie nimmt das Konzept den Branchenwert und der Closer muss ihn im Gespräch absichern, das ist eine Stufe schwächer. |

### Abschnitt „Abschluss des Gesprächs"

| Feldname im CRM | Sichtbar am Feld | Im Aufklapper | Typ / Stufe |
|---|---|---|---|
| Was noch geklärt sein müsste, wörtlich | **Vorsatz:** „Wenn wir Ihnen nächste Woche zeigen, wie genau das bei Ihnen läuft, können wir dann gemeinsam starten?" **Kernsatz, wenn kein klares Ja kommt:** „Was müsste dafür noch geklärt sein?" | Kam ein klares Ja, bleibt das Feld leer. **Wozu:** Der Closer baut seine Vorbereitung darauf auf und bringt den passenden Beleg mit, statt den Einwand in Minute 40 zum ersten Mal zu hören. | Freitext · optional |
| Abschlussgespräch am | „Haben Sie Ihren Kalender gerade offen?" | Termin höchstens eine Woche voraus, über den Sammel-Kalender. „Soll jemand aus Ihrem Team dazukommen?" Falls ja, in die Notizen. **Wozu:** Zwischen den Terminen fällt am meisten aus; je kürzer der Abstand, desto mehr Gespräche finden statt. Was bis dahin für den Kunden entsteht, kündigst du nach seinem Ziel an: bei Eigentümern die SEO- und GEO-Analyse seiner Region plus Mehrwertkalkulation, bei Kaufinteressenten Kalkulation und Muster-Anzeige, bei Zeitersparnis und Sachverständigen die Automatisierungs-Kurzanalyse. Das System merkt sich das und schreibt es in die Bestätigungsmail. | Datum und Uhrzeit · **Gate** |
| Mobilnummer | „Und geben Sie mir noch Ihre Mobilnummer, falls am Tag selbst etwas dazwischenkommt." **Erscheint nur, wenn das Feld leer ist.** | Aus dem Erstanruf vorbelegt; nur nachtragen, wenn das Feld leer ist. **Wozu:** Ohne sie läuft die SMS eine Stunde vor dem Abschlussgespräch nicht, und die ist die letzte Absicherung gegen ein vergessenes Gespräch. | Telefonnummer, vorbelegt · Pflicht, wenn leer |
| Notizen und Sonderthemen | *Setter-Hinweis:* Hier hinein, was in kein anderes Feld passt. | Wer aus seinem Team dazukommt, Besonderheiten des Büros, vereinbarte Ausnahmen, Stimmung im Gespräch. **Wozu:** Damit du nichts unterschlagen musst, was nicht in ein Feld passt. Der Closer liest es vor dem Termin. **Bei einem Kunden mit eigenem Vorhaben ist dies das einzige offene Feld**, dann bitte mitschreiben: was er genau vorhat (wörtlich), was am Ende dabei herauskommen soll, welche Systeme und Daten beteiligt sind, bis wann es stehen soll und was ihn die heutige Lösung kostet. | Freitext, mehrzeilig · optional |
| Ergebnis des Gesprächs | *Setter-Hinweis:* Erst nach dem Gespräch. „Nächster Schritt vereinbart" nur, wenn du die zugesagte Handlung mit Datum benennen kannst. | Bis auf die klare Absage endet jedes Beratungsgespräch mit einem Abschlusstermin. Kam ausnahmsweise keiner zustande, fasst der Setter binnen 48 Stunden nach. Kannst du die Handlung nicht mit Datum benennen, ist es „Vertagt ohne festen Schritt". **Wozu:** Das Feld entscheidet, was das System als Nächstes tut, und es ist die Grundlage der Quote, an der wir sehen, ob der Prozess trägt. | Auswahl: Auftrag · Nächster Schritt vereinbart · Vertagt ohne festen Schritt · Absage · Pflicht |

**Ohne Eingabe, das System füllt oder rechnet:** Versendete Unterlagen und Videos (beim Senden gesetzt, der Closer prüft sie vor seinem Termin) · Nötige Anfragen pro Monat · Anfragen-Bedarf pro Monat · Vorschlag fürs Nachfassen. Separat am Termin bleibt der Klick **„Termin fand statt"**.

**Berechnetes Zusatzfeld „Anfragen-Bedarf pro Monat":** `unter 2` · `2 bis 4` · `über 4`, abgeleitet aus dem Zahlenblock. Sagt dem Closer in einem Wort, welche Paketstufe die Zahlen begründen (Grundlage seines Empfehlungs-Pakets). Das System rechnet, nicht der Mensch, damit die Zahl in Strategiepapier, Mails und Abschlussgespräch identisch ist.

**Was gegenüber der gebauten Fassung wegfällt** (geprüft auf Abnehmer in Closing-Skript, Leitfaden Closing, Strategiepapier-Struktur, Mail-Platzhaltern und Auswertungen, 20.09.2026): das Häkchen „fragt von sich aus nach Preis" im Setting-Lauf (es führte nur zur Tiefe 3, deren Sonderpfad am 03.09. abgeschafft wurde; im Erstanruf bleibt es) · die Tiefe als Setter-Eingabe (wird berechnet, im Closing nie zitiert) · das Feld „Woher seine Anfragen heute kommen" als eigenes Feld (kein Abnehmer, wandert in den Hilfetext der Versuche) · „Versendete Unterlagen" als Eingabefeld (füllt das System) · das Ja/Nein-Feld zum Vorabschluss (die offene Hürde ist jetzt optionaler Freitext). Ein „Anlass des Gesprächs"-Feld wurde geprüft und bewusst nicht aufgenommen: Der Satz geht im Problem-Wortlaut auf.

**Drei Lücken, die beim Abgleich mit dem Skript aufgefallen sind** (20.09.2026, deshalb sind sie oben enthalten): Die **Mobilnummer** wird im Skript ausdrücklich im Terminblock erfragt, fehlte aber in der Maske. Das **Ergebnis des Gesprächs** ist im Skript-Anhang Pflicht für den Setter, war in der Feldtabelle aber nur beim Closer geführt; beide Gespräche haben ihren eigenen Ausgang. Und **Frage 1** („Was hat Sie dazu gebracht?") hat zwar kein eigenes Feld mehr, eröffnet aber den Block: Sie steht im Aufklapper des Ziel-Feldes, damit der Setter weiß, wohin die Antwort gehört (Problem in das Feld darunter, Ziel in dieses). Am Feld sichtbar ist die Brücke, weil sie die Antwort auslöst, die dort eingetragen wird.

## Block 4: Gesprächsausgang und Nachfassen

Keine Ampel-Felder: Der Gesprächsausgang plus die zugesagte Handlung tragen dieselbe Information. Die zwei Verhaltensregeln dazu stehen im Handbuch (immer Abschlusstermin außer bei Absage, sonst Setter-Nachfass binnen 48 Stunden; nach dem Abschlussgespräch setzt die Diagnosefrage die Nachfass-Lage).

| Feld | Typ / Werte |
|---|---|
| Gesprächsausgang (je Gespräch) | `Auftrag` · `Fortschritt` (zugesagte Handlung mit Datum) · `Vertagung` · `Absage` |
| Zugesagte Handlung | Freitext plus Datum; die Testfrage: Kann ich sie benennen, mit Datum? Wenn nein, ist es eine Vertagung |
| Nachfass-Lage | `zufrieden mit dem Ist` · `will, traut sich nicht` · leer; wird vom Closer nach der Diagnosefrage gesetzt |
| **Empfohlenes Nachfass-Stück** (berechnet) | aus Nachfass-Lage und Segment nach der Empfehlungstabelle in den Mailstrecken Teil B; ohne gesetzte Lage: KI-Hacks. Anzeige als Vorschlag, der Closer darf überstimmen |
| Nachfass-Zähler | Versuche mit Datum des letzten Versands; Obergrenze fünf, dann legt das System die Abschieds-Vorlage vor (beim Zweifler endet das Nachfassen schon nach dem Referenzanruf-Angebot) |
| Verlust-Kategorie | `verloren, wiedervorlagefähig` · `verloren, endgültig` — die erste ist der Endpunkt des Nachfassens und braucht ein Wiedervorlage-Datum |

## Block 4b: Bausteine aus der CRM-Prüfung (11.09.2026)

Ergänzungen aus dem Abgleich mit dem realen System (Miro-Board, Frames F23/F24; die Klartext-Feldnamen und Tooltips stehen wortgleich in der Feldtabelle neben F24).

| Baustein | Feld/Aktion | Stufe | Regel |
|---|---|---|---|
| Termin fand statt | Klick am Termin, je Termin-Typ | Pflicht nach jedem Termin | Schreibt ein Ereignis mit Zeitstempel. Grundlage für Erscheinungsquote, Termin-Vergütung (nur gehaltene Termine) und den Auslöser „erschienen". Kein Klick und kein „Nicht erschienen" heißt: offen |
| Zurück an den Vorgänger | Aktion, Grund ist Pflicht | jederzeit ab der ersten Übergabe | Setter gibt an Opener zurück, Closer an Setter; zählt die Rückgabequote und macht die Gates vollständig |
| Nachfass-Vorlagen-Bibliothek | Vorlagen je Toolkit-Stück, keine getaktete Serie (Entscheidung Niklas, 15.09.2026) | nach dem Gesprächsausgang „Wird nachgefasst" | Das System empfiehlt das Stück aus Diagnose und Segment (Empfehlungstabelle Teil B) und legt die vorbefüllte Vorlage vor; der Closer wählt Zeitpunkt und Reihenfolge und sendet. Acht Vorlagen: Zusammenfassung, Fallbeispiel, Auswirkungsfrage, Sichtbarkeits-Check (zweistufig: fehlt der Makler in den Suchen, die Check-Mail, sonst die Ratgeber-Mail; bei Sachverständigen der SV-Ranking-Beweis), Ratgeber, Beweisstück, Referenzanruf-Angebot, Abschied. Ein Termin in der Zukunft pausiert das Nachfassen; ein **Wiedervorlage-Wecker** erinnert den Closer, wenn ein Kontakt in „Wird nachgefasst" 7 Tage ohne Aktivität ist. Technik: die geprüfte Serien-Mechanik der Aufgaben-Serien |
| Wiedervorlage am | Datum | Pflicht bei „verloren, wiedervorlagefähig" | Ein täglicher Lauf erzeugt am Stichtag automatisch eine Aufgabe |
| Zuteilungsfrist | Automatik | beide Pools (Setter- und Closer-Besetzung) | Unbesetzt nach 2 Stunden → Direktzuteilung durch Admin; der 24-Stunden-Alarm bleibt. Interessenkonflikt-Regel: Bewirbt sich jemand auf einen Kontakt, den er selbst qualifiziert hat, wird das dem genehmigenden Admin sichtbar markiert |
| Vertrag gekündigt zum + Grund | Datum + Auswahl | nur bei Gewonnenen | Grundlage für die Abwanderungs-Kennzahl (Jahresziel unter 3 %/Monat) und mögliche Rückbelastungen; läuft eine Vereinbarung aus, erinnert das System rechtzeitig |
| Anrufversuche | Zähler mit Zeitstempel, automatisch | gemessen | Die erste Zahl des Wochen-Benchmarks (600 Anwahlen), ohne Strichlisten |

Der Angebots-Weg (Angebot versenden → „Angebot verschickt, wartet auf Unterschrift" → Gewonnen mit vorbefüllten Angebotsdaten, 30-Minuten-Warnung bei ausbleibender Versand-Bestätigung) ist in F23/F24 spezifiziert und gehört zum selben Bauumfang.

## Block 5: Messungen (Auswertung, keine Prüfung)

- **Anwahlen je Opener, wöchentlich:** automatisch gezählte Anrufversuche mit Zeitstempel — die erste Zahl des Wochen-Benchmarks (600 Anwahlen, 20 Termine, 14 gehaltene, 1 Abschluss)
- **Erfüllungsquote je Übergabefeld und je Opener/Setter, wöchentlich:** Anteil gefüllter Felder, getrennt nach Wert (auch: wie oft `nicht erhoben`/`nicht gefragt`). Wer bei den Ausweichwerten auf null Prozent steht, ist verdächtig, nicht gut.
- **Rückgabequote der Übergaben** (Closer gibt zurück), je Woche.
- **Erscheinungsquote** je Termin-Typ (Beratungs-/Abschlussgespräch), Zielwert laut Handbuch.
- **Verteilung der Kontakte auf die drei Tiefen** (zeigt, ob das Raster trennt).

## Umsetzungshinweise

1. Die Wortlaut-Felder (1.3, 1.4a, 2.4, 2.6, 2.8) sind Freitext ohne Vorschläge; sinngemäße Zusammenfassungen sind im Prozess ausdrücklich unerwünscht.
2. Die Materialauswahl vor dem Termin steuert die Alltagsregel in `2026-08-12-ressourcen-crm-mailstrecken.md` (Segment = Ziel; bei gesetztem Vorhaben-Feld ersetzt die Vorhaben-Mail die Segment-Mail); die Felder hier sind ihre Eingabewerte. Das Nachfass-Material steuert die Empfehlungstabelle in Teil B derselben Datei.
3. Kein automatischer Mailversand: Das System schlägt vor, ein Mensch schickt ab (Festlegung aus den Mailstrecken).
4. Platzhalter für die Nachfassmails, die aus diesen Feldern gefüllt werden: `{Anrede}` `{Gesprächsdatum}` `{Ziel}` `{Schmerzpunkt im Wortlaut}` `{Zuwachs}` `{Nötige Anfragen im Monat}` `{Ausgesprochener Bedarf}` `{Offener Punkt}` `{Absender}`; `{Ist-Aufträge}` und `{Zielaufträge}` nur, wenn die Ist-Zahl aus dem Speicher erhoben wurde.
