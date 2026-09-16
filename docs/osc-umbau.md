# OSC-Umbau (Opener · Setter · Closer)

Soll-Prozess: Miro F23 · Feldnamen und Hilfetexte: F24 · Umsetzungspaket mit den
vier Arbeits-Tabellen: F25 · Ist-System mit Belegen: F0 bis F22.

Branch: `osc-umbau`, abgezweigt vom Live-Branch `claude/analyze-repo-fKMVI`.

## Stand

| Nr | Ticket | Stand |
|---|---|---|
| 0.1 | Serverseitige Autorisierung | fertig, im Live-Branch |
| 0.2 | Deploy-Falle entschärfen | **erledigt** |
| 0.3 | Live-Schema als Ausgangszustand | fertig, im Live-Branch |
| 0.4 | opener_id + Zuordnungs-Verlauf | fertig, im Live-Branch |
| 2 | Neue Felder laut Schema-Delta | **eingespielt** (`20260912_osc_felder.sql`) |
| 3 | Ereignis-Verlauf | **eingespielt** (Protokoll-Trigger aktiv) |
| 1 | Statuskette — Code | **fertig** (`shared/status.js`, 15 Dateien) |
| 8 | Buchen-Gates | **fertig** — beide Übergaben mit Formular und Riegel |
| 4 | Bekannte Kleinfixe | **fertig** bis auf die zurückgestellte Calendly-Signatur |
| 5 | Besetzung über zwei Pools | **fertig** |
| 6 | Fristen und Alarme | **fertig** |
| 13 | Wiedervorlage-Wecker | **fertig** |
| 14 | Termin-fand-statt und Anrufzähler | **fertig** |
| 10 | Angebots-Zweig absichern | **fertig** |
| 11 | Mail-Modul für alle Rollen | **fertig** |
| 15 | Kennzahlen | **fertig** |
| 9 · 12 | Nachrichten und Nachfass-Toolkit | **Wortlaute da**, Struktur auf den Werkzeugkasten umgestellt |
| 1 | Statuskette — Datenbank | **vorbereitet, nicht eingespielt** (`20260913_osc_statuskette.sql`) |

## Warum die Statuskette noch wartet

Zwei Bedingungen, beide nachprüfbar:

**1. Der Code dieses Branches muss deployt sein.** Er schreibt heute `Lead`,
`Im Closing`, `Abgeschlossen`, `Termin verschoben`. Nach der Migration laufen
diese Werte in den CHECK. Betroffen: `TerminPicker.jsx`, `Closing.jsx`,
`Kaltakquise.jsx`, `AbschlussForm.jsx`, `Dashboard.jsx`, `hot-leads.js`,
`calendly-webhook.js`.

**2. Es muss belegt sein, wer sonst noch schreibt.** `hot_leads.status` ist
freier Text, und `status: 'Angebot'` wird ausschließlich als Signal an eine
externe Angebots-Automatisierung gesetzt, die daraufhin `'Angebot versendet'`
zurückschreibt. Kein einziger Datensatz trägt `'Angebot'` — der Wert existiert
nur im Flug. Wo es solche Außenpfade gibt, ist nicht dokumentiert. Der
Protokoll-Trigger beantwortet das mit Daten statt mit Vermutung:

```sql
select nach_status, daten->>'verbindung' as verbindung, count(*)
  from hot_lead_ereignisse
 where art = 'statuswechsel' and akteur_id is null
 group by 1, 2 order by 3 desc;
```

Jede Zeile ist ein Schreiber außerhalb des CRM. Eine Woche Beobachtung deckt
den normalen Betrieb ab. Taucht dort ein Wert auf, den die Liste nicht kennt,
legt die Migration diesen Pfad lahm — dann erst wird die Liste ergänzt.

## Was in der Datenbank an Status-Werten hängt

Gefunden über den Ausgangszustand aus Ticket 0.3. Ohne diese drei Stellen wäre
die Umbenennung ein Blindflug gewesen:

| Objekt | Hängt an | In der Migration |
|---|---|---|
| Trigger `trg_lead_closed_to_bridge` | `'Abgeschlossen'` → Billing-Bridge | neu gebaut auf `'Gewonnen'` |
| Funktion `notify_bridge_lead_closed()` | prüft den Wert im Rumpf | mitgezogen |
| Teilindex `idx_hot_leads_status_billing` | filtert auf `'Abgeschlossen'` | neu gebaut |

`'Angebot'` und `'Angebot versendet'` behalten ihre Schreibweise. Der Klartext
steckt in der Anzeige, nicht im gespeicherten Wert — eine Umbenennung hätte den
externen Angebots-Pfad zerrissen.

## Abbildung der Bestandsdaten

Alle 591 Kontakte sind abgedeckt, kein Wert fällt durch.

| alt | neu | Anzahl |
|---|---|---|
| Verloren | Verloren, endgültig | 189 |
| Lead | Beratungsgespräch vereinbart | 122 |
| Termin abgesagt | unverändert | 101 |
| Nicht erschienen | unverändert | 60 |
| Im Closing | Im Abschluss | 49 |
| Abgeschlossen | Gewonnen | 31 |
| Termin verschoben | Beratungsgespräch vereinbart | 20 |
| Angebot versendet | unverändert | 19 |

Drei Entscheidungen, die dahinterstecken:

- **`Lead` → „Beratungsgespräch vereinbart"**: Von 122 haben nur 2 keinen
  Termin. 88 haben einen Termin in der Vergangenheit — die bleiben trotzdem auf
  „vereinbart". Ob das Gespräch stattfand, weiß niemand; der neue Klick
  „Termin fand statt" löst das auf. Geschichte wird nicht erfunden.
