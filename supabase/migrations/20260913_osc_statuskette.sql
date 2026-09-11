-- =====================================================================
-- OSC-Umbau, Schritt 2: die Statuskette bekommt Zaehne
-- =====================================================================
-- NICHT EINSPIELEN, BEVOR
--   a) der Code dieses Branches deployt ist (er schreibt sonst alte Werte
--      und laeuft in den CHECK), UND
--   b) im Ereignis-Verlauf belegt ist, welche Schreiber es ausser dem CRM
--      gibt. Pruefung:
--
--        select nach_status, daten->>'verbindung' as verbindung, count(*)
--          from hot_lead_ereignisse
--         where art = 'statuswechsel' and akteur_id is null
--         group by 1, 2 order by 3 desc;
--
--      Jede Zeile hier ist ein Schreiber ausserhalb des CRM. Steht dort ein
--      Wert, den die Liste unten nicht kennt, legt diese Migration ihn lahm.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Alten Wert sichern, bevor irgendetwas ersetzt wird
-- ---------------------------------------------------------------------
alter table public.hot_leads add column if not exists status_alt text;
update public.hot_leads set status_alt = status where status_alt is null;

comment on column public.hot_leads.status_alt is
  'Status vor dem OSC-Umbau. Nur zur Nachvollziehbarkeit der Migration; wird nicht gepflegt.';

-- ---------------------------------------------------------------------
-- 2. Abbildung alt auf neu
-- ---------------------------------------------------------------------
-- 'Lead' (122) meint faktisch "Termin gelegt": nur 2 von 122 haben keinen
-- Termin. Die 88 mit Termin in der Vergangenheit bleiben bewusst auf
-- "vereinbart" - ob das Gespraech stattfand, weiss niemand, und Geschichte
-- wird nicht erfunden. Der neue Klick "Termin fand statt" loest das auf.
--
-- 'Termin verschoben' (20) ist kein eigener Zustand, sondern ein
-- vereinbarter Termin mit neuem Datum.
--
-- 'Verloren' (189) wird zu "endgueltig", nicht zu "wiedervorlagefaehig":
-- Zu keinem dieser Kontakte wurde je ein Wiedervorlage-Anlass oder -Datum
-- erfasst, und die neue Regel verlangt beides. Sie nachtraeglich als
-- wiedervorlagefaehig auszuweisen, waere eine Behauptung. Eine spaetere
-- Sichtung dieser 189 ist eine Geschaeftsentscheidung, keine Migration.
update public.hot_leads set status = case status
  when 'Lead'              then 'Beratungsgespräch vereinbart'
  when 'Termin verschoben' then 'Beratungsgespräch vereinbart'
  when 'Im Closing'        then 'Im Abschluss'
  when 'Abgeschlossen'     then 'Gewonnen'
  when 'Verloren'          then 'Verloren, endgültig'
  else status   -- 'Termin abgesagt', 'Nicht erschienen', 'Angebot versendet'
end
where status in ('Lead','Termin verschoben','Im Closing','Abgeschlossen','Verloren');

-- ---------------------------------------------------------------------
-- 3. Was in der Datenbank selbst an 'Abgeschlossen' haengt
-- ---------------------------------------------------------------------
-- Ohne diesen Block waere die Abrechnung ab hier stumm: der Trigger feuert
-- den Abschluss an die Billing-Bridge und prueft den Status woertlich.
drop trigger if exists trg_lead_closed_to_bridge on public.hot_leads;
create trigger trg_lead_closed_to_bridge
  after update of status on public.hot_leads
  for each row
  when (new.status = 'Gewonnen' and old.status is distinct from 'Gewonnen'
        and new.billing_mode = 'none')
  execute function public.notify_bridge_lead_closed();

-- Die Funktion prueft den Wert ein zweites Mal in ihrem Rumpf.
create or replace function public.notify_bridge_lead_closed()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'Gewonnen' and (old.status is distinct from 'Gewonnen') then
    perform net.http_post(
      url     := 'https://sumsideaicrmbillingbridge-production.up.railway.app/webhooks/supabase/lead-closed',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        -- TODO: gehoert in den Vault, siehe supabase/migrations/README.md
        'Authorization', 'Bearer ' || coalesce(
          (select decrypted_secret from vault.decrypted_secrets where name = 'bridge_token'),
          current_setting('app.bridge_token', true))
      ),
      body    := jsonb_build_object('hot_lead_id', new.id::text)
    );
  end if;
  return new;
end;
$$;

-- Teilindex filtert woertlich auf den alten Wert.
drop index if exists public.idx_hot_leads_status_billing;
create index idx_hot_leads_status_billing
  on public.hot_leads (status) where status = 'Gewonnen';

