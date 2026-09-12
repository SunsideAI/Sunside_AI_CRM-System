-- Eingespielt am 2026-09-12 um 08:58 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Rueckbau der Meet-Automatik.
--
-- Sie ist ueberfluessig geworden: In der Admin-Konsole steht der Zugriffstyp
-- jetzt auf "Oeffnen", damit sind neue Besprechungen von sich aus offen.
-- Technik, die niemand braucht, verrottet und verwirrt den Naechsten.
--
-- Die Spalten fallen mit weg, obwohl ich zuerst sagte, ich lasse sie stehen:
-- Sie sind leer, dienten ausschliesslich dieser Automatik, und der Meet-Code
-- laesst sich jederzeit in einem Aufruf aus dem gespeicherten Link ableiten.
-- Leere Spalten "fuer alle Faelle" sind genau die Unordnung, die ich mit dem
-- Rueckbau vermeiden will.

drop function if exists public.meet_oeffnen_anstossen(int);

drop index if exists public.idx_hot_leads_meet_offen;

alter table public.hot_leads
  drop column if exists meet_code,
  drop column if exists meet_geoeffnet_am,
  drop column if exists meet_fehler;

-- Die Einstellung crm_url bleibt: Sie ist nicht an die Meet-Automatik
-- gebunden, sondern die Adresse, unter der die Datenbank ueberhaupt
-- Netlify-Functions erreicht. Der naechste Lauf dieser Art braucht sie wieder.
comment on table public.einstellungen is
  'Schluessel-Wert-Einstellungen fuer CRM und Operations. crm_url ist die Adresse, unter der die Datenbank Netlify-Functions anstoesst.';
