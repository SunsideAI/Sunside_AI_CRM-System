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
| `calendly-webhook` | Aufruf von Calendly | Signatur, `CALENDLY_WEBHOOK_SECRET` |
| `seo-analysis-callback` | Rueckruf des Analyse-Dienstes | geteiltes Geheimnis, `SEO_CALLBACK_SECRET` |

## Umgebungsvariablen

| Name | Pflicht | Wirkung, wenn nicht gesetzt |
|---|---|---|
| `SESSION_SECRET` | nein | Das Signaturgeheimnis wird aus `SUPABASE_SERVICE_KEY` abgeleitet. Setzen ist sauberer: dann laesst sich die Sitzung unabhaengig vom Datenbank-Key erneuern. Mind. 32 Zeichen. |
| `CALENDLY_WEBHOOK_SECRET` | **ja, sobald moeglich** | Der Webhook wird **ungeprueft** angenommen und protokolliert eine Warnung. Bis dahin kann jeder erfundene Buchungen einspielen. |
| `SEO_CALLBACK_SECRET` | **ja, sobald moeglich** | Wie oben fuer den Analyse-Rueckruf. |

Die beiden Webhook-Geheimnisse lassen bewusst durch, solange sie fehlen — sonst
waere der Terminfluss ab dem Deploy tot. Sie schliessen in dem Moment, in dem
der Wert in Netlify steht. **Die Warnung in den Logs ist die Aufgabenliste.**

## Was hier bewusst offen bleibt

Die Rollen im Token sind ein Abbild vom Zeitpunkt der Anmeldung. Ein
Rollenentzug wirkt erst nach Ablauf (12 h) oder erneuter Anmeldung. Fuer die
beiden Geld-Endpunkte (`billing-info`, `billing-dashboard`) werden die Rollen
zusaetzlich frisch aus der Datenbank gelesen.
