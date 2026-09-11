-- =====================================================================
-- OSC-Umbau, Schritt 1: neue Felder und der Ereignis-Verlauf
-- =====================================================================
-- Rein additiv. Kein bestehendes Feld wird geaendert, kein Wert ersetzt.
-- Laesst sich gefahrlos vor dem Code einspielen: der laufende CRM-Stand
-- kennt die neuen Spalten nicht und fasst sie nicht an.
--
-- Quelle: Miro F25.2 (Schema-Delta), Feldnamen aus F24.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Rolle: aus zwei mach drei
-- ---------------------------------------------------------------------
-- Die heutigen Coldcaller werden Opener. Der Wert wird ergaenzt, nicht
-- ersetzt - die Umstellung der 49 Coldcaller ist eine eigene Entscheidung.
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'rolle_type' and e.enumlabel = 'Opener') then
    alter type public.rolle_type add value 'Opener';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Uebergabe 1: was der Opener im Erstanruf aufnimmt
-- ---------------------------------------------------------------------
alter table public.hot_leads
  add column if not exists berufsgruppe          text,
  add column if not exists ziel                  text,
  add column if not exists ziel_priorisiert      boolean,
  add column if not exists schmerzpunkt_wortlaut text,
  add column if not exists vorhaben              boolean,
  add column if not exists vorerfahrung          text,
  add column if not exists vorerfahrung_wortlaut text,
  add column if not exists mobilnummer           text,
  add column if not exists termin_bestaetigt     boolean not null default false;

comment on column public.hot_leads.schmerzpunkt_wortlaut is
  'Woertlich, nicht zusammengefasst. Geht als Platzhalter in die Mails.';
comment on column public.hot_leads.vorhaben is
  'Steuert die Vorhaben-Mail und den KI-Audit-Weg.';
comment on column public.hot_leads.mobilnummer is
  'Voraussetzung fuer die zwei SMS der Terminkette.';

-- ---------------------------------------------------------------------
-- Uebergabe 2: was der Setter im Beratungsgespraech misst
-- ---------------------------------------------------------------------
alter table public.hot_leads
  add column if not exists zuwachs_auftraege     numeric,
  add column if not exists abschlussquote        numeric,
  add column if not exists quote_art             text,
  add column if not exists ist_auftraege         numeric,
  add column if not exists keine_zahlen          boolean not null default false,
  add column if not exists entscheider_messlatte text,
  add column if not exists investitionsrahmen    numeric,
  add column if not exists rahmen_ausgewichen    boolean,
  add column if not exists bedarf_wortlaut       text,
  add column if not exists offene_huerde         text,
  add column if not exists material_versendet    text[] not null default '{}';

-- Berechnet, nicht eingegeben: wie viele Anfragen es im Monat braucht,
-- damit der Kunde seinen genannten Zuwachs erreicht. Null, sobald eine
-- der beiden Zahlen fehlt - eine fehlende Angabe ist keine Null.
alter table public.hot_leads
  add column if not exists noetige_anfragen numeric
    generated always as (
      case when zuwachs_auftraege is not null
            and abschlussquote is not null
            and abschlussquote > 0
           then round(zuwachs_auftraege / (abschlussquote / 10.0), 1)
      end
    ) stored;

comment on column public.hot_leads.noetige_anfragen is
  'Berechnet aus Zuwachs und Quote (x von 10). Grundlage des Empfehlungs-Pakets.';

-- ---------------------------------------------------------------------
-- Der zweite Termin, das Abschlussgespraech
-- ---------------------------------------------------------------------
alter table public.hot_leads
  add column if not exists termin_abschlussgespraech timestamptz,
  add column if not exists meeting_link_abschluss    text,
  add column if not exists gespraechsausgang         text,
  add column if not exists zugesagter_schritt        text,
  add column if not exists zugesagt_bis              date;

-- ---------------------------------------------------------------------
-- Nachfassen und Wiedervorlage
-- ---------------------------------------------------------------------
alter table public.hot_leads
  add column if not exists nachfass_grund   text,
  add column if not exists nachfass_schritt smallint,
  add column if not exists wiedervorlage_am date;

