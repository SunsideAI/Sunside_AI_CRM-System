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

## Abgleich mit dem Live-Stand

Am 11.09.2026 klafften Repo und Datenbank auseinander: **Fünf Migrationen liefen
live, hatten aber keine Datei hier** — genau der Zustand, den der Ausgangszustand
beenden sollte. Ursache war, dass Änderungen direkt eingespielt und nur
teilweise nachgeschrieben wurden.

Supabase legt die Anweisungen jeder Migration mit ab. Zurückholen:

    select * from public.migrationen_lesen('20260911');

`scripts/hole-migrationen.py` schreibt daraus fehlende Dateien. Die Dateinamen
tragen den Zeitstempel der Einspielung, damit die Reihenfolge stimmt.

**Regel:** Keine Migration direkt einspielen, ohne die Datei im selben Zug
anzulegen. Wer es doch tut, holt sie mit dem Befehl oben zurück — bevor
jemand anders auf einen Stand baut, den das Repo nicht kennt.

### Was NICHT eingespielt ist

Zwei Dateien warten bewusst auf den Deploy, beide mit Begründung im Kopf:

- `20260913_osc_statuskette.sql` — Werteliste, Übergangsmatrix, Datenmigration
- `20260913_osc_setter_rueckwirkend.sql` — setter_id auf den Closer, Rollen

Sie laufen erst, wenn der Code draußen ist. Vorher würden sie den laufenden
Betrieb treffen.
