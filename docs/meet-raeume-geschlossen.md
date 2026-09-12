# Warum die Meet-Räume geschlossen waren

**Gelöst am 12.09.2026.** Der Eintrag bleibt stehen, weil das Problem rund ein
Jahr lang bestand und der Grund nicht offensichtlich war.

## Das Problem

Jeder Video-Termin musste vor dem Gespräch von Hand geöffnet werden. Kunden
landeten sonst im „Um Teilnahme bitten" und warteten — einlassen konnte sie nur
der Organisator, und das ist `admin@sunsideai.de`, ein Konto, in dem niemand
sitzt. Der Vertriebler, der das Gespräch hält, ist selbst nur Gast und kann
ebenfalls niemanden einlassen.

Bei vielen Terminen ging das Öffnen unter.

## Warum es so lange unentdeckt blieb

Drei von vier Anzeichen sagten „alles offen":

| Einstellung | Stand | |
|---|---|---|
| Domain | Alle Nutzer, auch nicht angemeldete | ✓ |
| Zugriff | Alle Besprechungen | ✓ |
| Wartebereiche | AUS | ✓ |
| Verwaltung durch den Organisator | AUS | ✓ |
| **Zugriffstyp** | **Vertrauenswürdig** | ← der Riegel |

„Vertrauenswürdig" lässt nur Leute aus der Organisation und ausdrücklich
Eingeladene direkt hinein. **Alle anderen müssen anklopfen.** Ein externer
Kunde ohne Google-Anmeldung fällt immer darunter.

Dazu kommt: Der Block heißt **„Zugriffstyp"** und steht direkt neben
**„Zugriff"** — einer Einstellung mit ganz anderer Bedeutung, die bereits auf
der großzügigsten Stufe stand.

## Die Lösung

> Admin-Konsole → Apps → Google Workspace → Google Meet →
> Sicherheitseinstellungen für Meet → **Zugriffstyp** → **Öffnen**

Gilt für **neu erstellte** Besprechungen. Bereits gebuchte Termine behalten,
womit sie angelegt wurden, und müssen einmalig von Hand umgestellt werden
(Meet-Optionen des Termins → Zugang zur Videokonferenz → Öffnen).

## Nützlich für später

Der im CRM gespeicherte Link ist Calendlys Weiterleitung:

    https://calendly.com/events/<id>/google_meet
      -> https://meet.google.com/<code>

Sie löst **ohne Anmeldung** auf den echten Meet-Code auf — ein Aufruf, kein
Zugang nötig. Das war die Grundlage einer Automatisierung, die den Raum über
Googles Meet-Schnittstelle geöffnet hätte. Sie ist wieder entfernt, weil die
Einstellung sie überflüssig macht: Technik, die niemand braucht, verrottet und
verwirrt den Nächsten.

## Was damit **nicht** gelöst ist

Der Mensch, der das Gespräch hält, ist weiterhin **nie Organisator** — keine
Moderation, keine Aufzeichnung, keine Kontrolle über den Raum. In den
Meet-Optionen steht: „Alle Organisatoren und **Co-Organisatoren** können diese
Einstellungen ändern."

Trüge man den Vertriebler als Co-Organisator ein, wäre er kein Gast mehr im
eigenen Gespräch. Calendly kann das mit einem Konto nicht, Googles
Kalender-Schnittstelle schon.

Der Workspace hat derzeit **genau einen Nutzer** (`admin@sunsideai.de`). Eigene
Zugänge je Vertriebler wären neue Lizenzen für acht bis zehn Leute — zu bedenken
bei Ticket 7 (Sammel-Kalender), das in Calendly ebenfalls mehrere Nutzer
voraussetzt.
