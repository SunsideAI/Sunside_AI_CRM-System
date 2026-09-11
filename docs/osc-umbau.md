# OSC-Umbau (Opener · Setter · Closer)

Soll-Prozess: Miro F23 · Feldnamen und Hilfetexte: F24 · Umsetzungspaket mit den
vier Arbeits-Tabellen: F25 · Ist-System mit Belegen: F0 bis F22.

Branch: `osc-umbau`, abgezweigt vom Live-Branch `claude/analyze-repo-fKMVI`.

## Stand

| Nr | Ticket | Stand |
|---|---|---|
| 0.1 | Serverseitige Autorisierung | fertig, im Live-Branch |
| 0.2 | Deploy-Falle entschärfen | offen — ein Force-Push auf `main` |
| 0.3 | Live-Schema als Ausgangszustand | fertig, im Live-Branch |
| 0.4 | opener_id + Zuordnungs-Verlauf | fertig, im Live-Branch |
| 2 | Neue Felder laut Schema-Delta | **eingespielt** (`20260912_osc_felder.sql`) |
| 3 | Ereignis-Verlauf | **eingespielt** (Protokoll-Trigger aktiv) |
| 1 | Statuskette — Code | **fertig** (`shared/status.js`, 15 Dateien) |
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

## Offene Entscheidungen (nicht von mir zu treffen)

- Werden die Übergabe-Gates hart erzwungen oder zunächst als Warnung? Empfehlung
  aus F23: Gates hart, Pflichtfelder als Warnung.
- Werden die 49 Coldcaller auf die neue Rolle `Opener` umgestellt? Der Wert ist
  angelegt, die Umstellung ist eine eigene Entscheidung.
- Strecke B: Vertriebshandbuch sagt Tag 0/3/7/14/**21**, Miro sagt **28**.
- Die Mail-Wortlaute („ressourcen-crm-mailstrecken") liegen nicht im Repo.

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
