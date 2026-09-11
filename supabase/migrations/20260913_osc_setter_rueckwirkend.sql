-- =====================================================================
-- OSC-Umbau: setter_id bedeutet ab hier "wer das Beratungsgespräch hält"
-- =====================================================================
-- NICHT VOR DEM DEPLOY EINSPIELEN.
--
-- Heute steht in setter_id, WER GEBUCHT HAT - in 488 von 545 Fällen
-- derselbe Mensch wie in opener_id. Im neuen Prozess legt der Opener den
-- Termin und ein Setter hält ihn. Rückwirkend war dieser Setter immer der
-- Closer: eine eigene Setter-Rolle gab es nie, der Closer führte beide
-- Gespräche selbst.
--
-- Warum nicht vorher: Der laufende CRM-Stand filtert die Termin-Ansicht über
-- setter_id. Würde man das vor dem Deploy umstellen, verlören alle Opener die
-- von ihnen gelegten Termine aus den Augen - der Code dieses Branches holt
-- sie zusätzlich über opener_id, der alte nicht.
-- =====================================================================

begin;

-- Alten Wert sichern. Er ist zwar in 543 von 560 Fällen auch in opener_id
-- erhalten, aber eben nicht in allen: 15 Datensätze haben einen setter_id
-- ohne opener_id.
alter table public.hot_leads add column if not exists setter_id_alt uuid;
update public.hot_leads set setter_id_alt = setter_id where setter_id_alt is null;

comment on column public.hot_leads.setter_id_alt is
  'setter_id vor dem OSC-Umbau, als das Feld noch "wer gebucht hat" bedeutete. Nur zur Nachvollziehbarkeit.';

-- Rückwirkend: der Closer hat das Beratungsgespräch gehalten.
update public.hot_leads
   set setter_id = closer_id
 where closer_id is not null;

-- Ohne Closer gab es niemanden, der das Gespräch gehalten hat. 29 Fälle,
-- davon 22 noch im Pool. Leer ist hier die ehrliche Antwort - und genau der
-- Zustand, den der 24-Stunden-Alarm aus Ticket 6 aufgreifen soll. Eine
-- Übernahme des alten Werts würde behaupten, ein Opener hätte das Gespräch
-- geführt.
update public.hot_leads
   set setter_id = null
 where closer_id is null;

-- Wer rückwirkend Setter wird, muss die Rolle auch tragen - sonst zeigt
-- setter_id auf jemanden, der die Setter-Ansicht gar nicht sehen darf.
-- Betroffen sind genau die heutigen Closer (10 Personen, angeführt von
-- 180 / 108 / 88 Terminen). Die Rolle wird ergänzt, nicht ersetzt: wer
-- Closer ist, bleibt Closer.
update public.users
   set rollen = rollen || 'Setter'::rolle_type
 where 'Closer' = any(rollen::text[])
   and not ('Setter' = any(rollen::text[]));

commit;

-- Gegenprobe nach dem Einspielen:
--   select count(*) filter (where setter_id = closer_id) as setter_ist_closer,
--          count(*) filter (where setter_id is null)     as ohne_setter,
--          count(*) filter (where setter_id_alt is not null) as gesichert
--     from hot_leads;
