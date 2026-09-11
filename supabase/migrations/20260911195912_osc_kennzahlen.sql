-- Eingespielt am 2026-09-11 um 19:59 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Ticket 15: die Kennzahlen des neuen Prozesses.
--
-- Alle vier kommen aus Feldern und dem Ereignis-Verlauf, ohne dass jemand
-- etwas zusaetzlich eingeben muesste (F24). Vorher gab es keine davon.

-- 1. Erscheinungsquote je Setter.
--    Zaehlt gehaltene gegen geplatzte Termine. Grundlage ist der Klick
--    "Termin fand statt" - vorher gab es nur No-Show, also nur die eine
--    Haelfte, und daraus laesst sich keine Quote bilden.
create or replace view public.v_erscheinungsquote as
with wechsel as (
  select e.hot_lead_id, e.nach_status, e.erfasst_am,
         coalesce(h.setter_id, e.akteur_id) as setter_id
    from public.hot_lead_ereignisse e
    join public.hot_leads h on h.id = e.hot_lead_id
   where e.art = 'statuswechsel'
     and e.nach_status in ('Beratungsgespräch geführt', 'Nicht erschienen')
)
select
  date_trunc('month', w.erfasst_am at time zone 'Europe/Berlin')::date as monat,
  w.setter_id,
  u.vor_nachname as setter,
  count(*) filter (where w.nach_status = 'Beratungsgespräch geführt') as gehalten,
  count(*) filter (where w.nach_status = 'Nicht erschienen') as geplatzt,
  count(*) as termine,
  -- Prozentzahl nur, wenn es etwas zu teilen gibt. Null ist hier keine Quote,
  -- sondern die ehrliche Aussage "noch nicht messbar".
  case when count(*) > 0
       then round(100.0 * count(*) filter (where w.nach_status = 'Beratungsgespräch geführt') / count(*), 1)
  end as quote_prozent
from wechsel w
left join public.users u on u.id = w.setter_id
group by 1, 2, 3;

comment on view public.v_erscheinungsquote is
  'Gehaltene gegen geplatzte Beratungsgespraeche je Setter und Monat. Quote ist null, solange nichts zu teilen ist - das ist keine Null, sondern "noch nicht messbar".';

-- 2. Rueckgabequote.
--    Wie oft geht ein Kontakt eine Stufe zurueck, weil die Uebergabe nicht
--    reichte. Kein Vorwurf, sondern ein Mass fuer die Qualitaet der Uebergaben.
create or replace view public.v_rueckgabequote as
select
  date_trunc('month', e.erfasst_am at time zone 'Europe/Berlin')::date as monat,
  e.von_status as zurueck_aus,
  e.akteur_id,
  u.vor_nachname as zurueckgegeben_von,
  count(*) as rueckgaben
from public.hot_lead_ereignisse e
left join public.users u on u.id = e.akteur_id
where e.art = 'rueckgabe'
group by 1, 2, 3, 4;

comment on view public.v_rueckgabequote is
  'Rueckgaben an den Vorgaenger je Monat und Person. Speist sich aus der eigenen Aktion, nicht aus gewoehnlichen Statuswechseln.';

-- 3. Vollstaendigkeit der Gespraechsnotizen.
--    Wie oft sind die Gate-Felder der beiden Uebergaben gefuellt. Zeigt, wo
--    die Qualitaet leidet, bevor es jemandem im Gespraech auffaellt.
create or replace view public.v_uebergabe_vollstaendigkeit as
select
  date_trunc('month', h.created_at at time zone 'Europe/Berlin')::date as monat,
  count(*) as kontakte,
  count(*) filter (where h.berufsgruppe is not null)          as mit_berufsgruppe,
  count(*) filter (where h.ziel is not null)                  as mit_ziel,
  count(*) filter (where nullif(h.schmerzpunkt_wortlaut,'') is not null) as mit_schmerzpunkt,
  count(*) filter (where h.vorhaben is not null)              as mit_vorhaben,
  count(*) filter (where nullif(h.mobilnummer,'') is not null) as mit_mobilnummer,
  count(*) filter (where
        h.berufsgruppe is not null and h.ziel is not null
    and nullif(h.schmerzpunkt_wortlaut,'') is not null
    and h.vorhaben is not null and nullif(h.mobilnummer,'') is not null
  ) as uebergabe_1_komplett,
  count(*) filter (where
        nullif(h.entscheider_messlatte,'') is not null
    and nullif(h.schmerzpunkt_vertieft,'') is not null
    and nullif(h.offene_huerde,'') is not null
    and coalesce(array_length(h.material_versendet, 1), 0) > 0
    and (h.keine_zahlen or (h.zuwachs_auftraege is not null and h.abschlussquote is not null))
  ) as uebergabe_2_komplett
from public.hot_leads h
group by 1;

comment on view public.v_uebergabe_vollstaendigkeit is
  'Wie oft die Gate-Felder beider Uebergaben gefuellt sind, je Monat. Die Zahlen vor dem OSC-Umbau sind erwartungsgemaess null - die Felder gab es nicht.';
