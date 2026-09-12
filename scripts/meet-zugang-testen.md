# Lässt sich ein Meet-Raum über die Google-Schnittstelle öffnen?

Diese Frage entscheidet, ob wir die Automatisierung bauen können oder einen
anderen Weg gehen müssen. Googles Dokumentation beantwortet sie nicht — für
private Google-Konten steht dort schlicht nichts. Also messen statt raten.

**Dauer: etwa zehn Minuten. Nichts davon verändert einen echten Termin.**

## Warum das überhaupt gehen könnte

Der im CRM gespeicherte Link ist Calendlys Weiterleitung:

    https://calendly.com/events/<id>/google_meet
      -> https://meet.google.com/mug-kqve-wpf

Der hintere Teil ist der **Meeting-Code**. Googles Meet-Schnittstelle kann
Räume auf „offen" stellen (`config.accessType = OPEN`) — dann kommt jeder mit
dem Link direkt rein, ohne dass ein Organisator einlässt.

Zwei Dinge sind unklar, und beide sind K.-o.-Kriterien:

1. **Gilt die Schnittstelle für private Google-Konten?** Sie liegt in Googles
   Workspace-Dokumentation; manche Meet-Funktionen sind Workspace-Kunden
   vorbehalten.
2. **Dürfen wir fremde Räume ändern?** Die Räume legt Calendly an, nicht unsere
   Anwendung. Der Bereich `meetings.space.created` deckt nur selbst erzeugte
   Räume ab — wir bräuchten `meetings.space.settings`.

## Der Test

### 1. Projekt anlegen

<https://console.cloud.google.com> → neues Projekt → **Google Meet API**
aktivieren.

### 2. OAuth-Zugang erzeugen

„APIs & Dienste" → „Anmeldedaten" → OAuth-Client-ID → Typ **Desktop**.
Client-ID und Geheimnis notieren.

Beim Zustimmungsbildschirm das Google-Konto als Testnutzer eintragen — das
Konto, über das die Calendly-Termine laufen.

### 3. Im OAuth-Spielplatz prüfen

<https://developers.google.com/oauthplayground>

- Zahnrad oben rechts → „Use your own OAuth credentials" → Client-ID und
  Geheimnis eintragen
- Links unter „Input your own scopes" eintragen:

      https://www.googleapis.com/auth/meetings.space.settings

- Autorisieren **mit genau dem Konto**, über das die Termine laufen
- Tokens austauschen

### 4. Die zwei entscheidenden Aufrufe

**Lesen** — geht die Schnittstelle für dieses Konto überhaupt?

    GET https://meet.googleapis.com/v2/spaces/mug-kqve-wpf

**Ändern** — dürfen wir einen von Calendly erzeugten Raum öffnen?

    PATCH https://meet.googleapis.com/v2/spaces/mug-kqve-wpf?updateMask=config.accessType

    {"config": {"accessType": "OPEN"}}

## Was die Antworten bedeuten

| Antwort | Bedeutung | Was wir dann tun |
|---|---|---|
| Beide `200` | Es geht | Automatisierung bauen: nach jeder Buchung Raum öffnen |
| Lesen `200`, Ändern `403` | Raum gehört uns nicht | Anderer Weg nötig |
| `403` / `PERMISSION_DENIED` | Konto nicht abgedeckt | Weg von Google Meet |
| `404` | Code stimmt nicht mehr | Mit einem aktuellen Termin wiederholen |

Den Code `mug-kqve-wpf` durch einen **aktuellen** Termin ersetzen, falls der
alte abgelaufen ist. Er steht im CRM hinter „Video-Meeting beitreten" — die
Adresse einmal im Browser öffnen, sie leitet auf `meet.google.com/<code>`.

## Wenn es nicht geht

Dann liegt es nicht an der Umsetzung, sondern am Aufbau: **Ein Google-Konto für
alle Termine** heißt, dass der Mensch, der das Gespräch hält, nie Organisator
ist. Kein noch so guter Automatismus ändert das.

Die zwei tragfähigen Wege wären:

- **Weg von Google Meet** — den Calendly-Termintyp auf Calendly-Video oder Zoom
  umstellen. Dort gibt es kein Einlassen durch einen Organisator, das Problem
  verschwindet vollständig. Einmalige Umstellung, kein Code.
- **Eigene Zugänge je Vertriebler** — löst es an der Wurzel und passt zu
  Ticket 7 (Sammel-Kalender), kostet aber Lizenzen.
