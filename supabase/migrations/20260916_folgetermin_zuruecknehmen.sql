-- =====================================================================
-- Der Folgetermin wird zurückgenommen
-- =====================================================================
-- Eingespielt am 2026-09-16, wenige Stunden nach dem Anlegen.
--
-- Entscheidung vom selben Tag: Es bleibt bei ZWEI Terminen in der Kette.
--
--   Beratungsgespraech   Opener bucht fuer den Setter   Telefon, 30 Min
--   Abschlussgespraech   Setter bucht fuer den Closer   Video,   45 Min
--
-- Was nach dem Abschlussgespraech geschieht, entscheidet der Closer selbst.
-- Das CRM haelt fest, WAS vereinbart wurde (gespraechsausgang,
-- zugesagter_schritt, nachfass_grund) - es terminiert es nicht.
--
-- Die beiden Spalten waren leer, nachgezaehlt vor dem Loeschen: 0 Werte in
-- termin_folgetermin, 0 in meeting_link_folgetermin. Sie stehen zu lassen
-- hiesse, eine Moeglichkeit vorzutaeuschen, die es nicht gibt.
--
-- Der Block "Ausgang des Abschlussgespraechs" BLEIBT. Er war der eigentliche
-- Fund beim Bauen des Folgetermins: Die drei Felder gab es laengst, aber
-- keine Stelle, sie zu fuellen.
-- =====================================================================

alter table public.hot_leads
  drop column if exists termin_folgetermin,
  drop column if exists meeting_link_folgetermin;

comment on column public.hot_leads.gespraechsausgang is
  'Ausgang des Abschlussgespraechs. Bestimmt die Ruecknahmequote und, zusammen mit dem Segment, was das System zum Nachfassen vorschlaegt.';
