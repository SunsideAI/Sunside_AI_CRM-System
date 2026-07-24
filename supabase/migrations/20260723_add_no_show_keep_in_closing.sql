-- Optionaler Flag: Closer markiert No-Show, will den Lead aber selbst weiter
-- betreuen (kein automatisches Re-Engagement über den Setter).
--
-- Aktuelles Standardverhalten: Status 'Nicht erschienen' schiebt den Lead in
-- das Setter-No-Show-Widget in Kaltakquise, der Setter buchst neu.
--
-- Neues Verhalten wenn no_show_keep_in_closing = true:
-- - Status bleibt 'Nicht erschienen'
-- - Setter-Widget filtert diesen Lead heraus
-- - Closer sieht den Lead weiter im Closing-Tab und buchst selbst

ALTER TABLE public.hot_leads
  ADD COLUMN IF NOT EXISTS no_show_keep_in_closing BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.hot_leads.no_show_keep_in_closing IS
  'Wenn true: Closer betreut den No-Show-Lead selbst weiter, Setter wird nicht benachrichtigt.';
