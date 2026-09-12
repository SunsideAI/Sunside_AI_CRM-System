# Meet-Räume öffnen sich von selbst

## Das Problem

Alle Termine laufen über **ein** Google-Konto. Google Meet lässt nur den
Organisator einlassen — und in dem Konto sitzt niemand. Der Vertriebler, der
das Gespräch hält, ist selbst nur Gast und kann deshalb ebenfalls niemanden
einlassen. Beide Seiten warten.

Bisher musste jeder Raum vor dem Termin von Hand geöffnet werden. Bei vielen
Terminen geht das unter.

## Erst prüfen: geht es ohne Code?

Seit das Konto ein **Workspace-Konto** ist, gibt es eine Admin-Konsole — und
damit womöglich die einfachste Lösung überhaupt:

> Admin-Konsole → Apps → Google Workspace → Google Meet → **Meet-Videoeinstellungen**

Dort gibt es Einstellungen zur **Host-Verwaltung** und zum Zugang zu Meetings.
Lässt sich dort einstellen, dass Meetings standardmäßig ohne Einlassen
zugänglich sind, ist das Problem mit **einer Einstellung** und ohne jeden Code
gelöst — und es kann nichts mehr schiefgehen, weil nichts mehr laufen muss.

**Das ist der erste Weg, den wir gehen sollten.** Die Automatisierung unten ist
der Rückfall, falls die Einstellung nicht greift oder nur für Teile gilt.

## Der Rückfall: das CRM öffnet die Räume

Gebaut und einsatzbereit, aber **noch nicht scharf** — es fehlen die
Zugangsdaten unten.

### Wie es funktioniert

1. Alle 20 Minuten während der Arbeitszeit stößt die Datenbank die Function
   `meet-oeffnen` an — für Video-Termine der nächsten 72 Stunden, deren Raum
   noch nicht offen ist.
2. Der im CRM gespeicherte Link ist Calendlys Weiterleitung
   (`calendly.com/events/<id>/google_meet`). Sie löst ohne Anmeldung auf
   `meet.google.com/<code>` auf.
3. Mit diesem Code stellt Googles Meet-Schnittstelle den Raum auf `OPEN`:
   Wer den Link hat, kommt direkt hinein.
4. Ergebnis und Fehler stehen am Kontakt (`meet_geoeffnet_am`, `meet_fehler`)
   und im Lauf-Protokoll.

Alle 20 Minuten und nicht stündlich, weil ein Termin auch kurzfristig gebucht
werden kann und der Raum dann rechtzeitig offen sein muss.

### Was noch fehlt

Drei Werte in Netlify. Sie zu beschaffen dauert etwa zehn Minuten:

1. **Google-Cloud-Projekt** anlegen (<https://console.cloud.google.com>) und die
   **Google Meet API** aktivieren.
2. **OAuth-Client** erzeugen: „APIs & Dienste" → „Anmeldedaten" → OAuth-Client-ID
   → Typ **Desktop**.
3. Einmalige Zustimmung mit **genau dem Google-Konto**, über das die Calendly-
   Termine laufen. Am einfachsten im OAuth-Spielplatz
   (<https://developers.google.com/oauthplayground>, Zahnrad → eigene
   Anmeldedaten verwenden), Bereich:

       https://www.googleapis.com/auth/meetings.space.settings

4. Den **Refresh Token** aus dem Austausch übernehmen.

In Netlify eintragen:

| Variable | Woher |
|---|---|
| `GOOGLE_CLIENT_ID` | Schritt 2 |
| `GOOGLE_CLIENT_SECRET` | Schritt 2 |
| `GOOGLE_REFRESH_TOKEN` | Schritt 4 |

Danach den Zeitplan wieder aktivieren:

    select cron.schedule('meet-oeffnen', '*/20 6-21 * * *',
                         $$select public.meet_oeffnen_anstossen(72)$$);

Er ist derzeit **abgeschaltet**, damit der Anstoß nicht alle 20 Minuten ins
Leere läuft, solange die Function nicht deployt ist.

### Wenn es scheitert, scheitert es sichtbar

Ein Fehler wird am Kontakt in `meet_fehler` festgehalten und im Lauf-Protokoll
vermerkt. Dauerhafte Fehler (403, 404) werden **nicht** wiederholt — sie kämen
beim nächsten Lauf genauso zurück und würden nur Rauschen erzeugen.

So lässt sich abfragen, was offen ist:

```sql
select unternehmen,
       coalesce(termin_abschlussgespraech, termin_beratungsgespraech) as termin,
       meet_code, meet_geoeffnet_am, meet_fehler
  from hot_leads
 where terminart = 'Video'
   and meet_geoeffnet_am is null
   and coalesce(termin_abschlussgespraech, termin_beratungsgespraech) > now()
 order by termin;
```

### Der Rest des Konstruktionsfehlers bleibt

Auch mit offenen Räumen ist der Mensch, der das Gespräch hält, **nie
Organisator**: keine Moderation, keine Aufzeichnung, keine Kontrolle über den
Raum. Das löst erst ein eigener Zugang je Vertriebler — was ohnehin zu Ticket 7
(Sammel-Kalender) gehört. Das Öffnen ist die dringende Hälfte, nicht die ganze.
