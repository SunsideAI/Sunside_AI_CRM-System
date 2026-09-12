# Testdurchlauf für den OSC-Umbau

**Adresse:** <https://osc-umbau--crmsunsideai.netlify.app>

Dauer etwa 25 Minuten.

Der Produktivbetrieb läuft unverändert unter `crmsunsideai.netlify.app` — die
Vorschau ist ein eigener Build mit eigener Adresse, er wird durch nichts
veröffentlicht, was du hier tust.

## Vorher lesen

**Die Vorschau läuft gegen die Produktiv-Datenbank.** Alle Schema-Änderungen
sind additiv, das ist nachgemessen — aber der neue Code *schreibt* neue
Statuswerte. Ein Testdatensatz erscheint danach auch im veröffentlichten CRM,
dort mit einem Status, den es nicht kennt. Er stürzt nicht ab, der Datensatz
sieht nur schief aus und fällt aus den Zählungen.

Deshalb die eine Abmachung dieses Durchlaufs:

> **Jeder Testdatensatz heißt „TEST …"** — Firmenname beginnt mit `TEST`.

## Der Testnutzer

Für den Durchlauf steht ein Konto bereit, das **nur die Setter-Rolle** trägt:

    TEST Setter · test-setter@sunside.invalid

Das Passwort steht nicht hier — frag danach. Mit einem Admin-Konto siehst du den
Setting-Tab zwar auch, aber der Pool testet sich damit nicht ehrlich: Admin darf
ohnehin alles. Was der Durchlauf beweisen soll, ist, dass ein **reiner Setter**
genau das kann, was er können soll, und nichts darüber hinaus. Nachgemessen ist
das bereits an der Schnittstelle:

| Aufruf als reiner Setter | Antwort |
|---|---|
| Setter-Pool lesen | 200 |
| Nutzerverwaltung | 403 |
| Bewerbung genehmigen | 403 |
| Schalter „Bewerbung nötig" umlegen | 403 |
| ohne Anmeldung | 401 |

Das Konto verschwindet mit `python3 scripts/testdaten.py --loeschen` zusammen mit
den Testdatensätzen:

    python3 scripts/testdaten.py              # zeigt, was da ist
    python3 scripts/testdaten.py --loeschen   # entfernt es

## Was noch nicht geht

- **Abschlussgespräch-Termin von Hand** eintragen — der Sammel-Kalender ist
  Ticket 7 und braucht mehrere Calendly-Nutzer
- **Statuskette in der Datenbank** ist nicht eingespielt. Die Übergangsprüfung
  läuft nur im Code, nicht als Riegel in der Datenbank. Genau das testen wir.
- **setter_id** zeigt noch auf „wer gebucht hat". Die Rückumstellung läuft mit
  dem Veröffentlichen.

---

## 1. Anmeldung, Menü und Rollen

1. Anmelden. **Erwartung:** geht durch; bei einem 401 hat der Branch kein
   Token-Geheimnis — dann abbrechen und melden.
   Im Menü heißt der erste Punkt jetzt **Opening**, nicht mehr Kaltakquise.
   Die alte Adresse `/kaltakquise` muss auf `/opening` weiterleiten.
2. Einstellungen → Mitarbeiter → einen Nutzer öffnen.
   **Erwartung:** Die Rollenauswahl bietet **Opener, Setter, Closer, Admin,
   Geschäftsführer**. Coldcaller steht nicht mehr zur Wahl.
3. Einstellungen → System.
   **Erwartung:** Block „Zuteilung von Terminen" mit zwei Schaltern, beide auf
   „Bewerbung nötig". Einen umlegen, Seite neu laden — er muss umgelegt
   bleiben. Danach zurückstellen.

## 2. Erstanruf mit Übergabe (Ticket 8)

4. **Opening** → einen Lead öffnen → Termin buchen.
5. Nach der Terminauswahl erscheint **„5. Übergabe an den Setter"** mit neun
   Feldern. **Zuerst absichtlich leer lassen** und buchen.
   **Erwartung:** Es wird *nicht* gebucht. Meldung nennt die fehlenden Felder:
   Berufsgruppe, Ziel, Größtes Problem, Vorhaben, Mobilnummer. Die Felder sind
   rot markiert.
6. Felder ausfüllen — Firmenname mit **TEST** beginnen lassen — und buchen.
   **Erwartung:** Buchung geht durch.

   ```sql
   select unternehmen, status, berufsgruppe, ziel, mobilnummer,
          opener_id is not null as opener_gesetzt,
          setter_id is null as im_setter_pool
     from hot_leads where unternehmen like 'TEST%';
   ```
   Status muss **Beratungsgespräch vereinbart** sein, `opener_gesetzt` wahr,
   `im_setter_pool` wahr — **wer bucht, ist der Opener, nicht der Setter.**

## 3. Der Setting-Tab und der Pool (Tickets 5 und 11)

7. Abmelden, als **TEST Setter** anmelden, **Setting** im Menü öffnen. Steht der
   Punkt nicht da, fehlt dem Nutzer die Setter-Rolle — Einstellungen →
   Mitarbeiter → Rolle **Setter** ergänzen, neu anmelden.

   **Erwartung:** Der Punkt steht **zwischen Opening und Closing** — in der
   Reihenfolge des Prozesses.

8. Oben der Block **„Beratungsgespräche ohne Setter"** mit dem Testtermin aus
   Schritt 6. **„Übernehmen"** klicken.

   **Erwartung:** Bei „Bewerbung nötig" steht danach *beworben*. Als TEST Setter
   kommst du an die Genehmigung **nicht heran** — dafür zurück auf dein
   Admin-Konto: Einstellungen → Hot-Lead-Bewerbungen, **mit dem Zusatz
   „Beratungsgespräch"** statt „Abschlussgespräch". Genehmigen, dann wieder als
   TEST Setter anmelden.

