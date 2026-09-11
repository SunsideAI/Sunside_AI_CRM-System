-- Eingespielt am 2026-09-11 um 17:28 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Durable log of every lead assignment and un-assignment.
-- Offboarding deletes rows from lead_assignments; without this table the
-- attribution ("who opened this lead") is destroyed. 31 of 35 deals without an
-- opener had no trace left at all.

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
