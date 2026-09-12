# Testdurchlauf für den OSC-Umbau

Für die Branch-Adresse von `osc-umbau`. Dauer etwa 20 Minuten.

## Vorher lesen

**Die Vorschau läuft gegen die Produktiv-Datenbank.** Alle Schema-Änderungen
sind additiv, das ist nachgemessen — aber der neue Code *schreibt* neue
Statuswerte. Ein Testdatensatz erscheint danach auch im veröffentlichten CRM,
dort mit einem Status, den es nicht kennt. Er stürzt nicht ab, der Datensatz
sieht nur schief aus und fällt aus den Zählungen.

Deshalb die eine Abmachung dieses Durchlaufs:

> **Jeder Testdatensatz heißt „TEST …"** — Firmenname beginnt mit `TEST`.

Danach entfernt ein Befehl alles wieder:

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

## 1. Anmeldung und Rollen

1. Anmelden. **Erwartung:** geht durch; bei einem 401 hat der Branch kein
   Token-Geheimnis — dann abbrechen und melden.
2. Einstellungen → Mitarbeiter → einen Nutzer öffnen.
   **Erwartung:** Die Rollenauswahl bietet **Opener, Setter, Closer, Admin,
   Geschäftsführer**. Coldcaller steht nicht mehr zur Wahl.
3. Einstellungen → System.
   **Erwartung:** Block „Zuteilung von Terminen" mit zwei Schaltern, beide auf
   „Bewerbung nötig". Einen umlegen, Seite neu laden — er muss umgelegt
   bleiben. Danach zurückstellen.

## 2. Erstanruf mit Übergabe (Ticket 8)

4. Kaltakquise → einen Lead öffnen → Termin buchen.
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

## 3. Der Setter-Pool (Ticket 5)

7. Termine öffnen. **Erwartung:** Oben der Block „Beratungsgespräche ohne
   Setter" mit dem Testtermin. Trägt dein Nutzer die Setter-Rolle nicht, ist
   der Block unsichtbar — dann Rolle ergänzen.
8. „Übernehmen" klicken.
   **Erwartung:** Bei „Bewerbung nötig" steht danach *beworben*; ein Admin
   sieht sie in Einstellungen → Hot-Lead-Bewerbungen, **mit dem Zusatz
   „Beratungsgespräch"** statt „Abschlussgespräch". Genehmigen.
9. Bist du zugleich der Opener, erscheint beim Bewerben der Hinweis
   **„dein Erstanruf"** — der Interessenkonflikt wird markiert, nicht verboten.

## 4. Nach dem Gespräch (Tickets 8 und 14)

10. Termine → den Termin anklicken. **Erwartung:** Knopf **„Termin fand statt"**.
11. Klicken.

    ```sql
    select von_status, nach_status, art, akteur_id is not null as akteur_bekannt
      from hot_lead_ereignisse
     where hot_lead_id = (select id from hot_leads where unternehmen like 'TEST%')
     order by erfasst_am;
    ```
    Es muss ein `statuswechsel` auf **Beratungsgespräch geführt** stehen, mit
    bekanntem Akteur.

## 5. Übergabe an den Closer (Ticket 8)

12. Derselbe Termin zeigt jetzt **„Übergabe an den Closer"** mit zwölf Feldern.
13. Nur die Hälfte ausfüllen, Datum fürs Abschlussgespräch setzen, buchen.
    **Erwartung:** Wird abgewiesen, die fehlenden Felder werden benannt.
14. „Kunde wollte keine Zahlen nennen" anhaken.
    **Erwartung:** Die Zahlenfelder werden blass und **gelten als beantwortet** —
    das Gate verlangt sie nicht mehr.
15. Haken wieder weg, Zuwachs **12** und Quote **3** eintragen.
    **Erwartung:** Darunter erscheint **„Nötige Anfragen pro Monat: 3,3 (2 bis 4)"**.
    Steht dort 40, ist der Teiler kaputt.
16. Rest ausfüllen, buchen.
    **Erwartung:** Status **Abschlussgespräch vereinbart**.

## 6. Rückgabe an den Vorgänger (Ticket 15)

17. Im Closing den Testkontakt öffnen → **„Zurück an den Vorgänger"**.
18. Ohne Begründung absenden. **Erwartung:** wird verlangt.
19. Mit Begründung absenden.
    **Erwartung:** Status eine Stufe zurück auf **Beratungsgespräch geführt**,
    der Vorgänger bekommt eine Nachricht.

    ```sql
    select art, von_status, nach_status, bemerkung
      from hot_lead_ereignisse
     where art = 'rueckgabe'
       and hot_lead_id = (select id from hot_leads where unternehmen like 'TEST%');
    ```

## 7. Die Übergangsmatrix (Ticket 1)

20. Im Closing den Status von Hand auf **Gewonnen** setzen, während der Kontakt
    auf „Beratungsgespräch geführt" steht.
    **Erwartung:** Wird abgewiesen mit einer verständlichen Meldung, nicht mit
    einem Datenbankfehler. Der Weg führt über Abschlussgespräch und Im Abschluss.

## 8. Fristen und Kennzahlen (Tickets 6, 13, 15)

21. Der stündliche Lauf greift von selbst. Von Hand anstoßen:

    ```sql
    select public.crm_fristen_pruefen();
    ```
    Liefert sechs Zähler. Ein Testtermin ohne Setter in den nächsten 24 Stunden
    erscheint unter `termine_ohne_setter`; ein zweiter Lauf zählt ihn **nicht
    erneut**.

22. Kennzahlen:

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