9. Ist derselbe Nutzer zugleich der Opener, erscheint beim Bewerben **„dein
   Erstanruf"** — der Interessenkonflikt wird markiert, nicht verboten. (Mit dem
   TEST-Setter tritt der Fall nicht auf, er hat keinen Erstanruf geführt; zum
   Prüfen buchst du den Testtermin unter demselben Konto.)

10. Nach der Genehmigung erscheint der Kontakt in der Liste unter **Anstehend**.
    Die vier Ansichten tragen Zähler: Anstehend · Zu dokumentieren · Geplatzt ·
    Alle.

## 4. Nach dem Gespräch (Tickets 8 und 14)

11. Den Kontakt anklicken. **Erwartung:** Oben steht **„Aus dem Erstanruf"** mit
    Ziel, größtem Problem im Wortlaut und Berufsgruppe — das, was der Opener
    aufgenommen hat. Darunter der Knopf **„Termin fand statt"**.

12. Klicken.

    ```sql
    select von_status, nach_status, art, akteur_id is not null as akteur_bekannt
      from hot_lead_ereignisse
     where hot_lead_id = (select id from hot_leads where unternehmen like 'TEST%')
     order by erfasst_am;
    ```
    Es muss ein `statuswechsel` auf **Beratungsgespräch geführt** stehen, mit
    bekanntem Akteur.

13. Zurück in der Liste: Der Kontakt ist jetzt unter **Zu dokumentieren**, mit
    grünem Haken.

## 5. Übergabe an den Closer (Ticket 8)

14. Denselben Kontakt öffnen. **Erwartung:** **„Übergabe an den Closer"** mit
    zwölf Feldern.
15. Nur die Hälfte ausfüllen, Datum fürs Abschlussgespräch setzen, buchen.
    **Erwartung:** Wird abgewiesen, die fehlenden Felder werden benannt.
16. „Kunde wollte keine Zahlen nennen" anhaken.
    **Erwartung:** Die Zahlenfelder werden blass und **gelten als beantwortet** —
    das Gate verlangt sie nicht mehr.
17. Haken wieder weg, Zuwachs **12** und Quote **3** eintragen.
    **Erwartung:** Darunter erscheint **„Nötige Anfragen pro Monat: 3,3 (2 bis 4)"**.
    Steht dort 40, ist der Teiler kaputt.
18. Rest ausfüllen, buchen.
    **Erwartung:** Status **Abschlussgespräch vereinbart**. Der Kontakt
    verschwindet aus dem Setting-Tab — ab hier ist der Closer zuständig.

### Was im Setting-Tab sonst noch zu prüfen ist

- **Gelbe Markierung:** Ein Termin, der vorbei ist, ohne dass „Termin fand
  statt" geklickt wurde, bekommt ein gelbes Warnzeichen. Zum Prüfen einen
  Testtermin in die Vergangenheit legen:
  `update hot_leads set termin_beratungsgespraech = now() - interval '2 hours' where unternehmen like 'TEST%';`
- **E-Mail an den Kontakt** steht in **jeder** Stufe zur Verfügung, nicht nur in
  einer bestimmten — das ist Absicht (Ticket 11).
- **Geplatzte Termine:** Status auf „Nicht erschienen" setzen, Kontakt öffnen.
  **Erwartung:** Knopf **„Neuen Termin buchen"**.

## 6. Rückgabe an den Vorgänger (Ticket 15)

19. Im Closing den Testkontakt öffnen → **„Zurück an den Vorgänger"**.
20. Ohne Begründung absenden. **Erwartung:** wird verlangt.
21. Mit Begründung absenden.
    **Erwartung:** Status eine Stufe zurück auf **Beratungsgespräch geführt**,
    der Vorgänger bekommt eine Nachricht.

    ```sql
    select art, von_status, nach_status, bemerkung
      from hot_lead_ereignisse
     where art = 'rueckgabe'
       and hot_lead_id = (select id from hot_leads where unternehmen like 'TEST%');
    ```

## 7. Die Übergangsmatrix (Ticket 1)

22. Im Closing den Status von Hand auf **Gewonnen** setzen, während der Kontakt
    auf „Beratungsgespräch geführt" steht.
    **Erwartung:** Wird abgewiesen mit einer verständlichen Meldung, nicht mit
    einem Datenbankfehler. Der Weg führt über Abschlussgespräch und Im Abschluss.

## 8. Fristen und Kennzahlen (Tickets 6, 13, 15)

23. Der stündliche Lauf greift von selbst. Von Hand anstoßen:

    ```sql
    select public.crm_fristen_pruefen();
    ```
    Liefert sechs Zähler. Ein Testtermin ohne Setter in den nächsten 24 Stunden
    erscheint unter `termine_ohne_setter`; ein zweiter Lauf zählt ihn **nicht
    erneut**.

24. Kennzahlen:

    ```sql
    select * from v_erscheinungsquote  where setter is not null order by monat desc limit 5;
    select * from v_anrufe_je_woche    order by woche desc limit 5;
    select * from v_rueckgabequote     order by monat desc limit 5;
    ```

## 9. Aufräumen

    python3 scripts/testdaten.py --loeschen

**Erwartung:** „Rückstandsfrei."

---

## Wenn etwas schiefgeht

Melde mir **was du getan hast, was du erwartet hast und was passiert ist**. Die
interessanten Fälle sind die, in denen etwas *durchgeht*, das nicht sollte —
ein Gate, das nicht greift, ist gefährlicher als eines, das zu viel verlangt.
