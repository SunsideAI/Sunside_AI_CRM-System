-- Eingespielt am 2026-09-11 um 17:28 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Opener wird beim Anlegen eines Hot Leads festgeschrieben.
-- Neu: faellt auf lead_assignment_history zurueck, wenn die Zuweisung beim
-- Offboarding bereits geloescht wurde. Bleibt streng - nur bei Eindeutigkeit.
create or replace function public.hot_lead_opener_setzen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if new.opener_id is not null or new.lead_id is null then
    return new;
  end if;

  -- 1. aktive Zuweisung
  select la.user_id into v_user
    from public.lead_assignments la
   where la.lead_id = new.lead_id
   group by la.user_id;

  if found and (select count(distinct la.user_id) from public.lead_assignments la
                 where la.lead_id = new.lead_id) = 1 then
    new.opener_id := v_user;
    return new;
  end if;

  -- 2. Verlauf (Zuweisung wurde zwischenzeitlich geloescht)
  if (select count(distinct h.user_id) from public.lead_assignment_history h
       where h.lead_id = new.lead_id) = 1 then
    select distinct h.user_id into new.opener_id
      from public.lead_assignment_history h
     where h.lead_id = new.lead_id;
  end if;

  return new;
end;
$$;
