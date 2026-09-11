-- =====================================================================
-- Lead-Zuordnung: Verlauf statt spurlosem Loeschen
-- =====================================================================
-- Problem: archive-leads.js loescht beim Offboarding eines Vertrieblers
-- Zeilen aus lead_assignments. Nicht-kontaktierte Leads bekommen dabei
-- nicht einmal einen lead_archive-Eintrag. Danach ist nicht mehr
-- feststellbar, wer den Lead eroeffnet hat.
-- Messung am 11.09.2026: 31 von 35 Hot Leads ohne opener_id waren
-- spurlos - weder Assignment noch Archiv-Eintrag vorhanden.
--
-- Loesung: ein Verlaufsprotokoll, das per Trigger gefuellt wird und
-- damit unabhaengig davon greift, welcher Code loescht.
-- =====================================================================

create table if not exists public.lead_assignment_history (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid not null,
  user_id       uuid not null,
  assigned_at   timestamptz,
  removed_at    timestamptz,
  reason        text,
  source        text not null default 'trigger',
  created_at    timestamptz not null default now()
);

create index if not exists idx_lah_lead on public.lead_assignment_history(lead_id);
create index if not exists idx_lah_user on public.lead_assignment_history(user_id);
create index if not exists idx_lah_open on public.lead_assignment_history(lead_id) where removed_at is null;

comment on table public.lead_assignment_history is
  'Verlauf aller Lead-Zuweisungen. Wird per Trigger gefuellt, nie direkt beschrieben. Quelle der Opener-Zuordnung, wenn lead_assignments beim Offboarding geleert wurde.';

alter table public.lead_assignment_history enable row level security;

drop policy if exists "service role manages assignment history" on public.lead_assignment_history;
create policy "service role manages assignment history"
  on public.lead_assignment_history for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Trigger: protokolliert jede Zuweisung und jede Entfernung
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Einziger Weg, Zuweisungen zu entfernen - haelt den Grund fest
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Opener-Zuordnung: faellt auf den Verlauf zurueck
-- ---------------------------------------------------------------------
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

  select la.user_id into v_user
    from public.lead_assignments la
   where la.lead_id = new.lead_id
   group by la.user_id;

  if found and (select count(distinct la.user_id) from public.lead_assignments la
                 where la.lead_id = new.lead_id) = 1 then
    new.opener_id := v_user;
    return new;
  end if;

  if (select count(distinct h.user_id) from public.lead_assignment_history h
       where h.lead_id = new.lead_id) = 1 then
    select distinct h.user_id into new.opener_id
      from public.lead_assignment_history h
     where h.lead_id = new.lead_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Backfill (einmalig, idempotent)
-- ---------------------------------------------------------------------
insert into public.lead_assignment_history (lead_id, user_id, assigned_at, reason, source)
select la.lead_id, la.user_id, la.assigned_at, 'bestand_uebernommen', 'backfill'
  from public.lead_assignments la
 where not exists (
   select 1 from public.lead_assignment_history h
    where h.lead_id = la.lead_id and h.user_id = la.user_id and h.removed_at is null);

insert into public.lead_assignment_history (lead_id, user_id, assigned_at, removed_at, reason, source)
select a.lead_id, a.user_id, null, a.archiviert_am, 'archiviert_beim_offboarding', 'backfill_lead_archive'
  from public.lead_archive a
 where a.lead_id is not null and a.user_id is not null
   and not exists (select 1 from public.lead_assignments la
                    where la.lead_id = a.lead_id and la.user_id = a.user_id)
   and not exists (select 1 from public.lead_assignment_history h
                    where h.lead_id = a.lead_id and h.user_id = a.user_id);

update public.hot_leads h
   set opener_id = v.user_id
  from (
    select lh.lead_id, min(lh.user_id::text)::uuid as user_id
      from public.lead_assignment_history lh
     group by lh.lead_id
    having count(distinct lh.user_id) = 1
  ) v
 where h.lead_id = v.lead_id
   and h.opener_id is null;