- **`Verloren` → „endgültig", nicht „wiedervorlagefähig"**: Zu keinem dieser
  189 wurde je ein Wiedervorlage-Anlass oder -Datum erfasst, und die neue Regel
  verlangt beides. Eine spätere Sichtung dieser 189 ist eine
  Geschäftsentscheidung, keine Migration.
- **`status_alt`** sichert den Wert von vorher. Nichts geht verloren.

## Übergangsmatrix

In `status_uebergang_erlaubt()`, geprüft mit 14 Fällen (normale Wege,
Stufensprünge, Endzustände, Rückwärtswechsel). Verloren ist aus jeder Stufe
erreichbar — ein Kontakt kann jederzeit absagen. Der Sonderweg „zurück an den
Vorgänger" läuft über `status_ruecknahme_ziel()` als eigene Aktion mit
Pflicht-Grund, damit die Rückgabequote zählbar bleibt.

## Entscheidungen

**Getroffen am 12.09.2026:**

- **Die 49 Coldcaller bleiben Coldcaller.** Keine Umstellung auf `Opener`.
  Das kostet nichts: Jede Zugangsentscheidung im Code läuft über `istOpener()`,
  das beide Werte annimmt — nachgeprüft, es gibt keinen einzigen wörtlichen
  Vergleich auf `'Coldcaller'` oder `'Opener'` in `src/`, `netlify/` oder
  `shared/`. Neue Mitarbeiter bekommen `Opener`, die bestehenden behalten ihren
  Wert, beide arbeiten im selben Tab.
- **Strecke B folgt Miro: Tag 0/3/7/14/28.** Das Vertriebshandbuch sagte 21.
  Die Miro-Tabelle F25.1 ist die jüngere Quelle und deckt sich mit dem
  Eintrag „B5 — Tag 28" in der Nachrichtenliste.

**Noch offen:**

- Werden die Übergabe-Gates hart erzwungen oder zunächst als Warnung? Empfehlung
  aus F23: Gates hart, Pflichtfelder als Warnung.
- Sollen die 189 alten „Verloren" neu qualifiziert werden?
- Die Mail-**Wortlaute** liegen weder im Repo noch auf dem Miro-Board (siehe
  unten).

## Die Nachrichten (Tickets 9 und 12)

Die Wortlaute liegen seit dem 16.09.2026 vor:
`docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md`. Sie werden dort
gepflegt und von dort wortgleich übernommen — `shared/mailstrecken.js` hält nur
fest, wann und wofür eine Nachricht gilt, nie den Text selbst. Zwei Quellen für
denselben Satz laufen immer auseinander.

### Die Datei kippt eine Grundannahme

Miro F25.1 beschreibt zwei **getaktete** Nachfass-Strecken, Tag 0/4/10/21/35 und
0/3/7/14/28. Genau die hatte ich gebaut, und dazu lag die Entscheidung „Strecke B
auf Tag 28" vor. Teil D der Datei hebt das auf:

> **Es gibt keine getaktete Mail-Serie mehr.** *(Entscheidung Niklas, 15.09.2026)*
> Das Nachfassen ist eine Sammlung von Vorlagen und Werkzeugen, aus der der
> Closer wählt. Das CRM empfiehlt ein Stück und legt die passende Vorlage vor;
> Zeitpunkt und Reihenfolge bestimmt der Closer.

Die Miro-Tabelle ist damit überholt. **Die Datei gilt, sie ist die jüngere und
die redaktionell gepflegte Quelle.** Folgen:

- `20260913_osc_nachfass_serien.sql` ist **gelöscht**. Sie hätte einen Terminplan
  erzwungen, den es nicht mehr gibt. Nachgeprüft: nie eingespielt, die Tabelle
  `nachfass_zeitplan` existiert in der Datenbank nicht.
- `shared/mailstrecken.js` ist neu geschrieben: acht feste Nachrichten vor den
  beiden Terminen, dazu dreizehn Werkzeuge ohne Kalender.
- Die Entscheidung „Strecke B auf Tag 28" ist gegenstandslos.

### Was jetzt steht

| Teil | Inhalt |
|---|---|
| Feste Ketten | 8 Nachrichten — Einladung, Segment-Mail, Erinnerung, SMS, Bestätigungsanruf; nach dem Setting Einladung, Bestätigungsmail, SMS |
| Segment-Mail | fünf Fassungen. **Vorhaben schlägt alles**, danach schlägt die Berufsgruppe das Ziel |
| Werkzeugkasten | 13 Stücke, jedes mit Fundstelle, Platzhaltern und der Regel dazu |
| Empfehlung | aus Diagnose × Segment, mit einer Zeile Begründung; Rückfall KI-Hacks |
| Grenzen | höchstens fünf Versuche, jedes Stück je Kontakt nur einmal |

### Eine Falle, die beim Abgleich auffiel

Die Datei nennt die Segmente kurz „Eigentümer, Käufer, Zeit". Im CRM heißen die
Werte `Mehr Eigentümer-Anfragen`, `Mehr Kaufinteressenten`,
`Zeitersparnis und Entlastung`. Mein erster Entwurf hätte die Werte der Datei
verglichen und **nie** eine Zuordnung getroffen — still, ohne Fehlermeldung.
`shared/mailstrecken.js` benutzt jetzt die CRM-Werte aus `shared/felder.js`.

### Bewusstseinsstufe und Tiefe

