# Autorisierung

## Wie die Identitaet zustande kommt

`auth.js` gibt bei erfolgreicher Anmeldung ein signiertes Token aus (HS256,
12 Stunden gueltig, Inhalt: Nutzer-ID, Rollen, Name). Das Frontend legt es ab
und haengt es ueber `src/utils/sitzung.js` an jeden Function-Aufruf.

Jede Function ruft am Anfang:

```js
const zugang = anmeldungVerlangen(event)                        // jede Anmeldung
const zugang = anmeldungVerlangen(event, ['Admin', 'Geschäftsführer'])  // nur Leitung
if (zugang.antwort) return zugang.antwort
const angemeldet = zugang.nutzer     // { id, rollen, name, istAdmin }
```

**Die Identitaet darf nie aus Query oder Body kommen.** Vorher war das der
Normalfall: `user_id` stand in der Anfrage, jeder konnte eine fremde einsetzen.
Wo eine fremde ID fachlich noetig ist (Admin setzt das Passwort eines anderen),
ist sie ein Parameter — aber *wer* handelt, kommt aus `angemeldet.id`.

## Ohne Token erreichbar

| Endpunkt | Warum | Absicherung |
|---|---|---|
| `auth` | hier entsteht die Sitzung | Passwort |
| `forgot-password` | Nutzer ist ausgesperrt | Versand nur an die hinterlegte Adresse |
| `ebook-leads` (nur POST) | oeffentliches Formular auf der Website | — |
| `calendly-webhook` | Aufruf von Calendly | Signatur — siehe unten |
| `seo-analysis-callback` | Rückruf des Analyse-Dienstes | signierte Rückruf-Adresse, keine Variable nötig |

## Umgebungsvariablen

| Name | Pflicht | Wirkung, wenn nicht gesetzt |
|---|---|---|
| `SESSION_SECRET` | nein | Das Signaturgeheimnis wird aus `SUPABASE_SERVICE_KEY` abgeleitet. Setzen ist sauberer: dann lässt sich die Sitzung unabhängig vom Datenbank-Key erneuern. Mind. 32 Zeichen. |
| Calendly-Signaturschlüssel | **ja, sobald verfügbar** | Der Webhook wird **ungeprüft** angenommen und warnt im Log. |

### Zum Calendly-Schlüssel

`CALENDLY_API_KEY` ist **nicht** derselbe Wert. Das ist ein Personal Access
Token für ausgehende Aufrufe (Slots, Event-Typen in `calendar.js`). Der
Signaturschlüssel ist ein eigener Wert, den Calendly **einmalig beim Anlegen
der Webhook-Subscription zurückgibt** (`signing_key`) und danach nie wieder
ausliefert. Ist er nicht notiert worden, hilft nur: Subscription neu anlegen
und den Schlüssel diesmal festhalten.

Der Name der Variablen ist bewusst tolerant — geprüft werden der Reihe nach:
`CALENDLY_WEBHOOK_SECRET`, `CALENDLY_SIGNING_KEY`, `CALENDLY_WEBHOOK_SIGNING_KEY`,
`CALENDLY_WEBHOOK_SIGNING_SECRET`, `CALENDLY_SECRET`. Ein falsch geratener Name
wäre schlimmer als gar keine Prüfung: Er würde still durchlassen, während alle
glauben, die Tür sei zu. Das Log sagt, welcher Name gefunden wurde — nur der
Name, nie der Wert.

### Warum der SEO-Rückruf keine Variable braucht

Dem Analyse-Dienst wird beim Start nur eine `callback_url` mitgegeben und sonst
kein Geheimnis. Er könnte sich also gar nicht ausweisen — ein
`SEO_CALLBACK_SECRET` in Netlify wäre wirkungslos und die Prüfung dagegen
hätte jeden Rückruf abgewiesen. Stattdessen hängt `seo-analysis-start.js` einen
Nachweis an die Adresse, die der Dienst unverändert zurückschickt. Rückrufe zu
Analysen, die vor der Umstellung gestartet wurden, werden bis zum 14.09.2026
noch ohne Nachweis angenommen; die Frist läuft von selbst ab.

## Was hier bewusst offen bleibt

Die Rollen im Token sind ein Abbild vom Zeitpunkt der Anmeldung. Ein
Rollenentzug wirkt erst nach Ablauf (12 h) oder erneuter Anmeldung. Für die
beiden Geld-Endpunkte (`billing-info`, `billing-dashboard`) werden die Rollen
zusätzlich frisch aus der Datenbank gelesen.