-- ---------------------------------------------------------------------
-- 4. Die Werteliste, erzwungen
-- ---------------------------------------------------------------------
-- 'Angebot' und 'Angebot versendet' behalten ihre Schreibweise: 'Angebot'
-- ist das Signal an die externe Angebots-Automatisierung, 'Angebot
-- versendet' deren Rueckmeldung. Umbenennen wuerde diesen Pfad still
-- zerreissen - der Klartext steckt daher in der Anzeige, nicht im Wert.
alter table public.hot_leads drop constraint if exists hot_leads_status_gueltig;
alter table public.hot_leads add constraint hot_leads_status_gueltig check (status in (
  'Beratungsgespräch vereinbart',
  'Beratungsgespräch geführt',
  'Abschlussgespräch vereinbart',
  'Im Abschluss',
  'Angebot',
  'Angebot versendet',
  'Wird nachgefasst',
  'Gewonnen',
  'Nicht erschienen',
  'Termin abgesagt',
  'Verloren, wiedervorlagefähig',
  'Verloren, endgültig'
));

alter table public.hot_leads alter column status set default 'Beratungsgespräch vereinbart';

-- ---------------------------------------------------------------------
-- 5. Uebergangsmatrix
-- ---------------------------------------------------------------------
-- Quelle: Miro F25.3. Verloren ist von ueberall erreichbar - ein Kontakt
-- kann in jeder Stufe absagen. Der Rest folgt der Matrix.
create or replace function public.status_uebergang_erlaubt(p_von text, p_nach text)
returns boolean
language sql
immutable
as $$
  select case
    when p_von is null or p_von = p_nach then true
    -- Absagen und Wiedervorlage sind aus jeder Stufe moeglich
    when p_nach in ('Verloren, endgültig', 'Verloren, wiedervorlagefähig') then true
    when p_von = 'Beratungsgespräch vereinbart' then p_nach in
      ('Beratungsgespräch geführt','Termin abgesagt','Nicht erschienen')
    when p_von = 'Beratungsgespräch geführt' then p_nach in
      ('Abschlussgespräch vereinbart','Wird nachgefasst')
    when p_von = 'Abschlussgespräch vereinbart' then p_nach in
      ('Im Abschluss','Termin abgesagt','Nicht erschienen')
    when p_von = 'Im Abschluss' then p_nach in
      ('Gewonnen','Angebot','Angebot versendet','Wird nachgefasst')
    when p_von = 'Angebot' then p_nach in
      ('Angebot versendet','Im Abschluss')
    when p_von = 'Angebot versendet' then p_nach in
      ('Gewonnen','Wird nachgefasst','Im Abschluss')
    when p_von = 'Wird nachgefasst' then p_nach in
      ('Abschlussgespräch vereinbart','Angebot','Angebot versendet')
    when p_von = 'Nicht erschienen' then p_nach in
      ('Beratungsgespräch vereinbart','Abschlussgespräch vereinbart')
    when p_von = 'Termin abgesagt' then p_nach in
      ('Beratungsgespräch vereinbart','Abschlussgespräch vereinbart')
    when p_von = 'Verloren, wiedervorlagefähig' then p_nach in
      ('Wird nachgefasst','Beratungsgespräch vereinbart')
    when p_von = 'Gewonnen' then false              -- Endzustand
    when p_von = 'Verloren, endgültig' then false   -- Endzustand
    else false
  end;
$$;

-- Sonderweg aus F25.3: genau eine Stufe zurueck, mit Pflicht-Grund.
-- Wird als eigene Aktion gefahren, nicht als gewoehnlicher Wechsel, damit
-- die Rueckgabequote zaehlbar bleibt.
create or replace function public.status_ruecknahme_ziel(p_von text)
returns text
language sql
immutable
as $$
  select case p_von
    when 'Abschlussgespräch vereinbart' then 'Beratungsgespräch geführt'
    when 'Beratungsgespräch geführt'    then 'Beratungsgespräch vereinbart'
  end;
$$;

create or replace function public.hot_lead_uebergang_pruefen()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and not public.status_uebergang_erlaubt(old.status, new.status) then
    raise exception 'Statuswechsel nicht vorgesehen: % -> %', old.status, new.status
      using hint = 'Erlaubte Wechsel siehe status_uebergang_erlaubt(). Rueckgabe an den Vorgaenger laeuft ueber die eigene Aktion.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hot_lead_uebergang on public.hot_leads;
create trigger trg_hot_lead_uebergang
  before update of status on public.hot_leads
  for each row execute function public.hot_lead_uebergang_pruefen();

commit;