Teil A gibt zwei Formeln vor. Beide sind als berechnete Spalten eingespielt
(`20260916_osc_bewusstseinsstufe_und_toolkit.sql`), damit niemand eine Stufe
*wählt*: „Der Vertriebler klickt ein Häkchen, sonst nichts."

Eine Auslegung steckt darin, und sie ist nicht von mir zu entscheiden:
`Vorerfahrung` kennt drei Zustände — ja, nein und **„Nicht gefragt" = unbekannt**.
Die Formel der Datei kennt nur ja und nein. Unbekannt wird vorsichtig wie nein
behandelt, der Kontakt landet also auf der niedrigeren Stufe. Falls das anders
gemeint ist, ist es eine Zeile.

### Was an Wortlauten noch fehlt

| Stück | Warum |
|---|---|
| Segment-Mail Kaufinteressenten | Käufer-Video nicht gedreht; bis dahin Übergangsfassung mit dem Streil-Kurzschnitt |
| Die vier VSL | nicht aufgenommen; bis dahin Loom bzw. Referenzschreiben als Übergang |
| GEO-Ergänzung im Sichtbarkeits-Ratgeber | offen |
| Webinar, Voicebot-Demo-Nummer | einzurichten |

## Die Status im Code

Eine Quelle für beide Seiten: `shared/status.js`. Vorher standen die Werte rund
140-mal verstreut in 15 Dateien. Zwei Fallen steckten darin:

- **`'Termin abgesagt'` und `'Termin verschoben'` sind gleichzeitig Werte des
  `message_type`-Enums** für Systemnachrichten. Ein pauschales Ersetzen hätte
  die Benachrichtigungen zerschossen. Die Nachrichten-Typen sind unverändert
  geblieben; nur die Lead-Status wurden umgestellt.
- **`analytics.js` verglich auf Teilzeichenketten in Kleinbuchstaben**
  (`includes('abgeschlossen')`, `includes('closing')`). `Gewonnen` wäre dort
  ohne Fehlermeldung aus jeder Statistik gefallen. Ersetzt durch benannte Werte.

`'Termin verschoben'` ist kein Status mehr, sondern eine Terminänderung: Der
Lead bleibt auf „Beratungsgespräch vereinbart", nur das Datum wechselt.
Erkannt wird das über `hasTerminChange` statt über den Status.

### Lesen ist tolerant, Schreiben nicht

Die Functions bringen jeden gelesenen Status über `normalisiere()` auf die neue
Liste, bevor ihn irgendwer sieht. Geschrieben werden nur noch die neuen Werte.
Damit läuft der Code gegen beide Datenstände — und es gibt kein Fenster, in dem
Listen leer aussehen, weil Migration und Deploy nicht dieselbe Sekunde treffen.

Zwei Stellen mussten beide Schreibweisen annehmen, bis die Migration läuft:

- der Bridge-Auslöser in `hot-leads.js` — sonst bliebe die Rechnungsstellung
  beim ersten neu gesetzten Wert aus
- die Follow-Up-Abfragen, die gewonnene Leads ausschliessen

### Wer geschrieben hat

`set_config()` taugt nicht: Jeder PostgREST-Aufruf ist eine eigene Transaktion.
Der Akteur reist deshalb in derselben Zeile mit (`zuletzt_geaendert_von`), der
Protokoll-Trigger liest ihn dort ab. Schreiber ohne angemeldeten Nutzer — der
Calendly-Webhook — kennzeichnen sich über `zuletzt_geaendert_durch`. Damit ist
im Verlauf unterscheidbar: Person, bekanntes System, oder unbekannt. Nur die
dritte Gruppe ist die Frage, wegen der das Protokoll existiert.

## Die Übergabe-Gates (Ticket 8)

