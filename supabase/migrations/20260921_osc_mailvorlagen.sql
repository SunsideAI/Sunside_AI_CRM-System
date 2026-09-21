-- Mailvorlagen aus der Mailstrecken-Datei (Phase 3 im Plan v2, Ticket 9)
--
-- Die Wortlaute werden von scripts/vorlagen-einpflegen.mjs aus
-- docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md erzeugt und über
-- einen festen Schlüssel eingepflegt. So bleibt die Datei die einzige Quelle:
-- Wer einen Text ändert, ändert die Datei und pflegt neu ein.
--
-- Die neuen Vorlagen tragen die Kategorien „Opening", „Setting" und
-- „Nachfassen". Der veröffentlichte Stand (b63a552) fragt nur „Kaltakquise"
-- und „Closing" ab und sieht sie deshalb nicht.

alter table public.email_templates
  add column if not exists schluessel text,
  -- Arbeitsanweisung an den Absender („Screenshot vorher aktuell ziehen").
  -- Eigene Spalte, damit sie nie im Mailtext beim Kunden landet.
  add column if not exists hinweis text;

create unique index if not exists email_templates_schluessel_key
  on public.email_templates (schluessel) where schluessel is not null;

-- Die Links, die in die Vorlagen eingesetzt werden. Leer heißt: Der Platzhalter
-- bleibt stehen und der Mail-Dialog lässt nicht senden, bis ihn jemand füllt.
insert into public.einstellungen (schluessel, wert, beschreibung) values
  ('link_video_streil',          '', 'Video-Link: Testimonial Michael Streil (Segment-Mail Eigentümer, Übergang Käufer)'),
  ('link_video_beier',           '', 'Video-Link: Testimonial Patrick Beier (Segment-Mail Automatisierung, Sachverständige, Vorhaben)'),
  ('link_video_kaeufer',         '', 'Video-Link: Käufer-Video (Segment-Mail Kaufinteressenten), bis es gedreht ist leer'),
  ('link_vsl_eigentuemer',       '', 'VSL-Link Eigentümergewinnung (Bestätigungsmail nach dem Setting); bis zum Dreh das Loom-Video'),
  ('link_vsl_automatisierung',   '', 'VSL-Link Automatisierung (Bestätigungsmail nach dem Setting)'),
  ('link_vsl_propstack',         '', 'VSL-Link Automatisierung, Fassung Propstack'),
  ('link_vsl_pipedrive',         '', 'VSL-Link Automatisierung, Fassung Pipedrive'),
  ('link_vsl_kaeufer',           '', 'VSL-Link Kaufinteressenten (noch offen, E7)')
on conflict (schluessel) do nothing;
