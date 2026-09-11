-- Eingespielt am 2026-09-11 um 17:28 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Writes the history. Every path that touches lead_assignments is covered,
-- including manual SQL and code we have not seen yet.
create or replace function public.lead_assignment_protokoll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grund text := nullif(current_setting('app.assignment_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.lead_assignment_history (lead_id, user_id, assigned_at, reason)
    values (new.lead_id, new.user_id, coalesce(new.assigned_at, now()), v_grund);
    return new;
  end if;

  -- DELETE: close the open history row; create one if the assignment predates the log.
  update public.lead_assignment_history h
     set removed_at = now(),
         reason     = coalesce(v_grund, h.reason)
   where h.lead_id = old.lead_id
     and h.user_id = old.user_id
     and h.removed_at is null;

  if not found then
    insert into public.lead_assignment_history (lead_id, user_id, assigned_at, removed_at, reason, source)
    values (old.lead_id, old.user_id, old.assigned_at, now(), v_grund, 'trigger_nachtrag');
  end if;

  return old;
end;
$$;

drop trigger if exists trg_lead_assignment_protokoll on public.lead_assignments;
create trigger trg_lead_assignment_protokoll
  after insert or delete on public.lead_assignments
  for each row execute function public.lead_assignment_protokoll();

-- Single entry point for releasing leads. Records why the assignment ended.
create or replace function public.lead_assignments_freigeben(
  p_user_id  uuid,
  p_lead_ids uuid[],
  p_grund    text default 'offboarding'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anzahl integer;
begin
  perform set_config('app.assignment_reason', coalesce(nullif(p_grund, ''), 'offboarding'), true);

  delete from public.lead_assignments
   where user_id = p_user_id
     and lead_id = any(p_lead_ids);

  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

revoke all on function public.lead_assignments_freigeben(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.lead_assignments_freigeben(uuid, uuid[], text) to service_role;