Feldnamen und Hilfetexte stehen wortgleich in `shared/felder.js`, Quelle ist die
Feldtabelle neben F24. Dieselben Definitionen beschriften im Frontend die
Eingabe und prüfen im Backend das Gate — zwei Quellen wären zwei Wahrheiten,
und die Tooltips sind mit Bedacht formuliert („Bitte nicht raten, ein leeres
Feld ist besser als ein falsches").

**Gate hart, Pflichtfelder als Warnung**, nach der Empfehlung aus F23. Gate ist,
was ohne den Wert nicht funktioniert: die Segment-Mail braucht die Berufsgruppe,
die SMS die Mobilnummer, das Empfehlungs-Paket die Zahlen.

| Übergabe | Felder | davon Gate | Wo geprüft |
|---|---|---|---|
| 1 · Erstanruf (Opener) | 9 | 5 | beim Anlegen des Hot Leads (POST) |
| 2 · Beratungsgespräch (Setter) | 12 | 6 | beim Wechsel auf „Abschlussgespräch vereinbart" |

Drei Regeln, die beim Bauen nicht offensichtlich waren:

- **Eine nicht angehakte Checkbox ist eine Antwort, keine Lücke.** Sonst nörgelt
  das System über Felder, die korrekt leer sind, und die Warnungen sind nach
  einer Woche Rauschen.
- **Bei Ja/Nein ist „gar nicht beantwortet" sehr wohl eine Lücke.** „Kunde hat
  ein konkretes eigenes Vorhaben" steuert, welche Mail rausgeht — unbeantwortet
  ist kein Nein.
- **„Kunde wollte keine Zahlen nennen" hebt die Zahlen-Gates auf.** Genau dafür
  ist die Checkbox da; leer ist dann die richtige Antwort.

Das Gate für Übergabe 1 greift **nicht** bei Calendly-Direktbuchungen und nicht
beim Neubuchen nach einem geplatzten Termin — dort war kein Opener beteiligt,
und ein Gate würde nur den Termin verhindern.

### Die Setter-Ansicht

Sie hängt am Termin (`Termine`), nicht in der Closing-Ansicht: `/closing` ist
auf Closer und Admin beschränkt, der Setter kommt dort nicht hin. Am eigenen
Termin sieht er zwei Stufen:

1. **„Termin fand statt"** — ein Klick, setzt den Status auf „Beratungsgespräch
   geführt" und schreibt das Ereignis. Ohne diesen Klick zählen Erscheinungsquote
   und Termin-Vergütung nicht; bisher gab es nur No-Show, keinen positiven
   Nachweis.
2. **Übergabe an den Closer** — die zwölf Felder, die berechnete Anzeige
   „Nötige Anfragen pro Monat" und die Schaltfläche „Abschlussgespräch buchen".

Datum und Uhrzeit des Abschlussgesprächs werden vorerst von Hand eingetragen.
Die Buchung über den Sammel-Kalender kommt mit Ticket 7 — ein Status
„Abschlussgespräch vereinbart" ohne echten Termin wäre eine Falschangabe, also
ist das Feld Pflicht.

### Eine Korrektur an den berechneten Zahlen

`noetige_anfragen` hiess „pro Monat", rechnete aber Jahreswerte — der Teiler 12
fehlte. Bei 12 Wunsch-Aufträgen im Jahr und einer Quote von 3 von 10 hätte dort
40 statt 3,3 gestanden, und laut F24 wird genau diese Zahl ins Strategiepapier
übernommen. Korrigiert, dazu `anfragen_bereich` (unter 2 · 2 bis 4 · über 4)
als berechnete Spalte.

## Die Rollen

Die Rolle **Setter gab es in der Datenbank, aber niemand konnte sie vergeben**:
Die Mitarbeiterverwaltung bot nur `['Admin', 'Closer', 'Coldcaller']` an.
Geschäftsführer fehlte ebenfalls. Entsprechend trug sie **null Nutzer**.

`shared/rollen.js` ist jetzt die eine Quelle. Vergebbar sind Opener, Setter,
Closer, Admin, Geschäftsführer. **Coldcaller steht nicht mehr zur Auswahl**,
gilt aber weiterhin als Opener — 18 aktive Nutzer tragen den alten Wert, und
am Tag der Umstellung wäre sonst die Kaltakquise für alle zu.

| Seite | wer darf |
|---|---|
| Kaltakquise | Opener (und Coldcaller), Admin |
| **Termine** | **alle Angemeldeten — hier arbeitet der Setter** |
| Closing, Follow-Up | Closer, Admin |
| Finanzen | Geschäftsführer |
| Einstellungen | Admin |

Der Setter bekommt bewusst **nur die Termine**. Dort liegt alles, was er
braucht: sein Gespräch, „Termin fand statt" und die Übergabe an den Closer.

### setter_id bedeutet etwas Neues

Heute steht dort, **wer gebucht hat** — in 488 von 545 Fällen derselbe Mensch
wie in `opener_id`. Im neuen Prozess legt der Opener den Termin und ein Setter
hält ihn.

Rückwirkend war dieser Setter immer **der Closer**: Eine eigene Setter-Rolle
gab es nie, der Closer führte beide Gespräche selbst. Die Migration
`20260913_osc_setter_rueckwirkend.sql` setzt das um und gibt allen Closern
zusätzlich die Setter-Rolle — sonst zeigte `setter_id` auf jemanden, der die
Setter-Ansicht nicht öffnen darf.

- 562 Kontakte bekommen ihren Closer als Setter
- 29 ohne Closer werden leer. Dort hat niemand ein Gespräch gehalten (22 davon
  noch im Pool). Leer ist die ehrliche Antwort und genau der Zustand, den der
  24-Stunden-Alarm aus Ticket 6 aufgreifen soll
- `setter_id_alt` sichert den alten Wert. Er ist zwar meist auch in `opener_id`
  erhalten, aber nicht immer: 15 Datensätze haben einen Setter ohne Opener

**Diese Migration läuft nicht vor dem Deploy.** Der alte Code filtert die
Termin-Ansicht allein über `setter_id`; würde man sie vorher einspielen,
verlören alle Opener die von ihnen gelegten Termine aus den Augen. Der Code
dieses Branches holt sie zusätzlich über `opener_id` — der alte nicht.

### Coldcaller wird Opener — aber erst nach dem Deploy

Geprüft am ausgelieferten Bundle (`crmsunsideai.netlify.app`, Stand 11.09.):
Es enthält **nichts** vom Umbau — kein Sitzungs-Token, keinen der neuen Status.
Dafür wörtlich:

```
allowedRoles:["Coldcaller","Admin"]          // Zugang zur Kaltakquise
isColdcaller: () => hasRole("Coldcaller")    // Menü und Dashboard
```

Beides prüft exakt auf den alten Wert, ohne Ausweichpfad. Würde man die 18
aktiven Coldcaller **jetzt** umbenennen, verlören sie den Menüpunkt und würden
beim Öffnen der Kaltakquise aufs Dashboard umgeleitet — ihre Tagesarbeit.
Dazu käme: `users.js` löst den Akquisepfad über `rollen.includes('Coldcaller')`
aus, ein neuer Opener bekäme keinen.

Nach dem Deploy ist die Umbenennung gefahrlos, weil beide Werte als Opener
gelten. Sechs Stellen im Branch prüften vorher noch wörtlich und hätten nach
der Umbenennung still aufgehört zu greifen:

| Stelle | Was still ausgefallen wäre |
|---|---|
| `MitarbeiterVerwaltung` Offboarding | Leads eines ausscheidenden Openers wären nirgends gelandet |
| `Dashboard` Rollenkennung | Ein Opener wäre in den Kennzahlen als **Closer** gezählt worden |
| `MitarbeiterVerwaltung` Onboarding | kein Akquisepfad für neue Opener |
| `users.js` Zapier-Webhook | dito, serverseitig |
| `auth.js` | bildete die Einzelrolle `Coldcaller` auf **`Setter`** ab — schon vor dem Umbau falsch, danach grob irreführend |

Alle fünf laufen jetzt über `istOpener()`.

Was die Migration bewirkt: 12 Closer bekommen die Setter-Rolle dazu, 49 Nutzer
(18 davon aktiv) werden von Coldcaller auf Opener umgetragen, keine
Doppelbelegung.

## Die zwei Pools (Ticket 5)

Gleiche Mechanik wie beim Closer-Pool, nur eine Stufe früher: Der Setter
bewirbt sich auf ein Beratungsgespräch, ein Admin teilt zu. Die Spalte `stufe`
an der Bewerbung entscheidet, welches Feld bei der Genehmigung gefüllt wird —
`setter_id` oder `closer_id` — und welche Mitbewerber abgelehnt werden. Eine
Setter-Zuteilung lässt offene Closer-Bewerbungen unberührt.

**Der Interessenkonflikt wird markiert, nicht verboten.** Wer den Kontakt selbst
qualifiziert hat und sich auf die nächste Stufe bewirbt, erscheint dem
genehmigenden Admin mit einem Hinweis am Kommentar. Im Pool sieht der Bewerber
denselben Hinweis an seinem eigenen Eintrag.

Zwei Dinge sind dabei aufgefallen:

- **Der eindeutige Index kannte die Stufe nicht.** `(hot_lead_id, closer_id)`
  war für offene Bewerbungen eindeutig — wer sich auf das Beratungsgespräch
  bewarb, hätte sich nicht mehr auf das Abschlussgespräch desselben Kontakts
  bewerben können, und zwar mit einer Datenbankfehlermeldung statt einer
  verständlichen Antwort. Die Stufe gehört in den Schlüssel.
- **`closerId` kam aus dem Anfrage-Körper.** Man konnte sich für jemand anderen
  bewerben. Der Bewerber kommt jetzt aus dem Token.

Der Pool zeigt nur, was noch bevorsteht. Ein vergangener Termin ohne Setter ist
kein Fall für eine Bewerbung, sondern für den Alarm aus Ticket 6.

## Bewerbungspflicht als Schalter

Admins stellen in den Einstellungen je Stufe ein, ob beworben werden muss oder
direkt übernommen werden darf. Getrennt, weil die Lage unterschiedlich sein
kann: Beim Setting kann Tempo wichtiger sein als Auswahl, beim Closing
umgekehrt.

- **Voreinstellung „an" auf beiden Stufen.** Das ist das heutige Verhalten beim
  Closing. Ein neuer Schalter darf nichts still ändern.
- **Fehlt der Eintrag, gilt „an".** Ein fehlender Schalter darf keine Tür öffnen.
- **Auch bei „aus" wird protokolliert**, wer wann übernommen hat — als
  genehmigte Bewerbung mit Vermerk. Die Zuteilung bleibt nachvollziehbar, sie
  braucht nur keine Freigabe mehr.
- **Gleichzeitigkeit ist abgesichert:** Die Übernahme schreibt nur, solange das
  Feld leer ist (`.is(feld, null)`), und liest danach zurück. Wer zu spät kommt,
  bekommt 409 statt einer stillen Überschreibung.

Das Frontend kennt den Schalter nicht — die Function antwortet mit `direkt:
true/false`, und die Oberfläche sagt entsprechend „übernommen" oder „beworben".
So gibt es keine zweite Stelle, die mit der Einstellung auseinanderlaufen kann.

Gelesen werden die Einstellungen von allen Angemeldeten, geändert nur von der
Leitung. Die Function gibt bewusst **nur die CRM-Schlüssel** heraus: Dieselbe
Tabelle trägt Absenderadressen und Signaturen des Berichtsversands aus dem
Operations-System, die im CRM-Frontend nichts zu suchen haben.

## Der Opener wird nicht mehr automatisch Setter

Beim Durchgehen des Prozesses aufgefallen: Der TerminPicker schickte
`setterName: user.vor_nachname` — wer buchte, wurde also selbst als Setter
eingetragen. Damit hätte sich **der Setter-Pool nie gefüllt** und die ganze
Zwei-Pool-Mechanik wäre tot geboren gewesen. Zusätzlich hätte der Opener die
Übergabe-2-Maske an seinem eigenen Termin gesehen.

Jetzt gilt: **Wer bucht, ist der Opener.** `setter_id` bleibt leer und der
Termin geht in den Pool. Wer selbst die Setter-Rolle trägt, kann ankreuzen
„Ich halte das Beratungsgespräch selbst" — ohne Haken geht es in den Pool.

Zwei Folgeänderungen waren nötig:

- `hot-leads.js` verlangte zwingend einen Setter beim Anlegen. Das war richtig,
  solange derselbe Mensch beides war, und verhindert jetzt den Pool. Das Feld
  ist optional.
- `opener_id` wird beim Buchen ausdrücklich gesetzt statt dem Trigger
  überlassen. Der füllt nur, wenn genau ein Kandidat in `lead_assignments`
  steht — beim Buchen wissen wir es sicher.

## Regel: der Produktivlauf darf nie betroffen sein

Alle Datenbank-Änderungen dieses Umbaus sind rein additiv — der laufende
CRM-Stand kennt die neuen Spalten nicht und fasst sie nicht an. Das ist keine
Behauptung, sondern nachgemessen:

    python3 scripts/pruefe-produktiv.py

Das Skript spielt den **alten** Produktivcode gegen die **aktuelle** Datenbank:
Hot Lead mit altem Statuswert anlegen, durch die alten Status wechseln,
Zuweisung anlegen und löschen, Bewerbung ohne das neue Feld `stufe`. Alles über
PostgREST mit dem Service-Key — genau der Weg der Netlify-Functions. Direktes
SQL würde Trigger, RLS und PostgREST umgehen und wäre kein Beleg.

**Vor und nach jeder Migration gegen die Live-Datenbank ausführen.**

### Aus Schaden gelernt

Beim ersten Lauf hat der Testdatensatz den Trigger `trg_lead_closed_to_bridge`
ausgelöst und zwei echte HTTP-Aufrufe an die Abrechnung geschickt. Sie liefen
ins Leere, aber das war Glück und nicht Absicht. Das Skript setzt
`billing_mode` deshalb auf `manual_external` — der Trigger verlangt `none`.

**Wer Testdaten durch die Live-Datenbank schickt, muss wissen, welche Trigger
daran hängen.** Der Ereignis-Verlauf macht sie sichtbar:

    select tgname, tgrelid::regclass from pg_trigger where not tgisinternal;

### Zwei Wege zur Abrechnung, einer davon tot

`hot-leads.js` ruft die Bridge über `process.env.BRIDGE_URL` — also
konfigurierbar. Der Datenbank-Trigger `notify_bridge_lead_closed()` hat die
Adresse dagegen **fest einkodiert**, und genau dieser Hostname antwortet mit
404 „Application not found": Auf ihm liegt kein Dienst. Das Railway-Projekt
existiert; die fest einkodierte Adresse zeigt nur nicht mehr darauf.

Zu prüfen: Steht in `BRIDGE_URL` bei Netlify dieselbe Adresse? Dann fiele auch
der Weg über die Anwendung aus. Die Adresse gehört ohnehin in die
Konfiguration, nicht in den Funktionsrumpf — zusammen mit dem Token, das dort
ebenfalls fest steht.

## Die acht Befunde aus der Prüfung

Alle erledigt. Zwei davon brachen echte Abläufe:

**Die Neu-Terminierung schlug still fehl.** Die Kaltakquise setzte beim
Neubuchen nach No-Show oder Absage den Status auf „Im Abschluss" — ein
mechanisch umbenanntes altes `'Im Closing'`, das die Übergangsmatrix nicht
erlaubt. Der Aufruf wurde mit 409 abgewiesen, es wurde **nichts** gespeichert,
auch das neue Datum nicht — und der Closer bekam trotzdem eine Nachricht über
einen Termin, den es im CRM nicht gab. Jetzt geht es zurück in den vereinbarten
Termin, und welcher das ist, sagt das Abschluss-Datum: Ist es gesetzt, ging es
um das Abschlussgespräch, sonst um die Beratung. Fehlschläge werden gemeldet
statt verschluckt.

**An die geplatzten Termine kam niemand mehr heran.** Drei Stellen prüften
`setterId === user.id`. Nach dem Umbau ist das „wer das Beratungsgespräch
hält" — der Bucher steht in `opener_id`. Der Opener kam damit nicht mehr an
seinen eigenen geplatzten Termin, und der Setter darf die Kaltakquise gar nicht
öffnen. `darfNachterminieren()` prüft jetzt beide.

Die übrigen sechs:

- **`ebook-leads`** kannte die Rolle `Opener` nicht (`includes('setter')` usw.).
  Ein umgetragener Nutzer hätte keine Benachrichtigung mehr bekommen, ohne dass
  es auffällt.
- **Die No-Show-Kennzahl** zählte nur „Termin abgesagt". Das eigentliche
  Nichterscheinen fiel in den `else`-Zweig und galt als „offen" — die Kennzahl
  maß Absagen statt No-Shows.
- **`follow-up`** lieferte den Status roh und filterte mit neuen Werten gegen
  den nicht migrierten Bestand: ein `.eq()` das leer liefert, ohne Fehler.
  `beideSchreibweisen()` in `shared/status.js` löst das.
- **Die Bewerbungsliste** zeigte Setter- und Closer-Bewerbungen als identische
  Zeilen. Der Admin konnte nicht sehen, was er genehmigt.
- **`material_versendet`** war ein hartes Gate, das laut eigenem Hilfetext das
  System füllt — es füllte es aber niemand. Statt das Gate zu entschärfen,
  schreibt `send-email.js` die versendete Unterlage jetzt am Kontakt fort. Der
  Hilfetext stimmt damit.

## Fristen, Alarme und Wecker (Tickets 6 und 13)

Ein Lauf, vier Regeln — in der Datenbank, nicht im Frontend. Ein Termin, für
den niemand eingeteilt ist, muss auch dann auffallen, wenn gerade niemand das
CRM offen hat.

| Regel | Auslöser |
|---|---|
| Termin ohne Setter | Beratungsgespräch binnen 24 Stunden, `setter_id` leer |
| Bewerbung überfällig | offen seit mehr als zwei Stunden |
| Wiedervorlage fällig | `wiedervorlage_am` erreicht, Status „wiedervorlagefähig" |
| Vereinbarung endet | `vertrag_laeuft_bis` binnen 30 Tagen, keine Kündigung erfasst |

Die Meldungen gehen als Systemnachricht an alle aktiven Admins und
Geschäftsführer und erscheinen damit in der Glocke — kein neuer Kanal.

**Stündlich während der Arbeitszeit, nicht täglich.** Die Frist „unbesetzt nach
zwei Stunden" ließe sich mit einem Tageslauf nicht einhalten. Die übrigen
Regeln vertragen das, weil ein Merkzettel (`crm_erinnerungen`) Wiederholungen
verhindert: Ohne ihn ginge dieselbe Erinnerung jeden Tag erneut raus, bis
jemand handelt — und niemand läse sie mehr.

Der Lauf meldet sich über `lauf_starten`/`lauf_beenden` bei derselben
Überwachung an wie die Operations-Läufe, die Stillstandswache sieht ihn also
mit.

Die erste Regel greift genau den Zustand auf, den die Setter-Rückmigration
erzeugt: **29 Kontakte ohne Closer werden dort leer gesetzt.** Wer davon einen
Termin in der Zukunft hat, landet ab dem Deploy in dieser Meldung.

## Der Anrufzähler (Ticket 14)

Der Hilfetext in F24 verspricht: „Zählt jeden Anrufversuch automatisch. Niemand
muss Striche machen, und die Wochenzahl stimmt trotzdem." Dafür muss ihn jemand
schreiben — und zwar in der Function, nicht in der Maske: So zählt es
unabhängig davon, welche Ansicht speichert, und der Anrufer kommt aus dem
Token statt aus der Anfrage.

`leads.js` legt einen Eintrag an, sobald ein Ergebnis dokumentiert oder der
Lead als kontaktiert markiert wird. Der Zähler darf das Speichern des Leads
**nie** verhindern — ein Fehler dort wird protokolliert, nicht durchgereicht.

`v_anrufe_je_woche` liefert daraus Anwahlen je Opener und Woche: die erste Zahl
des Wochen-Benchmarks (600 Anwahlen), die es vorher schlicht nicht gab.

Der zweite Teil des Tickets, der Klick „Termin fand statt", steckt seit der
Setter-Ansicht in Ticket 8.

## Der Angebots-Zweig (Ticket 10)

Bisher wurde `'Angebot'` als Signal an die externe Automatisierung gesetzt, die
mit `'Angebot versendet'` zurückmeldet — **ob sie das je tut, sah niemand.** Es
gab keinen Zeitpunkt, an dem etwas hätte auffallen können.

Die Zeitstempel setzt jetzt ein Trigger und nicht die Anwendung: So greifen sie
auch für den Rückweg der Automatisierung, den wir nicht in der Hand haben.

Beim Anfordern wird zusätzlich der **Stand des Angebots festgehalten** —
Paket, Einrichtung, monatliche Gebühr. `setup` und `retainer` sind die
Vertragsfelder und können sich bis zum Abschluss noch ändern; das Angebot
nicht. Weicht der Vertrag später ab, zeigt das Abschlussformular beides. Vorher
war das ursprüngliche Angebot nach der ersten Änderung nicht mehr
nachvollziehbar.

Zwei neue Regeln im stündlichen Lauf:

- **Angebot ohne Versandbestätigung** — angefordert, aber nach 30 Minuten keine
  Rückmeldung. Ein stummer Versanddienst fiel bisher niemandem auf.
- **Seit einer Woche keine Unterschrift** — wöchentlich erinnert, nicht täglich.

### Ein Zählfehler, den der Test gefunden hat

`crm_erinnern()` gab die Zahl der verschickten **Nachrichten** zurück, nicht der
**Vorgänge**. Bei drei Admins meldete der Lauf drei Vorgänge, wo es einer war —
die Zähler im Lauf-Protokoll waren um den Faktor „Anzahl Admins" zu hoch. Das
wäre nie aufgefallen, weil die Zahl plausibel aussieht. Rückgabe ist jetzt
1 = erinnert, 0 = war schon erinnert.

## Das Mail-Modul (Ticket 11)

F23 verlangt es ausdrücklich: für Opener und Setter in **jeder** Stufe, in
jeder Ansicht, ohne Stufen-Sperre. Bisher gab es das Modul nur in der
Kaltakquise und im Closing — **der Setter hatte gar keinen Zugang**, weil seine
Ansicht die Termine sind.

- Neue Vorlagen-Kategorie `Setting` zwischen Kaltakquise und Closing
- Der Mail-Knopf in der Termin-Ansicht ist **bewusst außerhalb** der
  Setter-Übergabe platziert: Die wird bei anderen Stufen ausgeblendet, das
  Schreiben soll aber immer gehen
- Serverseitig reicht die Anmeldung — kein Rollen- oder Stufenfilter, genau wie
  gefordert

## Kennzahlen (Ticket 15)

Vier Auswertungen, alle aus Feldern und dem Ereignis-Verlauf — niemand muss
etwas zusätzlich eingeben. Vorher gab es keine davon.

| Kennzahl | Quelle |
|---|---|
| Anwahlen je Opener und Woche | `v_anrufe_je_woche` |
| Erscheinungsquote je Setter | `v_erscheinungsquote` |
| Rückgabequote | `v_rueckgabequote` |
| Vollständigkeit der Übergaben | `v_uebergabe_vollstaendigkeit` |

Die Erscheinungsquote war vorher grundsätzlich nicht bildbar: Es gab nur
No-Show, also eine Hälfte. Der Klick „Termin fand statt" liefert die andere.

Wo nichts zu teilen ist, bleibt die Quote **null statt 0 %** — das ist keine
Quote, sondern die ehrliche Aussage „noch nicht messbar".

### Die Rückgabe an den Vorgänger

Für die Rückgabequote fehlte die Aktion selbst — die Kennzahl wäre sonst
dauerhaft leer geblieben. Sie ist bewusst **keine gewöhnliche
Statusänderung**: Nur als eigenes Ereignis bleibt sie zählbar, statt in den
normalen Wechseln unterzugehen.

Genau eine Stufe zurück, Begründung Pflicht, der Vorgänger bekommt eine
Nachricht. Der Ton folgt F24: „kein Vorwurf, sondern hält die Qualität der
Übergaben hoch" — kein Warnrot, keine Fehlermeldung.

## Ein Linter, weil der Build zu wenig sieht

In `Closing.jsx` stand ein `loadData()`, das dort nie definiert war; in
`Kaltakquise.jsx` ein `showToast()`. **Beides baut fehlerfrei durch und knallt
erst beim Klick.**

Ein erster Versuch, das mit einer eigenen Heuristik zu finden, lieferte 1174
Fehlalarme — sie verstand weder `useState`-Destrukturierung noch deutsche Wörter
in Texten. Eine Prüfung, die so schreit, wird ignoriert; sie ist wieder raus.

Stattdessen `oxlint` mit `no-undef`. Aktuell: **null Treffer.**

    npm run pruefe

prüft beides — die Wachen und die undefinierten Aufrufe.

## Wie Code bei Sunside live geht

Wichtig zu wissen, bevor man etwas plant — ich hatte es zuerst falsch verstanden:

**Netlify baut jeden Push**, auch auf Nebenzweige. Jeder dieser Builds bekommt
eine eigene Adresse. **Veröffentlicht wird aber von Hand**: In der Deploy-Liste
trägt genau ein Build das Kennzeichen „Published", und der bedient die
Produktivadresse.

Deshalb war von vier grün gebauten Commits nichts im Live-Bundle zu finden —
sie waren gebaut, aber nicht veröffentlicht.

Das ist eine gute Eigenschaft: Bauen ist folgenlos, Veröffentlichen ist eine
bewusste Handlung.

### Die Branch-Landkarte

| Branch | Bedeutung |
|---|---|
| `main` | **Der veröffentlichte Stand.** Entspricht exakt dem, was läuft. |
| `claude/analyze-repo-fKMVI` | Fundament-Arbeit: Autorisierung, Schema-Sicherung, opener_id. Gebaut, **nicht veröffentlicht.** |
| `osc-umbau` | Der Umbau. Bleibt hier, bis er getestet ist. |

Der alte `main` (April-Stand aus der Airtable-Zeit, 35 eigene Commits) ist als
Tag `main-airtable-stand-april2026` erhalten — falls doch je etwas daraus
gebraucht wird.

### Ticket 0.2, anders gelöst als geplant

Ursprünglich wollte ich den neuesten Branch-Stand auf `main` ziehen. Besser ist,
was jetzt dort steht: **der tatsächlich veröffentlichte Commit.** So beschreibt
`main` die Wirklichkeit statt einer Absicht — und ein versehentlicher Deploy von
`main` würde genau das ausliefern, was ohnehin läuft.

## Opening statt Kaltakquise, und ein eigener Setting-Tab

**Kaltakquise heißt jetzt Opening** — an jeder Stelle, die zählt: Menü, Route,
Seitentitel, Vorlagen-Kategorie, Dashboard-Reiter, die Standard-Quelle neuer
Hot Leads. Die alte Adresse `/kaltakquise` leitet auf `/opening` weiter, weil
sie in bereits verschickten Mails und in Lesezeichen steht.

In den Daten war es klein: **genau vier Datensätze** trugen „Kaltakquise" als
Wert — zwei Quellen, zwei Vorlagen-Kategorien. Der Rest war Beschriftung.

Stehen bleibt das Wort dort, wo es die **Tätigkeit** beschreibt und nicht den
Reiter: in den Prompt-Texten der Analyse und in der Rollenbeschreibung
(„Kaltakquise bis zum gelegten Termin"). Das ist das treffende deutsche Wort
dafür, was ein Opener tut.

### Eine Namenskollision nebenbei

`analytics.js` nannte die Opener-Zahlen `getSettingStats`. Mit einem
Setting-Tab daneben wäre das garantiert verwechselt worden — der Parameter
heißt aus Kompatibilitätsgründen weiter `setting`, aber im Code steht jetzt,
dass das Opening gemeint ist.

### Der Setting-Tab

Zwischen Opening und Closing, in der Reihenfolge des Prozesses. Sichtbar für
Setter und Admins.

Bisher lag die Setter-Arbeit in den Terminen, als Seitenbereich am Kalender.
Für den Kalender ist das richtig — aber es ist keine Arbeitsfläche: **Der Setter
braucht eine Liste seiner Kontakte, nicht einen Monat mit Kästchen.**

Vier Ansichten: Anstehend · Zu dokumentieren · Geplatzt · Alle, jeweils mit
Zähler. Ein Termin, der vorbei ist, ohne dass jemand „Termin fand statt"
geklickt hat, wird gelb markiert — das ist die Arbeit, die liegt.

In der Detailansicht steht **was der Opener aufgenommen hat** (Ziel, größtes
Problem im Wortlaut, Berufsgruppe), damit der Setter damit ins Gespräch geht
statt danach zu suchen. Darunter: Video beitreten, schreiben, geplatzten Termin
neu legen, „Termin fand statt", die Übergabe an den Closer und die Rückgabe.

Der Pool der unbesetzten Beratungsgespräche steht oben auf der Seite — dieselbe
Ansicht wie an den Terminen, nur dort, wo der Setter ohnehin arbeitet.