-- ---------------------------------------------------------------------
-- Angebots-Zweig: heute wird der Status extern gesetzt, ohne Ueberwachung
-- ---------------------------------------------------------------------
alter table public.hot_leads
  add column if not exists angebot_paket        text,
  add column if not exists angebot_setup        numeric,
  add column if not exists angebot_gebuehr      numeric,
  add column if not exists angebot_angefordert_am timestamptz,
  add column if not exists angebot_verschickt_am  timestamptz;

-- ---------------------------------------------------------------------
-- Abwanderung messbar machen
-- ---------------------------------------------------------------------
alter table public.hot_leads
  add column if not exists kuendigung_zum   date,
  add column if not exists kuendigungsgrund text,
  add column if not exists vertrag_laeuft_bis date;

-- ---------------------------------------------------------------------
-- Persoenlicher Kalender des Closers (Folgetermine)
-- ---------------------------------------------------------------------
alter table public.users
  add column if not exists calendly_link text;

-- ---------------------------------------------------------------------
-- Ereignis-Verlauf: die Grundlage aller Kennzahlen und Provisionsausloeser
-- ---------------------------------------------------------------------
-- Nach dem Muster von aufgaben_ereignisse (F20). Ohne diesen Verlauf ist
-- kein Zeitpunkt belegbar - weder Terminlegung noch Uebergabe noch der
-- Nachweis, dass ein Termin tatsaechlich stattgefunden hat.
create table if not exists public.hot_lead_ereignisse (
  id           uuid primary key default uuid_generate_v4(),
  hot_lead_id  uuid not null references public.hot_leads(id) on delete cascade,
  art          text not null,
  von_status   text,
  nach_status  text,
  akteur_id    uuid references public.users(id) on delete set null,
  akteur_rolle text,
  bemerkung    text,
  daten        jsonb,
  erfasst_am   timestamptz not null default now()
);

create index if not exists idx_hle_lead on public.hot_lead_ereignisse(hot_lead_id, erfasst_am desc);
create index if not exists idx_hle_art  on public.hot_lead_ereignisse(art, erfasst_am desc);
create index if not exists idx_hle_akteur on public.hot_lead_ereignisse(akteur_id, erfasst_am desc);

comment on table public.hot_lead_ereignisse is
  'Verlauf je Kontakt: Statuswechsel, Zuteilungen, Versand, "Termin fand statt". Wird nur angehaengt, nie geaendert.';

alter table public.hot_lead_ereignisse enable row level security;
drop policy if exists "service role manages hot_lead_ereignisse" on public.hot_lead_ereignisse;
create policy "service role manages hot_lead_ereignisse"
  on public.hot_lead_ereignisse for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Anrufversuche: die erste Zahl des Wochen-Benchmarks (600 Anwahlen)
-- ---------------------------------------------------------------------
create table if not exists public.anrufversuche (
  id         uuid primary key default uuid_generate_v4(),
  lead_id    uuid references public.leads(id) on delete cascade,
  hot_lead_id uuid references public.hot_leads(id) on delete set null,
  anrufer_id uuid references public.users(id) on delete set null,
  ergebnis   text,
  erfasst_am timestamptz not null default now()
);

create index if not exists idx_anrufversuche_anrufer on public.anrufversuche(anrufer_id, erfasst_am desc);
create index if not exists idx_anrufversuche_lead    on public.anrufversuche(lead_id, erfasst_am desc);

comment on table public.anrufversuche is
  'Ein Eintrag je Anwahl. Wird aus der Anruf-Maske automatisch geschrieben, nicht von Hand gepflegt.';

alter table public.anrufversuche enable row level security;
drop policy if exists "service role manages anrufversuche" on public.anrufversuche;
create policy "service role manages anrufversuche"
  on public.anrufversuche for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Besetzung ueber zwei Pools: die Bewerbung bekommt eine Stufe
-- ---------------------------------------------------------------------
alter table public.hot_lead_applications
  add column if not exists stufe text not null default 'Closer';

comment on column public.hot_lead_applications.stufe is
  'Closer oder Setter. Die Pool-Mechanik gilt kuenftig fuer beide Stufen.';
