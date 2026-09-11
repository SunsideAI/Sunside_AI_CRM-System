# Migrationen

## Ausgangszustand

`00000000000000_baseline_live_schema.sql` dokumentiert das Schema der laufenden
Datenbank (Stand 11.09.2026): 48 Tabellen, 23 Views, 54 Funktionen, 19 Trigger,
24 Zugriffsregeln, 143 Indizes, 11 Aufzaehlungstypen — Schemata `public` und `seo`.

Die Datei wird **nicht ausgefuehrt**. Sie ist die Referenz, gegen die jede neue
Migration geprueft wird. Vor dem Umbau existierte kein dokumentierter
Ausgangszustand; Schema-Aenderungen waren damit nicht sicher planbar (F13).

Neu erzeugen:

    select public.schema_dump();

Die Ausgabe enthaelt alle Funktionskoerper. **Vor dem Committen auf Zugangsdaten
pruefen** — im Stand vom 11.09. steckte ein Bearer-Token fest einkodiert in
`notify_bridge_lead_closed()`.

## Reihenfolge

Dateien werden nach Namen sortiert angewendet. Der Ausgangszustand steht mit
`00000000000000` bewusst vorn.

## Was hier fehlt

Die Migrationen vor dem 11.09.2026 bilden die Live-Datenbank nicht vollstaendig
ab — vieles wurde direkt eingespielt. Der Ausgangszustand schliesst diese Luecke,
loest sie aber nicht rueckwirkend auf.
