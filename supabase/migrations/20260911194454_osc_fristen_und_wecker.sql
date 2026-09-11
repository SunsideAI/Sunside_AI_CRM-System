-- Eingespielt am 2026-09-11 um 19:44 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- =====================================================================
-- Ticket 6 (Fristen und Alarme) und Ticket 13 (Wecker)
-- =====================================================================
-- Beides sind taegliche Laeufe. Sie laufen in der Datenbank und nicht im
-- Frontend: Ein Termin, fuer den niemand eingeteilt ist, muss auch dann
-- auffallen, wenn gerade niemand das CRM offen hat.
--
-- Rein additiv: neue Tabelle, neue Funktionen, neue cron-Auftraege. Kein
-- bestehender Ablauf wird veraendert.
-- =====================================================================

-- Merkzettel gegen Wiederholung. Ohne ihn ginge dieselbe Erinnerung jeden Tag
-- erneut raus, bis jemand handelt - und niemand liest sie mehr.
create table if not exists public.crm_erinnerungen (
  schluessel  text primary key,
  hot_lead_id uuid references public.hot_leads(id) on delete cascade,
  art         text not null,
  erzeugt_am  timestamptz not null default now()
);

create index if not exists idx_crm_erinnerungen_art on public.crm_erinnerungen(art, erzeugt_am desc);

comment on table public.crm_erinnerungen is
  'Merkzettel der bereits verschickten Erinnerungen. Verhindert, dass dieselbe Meldung taeglich wiederholt wird.';

alter table public.crm_erinnerungen enable row level security;
drop policy if exists "service role manages crm_erinnerungen" on public.crm_erinnerungen;
create policy "service role manages crm_erinnerungen" on public.crm_erinnerungen for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Hilfsfunktion: Nachricht an alle aktiven Admins, hoechstens einmal
-- ---------------------------------------------------------------------
create or replace function public.crm_erinnern(
  p_schluessel text, p_art text, p_hot_lead uuid,
  p_typ text, p_titel text, p_nachricht text
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_anzahl integer := 0;
begin
  -- Schon erinnert? Dann nichts tun. Der Primaerschluessel entscheidet.
  insert into public.crm_erinnerungen (schluessel, hot_lead_id, art)
  values (p_schluessel, p_hot_lead, p_art)
  on conflict (schluessel) do nothing;

  if not found then
    return 0;
  end if;

  insert into public.system_messages (message_id, empfaenger_id, titel, nachricht, typ, hot_lead_id, gelesen)
  select 'CRM-' || substr(md5(p_schluessel), 1, 12) || '-' || substr(u.id::text, 1, 8),
         u.id, p_titel, p_nachricht, p_typ, p_hot_lead, false
    from public.users u
   where u.status = true
     and ('Admin' = any(u.rollen::text[]) or 'Geschäftsführer' = any(u.rollen::text[]));

  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

-- ---------------------------------------------------------------------
-- Der taegliche Lauf
-- ---------------------------------------------------------------------
create or replace function public.crm_fristen_pruefen()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lauf bigint := lauf_starten('crm-fristen');
  r record;
  v_termine int := 0;
  v_bewerbungen int := 0;
  v_wiedervorlagen int := 0;
  v_vertraege int := 0;
  v_ergebnis jsonb;
begin
  -- 1. Termin binnen 24 Stunden, aber niemand eingeteilt.
  --    Genau der Zustand, den die Rueckmigration bei 29 Kontakten erzeugt.
  for r in
    select h.id, h.unternehmen, h.termin_beratungsgespraech
      from public.hot_leads h
     where h.setter_id is null
       and h.termin_beratungsgespraech between now() and now() + interval '24 hours'
       and h.status not in ('Verloren, endgültig', 'Verloren, wiedervorlagefähig', 'Gewonnen')
  loop
    v_termine := v_termine + crm_erinnern(
      'termin-ohne-setter:' || r.id::text, 'termin_ohne_setter', r.id,
      'Pool Update',
      'Termin morgen ohne Setter: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Das Beratungsgespräch am ' ||
        to_char(r.termin_beratungsgespraech at time zone 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') ||
        ' Uhr hat noch keinen Setter. Bitte zuteilen.');
  end loop;

  -- 2. Bewerbung liegt laenger als zwei Stunden unbearbeitet.
  for r in
    select b.id, b.stufe, b.erstellt_am, b.hot_lead_id,
           u.vor_nachname as bewerber, h.unternehmen
      from public.hot_lead_applications b
      join public.users u on u.id = b.closer_id
      left join public.hot_leads h on h.id = b.hot_lead_id
     where b.status = 'Offen'
       and b.erstellt_am < now() - interval '2 hours'
  loop
    v_bewerbungen := v_bewerbungen + crm_erinnern(
      'bewerbung-offen:' || r.id::text, 'bewerbung_offen', r.hot_lead_id,
      'Pool Update',
      'Bewerbung wartet seit über zwei Stunden',
      r.bewerber || ' wartet auf die Entscheidung zu ' ||
        coalesce(r.unternehmen, 'einem Kontakt') ||
        ' (' || coalesce(r.stufe, 'Closer') || '). Eingegangen am ' ||
        to_char(r.erstellt_am at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || ' Uhr.');
  end loop;

  -- 3. Wiedervorlage faellig (Ticket 13).
  for r in
    select h.id, h.unternehmen, h.wiedervorlage_am, h.closer_id, h.opener_id
      from public.hot_leads h
     where h.wiedervorlage_am is not null
       and h.wiedervorlage_am <= current_date
       and h.status = 'Verloren, wiedervorlagefähig'
  loop
    v_wiedervorlagen := v_wiedervorlagen + crm_erinnern(
      'wiedervorlage:' || r.id::text || ':' || r.wiedervorlage_am::text,
      'wiedervorlage', r.id, 'Pool Update',
      'Wiedervorlage fällig: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Der Kontakt wurde zum ' || to_char(r.wiedervorlage_am, 'DD.MM.YYYY') ||
      ' zur Wiedervorlage gesetzt. Bitte wieder aufnehmen.');
  end loop;

  -- 4. Laufende Vereinbarung endet binnen 30 Tagen (Abwanderungs-Kennzahl).
  for r in
    select h.id, h.unternehmen, h.vertrag_laeuft_bis
      from public.hot_leads h
     where h.vertrag_laeuft_bis is not null
       and h.vertrag_laeuft_bis between current_date and current_date + 30
       and h.kuendigung_zum is null
  loop
    v_vertraege := v_vertraege + crm_erinnern(
      'vertragsende:' || r.id::text || ':' || r.vertrag_laeuft_bis::text,
      'vertragsende', r.id, 'Pool Update',
      'Vereinbarung läuft aus: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Die Vereinbarung endet am ' || to_char(r.vertrag_laeuft_bis, 'DD.MM.YYYY') ||
      '. Verlängerung klären.');
  end loop;

  v_ergebnis := jsonb_build_object(
    'termine_ohne_setter', v_termine,
    'bewerbungen_ueberfaellig', v_bewerbungen,
    'wiedervorlagen', v_wiedervorlagen,
    'vertragsenden', v_vertraege);

  perform lauf_beenden(v_lauf, v_ergebnis, null);
  return v_ergebnis;
exception when others then
  perform lauf_beenden(v_lauf, null, sqlerrm);
  raise;
end;
$$;

revoke all on function public.crm_fristen_pruefen() from public, anon, authenticated;
grant execute on function public.crm_fristen_pruefen() to service_role;
