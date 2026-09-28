-- Der Ausgang des Beratungsgespräches, nach der Revision vom 25.09.
--
-- Bisher teilten sich Beratungs- und Abschlussgespräch dieselben vier Werte.
-- Nach dem Setting ist aber niemand Kunde: „Auftrag" kann es dort nicht geben,
-- und „Absage" trifft es nicht - gemeint ist, dass der Kontakt nicht zu uns
-- passt. Es bleiben drei Wege: Das Abschlussgespräch steht, es wird
-- nachgefasst, oder der Kontakt wird mit Begründung aussortiert.
--
-- Der Ausgang des ABSCHLUSSgespräches (Spalte gespraechsausgang) bleibt, wie
-- er ist - dort ist der Auftrag der Regelfall.
--
-- Bestand: Alle 616 Hot Leads haben ergebnis_beratung NULL (geprüft 25.09.),
-- es ist also nichts umzuschreiben.

alter table public.hot_leads
  drop constraint if exists hot_leads_ergebnis_beratung_check;

alter table public.hot_leads
  add constraint hot_leads_ergebnis_beratung_check
  check (
    ergebnis_beratung is null
    or ergebnis_beratung in (
      'Abschlussgespräch vereinbart',
      'Vertagt ohne festen Schritt',
      'Nicht geeignet'
    )
  );

comment on column public.hot_leads.ergebnis_beratung is
  'Ausgang des Beratungsgesprächs (Setting): Abschlussgespräch vereinbart, Vertagt ohne festen Schritt, Nicht geeignet. Der Grund zum Aussortieren steht in verlust_grund.';
