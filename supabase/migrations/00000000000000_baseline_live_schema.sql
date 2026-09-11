-- Live-Schema Sunside CRM/Operations
-- Erzeugt am 2026-09-11 17:40 aus der laufenden Datenbank.
-- Dokumentation des Ausgangszustands. NICHT gegen die Live-DB ausfuehren.
-- ACHTUNG: In notify_bridge_lead_closed() stand ein fest einkodiertes Bearer-Token.
-- Es ist hier geschwaerzt. Es gehoert in den Vault und muss rotiert werden.

-- ===== Aufzaehlungstypen =====
create type public.anfrage_status_type as enum ('Offen', 'Genehmigt', 'Teilweise_Genehmigt', 'Abgelehnt');
create type public.ergebnis_type as enum ('Beratungsgespräch', 'Nicht erreicht', 'Kein Interesse', 'Unterlage bereitstellen', 'Ungültiger Lead', 'Wiedervorlage');
create type public.hot_lead_application_status_type as enum ('Offen', 'Genehmigt', 'Abgelehnt');
create type public.hot_lead_status_type as enum ('Lead', 'Geplant', 'Im Closing', 'Angebot versendet', 'Abgeschlossen', 'Verloren', 'Angebot', 'Termin abgesagt', 'Termin verschoben', 'Wiedervorlage', 'Nicht erschienen');
create type public.kategorie_type as enum ('Immobilienmakler', 'Sachverständiger');
create type public.land_type as enum ('Deutschland', 'Österreich', 'Schweiz');
create type public.message_type as enum ('Termin abgesagt', 'Termin verschoben', 'Lead gewonnen', 'Lead verloren', 'Pool Update');
create type public.quelle_type as enum ('E-Book', 'Kaltakquise', 'Empfehlung', 'Sonstige', 'Cold Calling', 'Calendly Direkt');
create type public.rolle_type as enum ('Setter', 'Closer', 'Coldcaller', 'Admin', 'Geschäftsführer');
create type public.template_kategorie_type as enum ('Kaltakquise', 'Closing', 'Allgemein');
create type public.terminart_type as enum ('Video', 'Telefonisch');

-- ===== Tabellen =====

create table public.assets (
  id uuid not null default extensions.uuid_generate_v4(),
  airtable_id text,
  name text not null,
  file_name text,
  file_url text,
  file_size integer,
  mime_type text,
  width integer,
  height integer,
  storage_path text,
  created_at timestamp with time zone default now()
);
alter table public.assets enable row level security;

create table public.aufgaben_ereignisse (
  id bigint not null,
  aufgabe_id bigint not null,
  art text not null,
  von_wert text,
  nach_wert text,
  bemerkung text,
  akteur uuid,
  erfasst_am timestamp with time zone not null default now()
);
alter table public.aufgaben_ereignisse enable row level security;

create table public.aufgaben_serie (
  id bigint not null,
  hot_lead_id uuid,
  leistung_id bigint,
  vorlage_id bigint,
  titel text not null,
  beschreibung text,
  verantwortlich text not null default 'sunside'::text,
  zustaendig_user_id uuid,
  prioritaet text not null default 'normal'::text,
  turnus text not null,
  faellig_am_tag integer not null default 1,
  vorlauf_tage integer not null default 0,
  menge_text text,
  aktiv boolean not null default true,
  pausiert_bis date,
  laeuft_ab_am date,
  notiz text,
  erstellt_von_user_id uuid,
  created_at timestamp with time zone not null default now()
);
alter table public.aufgaben_serie enable row level security;

create table public.backup_dedup_wuestenrot_monika_hot (
  id uuid,
  lead_id uuid,
  unternehmen text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  kategorie text,
  mail text,
  telefonnummer text,
  ort text,
  bundesland text,
  website text,
  termin_beratungsgespraech timestamp with time zone,
  terminart text,
  meeting_link text,
  status text,
  setter_id uuid,
  closer_id uuid,
  setup numeric(10,2),
  retainer numeric(10,2),
  laufzeit integer,
  prioritaet text,
  quelle text,
  monatliche_besuche text,
  mehrwert text,
  absprungrate text,
  anzahl_leads text,
  kunde_seit date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  airtable_id text,
  kommentar text,
  vertragsbestandteile text,
  paketname_individuell text,
  kurzbeschreibung text,
  leistungsbeschreibung text,
  attachments jsonb,
  produkt_dienstleistung text[],
  follow_up_status text,
  follow_up_naechster_schritt text,
  follow_up_datum date,
  rechnung_anrede text,
  rechnung_firma text,
  rechnung_zusatz text,
  rechnung_strasse text,
  rechnung_plz text,
  rechnung_ort text,
  rechnung_land text,
  rechnung_email text,
  ust_id text,
  steuernummer text,
  zahlungsziel_tage integer,
  vertragsbeginn date,
  retainer_start_offset_months integer,
  billing_notes text,
  billing_mode text,
  no_show_count integer,
  no_show_marked_at timestamp with time zone,
  no_show_marked_by uuid,
  reaktivierung_bearbeiter_id uuid,
  no_show_keep_in_closing boolean
);

create table public.backup_dedup_wuestenrot_monika_lead (
  id uuid,
  unternehmensname text,
  stadt text,
  land text,
  kategorie text,
  mail text,
  website text,
  telefonnummer text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  bereits_kontaktiert boolean,
  datum date,
  ergebnis text,
  kommentar text,
  wiedervorlage_datum timestamp with time zone,
  quelle text,
  absprungrate numeric,
  monatliche_besuche numeric,
  anzahl_leads numeric,
  mehrwert numeric,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  airtable_id text
);

create table public.backup_hot_lead_mia_casa_dillingen (
  id uuid,
  lead_id uuid,
  unternehmen text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  kategorie text,
  mail text,
  telefonnummer text,
  ort text,
  bundesland text,
  website text,
  termin_beratungsgespraech timestamp with time zone,
  terminart text,
  meeting_link text,
  status text,
  setter_id uuid,
  closer_id uuid,
  setup numeric(10,2),
  retainer numeric(10,2),
  laufzeit integer,
  prioritaet text,
  quelle text,
  monatliche_besuche text,
  mehrwert text,
  absprungrate text,
  anzahl_leads text,
  kunde_seit date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  airtable_id text,
  kommentar text,
  vertragsbestandteile text,
  paketname_individuell text,
  kurzbeschreibung text,
  leistungsbeschreibung text,
  attachments jsonb,
  produkt_dienstleistung text[],
  follow_up_status text,
  follow_up_naechster_schritt text,
  follow_up_datum date,
  rechnung_anrede text,
  rechnung_firma text,
  rechnung_zusatz text,
  rechnung_strasse text,
  rechnung_plz text,
  rechnung_ort text,
  rechnung_land text,
  rechnung_email text,
  ust_id text,
  steuernummer text,
  zahlungsziel_tage integer,
  vertragsbeginn date,
  retainer_start_offset_months integer,
  billing_notes text,
  billing_mode text,
  no_show_count integer,
  no_show_marked_at timestamp with time zone,
  no_show_marked_by uuid,
  reaktivierung_bearbeiter_id uuid,
  no_show_keep_in_closing boolean
);

create table public.backup_hot_leads_closer_2026_07_06 (
  id uuid,
  closer_id uuid,
  reaktivierung_bearbeiter_id uuid,
  status text,
  unternehmen text,
  lead_id uuid,
  updated_at timestamp with time zone
);

create table public.backup_hot_leads_dedup_20260723 (
  id uuid,
  lead_id uuid,
  unternehmen text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  kategorie text,
  mail text,
  telefonnummer text,
  ort text,
  bundesland text,
  website text,
  termin_beratungsgespraech timestamp with time zone,
  terminart text,
  meeting_link text,
  status text,
  setter_id uuid,
  closer_id uuid,
  setup numeric(10,2),
  retainer numeric(10,2),
  laufzeit integer,
  prioritaet text,
  quelle text,
  monatliche_besuche text,
  mehrwert text,
  absprungrate text,
  anzahl_leads text,
  kunde_seit date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  airtable_id text,
  kommentar text,
  vertragsbestandteile text,
  paketname_individuell text,
  kurzbeschreibung text,
  leistungsbeschreibung text,
  attachments jsonb,
  produkt_dienstleistung text[],
  follow_up_status text,
  follow_up_naechster_schritt text,
  follow_up_datum date,
  rechnung_anrede text,
  rechnung_firma text,
  rechnung_zusatz text,
  rechnung_strasse text,
  rechnung_plz text,
  rechnung_ort text,
  rechnung_land text,
  rechnung_email text,
  ust_id text,
  steuernummer text,
  zahlungsziel_tage integer,
  vertragsbeginn date,
  retainer_start_offset_months integer,
  billing_notes text,
  billing_mode text,
  no_show_count integer,
  no_show_marked_at timestamp with time zone,
  no_show_marked_by uuid,
  reaktivierung_bearbeiter_id uuid
);
alter table public.backup_hot_leads_dedup_20260723 enable row level security;

create table public.backup_kommentar_umzug_20260827 (
  id uuid,
  unternehmensname text,
  kommentar text,
  backup_timestamp timestamp with time zone
);

create table public.backup_marvin_verloren_to_abgesagt (
  id uuid,
  lead_id uuid,
  unternehmen text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  kategorie text,
  mail text,
  telefonnummer text,
  ort text,
  bundesland text,
  website text,
  termin_beratungsgespraech timestamp with time zone,
  terminart text,
  meeting_link text,
  status text,
  setter_id uuid,
  closer_id uuid,
  setup numeric(10,2),
  retainer numeric(10,2),
  laufzeit integer,
  prioritaet text,
  quelle text,
  monatliche_besuche text,
  mehrwert text,
  absprungrate text,
  anzahl_leads text,
  kunde_seit date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  airtable_id text,
  kommentar text,
  vertragsbestandteile text,
  paketname_individuell text,
  kurzbeschreibung text,
  leistungsbeschreibung text,
  attachments jsonb,
  produkt_dienstleistung text[],
  follow_up_status text,
  follow_up_naechster_schritt text,
  follow_up_datum date,
  rechnung_anrede text,
  rechnung_firma text,
  rechnung_zusatz text,
  rechnung_strasse text,
  rechnung_plz text,
  rechnung_ort text,
  rechnung_land text,
  rechnung_email text,
  ust_id text,
  steuernummer text,
  zahlungsziel_tage integer,
  vertragsbeginn date,
  retainer_start_offset_months integer,
  billing_notes text,
  billing_mode text,
  no_show_count integer,
  no_show_marked_at timestamp with time zone,
  no_show_marked_by uuid,
  reaktivierung_bearbeiter_id uuid,
  no_show_keep_in_closing boolean
);

create table public.billing_contacts (
  id uuid not null default gen_random_uuid(),
  hot_lead_id uuid not null,
  lexware_contact_id uuid not null,
  lexware_contact_version integer not null default 0,
  lexware_customer_number text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  last_synced_at timestamp with time zone,
  mapping_confidence text,
  mapping_notes text
);
alter table public.billing_contacts enable row level security;

create table public.billing_dunnings (
  id uuid not null default gen_random_uuid(),
  invoice_id uuid not null,
  lexware_dunning_id uuid,
  dunning_level integer not null,
  dunning_date date not null,
  dunning_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  created_at timestamp with time zone not null default now()
);
alter table public.billing_dunnings enable row level security;

create table public.billing_invoices (
  id uuid not null default gen_random_uuid(),
  hot_lead_id uuid,
  lexware_invoice_id uuid,
  lexware_voucher_number text,
  invoice_type text not null,
  retainer_period_start date,
  retainer_period_end date,
  net_amount numeric(12,2) not null,
  tax_rate numeric(4,2) not null default 19.00,
  gross_amount numeric(12,2) not null,
  currency text not null default 'EUR'::text,
  status text not null default 'pending'::text,
  voucher_date date,
  due_date date,
  paid_at timestamp with time zone,
  open_amount numeric(12,2),
  idempotency_key text not null,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  source text not null default 'bridge'::text,
  metadata jsonb default '{}'::jsonb,
  dunning_level integer not null default 0,
  last_dunning_at timestamp with time zone,
  next_dunning_at date
);
alter table public.billing_invoices enable row level security;

create table public.billing_mapping_review (
  id uuid not null default gen_random_uuid(),
  hot_lead_id uuid,
  lexware_contact_id uuid not null,
  lexware_contact_data jsonb not null,
  match_type text not null,
  match_score numeric(3,2),
  match_reason text,
  review_status text not null default 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);
alter table public.billing_mapping_review enable row level security;

create table public.billing_recurring (
  id uuid not null default gen_random_uuid(),
  hot_lead_id uuid not null,
  monthly_net_amount numeric(12,2) not null,
  tax_rate numeric(4,2) not null default 19.00,
  produkt text not null,
  laufzeit_months integer default 12,
  start_date date not null,
  end_date date,
  next_invoice_date date not null,
  last_invoice_date date,
  cancel_at_date date,
  status text not null default 'active'::text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  source text not null default 'bridge'::text,
  lexware_recurring_template_id uuid
);
alter table public.billing_recurring enable row level security;

create table public.billing_sync_log (
  id bigint not null default nextval('billing_sync_log_id_seq'::regclass),
  ts timestamp with time zone not null default now(),
  hot_lead_id uuid,
  invoice_id uuid,
  action text not null,
  direction text not null,
  lexware_endpoint text,
  http_status integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  duration_ms integer
);
alter table public.billing_sync_log enable row level security;

create table public.einstellungen (
  schluessel text not null,
  wert text not null,
  beschreibung text,
  geaendert_am timestamp with time zone not null default now()
);
alter table public.einstellungen enable row level security;

create table public.email_template_attachments (
  id uuid not null default extensions.uuid_generate_v4(),
  template_id uuid not null,
  file_name text not null,
  display_name text,
  file_url text,
  file_size integer,
  mime_type text,
  created_at timestamp with time zone default now(),
  file_data bytea
);

create table public.email_templates (
  id uuid not null default extensions.uuid_generate_v4(),
  name text not null,
  betreff text,
  inhalt text,
  kategorie text default 'Allgemein'::template_kategorie_type,
  aktiv boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  airtable_id text
);
alter table public.email_templates enable row level security;

create table public.follow_up_actions (
  id uuid not null default extensions.uuid_generate_v4(),
  hot_lead_id uuid not null,
  typ text not null,
  beschreibung text not null,
  erledigt boolean default false,
  faellig_am date,
  erstellt_von uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  kanban_status text default 'offen'::text
);
alter table public.follow_up_actions enable row level security;

create table public.hot_lead_applications (
  id uuid not null default extensions.uuid_generate_v4(),
  bewerbung_id text not null,
  hot_lead_id uuid not null,
  closer_id uuid not null,
  kommentar text,
  status hot_lead_application_status_type default 'Offen'::hot_lead_application_status_type,
  admin_kommentar text,
  bearbeitet_von uuid,
  bearbeitet_am timestamp with time zone,
  erstellt_am timestamp with time zone default now()
);
alter table public.hot_lead_applications enable row level security;

create table public.hot_lead_attachments (
  id uuid not null default extensions.uuid_generate_v4(),
  hot_lead_id uuid not null,
  file_name text not null,
  file_url text not null,
  file_size integer,
  mime_type text,
  created_at timestamp with time zone default now()
);

create table public.hot_leads (
  id uuid not null default extensions.uuid_generate_v4(),
  lead_id uuid,
  unternehmen text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  kategorie text,
  mail text,
  telefonnummer text,
  ort text,
  bundesland text,
  website text,
  termin_beratungsgespraech timestamp with time zone,
  terminart text,
  meeting_link text,
  status text default 'Lead'::hot_lead_status_type,
  setter_id uuid,
  closer_id uuid,
  setup numeric(10,2),
  retainer numeric(10,2),
  laufzeit integer,
  prioritaet text,
  quelle text,
  monatliche_besuche text,
  mehrwert text,
  absprungrate text,
  anzahl_leads text,
  kunde_seit date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  airtable_id text,
  kommentar text,
  vertragsbestandteile text,
  paketname_individuell text,
  kurzbeschreibung text,
  leistungsbeschreibung text,
  attachments jsonb default '[]'::jsonb,
  produkt_dienstleistung text[],
  follow_up_status text,
  follow_up_naechster_schritt text,
  follow_up_datum date,
  rechnung_anrede text,
  rechnung_firma text,
  rechnung_zusatz text,
  rechnung_strasse text,
  rechnung_plz text,
  rechnung_ort text,
  rechnung_land text default 'DE'::text,
  rechnung_email text,
  ust_id text,
  steuernummer text,
  zahlungsziel_tage integer default 14,
  vertragsbeginn date,
  retainer_start_offset_months integer default 0,
  billing_notes text,
  billing_mode text not null default 'none'::text,
  no_show_count integer not null default 0,
  no_show_marked_at timestamp with time zone,
  no_show_marked_by uuid,
  reaktivierung_bearbeiter_id uuid,
  no_show_keep_in_closing boolean default false,
  opener_id uuid
);
alter table public.hot_leads enable row level security;

create table public.kalender_blocker (
  id uuid not null default extensions.uuid_generate_v4(),
  airtable_id text,
  name text,
  typ text,
  startdatum date,
  enddatum date,
  startzeit text,
  endzeit text,
  wochentage text[],
  aktiv boolean default true,
  notiz text,
  erstellt_von text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
alter table public.kalender_blocker enable row level security;

create table public.kunden (
  hot_lead_id uuid not null,
  uebergeben_am timestamp with time zone not null default now(),
  phase text not null default 'einrichtung'::text,
  ampel text not null default 'gruen'::text,
  ampel_seit timestamp with time zone not null default now(),
  ampel_grund text,
  betreuung text,
  notiz text,
  created_at timestamp with time zone not null default now()
);
alter table public.kunden enable row level security;

create table public.kunden_alarme (
  id bigint not null,
  hot_lead_id uuid not null,
  typ text not null,
  betrifft text not null,
  erkannt_am timestamp with time zone not null default now(),
  gesendet_am timestamp with time zone,
  kanal text,
  fehler text,
  net_request_id bigint,
  versuch_am timestamp with time zone,
  versuche integer not null default 0,
  reagiert_am timestamp with time zone,
  reagiert_von text,
  ergebnis text,
  bewertung text
);
alter table public.kunden_alarme enable row level security;

create table public.kunden_anfragen (
  id bigint not null,
  hot_lead_id uuid not null,
  anfrageart text not null,
  eingegangen_am timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  quelle text not null default 'make'::text
);
alter table public.kunden_anfragen enable row level security;

create table public.kunden_aufgaben (
  id bigint not null,
  hot_lead_id uuid,
  leistung_id bigint,
  vorlage_id bigint,
  titel text not null,
  phase text not null,
  verantwortlich text not null,
  faellig_am date,
  erledigt_am timestamp with time zone,
  erledigt_von uuid,
  ergebnis text,
  periode text,
  created_at timestamp with time zone not null default now(),
  zustaendig_user_id uuid,
  erstellt_von_user_id uuid,
  quelle text not null default 'vorlage'::text,
  beschreibung text,
  prioritaet text not null default 'normal'::text,
  quelle_kommunikation_id bigint,
  status text not null default 'offen'::text,
  blockiert_grund text,
  wiedervorlage_am date,
  serie_id bigint,
  begonnen_am timestamp with time zone,
  letzter_akteur uuid,
  geloescht_am timestamp with time zone,
  geloescht_von uuid,
  geloescht_grund text,
  intern boolean not null default false
);
alter table public.kunden_aufgaben enable row level security;

create table public.kunden_berichte (
  id bigint not null default nextval('kunden_berichte_id_seq'::regclass),
  hot_lead_id uuid not null,
  zeitraum_von date not null,
  zeitraum_bis date not null,
  daten jsonb not null,
  zusammenfassung text,
  pdf_pfad text,
  status text not null default 'entwurf'::text,
  erzeugt_am timestamp with time zone not null default now(),
  freigegeben_von uuid,
  freigegeben_am timestamp with time zone,
  versendet_am timestamp with time zone,
  versendet_an text[],
  verworfen_grund text,
  interne_notiz text
);
alter table public.kunden_berichte enable row level security;

create table public.kunden_berichtsplan (
  hot_lead_id uuid not null,
  turnus text not null default 'monatlich'::text,
  empfaenger text[] not null default '{}'::text[],
  vorlauf_tage integer not null default 3,
  aktiv boolean not null default true,
  notiz text,
  geaendert_am timestamp with time zone not null default now()
);
alter table public.kunden_berichtsplan enable row level security;

create table public.kunden_ereignisse (
  id bigint not null,
  hot_lead_id uuid not null,
  leistung_id bigint,
  art text not null,
  von_wert text,
  nach_wert text,
  bemerkung text,
  akteur text,
  erfasst_am timestamp with time zone not null default now()
);
alter table public.kunden_ereignisse enable row level security;

create table public.kunden_kommunikation (
  id bigint not null,
  hot_lead_id uuid,
  richtung text not null,
  absender text not null,
  empfaenger text[] not null default '{}'::text[],
  betreff text,
  inhalt text,
  gesendet_am timestamp with time zone not null,
  message_id text,
  in_reply_to text,
  thread_schluessel text,
  quelle text not null,
  ist_systemmail boolean not null default false,
  zuordnung text not null default 'offen'::text,
  klassifikation jsonb,
  klassifiziert_am timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  gegenstelle_domain text,
  ordner text
);
alter table public.kunden_kommunikation enable row level security;

create table public.kunden_leistungen (
  id bigint not null,
  hot_lead_id uuid not null,
  leistung text not null,
  status text not null default 'bestaetigt'::text,
  bestaetigt_am timestamp with time zone,
  live_seit timestamp with time zone,
  beendet_am timestamp with time zone,
  notiz text,
  created_at timestamp with time zone not null default now()
);
alter table public.kunden_leistungen enable row level security;

create table public.lead_archive (
  id uuid not null default extensions.uuid_generate_v4(),
  lead_id uuid,
  user_id uuid,
  bereits_kontaktiert boolean,
  ergebnis text,
  datum date,
  archiviert_am timestamp with time zone default now(),
  airtable_id text
);
alter table public.lead_archive enable row level security;

create table public.lead_assignment_history (
  id uuid not null default extensions.uuid_generate_v4(),
  lead_id uuid not null,
  user_id uuid not null,
  assigned_at timestamp with time zone,
  removed_at timestamp with time zone,
  reason text,
  source text not null default 'trigger'::text,
  created_at timestamp with time zone not null default now()
);
alter table public.lead_assignment_history enable row level security;

create table public.lead_assignments (
  id uuid not null default extensions.uuid_generate_v4(),
  lead_id uuid not null,
  user_id uuid not null,
  assigned_at timestamp with time zone default now()
);
alter table public.lead_assignments enable row level security;

create table public.lead_requests (
  id uuid not null default extensions.uuid_generate_v4(),
  anfrage_id text not null,
  user_id uuid not null,
  anzahl integer not null,
  nachricht text,
  status text default 'Offen'::anfrage_status_type,
  genehmigte_anzahl integer,
  admin_kommentar text,
  bearbeitet_von uuid,
  bearbeitet_am timestamp with time zone,
  erstellt_am timestamp with time zone default now(),
  airtable_id text
);
alter table public.lead_requests enable row level security;

create table public.leads (
  id uuid not null default extensions.uuid_generate_v4(),
  unternehmensname text,
  stadt text,
  land text default 'Deutschland'::land_type,
  kategorie text default 'Immobilienmakler'::kategorie_type,
  mail text,
  website text,
  telefonnummer text,
  ansprechpartner_vorname text,
  ansprechpartner_nachname text,
  bereits_kontaktiert boolean default false,
  datum date,
  ergebnis text,
  kommentar text,
  wiedervorlage_datum timestamp with time zone,
  quelle text default 'Kaltakquise'::quelle_type,
  absprungrate numeric,
  monatliche_besuche numeric,
  anzahl_leads numeric,
  mehrwert numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  airtable_id text
);
alter table public.leads enable row level security;

create table public.leistung_aufgaben_vorlage (
  id bigint not null,
  leistung text not null,
  phase text not null,
  reihenfolge integer not null,
  titel text not null,
  verantwortlich text not null,
  turnus text,
  hinweis text,
  aktiv boolean not null default true,
  frist_tage integer
);
alter table public.leistung_aufgaben_vorlage enable row level security;

create table public.leistungskatalog (
  schluessel text not null,
  anzeigename text not null,
  varianten text[] not null default '{}'::text[],
  aktiv boolean not null default true,
  sortierung integer not null default 100
);
alter table public.leistungskatalog enable row level security;

create table public.nutzer_dashboard (
  user_id uuid not null,
  layouts jsonb not null default '{}'::jsonb,
  versteckt text[] not null default '{}'::text[],
  aktualisiert_am timestamp with time zone not null default now()
);
alter table public.nutzer_dashboard enable row level security;

create table public.operations_zugang (
  user_id uuid not null,
  rolle text not null default 'mitarbeit'::text,
  aktiv boolean not null default true,
  angelegt_am timestamp with time zone not null default now(),
  angelegt_von uuid,
  notiz text
);
alter table public.operations_zugang enable row level security;

create table public.pakete (
  schluessel text not null,
  name text not null,
  leistungen text[] not null,
  vorlage text,
  aktiv boolean not null default true,
  sortierung integer not null default 100
);
alter table public.pakete enable row level security;

create table public.product_catalog (
  id uuid not null default gen_random_uuid(),
  produkt_key text not null,
  setup_item_name text not null,
  setup_description text not null,
  retainer_item_name text not null,
  retainer_description text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
alter table public.product_catalog enable row level security;

create table public.system_laeufe (
  id bigint not null default nextval('system_laeufe_id_seq'::regclass),
  name text not null,
  gestartet_am timestamp with time zone not null default now(),
  beendet_am timestamp with time zone,
  ergebnis jsonb,
  fehler text
);
alter table public.system_laeufe enable row level security;

create table public.system_messages (
  id uuid not null default extensions.uuid_generate_v4(),
  message_id text not null,
  empfaenger_id uuid not null,
  typ text not null,
  titel text,
  nachricht text,
  hot_lead_id uuid,
  gelesen boolean default false,
  erstellt_am timestamp with time zone default now()
);
alter table public.system_messages enable row level security;

create table public.system_takt (
  name text not null,
  erwarteter_abstand interval,
  quelle text not null,
  notiz text
);

create table public.users (
  id uuid not null default extensions.uuid_generate_v4(),
  vorname text,
  nachname text,
  vor_nachname text default ((COALESCE(vorname, ''::text) || ' '::text) || COALESCE(nachname, ''::text)),
  email text not null,
  email_geschaeftlich text,
  telefon text,
  strasse text,
  plz text,
  ort text,
  bundesland text,
  password_hash text,
  rollen text[] default '{}'::rolle_type[],
  status boolean default true,
  onboarding text,
  google_calendar_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  airtable_id text,
  preferences jsonb default '{}'::jsonb
);
alter table public.users enable row level security;

create table seo.abdeckungsluecken (
  crm_lead_id uuid not null,
  kunde text not null,
  domain text,
  produkt text,
  vertragsstart date,
  ist_seo boolean not null default false,
  erkannt_am date not null default CURRENT_DATE,
  behoben_am date,
  notiz text
);
alter table seo.abdeckungsluecken enable row level security;

create table seo.daily_totals (
  site_url text not null,
  datum date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6) not null default 0,
  "position" numeric(8,3) not null default 0,
  erfasst_am timestamp with time zone not null default now()
);
alter table seo.daily_totals enable row level security;

create table seo.eingriffe (
  id bigint not null,
  site_url text not null,
  datum date not null default CURRENT_DATE,
  was text not null,
  typ text,
  betroffene_urls jsonb not null default '[]'::jsonb,
  massnahme_id bigint,
  notiz text,
  angelegt_am timestamp with time zone not null default now()
);
alter table seo.eingriffe enable row level security;

create table seo.massnahmen (
  id bigint not null,
  site_url text not null,
  typ text not null,
  titel text not null,
  begruendung text,
  prioritaet integer not null default 3,
  potenzial_clicks integer,
  ziel_queries jsonb not null default '[]'::jsonb,
  ziel_urls jsonb not null default '[]'::jsonb,
  status text not null default 'offen'::text,
  fingerprint text not null,
  erkannt_am date not null default CURRENT_DATE,
  zuletzt_gesehen date not null default CURRENT_DATE,
  erledigt_am date,
  ergebnis text
);
alter table seo.massnahmen enable row level security;

create table seo.page_snapshots (
  site_url text not null,
  snapshot_date date not null,
  page text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6) not null default 0,
  "position" numeric(8,3) not null default 0
);
alter table seo.page_snapshots enable row level security;

create table seo.properties (
  site_url text not null,
  kunde text not null,
  aktiv boolean not null default true,
  groesse text,
  notiz text,
  angelegt_am timestamp with time zone not null default now(),
  hot_lead_id uuid,
  domain text,
  crm_lead_id uuid,
  crm_name text,
  produkt text,
  vertragsstart date,
  arbeitsbeginn date,
  ist_seo boolean not null default false,
  zuordnung text not null default 'offen'::text,
  zuletzt_gesehen date
);
alter table seo.properties enable row level security;

create table seo.query_snapshots (
  site_url text not null,
  snapshot_date date not null,
  query text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8,6) not null default 0,
  "position" numeric(8,3) not null default 0
);
alter table seo.query_snapshots enable row level security;

create table seo.status (
  site_url text not null,
  snapshot_date date not null,
  ampel text not null,
  score numeric(5,2),
  aussage text not null,
  achse_wachstum numeric(6,2),
  achse_effizienz numeric(6,2),
  achse_reichweite numeric(6,2),
  achse_potenzial numeric(6,2),
  kennzahlen jsonb not null default '{}'::jsonb,
  erfasst_am timestamp with time zone not null default now(),
  clicks integer,
  impressions integer
);
alter table seo.status enable row level security;

-- ===== Schluessel und Regeln =====
alter table public.assets add constraint assets_pkey PRIMARY KEY (id);
alter table public.aufgaben_ereignisse add constraint aufgaben_ereignisse_pkey PRIMARY KEY (id);
alter table public.aufgaben_serie add constraint aufgaben_serie_pkey PRIMARY KEY (id);
alter table public.billing_contacts add constraint billing_contacts_pkey PRIMARY KEY (id);
alter table public.billing_dunnings add constraint billing_dunnings_pkey PRIMARY KEY (id);
alter table public.billing_invoices add constraint billing_invoices_pkey PRIMARY KEY (id);
alter table public.billing_mapping_review add constraint billing_mapping_review_pkey PRIMARY KEY (id);
alter table public.billing_recurring add constraint billing_recurring_pkey PRIMARY KEY (id);
alter table public.billing_sync_log add constraint billing_sync_log_pkey PRIMARY KEY (id);
alter table public.einstellungen add constraint einstellungen_pkey PRIMARY KEY (schluessel);
alter table public.email_template_attachments add constraint email_template_attachments_pkey PRIMARY KEY (id);
alter table public.email_templates add constraint email_templates_pkey PRIMARY KEY (id);
alter table public.follow_up_actions add constraint follow_up_actions_pkey PRIMARY KEY (id);
alter table public.hot_lead_applications add constraint hot_lead_applications_pkey PRIMARY KEY (id);
alter table public.hot_lead_attachments add constraint hot_lead_attachments_pkey PRIMARY KEY (id);
alter table public.hot_leads add constraint hot_leads_pkey PRIMARY KEY (id);
alter table public.kalender_blocker add constraint kalender_blocker_pkey PRIMARY KEY (id);
alter table public.kunden add constraint kunden_pkey PRIMARY KEY (hot_lead_id);
alter table public.kunden_alarme add constraint kunden_alarme_pkey PRIMARY KEY (id);
alter table public.kunden_anfragen add constraint kunden_anfragen_pkey PRIMARY KEY (id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_pkey PRIMARY KEY (id);
alter table public.kunden_berichte add constraint kunden_berichte_pkey PRIMARY KEY (id);
alter table public.kunden_berichtsplan add constraint kunden_berichtsplan_pkey PRIMARY KEY (hot_lead_id);
alter table public.kunden_ereignisse add constraint kunden_ereignisse_pkey PRIMARY KEY (id);
alter table public.kunden_kommunikation add constraint kunden_kommunikation_pkey PRIMARY KEY (id);
alter table public.kunden_leistungen add constraint kunden_leistungen_pkey PRIMARY KEY (id);
alter table public.lead_archive add constraint lead_archive_pkey PRIMARY KEY (id);
alter table public.lead_assignment_history add constraint lead_assignment_history_pkey PRIMARY KEY (id);
alter table public.lead_assignments add constraint lead_assignments_pkey PRIMARY KEY (id);
alter table public.lead_requests add constraint lead_requests_pkey PRIMARY KEY (id);
alter table public.leads add constraint leads_pkey PRIMARY KEY (id);
alter table public.leistung_aufgaben_vorlage add constraint leistung_aufgaben_vorlage_pkey PRIMARY KEY (id);
alter table public.leistungskatalog add constraint leistungskatalog_pkey PRIMARY KEY (schluessel);
alter table public.nutzer_dashboard add constraint nutzer_dashboard_pkey PRIMARY KEY (user_id);
alter table public.operations_zugang add constraint operations_zugang_pkey PRIMARY KEY (user_id);
alter table public.pakete add constraint pakete_pkey PRIMARY KEY (schluessel);
alter table public.product_catalog add constraint product_catalog_pkey PRIMARY KEY (id);
alter table public.system_laeufe add constraint system_laeufe_pkey PRIMARY KEY (id);
alter table public.system_messages add constraint system_messages_pkey PRIMARY KEY (id);
alter table public.system_takt add constraint system_takt_pkey PRIMARY KEY (name);
alter table public.users add constraint users_pkey PRIMARY KEY (id);
alter table seo.abdeckungsluecken add constraint abdeckungsluecken_pkey PRIMARY KEY (crm_lead_id);
alter table seo.daily_totals add constraint daily_totals_pkey PRIMARY KEY (site_url, datum);
alter table seo.eingriffe add constraint eingriffe_pkey PRIMARY KEY (id);
alter table seo.massnahmen add constraint massnahmen_pkey PRIMARY KEY (id);
alter table seo.page_snapshots add constraint page_snapshots_pkey PRIMARY KEY (site_url, snapshot_date, page);
alter table seo.properties add constraint properties_pkey PRIMARY KEY (site_url);
alter table seo.query_snapshots add constraint query_snapshots_pkey PRIMARY KEY (site_url, snapshot_date, query);
alter table seo.status add constraint status_pkey PRIMARY KEY (site_url, snapshot_date);
alter table public.billing_contacts add constraint billing_contacts_hot_lead_id_key UNIQUE (hot_lead_id);
alter table public.billing_contacts add constraint billing_contacts_lexware_contact_id_key UNIQUE (lexware_contact_id);
alter table public.billing_dunnings add constraint billing_dunnings_lexware_dunning_id_key UNIQUE (lexware_dunning_id);
alter table public.billing_invoices add constraint billing_invoices_idempotency_key_key UNIQUE (idempotency_key);
alter table public.billing_invoices add constraint billing_invoices_lexware_invoice_id_key UNIQUE (lexware_invoice_id);
alter table public.billing_recurring add constraint billing_recurring_hot_lead_id_start_date_key UNIQUE (hot_lead_id, start_date);
alter table public.hot_lead_applications add constraint hot_lead_applications_bewerbung_id_key UNIQUE (bewerbung_id);
alter table public.kunden_alarme add constraint kunden_alarme_hot_lead_id_typ_betrifft_key UNIQUE (hot_lead_id, typ, betrifft);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_leistung_id_vorlage_id_periode_key UNIQUE (leistung_id, vorlage_id, periode);
alter table public.kunden_berichte add constraint kunden_berichte_hot_lead_id_zeitraum_von_zeitraum_bis_key UNIQUE (hot_lead_id, zeitraum_von, zeitraum_bis);
alter table public.kunden_kommunikation add constraint kunden_kommunikation_message_id_key UNIQUE (message_id);
alter table public.kunden_leistungen add constraint kunden_leistungen_hot_lead_id_leistung_key UNIQUE (hot_lead_id, leistung);
alter table public.lead_assignments add constraint lead_assignments_lead_id_user_id_key UNIQUE (lead_id, user_id);
alter table public.lead_requests add constraint lead_requests_anfrage_id_key UNIQUE (anfrage_id);
alter table public.leistung_aufgaben_vorlage add constraint leistung_aufgaben_vorlage_leistung_phase_reihenfolge_key UNIQUE (leistung, phase, reihenfolge);
alter table public.product_catalog add constraint product_catalog_produkt_key_key UNIQUE (produkt_key);
alter table public.system_messages add constraint system_messages_message_id_key UNIQUE (message_id);
alter table public.users add constraint users_email_key UNIQUE (email);
alter table seo.massnahmen add constraint massnahmen_site_url_fingerprint_key UNIQUE (site_url, fingerprint);
alter table public.aufgaben_ereignisse add constraint aufgaben_ereignisse_akteur_fkey FOREIGN KEY (akteur) REFERENCES users(id);
alter table public.aufgaben_ereignisse add constraint aufgaben_ereignisse_aufgabe_id_fkey FOREIGN KEY (aufgabe_id) REFERENCES kunden_aufgaben(id) ON DELETE CASCADE;
alter table public.aufgaben_serie add constraint aufgaben_serie_erstellt_von_user_id_fkey FOREIGN KEY (erstellt_von_user_id) REFERENCES users(id);
alter table public.aufgaben_serie add constraint aufgaben_serie_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE CASCADE;
alter table public.aufgaben_serie add constraint aufgaben_serie_leistung_id_fkey FOREIGN KEY (leistung_id) REFERENCES kunden_leistungen(id) ON DELETE CASCADE;
alter table public.aufgaben_serie add constraint aufgaben_serie_vorlage_id_fkey FOREIGN KEY (vorlage_id) REFERENCES leistung_aufgaben_vorlage(id);
alter table public.aufgaben_serie add constraint aufgaben_serie_zustaendig_user_id_fkey FOREIGN KEY (zustaendig_user_id) REFERENCES users(id);
alter table public.billing_contacts add constraint billing_contacts_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE RESTRICT;
alter table public.billing_dunnings add constraint billing_dunnings_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE;
alter table public.billing_invoices add constraint billing_invoices_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE RESTRICT;
alter table public.billing_mapping_review add constraint billing_mapping_review_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE CASCADE;
alter table public.billing_mapping_review add constraint billing_mapping_review_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id);
alter table public.billing_recurring add constraint billing_recurring_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE RESTRICT;
alter table public.billing_sync_log add constraint billing_sync_log_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE SET NULL;
alter table public.billing_sync_log add constraint billing_sync_log_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE SET NULL;
alter table public.email_template_attachments add constraint email_template_attachments_template_id_fkey FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE;
alter table public.follow_up_actions add constraint follow_up_actions_erstellt_von_fkey FOREIGN KEY (erstellt_von) REFERENCES users(id) ON DELETE SET NULL;
alter table public.follow_up_actions add constraint follow_up_actions_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE CASCADE;
alter table public.hot_lead_applications add constraint hot_lead_applications_bearbeitet_von_fkey FOREIGN KEY (bearbeitet_von) REFERENCES users(id) ON DELETE SET NULL;
alter table public.hot_lead_applications add constraint hot_lead_applications_closer_id_fkey FOREIGN KEY (closer_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public.hot_lead_applications add constraint hot_lead_applications_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE CASCADE;
alter table public.hot_lead_attachments add constraint hot_lead_attachments_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE CASCADE;
alter table public.hot_leads add constraint hot_leads_closer_id_fkey FOREIGN KEY (closer_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public.hot_leads add constraint hot_leads_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
alter table public.hot_leads add constraint hot_leads_no_show_marked_by_fkey FOREIGN KEY (no_show_marked_by) REFERENCES users(id);
alter table public.hot_leads add constraint hot_leads_opener_id_fkey FOREIGN KEY (opener_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public.hot_leads add constraint hot_leads_reaktivierung_bearbeiter_id_fkey FOREIGN KEY (reaktivierung_bearbeiter_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public.hot_leads add constraint hot_leads_setter_id_fkey FOREIGN KEY (setter_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public.kunden add constraint kunden_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_alarme add constraint kunden_alarme_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_anfragen add constraint kunden_anfragen_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_erledigt_von_fkey FOREIGN KEY (erledigt_von) REFERENCES users(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_erstellt_von_user_id_fkey FOREIGN KEY (erstellt_von_user_id) REFERENCES users(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_geloescht_von_fkey FOREIGN KEY (geloescht_von) REFERENCES users(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_leistung_id_fkey FOREIGN KEY (leistung_id) REFERENCES kunden_leistungen(id) ON DELETE CASCADE;
alter table public.kunden_aufgaben add constraint kunden_aufgaben_letzter_akteur_fkey FOREIGN KEY (letzter_akteur) REFERENCES users(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_quelle_kommunikation_id_fkey FOREIGN KEY (quelle_kommunikation_id) REFERENCES kunden_kommunikation(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_serie_id_fkey FOREIGN KEY (serie_id) REFERENCES aufgaben_serie(id) ON DELETE SET NULL;
alter table public.kunden_aufgaben add constraint kunden_aufgaben_vorlage_id_fkey FOREIGN KEY (vorlage_id) REFERENCES leistung_aufgaben_vorlage(id);
alter table public.kunden_aufgaben add constraint kunden_aufgaben_zustaendig_user_id_fkey FOREIGN KEY (zustaendig_user_id) REFERENCES users(id);
alter table public.kunden_berichte add constraint kunden_berichte_freigegeben_von_fkey FOREIGN KEY (freigegeben_von) REFERENCES users(id);
alter table public.kunden_berichte add constraint kunden_berichte_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_berichtsplan add constraint kunden_berichtsplan_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_ereignisse add constraint kunden_ereignisse_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_ereignisse add constraint kunden_ereignisse_leistung_id_fkey FOREIGN KEY (leistung_id) REFERENCES kunden_leistungen(id) ON DELETE SET NULL;
alter table public.kunden_kommunikation add constraint kunden_kommunikation_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_leistungen add constraint kunden_leistungen_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table public.kunden_leistungen add constraint kunden_leistungen_leistung_fkey FOREIGN KEY (leistung) REFERENCES leistungskatalog(schluessel);
alter table public.lead_archive add constraint lead_archive_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
alter table public.lead_archive add constraint lead_archive_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
alter table public.lead_assignments add constraint lead_assignments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
alter table public.lead_assignments add constraint lead_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public.lead_requests add constraint lead_requests_bearbeitet_von_fkey FOREIGN KEY (bearbeitet_von) REFERENCES users(id) ON DELETE SET NULL;
alter table public.lead_requests add constraint lead_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public.leistung_aufgaben_vorlage add constraint leistung_aufgaben_vorlage_leistung_fkey FOREIGN KEY (leistung) REFERENCES leistungskatalog(schluessel);
alter table public.nutzer_dashboard add constraint nutzer_dashboard_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public.operations_zugang add constraint operations_zugang_angelegt_von_fkey FOREIGN KEY (angelegt_von) REFERENCES users(id);
alter table public.operations_zugang add constraint operations_zugang_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public.system_messages add constraint system_messages_empfaenger_id_fkey FOREIGN KEY (empfaenger_id) REFERENCES users(id) ON DELETE CASCADE;
alter table public.system_messages add constraint system_messages_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id) ON DELETE SET NULL;
alter table seo.daily_totals add constraint daily_totals_site_url_fkey FOREIGN KEY (site_url) REFERENCES seo.properties(site_url) ON DELETE CASCADE;
alter table seo.eingriffe add constraint eingriffe_massnahme_id_fkey FOREIGN KEY (massnahme_id) REFERENCES seo.massnahmen(id) ON DELETE SET NULL;
alter table seo.eingriffe add constraint eingriffe_site_url_fkey FOREIGN KEY (site_url) REFERENCES seo.properties(site_url) ON DELETE CASCADE;
alter table seo.massnahmen add constraint massnahmen_site_url_fkey FOREIGN KEY (site_url) REFERENCES seo.properties(site_url) ON DELETE CASCADE;
alter table seo.page_snapshots add constraint page_snapshots_site_url_fkey FOREIGN KEY (site_url) REFERENCES seo.properties(site_url) ON DELETE CASCADE;
alter table seo.properties add constraint properties_hot_lead_id_fkey FOREIGN KEY (hot_lead_id) REFERENCES hot_leads(id);
alter table seo.query_snapshots add constraint query_snapshots_site_url_fkey FOREIGN KEY (site_url) REFERENCES seo.properties(site_url) ON DELETE CASCADE;
alter table seo.status add constraint status_site_url_fkey FOREIGN KEY (site_url) REFERENCES seo.properties(site_url) ON DELETE CASCADE;
alter table public.aufgaben_ereignisse add constraint ereignis_art_gueltig CHECK ((art = ANY (ARRAY['angelegt'::text, 'status'::text, 'zustaendigkeit'::text, 'termin'::text, 'kommentar'::text, 'bearbeitet'::text, 'geloescht'::text, 'wiederhergestellt'::text])));
alter table public.aufgaben_serie add constraint aufgaben_serie_prioritaet_check CHECK ((prioritaet = ANY (ARRAY['niedrig'::text, 'normal'::text, 'hoch'::text])));
alter table public.aufgaben_serie add constraint aufgaben_serie_turnus_check CHECK ((turnus = ANY (ARRAY['woechentlich'::text, 'zweiwoechentlich'::text, 'monatlich'::text, 'zweimonatlich'::text, 'quartalsweise'::text])));
alter table public.aufgaben_serie add constraint aufgaben_serie_verantwortlich_check CHECK ((verantwortlich = ANY (ARRAY['kunde'::text, 'sunside'::text])));
alter table public.aufgaben_serie add constraint aufgaben_serie_vorlauf_tage_check CHECK (((vorlauf_tage >= 0) AND (vorlauf_tage <= 30)));
alter table public.billing_contacts add constraint billing_contacts_mapping_confidence_check CHECK (((mapping_confidence = ANY (ARRAY['exact_email'::text, 'fuzzy_company_name'::text, 'manual_review'::text, 'manual_confirmed'::text])) OR (mapping_confidence IS NULL)));
alter table public.billing_dunnings add constraint billing_dunnings_dunning_level_check CHECK (((dunning_level >= 1) AND (dunning_level <= 3)));
alter table public.billing_invoices add constraint billing_invoices_invoice_type_check CHECK ((invoice_type = ANY (ARRAY['erstrechnung'::text, 'retainer'::text, 'one_time'::text, 'manual'::text, 'reminder'::text, 'provision'::text])));
alter table public.billing_invoices add constraint billing_invoices_source_check CHECK ((source = ANY (ARRAY['bridge'::text, 'lexware_legacy'::text, 'lexware_managed'::text])));
alter table public.billing_invoices add constraint billing_invoices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'draft'::text, 'open'::text, 'overdue'::text, 'paid'::text, 'paidoff'::text, 'voided'::text, 'failed'::text])));
alter table public.billing_mapping_review add constraint billing_mapping_review_match_type_check CHECK ((match_type = ANY (ARRAY['exact_email'::text, 'fuzzy_company_name'::text, 'fuzzy_contact_name'::text, 'unmatched_lexware'::text])));
alter table public.billing_mapping_review add constraint billing_mapping_review_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'create_new'::text])));
alter table public.billing_recurring add constraint billing_recurring_source_check CHECK ((source = ANY (ARRAY['bridge'::text, 'lexware_managed'::text])));
alter table public.billing_recurring add constraint billing_recurring_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'completed'::text])));
alter table public.billing_sync_log add constraint billing_sync_log_direction_check CHECK ((direction = ANY (ARRAY['outgoing'::text, 'incoming'::text])));
alter table public.follow_up_actions add constraint follow_up_actions_kanban_status_check CHECK ((kanban_status = ANY (ARRAY['offen'::text, 'in_bearbeitung'::text, 'erledigt'::text])));
alter table public.follow_up_actions add constraint follow_up_actions_typ_check CHECK ((typ = ANY (ARRAY['mail_gesendet'::text, 'anruf'::text, 'todo'::text, 'notiz'::text, 'closer_meeting'::text])));
alter table public.hot_leads add constraint hot_leads_billing_mode_check CHECK ((billing_mode = ANY (ARRAY['none'::text, 'standard'::text, 'reference'::text, 'manual_external'::text, 'one_time_paid'::text, 'recurring_only'::text, 'provision_partner'::text])));
alter table public.hot_leads add constraint hot_leads_follow_up_status_check CHECK ((follow_up_status = ANY (ARRAY['aktiv'::text, 'pausiert'::text, 'abgeschlossen'::text])));
alter table public.hot_leads add constraint hot_leads_rechnung_anrede_check CHECK ((rechnung_anrede = ANY (ARRAY['Herr'::text, 'Frau'::text, 'Divers'::text, 'Firma'::text])));
alter table public.kunden add constraint kunden_ampel_gueltig CHECK ((ampel = ANY (ARRAY['gruen'::text, 'gelb'::text, 'rot'::text])));
alter table public.kunden add constraint kunden_phase_gueltig CHECK ((phase = ANY (ARRAY['einrichtung'::text, 'aktivierung'::text, 'betreuung'::text, 'verlaengerung'::text, 'beendet'::text])));
alter table public.kunden_alarme add constraint alarm_bewertung_gueltig CHECK (((bewertung IS NULL) OR (bewertung = ANY (ARRAY['berechtigt'::text, 'fehlalarm'::text, 'nicht_angebunden'::text]))));
alter table public.kunden_aufgaben add constraint aufgabe_blockade_begruendet CHECK (((status <> 'blockiert'::text) OR (blockiert_grund IS NOT NULL)));
alter table public.kunden_aufgaben add constraint aufgabe_erledigt_stimmig CHECK (((status = 'erledigt'::text) = (erledigt_am IS NOT NULL)));
alter table public.kunden_aufgaben add constraint aufgabe_prioritaet_gueltig CHECK ((prioritaet = ANY (ARRAY['niedrig'::text, 'normal'::text, 'hoch'::text])));
alter table public.kunden_aufgaben add constraint aufgabe_quelle_gueltig CHECK ((quelle = ANY (ARRAY['vorlage'::text, 'manuell'::text, 'mail'::text, 'alarm'::text])));
alter table public.kunden_aufgaben add constraint aufgabe_status_gueltig CHECK ((status = ANY (ARRAY['offen'::text, 'in_arbeit'::text, 'blockiert'::text, 'erledigt'::text])));
alter table public.kunden_aufgaben add constraint aufgabe_verantwortlich_gueltig CHECK ((verantwortlich = ANY (ARRAY['kunde'::text, 'sunside'::text])));
alter table public.kunden_aufgaben add constraint aufgabe_zustaendigkeit_stimmig CHECK (((verantwortlich = 'sunside'::text) OR (zustaendig_user_id IS NULL)));
alter table public.kunden_berichte add constraint kunden_berichte_status_check CHECK ((status = ANY (ARRAY['entwurf'::text, 'freigegeben'::text, 'versendet'::text, 'verworfen'::text])));
alter table public.kunden_berichtsplan add constraint kunden_berichtsplan_turnus_check CHECK ((turnus = ANY (ARRAY['monatlich'::text, 'quartalsweise'::text, 'aus'::text])));
alter table public.kunden_berichtsplan add constraint kunden_berichtsplan_vorlauf_tage_check CHECK (((vorlauf_tage >= 0) AND (vorlauf_tage <= 30)));
alter table public.kunden_kommunikation add constraint kommunikation_richtung_gueltig CHECK ((richtung = ANY (ARRAY['eingehend'::text, 'ausgehend'::text])));
alter table public.kunden_kommunikation add constraint kommunikation_zuordnung_gueltig CHECK ((zuordnung = ANY (ARRAY['offen'::text, 'sicher'::text, 'aus der Ablage'::text, 'verworfen'::text])));
alter table public.kunden_leistungen add constraint leistung_status_gueltig CHECK ((status = ANY (ARRAY['bestaetigt'::text, 'in_entwicklung'::text, 'entwicklung_abgeschlossen'::text, 'ausgerollt'::text, 'live'::text, 'pausiert'::text, 'beendet'::text])));
alter table public.leistung_aufgaben_vorlage add constraint vorlage_phase_gueltig CHECK ((phase = ANY (ARRAY['beistellung'::text, 'setup'::text, 'laufend'::text])));
alter table public.leistung_aufgaben_vorlage add constraint vorlage_turnus_gueltig CHECK (((turnus IS NULL) OR (turnus = ANY (ARRAY['woechentlich'::text, 'zweiwoechentlich'::text, 'monatlich'::text, 'zweimonatlich'::text, 'quartalsweise'::text]))));
alter table public.leistung_aufgaben_vorlage add constraint vorlage_turnus_nur_laufend CHECK (((turnus IS NULL) OR (phase = 'laufend'::text)));
alter table public.leistung_aufgaben_vorlage add constraint vorlage_verantwortlich_gueltig CHECK ((verantwortlich = ANY (ARRAY['kunde'::text, 'sunside'::text])));
alter table public.operations_zugang add constraint operations_zugang_rolle_check CHECK ((rolle = ANY (ARRAY['leitung'::text, 'mitarbeit'::text])));
alter table seo.massnahmen add constraint massnahmen_status_check CHECK ((status = ANY (ARRAY['offen'::text, 'in_arbeit'::text, 'erledigt'::text, 'verworfen'::text])));
alter table seo.massnahmen add constraint massnahmen_typ_check CHECK ((typ = ANY (ARRAY['ctr'::text, 'striking_distance'::text, 'verlust'::text, 'chance'::text, 'index'::text, 'kannibalisierung'::text, 'technik'::text, 'content'::text])));
alter table seo.properties add constraint properties_zuordnung_check CHECK ((zuordnung = ANY (ARRAY['auto'::text, 'ausnahme'::text, 'offen'::text, 'ignoriert'::text])));
alter table seo.status add constraint status_ampel_check CHECK ((ampel = ANY (ARRAY['gut'::text, 'stabil'::text, 'achtung'::text, 'problem'::text, 'zu_klein'::text])));

-- ===== Indizes =====
CREATE INDEX hot_leads_opener_id_idx ON public.hot_leads USING btree (opener_id);
CREATE INDEX hot_leads_reaktivierung_bearbeiter_id_idx ON public.hot_leads USING btree (reaktivierung_bearbeiter_id) WHERE (reaktivierung_bearbeiter_id IS NOT NULL);
CREATE UNIQUE INDEX idx_aufgabe_serie_periode ON public.kunden_aufgaben USING btree (serie_id, periode) WHERE (serie_id IS NOT NULL);
CREATE INDEX idx_aufgabe_sichtbar ON public.kunden_aufgaben USING btree (status, faellig_am) WHERE (geloescht_am IS NULL);
CREATE INDEX idx_aufgabe_zustaendig ON public.kunden_aufgaben USING btree (zustaendig_user_id, status) WHERE (status <> 'erledigt'::text);
CREATE INDEX idx_aufgaben_ereignisse ON public.aufgaben_ereignisse USING btree (aufgabe_id, erfasst_am DESC);
CREATE INDEX idx_aufgaben_meine ON public.kunden_aufgaben USING btree (zustaendig_user_id, faellig_am) WHERE (erledigt_am IS NULL);
CREATE INDEX idx_billing_contacts_hot_lead ON public.billing_contacts USING btree (hot_lead_id);
CREATE INDEX idx_billing_contacts_lexware ON public.billing_contacts USING btree (lexware_contact_id);
CREATE INDEX idx_billing_dunnings_invoice ON public.billing_dunnings USING btree (invoice_id);
CREATE INDEX idx_billing_invoices_due ON public.billing_invoices USING btree (due_date) WHERE (status = ANY (ARRAY['open'::text, 'overdue'::text]));
CREATE INDEX idx_billing_invoices_hot_lead ON public.billing_invoices USING btree (hot_lead_id);
CREATE INDEX idx_billing_invoices_lexware ON public.billing_invoices USING btree (lexware_invoice_id);
CREATE INDEX idx_billing_invoices_lexware_invoice_id ON public.billing_invoices USING btree (lexware_invoice_id) WHERE (lexware_invoice_id IS NOT NULL);
CREATE INDEX idx_billing_invoices_source ON public.billing_invoices USING btree (source);
CREATE INDEX idx_billing_invoices_source_date ON public.billing_invoices USING btree (source, voucher_date DESC);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices USING btree (status);
CREATE INDEX idx_billing_recurring_hot_lead ON public.billing_recurring USING btree (hot_lead_id);
CREATE INDEX idx_billing_recurring_next ON public.billing_recurring USING btree (next_invoice_date) WHERE (status = 'active'::text);
CREATE INDEX idx_billing_sync_log_hot_lead ON public.billing_sync_log USING btree (hot_lead_id);
CREATE INDEX idx_billing_sync_log_invoice ON public.billing_sync_log USING btree (invoice_id);
CREATE INDEX idx_billing_sync_log_ts ON public.billing_sync_log USING btree (ts DESC);
CREATE INDEX idx_email_templates_aktiv ON public.email_templates USING btree (aktiv);
CREATE INDEX idx_email_templates_kategorie ON public.email_templates USING btree (kategorie);
CREATE INDEX idx_follow_up_faellig ON public.follow_up_actions USING btree (faellig_am) WHERE (NOT erledigt);
CREATE INDEX idx_follow_up_hot_lead ON public.follow_up_actions USING btree (hot_lead_id);
CREATE INDEX idx_follow_up_kanban_status ON public.follow_up_actions USING btree (kanban_status);
CREATE INDEX idx_follow_up_typ ON public.follow_up_actions USING btree (typ);
CREATE INDEX idx_hot_lead_applications_closer ON public.hot_lead_applications USING btree (closer_id);
CREATE INDEX idx_hot_lead_applications_erstellt ON public.hot_lead_applications USING btree (erstellt_am DESC);
CREATE INDEX idx_hot_lead_applications_hot_lead ON public.hot_lead_applications USING btree (hot_lead_id);
CREATE INDEX idx_hot_lead_applications_status ON public.hot_lead_applications USING btree (status);
CREATE UNIQUE INDEX idx_hot_lead_applications_unique_pending ON public.hot_lead_applications USING btree (hot_lead_id, closer_id) WHERE (status = 'Offen'::hot_lead_application_status_type);
CREATE INDEX idx_hot_lead_attachments_lead ON public.hot_lead_attachments USING btree (hot_lead_id);
CREATE INDEX idx_hot_leads_billing_mode ON public.hot_leads USING btree (billing_mode) WHERE (billing_mode <> 'none'::text);
CREATE INDEX idx_hot_leads_closer ON public.hot_leads USING btree (closer_id);
CREATE INDEX idx_hot_leads_lead ON public.hot_leads USING btree (lead_id);
CREATE INDEX idx_hot_leads_no_show_setter ON public.hot_leads USING btree (setter_id, status, no_show_marked_at DESC) WHERE (status = 'Nicht erschienen'::text);
CREATE INDEX idx_hot_leads_setter ON public.hot_leads USING btree (setter_id);
CREATE INDEX idx_hot_leads_status ON public.hot_leads USING btree (status);
CREATE INDEX idx_hot_leads_status_billing ON public.hot_leads USING btree (status) WHERE (status = 'Abgeschlossen'::text);
CREATE INDEX idx_hot_leads_termin ON public.hot_leads USING btree (termin_beratungsgespraech);
CREATE INDEX idx_kommunikation_kunde ON public.kunden_kommunikation USING btree (hot_lead_id, gesendet_am DESC);
CREATE INDEX idx_kommunikation_offen ON public.kunden_kommunikation USING btree (zuordnung) WHERE (zuordnung = 'offen'::text);
CREATE INDEX idx_kommunikation_offen_domain ON public.kunden_kommunikation USING btree (gegenstelle_domain) WHERE (hot_lead_id IS NULL);
CREATE INDEX idx_kommunikation_thread ON public.kunden_kommunikation USING btree (thread_schluessel, gesendet_am);
CREATE INDEX idx_kunden_aufgaben_offen ON public.kunden_aufgaben USING btree (hot_lead_id, faellig_am) WHERE (erledigt_am IS NULL);
CREATE INDEX idx_kunden_ereignisse_kunde ON public.kunden_ereignisse USING btree (hot_lead_id, erfasst_am DESC);
CREATE INDEX idx_kunden_leistungen_status ON public.kunden_leistungen USING btree (status, leistung);
CREATE INDEX idx_lah_lead ON public.lead_assignment_history USING btree (lead_id);
CREATE INDEX idx_lah_open ON public.lead_assignment_history USING btree (lead_id) WHERE (removed_at IS NULL);
CREATE INDEX idx_lah_user ON public.lead_assignment_history USING btree (user_id);
CREATE INDEX idx_lead_archive_datum ON public.lead_archive USING btree (archiviert_am);
CREATE INDEX idx_lead_archive_lead ON public.lead_archive USING btree (lead_id);
CREATE INDEX idx_lead_archive_user ON public.lead_archive USING btree (user_id);
CREATE INDEX idx_lead_assignments_lead ON public.lead_assignments USING btree (lead_id);
CREATE INDEX idx_lead_assignments_user ON public.lead_assignments USING btree (user_id);
CREATE INDEX idx_lead_requests_erstellt ON public.lead_requests USING btree (erstellt_am);
CREATE INDEX idx_lead_requests_status ON public.lead_requests USING btree (status);
CREATE INDEX idx_lead_requests_user ON public.lead_requests USING btree (user_id);
CREATE INDEX idx_leads_bereits_kontaktiert ON public.leads USING btree (bereits_kontaktiert);
CREATE INDEX idx_leads_datum ON public.leads USING btree (datum);
CREATE INDEX idx_leads_ergebnis ON public.leads USING btree (ergebnis);
CREATE INDEX idx_leads_kategorie ON public.leads USING btree (kategorie);
CREATE INDEX idx_leads_land ON public.leads USING btree (land);
CREATE INDEX idx_leads_quelle ON public.leads USING btree (quelle);
CREATE INDEX idx_leads_wiedervorlage ON public.leads USING btree (wiedervorlage_datum);
CREATE INDEX idx_mapping_review_hot_lead ON public.billing_mapping_review USING btree (hot_lead_id);
CREATE INDEX idx_mapping_review_status ON public.billing_mapping_review USING btree (review_status);
CREATE INDEX idx_product_catalog_key ON public.product_catalog USING btree (produkt_key) WHERE (is_active = true);
CREATE INDEX idx_serie_aktiv ON public.aufgaben_serie USING btree (aktiv, turnus) WHERE aktiv;
CREATE UNIQUE INDEX idx_serie_je_vorlage ON public.aufgaben_serie USING btree (leistung_id, vorlage_id) WHERE ((leistung_id IS NOT NULL) AND (vorlage_id IS NOT NULL));
CREATE INDEX idx_serie_kunde ON public.aufgaben_serie USING btree (hot_lead_id);
CREATE INDEX idx_system_messages_empfaenger ON public.system_messages USING btree (empfaenger_id);
CREATE INDEX idx_system_messages_erstellt ON public.system_messages USING btree (erstellt_am);
CREATE INDEX idx_system_messages_gelesen ON public.system_messages USING btree (gelesen);
CREATE INDEX idx_system_messages_typ ON public.system_messages USING btree (typ);
CREATE INDEX idx_template_attachments_template ON public.email_template_attachments USING btree (template_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_email_geschaeftlich ON public.users USING btree (email_geschaeftlich);
CREATE INDEX idx_users_status ON public.users USING btree (status);
CREATE INDEX kunden_anfragen_lead_zeit_idx ON public.kunden_anfragen USING btree (hot_lead_id, eingegangen_am DESC);
CREATE INDEX kunden_berichte_status ON public.kunden_berichte USING btree (status, erzeugt_am DESC);
CREATE INDEX system_laeufe_name_zeit ON public.system_laeufe USING btree (name, gestartet_am DESC);
CREATE UNIQUE INDEX daily_totals_site_datum ON seo.daily_totals USING btree (site_url, datum);
CREATE INDEX idx_daily_totals_datum ON seo.daily_totals USING btree (datum DESC);
CREATE INDEX idx_massnahmen_status ON seo.massnahmen USING btree (status, prioritaet);
CREATE INDEX idx_page_snap_date ON seo.page_snapshots USING btree (snapshot_date DESC);
CREATE INDEX idx_properties_domain ON seo.properties USING btree (domain);
CREATE INDEX idx_query_snap_date ON seo.query_snapshots USING btree (snapshot_date DESC);
CREATE INDEX idx_query_snap_pos ON seo.query_snapshots USING btree (site_url, snapshot_date, "position");
CREATE INDEX idx_seo_properties_hot_lead ON seo.properties USING btree (hot_lead_id);
CREATE INDEX idx_status_date ON seo.status USING btree (snapshot_date DESC);
CREATE UNIQUE INDEX page_snapshots_schluessel ON seo.page_snapshots USING btree (site_url, snapshot_date, page);
CREATE UNIQUE INDEX query_snapshots_schluessel ON seo.query_snapshots USING btree (site_url, snapshot_date, query);

-- ===== Views =====

create or replace view public.hot_leads_with_users as
 SELECT hl.id,
    hl.lead_id,
    hl.unternehmen,
    hl.ansprechpartner_vorname,
    hl.ansprechpartner_nachname,
    hl.kategorie,
    hl.mail,
    hl.telefonnummer,
    hl.ort,
    hl.bundesland,
    hl.website,
    hl.termin_beratungsgespraech,
    hl.terminart,
    hl.meeting_link,
    hl.status,
    hl.setter_id,
    hl.closer_id,
    hl.setup,
    hl.retainer,
    hl.laufzeit,
    hl.prioritaet,
    hl.quelle,
    hl.monatliche_besuche,
    hl.mehrwert,
    hl.absprungrate,
    hl.anzahl_leads,
    hl.kunde_seit,
    hl.created_at,
    hl.updated_at,
    hl.airtable_id,
    hl.kommentar,
    hl.vertragsbestandteile,
    hl.paketname_individuell,
    hl.kurzbeschreibung,
    hl.leistungsbeschreibung,
    hl.attachments,
    hl.produkt_dienstleistung,
    setter.vor_nachname AS setter_name,
    closer.vor_nachname AS closer_name
   FROM hot_leads hl
     LEFT JOIN users setter ON hl.setter_id = setter.id
     LEFT JOIN users closer ON hl.closer_id = closer.id;

create or replace view public.leads_with_users as
 SELECT l.id,
    l.unternehmensname,
    l.stadt,
    l.land,
    l.kategorie,
    l.mail,
    l.website,
    l.telefonnummer,
    l.ansprechpartner_vorname,
    l.ansprechpartner_nachname,
    l.bereits_kontaktiert,
    l.datum,
    l.ergebnis,
    l.kommentar,
    l.wiedervorlage_datum,
    l.quelle,
    l.absprungrate,
    l.monatliche_besuche,
    l.anzahl_leads,
    l.mehrwert,
    l.created_at,
    l.updated_at,
    l.airtable_id,
    array_agg(u.id) FILTER (WHERE u.id IS NOT NULL) AS assigned_user_ids,
    array_agg(u.vor_nachname) FILTER (WHERE u.vor_nachname IS NOT NULL) AS assigned_user_names
   FROM leads l
     LEFT JOIN lead_assignments la ON l.id = la.lead_id
     LEFT JOIN users u ON la.user_id = u.id
  GROUP BY l.id;

create or replace view public.seo_uebersicht as
 SELECT p.site_url,
    p.kunde,
    p.domain,
    p.crm_lead_id,
    p.produkt,
    p.ist_seo,
    p.vertragsstart,
    p.arbeitsbeginn,
    p.zuordnung,
    p.aktiv,
    s.snapshot_date,
    s.ampel,
    s.aussage,
    s.clicks,
    s.impressions,
    s.achse_wachstum,
    s.achse_effizienz,
    s.achse_reichweite,
    s.achse_potenzial,
    ( SELECT count(*) AS count
           FROM seo.massnahmen m
          WHERE m.site_url = p.site_url AND (m.status = ANY (ARRAY['offen'::text, 'in_arbeit'::text]))) AS offene_massnahmen
   FROM seo.properties p
     LEFT JOIN LATERAL ( SELECT s2.site_url,
            s2.snapshot_date,
            s2.ampel,
            s2.score,
            s2.aussage,
            s2.achse_wachstum,
            s2.achse_effizienz,
            s2.achse_reichweite,
            s2.achse_potenzial,
            s2.kennzahlen,
            s2.erfasst_am,
            s2.clicks,
            s2.impressions
           FROM seo.status s2
          WHERE s2.site_url = p.site_url
          ORDER BY s2.snapshot_date DESC
         LIMIT 1) s ON true;

create or replace view public.unread_messages_count as
 SELECT empfaenger_id,
    count(*) AS unread_count
   FROM system_messages
  WHERE gelesen = false
  GROUP BY empfaenger_id;

create or replace view public.user_assignment_stats as
 SELECT u.id,
    u.vor_nachname,
    u.email,
    u.email_geschaeftlich,
    u.airtable_id,
    u.status,
    u.onboarding,
    count(la.lead_id) AS assignment_count
   FROM users u
     LEFT JOIN lead_assignments la ON la.user_id = u.id
  GROUP BY u.id;

create or replace view public.v_alarm_belege as
 SELECT b.hot_lead_id,
    hl.unternehmen,
    COALESCE(br.status, 'kein Vertragseintrag'::text) AS vertragsstatus,
    b.gesamt,
    b.letzte_anfrage::date AS letzte_anfrage,
    b.tage_still,
    round(r.schnitt, 1) AS schnitt_vorher,
    r.monate AS referenzmonate
   FROM ( SELECT kunden_anfragen.hot_lead_id,
            count(*) AS gesamt,
            max(kunden_anfragen.eingegangen_am) AS letzte_anfrage,
            now()::date - max(kunden_anfragen.eingegangen_am)::date AS tage_still
           FROM kunden_anfragen
          GROUP BY kunden_anfragen.hot_lead_id) b
     JOIN hot_leads hl ON hl.id = b.hot_lead_id
     LEFT JOIN billing_recurring br ON br.hot_lead_id = b.hot_lead_id
     LEFT JOIN ( SELECT x.hot_lead_id,
            avg(x.n) AS schnitt,
            count(*) AS monate
           FROM ( SELECT kunden_anfragen.hot_lead_id,
                    to_char(kunden_anfragen.eingegangen_am, 'YYYY-MM'::text) AS m,
                    count(*) AS n
                   FROM kunden_anfragen
                  WHERE kunden_anfragen.eingegangen_am >= (date_trunc('month'::text, now()) - '7 mons'::interval) AND kunden_anfragen.eingegangen_am < (date_trunc('month'::text, now()) - '1 mon'::interval)
                  GROUP BY kunden_anfragen.hot_lead_id, (to_char(kunden_anfragen.eingegangen_am, 'YYYY-MM'::text))) x
          GROUP BY x.hot_lead_id) r ON r.hot_lead_id = b.hot_lead_id;

create or replace view public.v_alarme_offen as
 SELECT a.id,
    a.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    a.typ,
    a.betrifft,
    a.erkannt_am,
    a.gesendet_am,
    a.fehler,
    now()::date - a.erkannt_am::date AS tage_offen,
    b.tage_still,
    b.schnitt_vorher,
    b.letzte_anfrage,
    b.vertragsstatus,
    kl.status AS chatbot_status,
    kl.live_seit AS chatbot_live_seit
   FROM kunden_alarme a
     JOIN hot_leads hl ON hl.id = a.hot_lead_id
     LEFT JOIN v_alarm_belege b ON b.hot_lead_id = a.hot_lead_id
     LEFT JOIN kunden_leistungen kl ON kl.hot_lead_id = a.hot_lead_id AND kl.leistung = 'chatbot'::text
  WHERE a.reagiert_am IS NULL;

create or replace view public.v_ampel_empfehlung as
 WITH lage AS (
         SELECT k.hot_lead_id,
            k.ampel AS ampel_heute,
            b_1.tage_still,
            b_1.schnitt_vorher,
            b_1.gesamt,
            d.anfragen_28t,
            d.anfragen_vor,
            ( SELECT count(*) AS count
                   FROM kunden_alarme al
                  WHERE al.hot_lead_id = k.hot_lead_id AND al.reagiert_am IS NULL) AS alarme_offen,
            ( SELECT count(*) AS count
                   FROM kunden_leistungen kl
                  WHERE kl.hot_lead_id = k.hot_lead_id AND kl.leistung = 'chatbot'::text AND kl.status = 'ausgerollt'::text) AS bot_nie_live,
            ( SELECT count(*) AS count
                   FROM kunden_leistungen kl
                  WHERE kl.hot_lead_id = k.hot_lead_id) AS leistungen,
            ( SELECT min(kl.live_seit) AS min
                   FROM kunden_leistungen kl
                  WHERE kl.hot_lead_id = k.hot_lead_id AND kl.status = 'live'::text) AS aeltestes_live,
            ( SELECT count(*) AS count
                   FROM kunden_aufgaben a
                  WHERE a.hot_lead_id = k.hot_lead_id AND a.erledigt_am IS NULL AND a.faellig_am < CURRENT_DATE) AS aufgaben_ueberfaellig,
            ( SELECT count(*) AS count
                   FROM kunden_aufgaben a
                  WHERE a.hot_lead_id = k.hot_lead_id AND a.erledigt_am IS NULL AND a.verantwortlich = 'kunde'::text AND a.created_at < (now() - '30 days'::interval)) AS beistellung_lange_offen
           FROM kunden k
             LEFT JOIN v_alarm_belege b_1 ON b_1.hot_lead_id = k.hot_lead_id
             LEFT JOIN v_kunde_dashboard d ON d.hot_lead_id = k.hot_lead_id
        ), bewertet AS (
         SELECT l.hot_lead_id,
            l.ampel_heute,
            l.tage_still,
            l.schnitt_vorher,
            l.gesamt,
            l.anfragen_28t,
            l.anfragen_vor,
            l.alarme_offen,
            l.bot_nie_live,
            l.leistungen,
            l.aeltestes_live,
            l.aufgaben_ueberfaellig,
            l.beistellung_lange_offen,
            l.anfragen_vor >= 10 AND l.anfragen_28t::numeric < (l.anfragen_vor::numeric * 0.5) AND l.aeltestes_live IS NOT NULL AND l.aeltestes_live < (now() - '60 days'::interval) AS eingebrochen
           FROM lage l
        )
 SELECT hot_lead_id,
    ampel_heute,
        CASE
            WHEN alarme_offen > 0 THEN 'rot'::text
            WHEN eingebrochen THEN 'rot'::text
            WHEN leistungen = 0 THEN 'gelb'::text
            WHEN bot_nie_live > 0 THEN 'gelb'::text
            WHEN beistellung_lange_offen > 0 THEN 'gelb'::text
            WHEN aufgaben_ueberfaellig > 0 THEN 'gelb'::text
            ELSE 'gruen'::text
        END AS empfehlung,
        CASE
            WHEN alarme_offen > 0 THEN format('%s unbearbeiteter Alarm: seit %s Tagen keine Anfrage (davor Ø %s/Monat).'::text, alarme_offen, tage_still, COALESCE(schnitt_vorher::text, '—'::text))
            WHEN eingebrochen THEN format('Anfragen um %s Prozent gefallen: %s in 28 Tagen gegen %s davor.'::text, round((anfragen_vor - anfragen_28t)::numeric * 100.0 / anfragen_vor::numeric), anfragen_28t, anfragen_vor)
            WHEN leistungen = 0 THEN 'Keine Leistung hinterlegt - unklar, was dieser Kunde eigentlich bekommt.'::text
            WHEN bot_nie_live > 0 THEN 'Chatbot gilt als ausgerollt, hat aber nie eine Anfrage geliefert. Erst pruefen, ob er eingebunden ist.'::text
            WHEN beistellung_lange_offen > 0 THEN format('%s Beistellung(en) des Kunden seit ueber 30 Tagen offen - das Onboarding steht.'::text, beistellung_lange_offen)
            WHEN aufgaben_ueberfaellig > 0 THEN format('%s Aufgabe(n) ueberfaellig.'::text, aufgaben_ueberfaellig)
            ELSE 'Keine Auffaelligkeit in Leistung, Aufgaben oder Anfragelage.'::text
        END AS begruendung,
    tage_still,
    schnitt_vorher,
    alarme_offen,
    bot_nie_live,
    aufgaben_ueberfaellig,
    beistellung_lange_offen,
    aeltestes_live,
    anfragen_28t,
    anfragen_vor,
    eingebrochen
   FROM bewertet b;

create or replace view public.v_anfragen_alarm as
 WITH basis AS (
         SELECT kunden_anfragen.hot_lead_id,
            count(*) AS gesamt,
            max(kunden_anfragen.eingegangen_am) AS letzte_anfrage,
            now()::date - max(kunden_anfragen.eingegangen_am)::date AS tage_still
           FROM kunden_anfragen
          GROUP BY kunden_anfragen.hot_lead_id
        ), ref AS (
         SELECT x.hot_lead_id,
            avg(x.n) AS schnitt,
            count(*) AS monate
           FROM ( SELECT kunden_anfragen.hot_lead_id,
                    to_char(kunden_anfragen.eingegangen_am, 'YYYY-MM'::text) AS m,
                    count(*) AS n
                   FROM kunden_anfragen
                  WHERE kunden_anfragen.eingegangen_am >= (date_trunc('month'::text, now()) - '7 mons'::interval) AND kunden_anfragen.eingegangen_am < (date_trunc('month'::text, now()) - '1 mon'::interval)
                  GROUP BY kunden_anfragen.hot_lead_id, (to_char(kunden_anfragen.eingegangen_am, 'YYYY-MM'::text))) x
          GROUP BY x.hot_lead_id
        ), vormonat AS (
         SELECT kunden_anfragen.hot_lead_id,
            count(*) AS n
           FROM kunden_anfragen
          WHERE to_char(kunden_anfragen.eingegangen_am, 'YYYY-MM'::text) = to_char(date_trunc('month'::text, now()) - '1 mon'::interval, 'YYYY-MM'::text)
          GROUP BY kunden_anfragen.hot_lead_id
        )
 SELECT b.hot_lead_id,
    hl.unternehmen,
    hl.mail,
    COALESCE(br.status, 'kein_vertragseintrag'::text) AS vertragsstatus,
        CASE
            WHEN COALESCE(v.n, 0::bigint) = 0 AND r.monate >= 3 AND r.schnitt >= 3::numeric THEN 'einbruch'::text
            WHEN b.tage_still >= 60 AND b.gesamt >= 3 THEN 'stille'::text
            ELSE NULL::text
        END AS typ,
    to_char(date_trunc('month'::text, now()) - '1 mon'::interval, 'YYYY-MM'::text) AS betrifft,
    b.letzte_anfrage,
    b.tage_still,
    b.gesamt,
    round(r.schnitt, 1) AS schnitt_vorher,
    r.monate AS referenzmonate,
    COALESCE(v.n, 0::bigint) AS anfragen_vormonat
   FROM basis b
     JOIN hot_leads hl ON hl.id = b.hot_lead_id
     LEFT JOIN ref r ON r.hot_lead_id = b.hot_lead_id
     LEFT JOIN vormonat v ON v.hot_lead_id = b.hot_lead_id
     LEFT JOIN billing_recurring br ON br.hot_lead_id = b.hot_lead_id
  WHERE COALESCE(v.n, 0::bigint) = 0 AND r.monate >= 3 AND r.schnitt >= 3::numeric OR b.tage_still >= 60 AND b.gesamt >= 3;

create or replace view public.v_aufgaben as
 SELECT a.id,
    a.hot_lead_id,
    a.leistung_id,
    a.serie_id,
    a.vorlage_id,
        CASE
            WHEN a.hot_lead_id IS NULL THEN NULL::text
            ELSE kurzname(hl.unternehmen)
        END AS kunde,
    k.ampel AS kunden_ampel,
    kl.leistung,
    lk.anzeigename AS leistung_name,
    a.titel,
    a.beschreibung,
    a.phase,
    a.periode,
    a.verantwortlich,
    a.prioritaet,
    a.quelle,
    a.status,
    a.blockiert_grund,
    a.wiedervorlage_am,
    a.faellig_am,
    a.begonnen_am,
    a.erledigt_am,
    a.ergebnis,
    a.zustaendig_user_id,
    zu.vor_nachname AS zustaendig,
    a.erstellt_von_user_id,
    er.vor_nachname AS erstellt_von,
    a.erledigt_von,
    ev.vor_nachname AS erledigt_von_name,
    a.created_at,
    s.turnus,
    s.menge_text,
        CASE
            WHEN a.status = 'erledigt'::text OR a.faellig_am IS NULL THEN NULL::integer
            ELSE a.faellig_am - CURRENT_DATE
        END AS tage_bis_faellig,
    a.status <> 'erledigt'::text AND a.faellig_am IS NOT NULL AND a.faellig_am < CURRENT_DATE AS ueberfaellig,
    a.status = 'blockiert'::text AND a.wiedervorlage_am IS NOT NULL AND a.wiedervorlage_am <= CURRENT_DATE AS wiedervorlage_faellig,
    ( SELECT count(*) AS count
           FROM aufgaben_ereignisse e
          WHERE e.aufgabe_id = a.id AND e.art = 'kommentar'::text) AS kommentare
   FROM kunden_aufgaben a
     LEFT JOIN hot_leads hl ON hl.id = a.hot_lead_id
     LEFT JOIN kunden k ON k.hot_lead_id = a.hot_lead_id
     LEFT JOIN kunden_leistungen kl ON kl.id = a.leistung_id
     LEFT JOIN leistungskatalog lk ON lk.schluessel = kl.leistung
     LEFT JOIN aufgaben_serie s ON s.id = a.serie_id
     LEFT JOIN users zu ON zu.id = a.zustaendig_user_id
     LEFT JOIN users er ON er.id = a.erstellt_von_user_id
     LEFT JOIN users ev ON ev.id = a.erledigt_von
  WHERE a.geloescht_am IS NULL;

create or replace view public.v_aufgaben_verlauf as
 SELECT e.id,
    e.aufgabe_id,
    e.art,
    e.von_wert,
    e.nach_wert,
    e.bemerkung,
    e.akteur,
    u.vor_nachname AS akteur_name,
    e.erfasst_am
   FROM aufgaben_ereignisse e
     LEFT JOIN users u ON u.id = e.akteur;

create or replace view public.v_auswertung_monat as
 WITH monate AS (
         SELECT generate_series(date_trunc('month'::text, CURRENT_DATE - '1 year 5 mons'::interval)::timestamp with time zone, date_trunc('month'::text, CURRENT_DATE::timestamp with time zone), '1 mon'::interval)::date AS monat
        ), kundschaft AS (
         SELECT k.hot_lead_id,
            kurzname(hl.unternehmen) AS kunde,
            k.ampel
           FROM kunden k
             JOIN hot_leads hl ON hl.id = k.hot_lead_id
        ), mails AS (
         SELECT kunden_kommunikation.hot_lead_id,
            date_trunc('month'::text, kunden_kommunikation.gesendet_am)::date AS monat,
            count(*) FILTER (WHERE kunden_kommunikation.richtung = 'eingehend'::text) AS mails_ein,
            count(*) FILTER (WHERE kunden_kommunikation.richtung = 'ausgehend'::text) AS mails_aus
           FROM kunden_kommunikation
          WHERE kunden_kommunikation.hot_lead_id IS NOT NULL AND kunden_kommunikation.ist_systemmail = false
          GROUP BY kunden_kommunikation.hot_lead_id, (date_trunc('month'::text, kunden_kommunikation.gesendet_am)::date)
        ), anfragen AS (
         SELECT kunden_anfragen.hot_lead_id,
            date_trunc('month'::text, kunden_anfragen.eingegangen_am)::date AS monat,
            count(*) AS anfragen
           FROM kunden_anfragen
          GROUP BY kunden_anfragen.hot_lead_id, (date_trunc('month'::text, kunden_anfragen.eingegangen_am)::date)
        ), seo AS (
         SELECT p.hot_lead_id,
            date_trunc('month'::text, d.datum::timestamp with time zone)::date AS monat,
            sum(d.clicks) AS klicks,
            sum(d.impressions) AS impressionen
           FROM seo.daily_totals d
             JOIN seo.properties p ON p.site_url = d.site_url
          WHERE p.hot_lead_id IS NOT NULL
          GROUP BY p.hot_lead_id, (date_trunc('month'::text, d.datum::timestamp with time zone)::date)
        ), beginn AS (
         SELECT x.hot_lead_id,
            min(x.monat) FILTER (WHERE x.quelle = 'mail'::text) AS mails_ab,
            min(x.monat) FILTER (WHERE x.quelle = 'anfrage'::text) AS anfragen_ab,
            min(x.monat) FILTER (WHERE x.quelle = 'seo'::text) AS seo_ab
           FROM ( SELECT mails.hot_lead_id,
                    mails.monat,
                    'mail'::text AS quelle
                   FROM mails
                UNION ALL
                 SELECT anfragen.hot_lead_id,
                    anfragen.monat,
                    'anfrage'::text
                   FROM anfragen
                UNION ALL
                 SELECT seo.hot_lead_id,
                    seo.monat,
                    'seo'::text
                   FROM seo) x
          GROUP BY x.hot_lead_id
        )
 SELECT ku.hot_lead_id,
    ku.kunde,
    ku.ampel,
    m.monat,
    to_char(m.monat::timestamp with time zone, 'MM/YY'::text) AS monat_kurz,
        CASE
            WHEN b.mails_ab IS NOT NULL AND m.monat >= b.mails_ab THEN COALESCE(ma.mails_ein, 0::bigint)
            ELSE NULL::bigint
        END AS mails_ein,
        CASE
            WHEN b.mails_ab IS NOT NULL AND m.monat >= b.mails_ab THEN COALESCE(ma.mails_aus, 0::bigint)
            ELSE NULL::bigint
        END AS mails_aus,
        CASE
            WHEN b.anfragen_ab IS NOT NULL AND m.monat >= b.anfragen_ab THEN COALESCE(an.anfragen, 0::bigint)
            ELSE NULL::bigint
        END AS anfragen,
        CASE
            WHEN b.seo_ab IS NOT NULL AND m.monat >= b.seo_ab THEN COALESCE(se.klicks, 0::bigint)
            ELSE NULL::bigint
        END AS klicks,
        CASE
            WHEN b.seo_ab IS NOT NULL AND m.monat >= b.seo_ab THEN COALESCE(se.impressionen, 0::bigint)
            ELSE NULL::bigint
        END AS impressionen
   FROM kundschaft ku
     CROSS JOIN monate m
     LEFT JOIN beginn b ON b.hot_lead_id = ku.hot_lead_id
     LEFT JOIN mails ma ON ma.hot_lead_id = ku.hot_lead_id AND ma.monat = m.monat
     LEFT JOIN anfragen an ON an.hot_lead_id = ku.hot_lead_id AND an.monat = m.monat
     LEFT JOIN seo se ON se.hot_lead_id = ku.hot_lead_id AND se.monat = m.monat
  ORDER BY ku.kunde, m.monat;

create or replace view public.v_berichte as
 SELECT b.id,
    b.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    b.zeitraum_von,
    b.zeitraum_bis,
    b.status,
    b.erzeugt_am,
    b.freigegeben_am,
    u.vor_nachname AS freigegeben_von_name,
    b.versendet_am,
    b.versendet_an,
    b.verworfen_grund,
    b.zusammenfassung,
    b.interne_notiz,
    b.pdf_pfad IS NOT NULL AS hat_pdf,
    ((b.daten -> 'sichtbarkeit'::text) ->> 'klicks'::text)::integer AS klicks,
    ((b.daten -> 'sichtbarkeit'::text) ->> 'klicks_vorher'::text)::integer AS klicks_vorher,
    ((b.daten -> 'sichtbarkeit'::text) ->> 'position'::text)::numeric AS "position",
    ((b.daten -> 'sichtbarkeit'::text) ->> 'tage_mit_daten'::text)::integer AS tage_mit_daten,
    b.zeitraum_bis - b.zeitraum_von + 1 AS tage_im_zeitraum,
    p.empfaenger,
    p.turnus,
    COALESCE(array_length(p.empfaenger, 1), 0) = 0 AS ohne_empfaenger
   FROM kunden_berichte b
     JOIN hot_leads hl ON hl.id = b.hot_lead_id
     LEFT JOIN users u ON u.id = b.freigegeben_von
     LEFT JOIN kunden_berichtsplan p ON p.hot_lead_id = b.hot_lead_id;

create or replace view public.v_berichte_offen as
 SELECT id,
    hot_lead_id,
    kunde,
    zeitraum_von,
    zeitraum_bis,
    status,
    erzeugt_am,
    freigegeben_am,
    freigegeben_von_name,
    versendet_am,
    versendet_an,
    verworfen_grund,
    zusammenfassung,
    interne_notiz,
    hat_pdf,
    klicks,
    klicks_vorher,
    "position",
    tage_mit_daten,
    tage_im_zeitraum,
    empfaenger,
    turnus,
    ohne_empfaenger
   FROM v_berichte
  WHERE status = ANY (ARRAY['entwurf'::text, 'freigegeben'::text])
  ORDER BY erzeugt_am DESC;

create or replace view public.v_kunde_dashboard as
 WITH fenster AS (
         SELECT CURRENT_DATE - 3 AS bis,
            CURRENT_DATE - 3 - 27 AS von,
            CURRENT_DATE - 3 - 28 AS vor_bis,
            CURRENT_DATE - 3 - 55 AS vor_von
        ), seo_akt AS (
         SELECT p.hot_lead_id,
            p.site_url,
            p.kunde AS seo_name,
            sum(d.clicks) FILTER (WHERE d.datum >= f.von AND d.datum <= f.bis) AS clicks_28t,
            sum(d.clicks) FILTER (WHERE d.datum >= f.vor_von AND d.datum <= f.vor_bis) AS clicks_vor,
            sum(d.impressions) FILTER (WHERE d.datum >= f.von AND d.datum <= f.bis) AS impressionen_28t
           FROM seo.properties p
             CROSS JOIN fenster f
             LEFT JOIN seo.daily_totals d ON d.site_url = p.site_url
          WHERE p.hot_lead_id IS NOT NULL AND p.aktiv
          GROUP BY p.hot_lead_id, p.site_url, p.kunde
        ), seo_status AS (
         SELECT DISTINCT ON (status.site_url) status.site_url,
            status.ampel,
            status.score,
            status.aussage,
            status.snapshot_date
           FROM seo.status
          ORDER BY status.site_url, status.snapshot_date DESC
        ), anfragen AS (
         SELECT a_1.hot_lead_id,
            count(*) FILTER (WHERE a_1.eingegangen_am::date >= f.von AND a_1.eingegangen_am::date <= f.bis) AS anfragen_28t,
            count(*) FILTER (WHERE a_1.eingegangen_am::date >= f.vor_von AND a_1.eingegangen_am::date <= f.vor_bis) AS anfragen_vor
           FROM kunden_anfragen a_1
             CROSS JOIN fenster f
          GROUP BY a_1.hot_lead_id
        )
 SELECT k.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    ku.ampel,
    ku.phase,
    s.site_url,
    s.clicks_28t,
    s.clicks_vor,
        CASE
            WHEN COALESCE(s.clicks_vor, 0::bigint) = 0 THEN NULL::numeric
            ELSE round((s.clicks_28t - s.clicks_vor)::numeric * 100.0 / s.clicks_vor::numeric)
        END AS klicks_veraenderung,
    s.impressionen_28t,
    st.ampel AS seo_ampel,
    st.aussage AS seo_aussage,
    ( SELECT count(*) AS count
           FROM seo.massnahmen m
          WHERE m.site_url = s.site_url AND m.status = 'offen'::text) AS massnahmen_offen,
    COALESCE(a.anfragen_28t, 0::bigint) AS anfragen_28t,
    COALESCE(a.anfragen_vor, 0::bigint) AS anfragen_vor,
        CASE
            WHEN COALESCE(a.anfragen_vor, 0::bigint) = 0 THEN NULL::numeric
            ELSE round((a.anfragen_28t - a.anfragen_vor)::numeric * 100.0 / a.anfragen_vor::numeric)
        END AS anfragen_veraenderung,
    ( SELECT count(*) AS count
           FROM kunden_leistungen l
          WHERE l.hot_lead_id = k.hot_lead_id AND l.leistung = 'website_seo'::text) AS hat_seo_produkt
   FROM kunden k
     JOIN hot_leads hl ON hl.id = k.hot_lead_id
     JOIN kunden ku ON ku.hot_lead_id = k.hot_lead_id
     LEFT JOIN seo_akt s ON s.hot_lead_id = k.hot_lead_id
     LEFT JOIN seo_status st ON st.site_url = s.site_url
     LEFT JOIN anfragen a ON a.hot_lead_id = k.hot_lead_id;

create or replace view public.v_kunden_uebersicht as
 SELECT k.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    hl.unternehmen AS kunde_voll,
    k.phase,
    k.ampel,
    k.ampel_grund,
    COALESCE(br.status, 'kein Vertragseintrag'::text) AS zahlung,
    ( SELECT string_agg((lk.anzeigename || ' · '::text) || kl.status, ' | '::text ORDER BY lk.sortierung) AS string_agg
           FROM kunden_leistungen kl
             JOIN leistungskatalog lk ON lk.schluessel = kl.leistung
          WHERE kl.hot_lead_id = k.hot_lead_id) AS leistungen,
    ( SELECT count(*) AS count
           FROM kunden_leistungen kl
          WHERE kl.hot_lead_id = k.hot_lead_id AND kl.status = 'live'::text) AS leistungen_live,
    ( SELECT count(*) AS count
           FROM kunden_leistungen kl
          WHERE kl.hot_lead_id = k.hot_lead_id AND kl.bestaetigt_am IS NULL) AS leistungen_unbestaetigt,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.hot_lead_id = k.hot_lead_id AND a.erledigt_am IS NULL) AS aufgaben_offen,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.hot_lead_id = k.hot_lead_id AND a.erledigt_am IS NULL AND a.verantwortlich = 'kunde'::text) AS wartet_auf_kunde,
    ( SELECT count(*) AS count
           FROM kunden_alarme al
          WHERE al.hot_lead_id = k.hot_lead_id AND al.reagiert_am IS NULL) AS alarme_offen,
    b.letzte_anfrage,
    b.tage_still,
    b.gesamt AS anfragen_gesamt,
    b.schnitt_vorher,
    hl.mail AS kontakt_mail
   FROM kunden k
     JOIN hot_leads hl ON hl.id = k.hot_lead_id
     LEFT JOIN billing_recurring br ON br.hot_lead_id = k.hot_lead_id
     LEFT JOIN v_alarm_belege b ON b.hot_lead_id = k.hot_lead_id;

create or replace view public.v_leistungen as
 SELECT kl.id,
    kl.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    k.ampel AS kunden_ampel,
    kl.leistung,
    lk.anzeigename AS leistung_name,
    kl.status,
    kl.bestaetigt_am,
    kl.live_seit,
    kl.beendet_am,
    kl.notiz,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.leistung_id = kl.id AND a.geloescht_am IS NULL) AS aufgaben_gesamt,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.leistung_id = kl.id AND a.geloescht_am IS NULL AND a.status <> 'erledigt'::text) AS aufgaben_offen,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.leistung_id = kl.id AND a.geloescht_am IS NULL AND a.status <> 'erledigt'::text AND a.faellig_am < CURRENT_DATE) AS aufgaben_ueberfaellig,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.leistung_id = kl.id AND a.geloescht_am IS NULL AND a.status = 'blockiert'::text) AS aufgaben_blockiert,
    ( SELECT count(*) AS count
           FROM aufgaben_serie s
          WHERE s.leistung_id = kl.id AND s.aktiv) AS serien,
    ( SELECT max(e.erfasst_am) AS max
           FROM kunden_ereignisse e
          WHERE e.leistung_id = kl.id AND e.art = 'status'::text) AS letzter_wechsel,
    CURRENT_DATE - COALESCE(( SELECT max(e.erfasst_am)::date AS max
           FROM kunden_ereignisse e
          WHERE e.leistung_id = kl.id AND e.art = 'status'::text), kl.bestaetigt_am::date) AS tage_im_status
   FROM kunden_leistungen kl
     JOIN hot_leads hl ON hl.id = kl.hot_lead_id
     LEFT JOIN kunden k ON k.hot_lead_id = kl.hot_lead_id
     LEFT JOIN leistungskatalog lk ON lk.schluessel = kl.leistung;

create or replace view public.v_mail_prioritaet as
 WITH letzte_antwort AS (
         SELECT kunden_kommunikation.thread_schluessel,
            max(kunden_kommunikation.gesendet_am) AS antwort_am
           FROM kunden_kommunikation
          WHERE kunden_kommunikation.richtung = 'ausgehend'::text
          GROUP BY kunden_kommunikation.thread_schluessel
        ), offen AS (
         SELECT m.id,
            m.hot_lead_id,
            m.richtung,
            m.absender,
            m.empfaenger,
            m.betreff,
            m.inhalt,
            m.gesendet_am,
            m.message_id,
            m.in_reply_to,
            m.thread_schluessel,
            m.quelle,
            m.ist_systemmail,
            m.zuordnung,
            m.klassifikation,
            m.klassifiziert_am,
            m.created_at,
            m.gegenstelle_domain,
            m.ordner,
            now()::date - m.gesendet_am::date AS tage
           FROM kunden_kommunikation m
             LEFT JOIN letzte_antwort a ON a.thread_schluessel = m.thread_schluessel
          WHERE m.richtung = 'eingehend'::text AND m.ist_systemmail = false AND m.hot_lead_id IS NOT NULL AND (a.antwort_am IS NULL OR m.gesendet_am > a.antwort_am)
        ), faden AS (
         SELECT o.id,
            o.hot_lead_id,
            o.richtung,
            o.absender,
            o.empfaenger,
            o.betreff,
            o.inhalt,
            o.gesendet_am,
            o.message_id,
            o.in_reply_to,
            o.thread_schluessel,
            o.quelle,
            o.ist_systemmail,
            o.zuordnung,
            o.klassifikation,
            o.klassifiziert_am,
            o.created_at,
            o.gegenstelle_domain,
            o.ordner,
            o.tage,
            count(*) OVER (PARTITION BY o.thread_schluessel) AS im_faden,
            max(o.tage) OVER (PARTITION BY o.thread_schluessel) AS wartet_seit,
            row_number() OVER (PARTITION BY o.thread_schluessel ORDER BY o.gesendet_am DESC) AS rang
           FROM offen o
        )
 SELECT f.id,
    f.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    k.ampel AS kunden_ampel,
    f.betreff,
    f.absender,
    f.gesendet_am,
    f.wartet_seit AS tage_offen,
    f.im_faden,
    false AS hat_antwort,
    f.klassifikation,
    COALESCE(f.klassifikation ->> 'zusammenfassung'::text, "left"(COALESCE(f.inhalt, ''::text), 240)) AS auszug,
    (f.klassifikation ->> 'zusammenfassung'::text) IS NOT NULL AS ausgewertet,
        CASE
            WHEN f.wartet_seit <= 1 THEN 25
            WHEN f.wartet_seit <= 5 THEN 55
            WHEN f.wartet_seit <= 21 THEN 45
            WHEN f.wartet_seit <= 60 THEN 25
            ELSE 5
        END +
        CASE
            WHEN k.ampel = 'rot'::text THEN 20
            WHEN k.ampel = 'gelb'::text THEN 10
            ELSE 0
        END +
        CASE
            WHEN (f.klassifikation ->> 'dringlichkeit'::text) = 'hoch'::text THEN 25
            WHEN (f.klassifikation ->> 'dringlichkeit'::text) = 'mittel'::text THEN 10
            ELSE 0
        END +
        CASE
            WHEN ((f.klassifikation -> 'aufgabe'::text) ->> 'titel'::text) IS NOT NULL THEN 15
            ELSE 0
        END +
        CASE
            WHEN (f.klassifikation ->> 'stimmung'::text) = ANY (ARRAY['kritisch'::text, 'veraergert'::text]) THEN 20
            ELSE 0
        END +
        CASE
            WHEN f.im_faden > 1 THEN 10
            ELSE 0
        END AS punkte,
        CASE
            WHEN f.im_faden > 1 THEN ((f.im_faden || ' Nachrichten offen, älteste seit '::text) || f.wartet_seit) || ' Tagen'::text
            WHEN f.wartet_seit = 0 THEN 'heute eingegangen'::text
            WHEN f.wartet_seit = 1 THEN 'gestern eingegangen'::text
            ELSE ('unbeantwortet seit '::text || f.wartet_seit) || ' Tagen'::text
        END AS grund
   FROM faden f
     JOIN hot_leads hl ON hl.id = f.hot_lead_id
     LEFT JOIN kunden k ON k.hot_lead_id = f.hot_lead_id
  WHERE f.rang = 1 AND f.wartet_seit <= 90
  ORDER BY (
        CASE
            WHEN f.wartet_seit <= 1 THEN 25
            WHEN f.wartet_seit <= 5 THEN 55
            WHEN f.wartet_seit <= 21 THEN 45
            WHEN f.wartet_seit <= 60 THEN 25
            ELSE 5
        END +
        CASE
            WHEN k.ampel = 'rot'::text THEN 20
            WHEN k.ampel = 'gelb'::text THEN 10
            ELSE 0
        END +
        CASE
            WHEN (f.klassifikation ->> 'dringlichkeit'::text) = 'hoch'::text THEN 25
            WHEN (f.klassifikation ->> 'dringlichkeit'::text) = 'mittel'::text THEN 10
            ELSE 0
        END +
        CASE
            WHEN ((f.klassifikation -> 'aufgabe'::text) ->> 'titel'::text) IS NOT NULL THEN 15
            ELSE 0
        END +
        CASE
            WHEN (f.klassifikation ->> 'stimmung'::text) = ANY (ARRAY['kritisch'::text, 'veraergert'::text]) THEN 20
            ELSE 0
        END +
        CASE
            WHEN f.im_faden > 1 THEN 10
            ELSE 0
        END) DESC, f.gesendet_am DESC;

create or replace view public.v_onboarding_report as
 SELECT a.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    lk.anzeigename AS leistung,
        CASE a.phase
            WHEN 'beistellung'::text THEN '1 · Was wir vom Kunden brauchen'::text
            WHEN 'setup'::text THEN '2 · Einrichtung'::text
            WHEN 'laufend'::text THEN '3 · Laufend'::text
            ELSE NULL::text
        END AS abschnitt,
    a.titel AS aufgabe,
        CASE
            WHEN a.erledigt_am IS NOT NULL THEN 'Erledigt'::text
            WHEN a.faellig_am < CURRENT_DATE THEN 'Überfällig'::text
            ELSE 'Offen'::text
        END AS status,
        CASE a.verantwortlich
            WHEN 'kunde'::text THEN 'Kunde'::text
            WHEN 'sunside'::text THEN COALESCE(u.vor_nachname, 'Sunside AI'::text)
            ELSE NULL::text
        END AS verantwortlich,
    COALESCE(a.ergebnis, a.beschreibung) AS notizen,
    a.faellig_am,
    a.erledigt_am,
    v.reihenfolge
   FROM kunden_aufgaben a
     JOIN hot_leads hl ON hl.id = a.hot_lead_id
     LEFT JOIN kunden_leistungen kl ON kl.id = a.leistung_id
     LEFT JOIN leistungskatalog lk ON lk.schluessel = kl.leistung
     LEFT JOIN leistung_aufgaben_vorlage v ON v.id = a.vorlage_id
     LEFT JOIN users u ON u.id = a.zustaendig_user_id
  ORDER BY a.hot_lead_id, lk.sortierung, a.phase, (COALESCE(v.reihenfolge, 999));

create or replace view public.v_operations_nutzer as
 SELECT u.id,
    u.vor_nachname,
    u.vorname,
    u.email,
    z.rolle
   FROM operations_zugang z
     JOIN users u ON u.id = z.user_id
  WHERE z.aktiv AND u.status = true
  ORDER BY u.vor_nachname;

create or replace view public.v_serien as
 SELECT s.id,
    s.hot_lead_id,
    kurzname(hl.unternehmen) AS kunde,
    s.leistung_id,
    kl.leistung,
    lk.anzeigename AS leistung_name,
    kl.status AS leistung_status,
    s.titel,
    s.turnus,
    s.faellig_am_tag,
    s.vorlauf_tage,
    s.menge_text,
    s.verantwortlich,
    s.prioritaet,
    s.zustaendig_user_id,
    u.vor_nachname AS zustaendig,
    s.aktiv,
    s.pausiert_bis,
    s.laeuft_ab_am,
    s.notiz,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.serie_id = s.id) AS erzeugt_gesamt,
    ( SELECT count(*) AS count
           FROM kunden_aufgaben a
          WHERE a.serie_id = s.id AND a.status <> 'erledigt'::text) AS davon_offen,
    ( SELECT max(a.periode) AS max
           FROM kunden_aufgaben a
          WHERE a.serie_id = s.id) AS letzte_periode,
        CASE
            WHEN NOT s.aktiv THEN 'beendet'::text
            WHEN s.pausiert_bis IS NOT NULL AND s.pausiert_bis >= CURRENT_DATE THEN 'pausiert'::text
            WHEN s.leistung_id IS NOT NULL AND (kl.status <> ALL (ARRAY['live'::text, 'ausgerollt'::text, 'entwicklung_abgeschlossen'::text])) THEN 'ruht mit der Leistung'::text
            ELSE 'läuft'::text
        END AS zustand
   FROM aufgaben_serie s
     LEFT JOIN hot_leads hl ON hl.id = s.hot_lead_id
     LEFT JOIN kunden_leistungen kl ON kl.id = s.leistung_id
     LEFT JOIN leistungskatalog lk ON lk.schluessel = kl.leistung
     LEFT JOIN users u ON u.id = s.zustaendig_user_id;

create or replace view public.v_sichtbarkeit_stand as
 WITH je_property AS (
         SELECT p.site_url,
            p.hot_lead_id IS NOT NULL AS verknuepft,
            ( SELECT max(d.datum) AS max
                   FROM seo.daily_totals d
                  WHERE d.site_url = p.site_url) AS juengster
           FROM seo.properties p
          WHERE p.aktiv
        )
 SELECT count(*) AS properties,
    count(*) FILTER (WHERE verknuepft) AS davon_verknuepft,
    count(*) FILTER (WHERE juengster >= (CURRENT_DATE - 5)) AS aktuell,
    count(*) FILTER (WHERE juengster IS NULL) AS ohne_daten,
    min(juengster) AS aeltester_stand,
    max(juengster) AS juengster_stand,
    (count(*) FILTER (WHERE juengster >= (CURRENT_DATE - 5)) * 2) < count(*) AS abruf_steht
   FROM je_property;

create or replace view public.v_system_stand as
 WITH abstaende AS (
         SELECT system_laeufe.name,
            system_laeufe.gestartet_am,
            system_laeufe.gestartet_am - lag(system_laeufe.gestartet_am) OVER (PARTITION BY system_laeufe.name ORDER BY system_laeufe.gestartet_am) AS abstand
           FROM system_laeufe
          WHERE system_laeufe.gestartet_am > (now() - '8 days'::interval)
        ), takt AS (
         SELECT abstaende.name,
            max(abstaende.abstand) AS groesster_abstand,
            count(abstaende.abstand) AS belege,
            max(abstaende.gestartet_am) - min(abstaende.gestartet_am) AS spanne
           FROM abstaende
          GROUP BY abstaende.name
        ), letzter AS (
         SELECT DISTINCT ON (system_laeufe.name) system_laeufe.name,
            system_laeufe.gestartet_am,
            system_laeufe.beendet_am,
            system_laeufe.ergebnis,
            system_laeufe.fehler
           FROM system_laeufe
          ORDER BY system_laeufe.name, system_laeufe.gestartet_am DESC
        ), beurteilung AS (
         SELECT l.name,
            l.gestartet_am,
            l.beendet_am,
            l.ergebnis,
            l.fehler,
            t.groesster_abstand AS gemessen,
            t.belege,
            t.spanne,
            k.name IS NOT NULL AS hinterlegt,
            k.erwarteter_abstand,
            k.quelle,
            GREATEST(COALESCE(k.erwarteter_abstand, t.groesster_abstand), COALESCE(t.groesster_abstand, k.erwarteter_abstand)) AS schwelle
           FROM letzter l
             LEFT JOIN takt t USING (name)
             LEFT JOIN system_takt k ON k.name = l.name
        )
 SELECT name,
    gestartet_am AS zuletzt,
    beendet_am,
    fehler,
    ergebnis,
    now() - gestartet_am AS her,
    schwelle AS groesster_abstand,
    belege,
    spanne,
        CASE
            WHEN hinterlegt AND erwarteter_abstand IS NULL THEN NULL::boolean
            WHEN NOT hinterlegt AND (belege IS NULL OR belege < 3 OR spanne < '25:00:00'::interval) THEN NULL::boolean
            WHEN beendet_am IS NULL AND fehler IS NULL AND (now() - gestartet_am) > '00:30:00'::interval THEN true
            WHEN (now() - gestartet_am) > (schwelle * 1.5::double precision) THEN true
            ELSE false
        END AS steht,
    quelle AS takt_quelle
   FROM beurteilung b;

-- ===== Funktionen =====

CREATE OR REPLACE FUNCTION public.alarme_erfassen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare neu integer;
begin
  insert into public.kunden_alarme (hot_lead_id, typ, betrifft)
  select hot_lead_id, typ, betrifft from public.v_anfragen_alarm where typ is not null
  on conflict (hot_lead_id, typ, betrifft) do nothing;
  get diagnostics neu = row_count;
  return neu;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.alarme_versand_pruefen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
declare
  r  record;
  n  integer := 0;
begin
  for r in
    select a.id, resp.status_code, resp.content, resp.error_msg
    from public.kunden_alarme a
    join net._http_response resp on resp.id = a.net_request_id
    where a.gesendet_am is null and a.net_request_id is not null
  loop
    if r.status_code between 200 and 299 then
      update public.kunden_alarme set gesendet_am = now(), fehler = null where id = r.id;
    else
      update public.kunden_alarme
         set fehler = left(coalesce(r.error_msg,
                       'HTTP ' || coalesce(r.status_code::text,'?') || ': ' || coalesce(r.content,'')), 500),
             net_request_id = null
       where id = r.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.alarme_versenden()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
declare
  v_key text; v_von text; v_an text := 'contact@sunsideai.de';
  r record; v_betreff text; v_text text; v_lage text; v_req bigint; n integer := 0;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_key is null or v_key = '' then
    raise notice 'alarme_versenden: kein resend_api_key im Vault - nichts versendet';
    return -1;
  end if;

  select coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'alarm_absender'),
                  'Sunside AI Alarm <alarm@sunsideai.de>')
    into v_von;

  for r in
    select a.id, a.typ, a.betrifft,
           b.unternehmen, b.vertragsstatus, b.gesamt,
           b.letzte_anfrage, b.tage_still, b.schnitt_vorher, b.referenzmonate
    from public.kunden_alarme a
    join public.v_alarm_belege b on b.hot_lead_id = a.hot_lead_id
    where a.gesendet_am is null and a.net_request_id is null and a.versuche < 3
    order by a.erkannt_am
  loop
    v_betreff := case r.typ
      when 'einbruch' then format('[OPS-ALARM] %s - Anfragen eingebrochen', public.kurzname(r.unternehmen))
      when 'stille'   then format('[OPS-ALARM] %s - seit %s Tagen keine Anfrage',
                                  public.kurzname(r.unternehmen), r.tage_still)
      else format('[OPS-ALARM] %s - %s', public.kurzname(r.unternehmen), r.typ)
    end;

    v_lage := case r.typ
      when 'einbruch' then format('Im Vormonat kam keine einzige Anfrage, obwohl dieser Kunde davor stabil bei %s Anfragen pro Monat lag.', r.schnitt_vorher)
      when 'stille'   then format('Seit %s Tagen ist keine Anfrage mehr eingegangen.', r.tage_still)
      else 'Auffaelligkeit erkannt.'
    end;

    v_text := format(
      E'%s\n\n%s\n\nBelege\n------\nLetzte Anfrage:     %s (vor %s Tagen)\nAnfragen insgesamt: %s\nSchnitt davor:      %s pro Monat (%s Referenzmonate)\nVertragsstatus:     %s\nBetroffener Monat:  %s\n\nHinweis: Der Vertragsstatus beschreibt die Zahlung, nicht die Auslieferung.\nEin pausierter Vertrag kann trotzdem voll beliefert werden.\n\nNaechster Schritt: pruefen, ob der Chatbot ueberhaupt noch auf der Seite\neingebunden ist. Eine Null aus fehlender Messung sieht aus wie eine Null\naus fehlender Nachfrage - fuehrt aber zur gegenteiligen Massnahme.\n',
      r.unternehmen, v_lage,
      coalesce(r.letzte_anfrage::text,'nie'), coalesce(r.tage_still::text,'-'), r.gesamt,
      coalesce(r.schnitt_vorher::text,'keine Referenz'), coalesce(r.referenzmonate::text,'0'),
      r.vertragsstatus, r.betrifft);

    select net.http_post(
      url     := 'https://api.resend.com/emails',
      body    := jsonb_build_object('from', v_von, 'to', jsonb_build_array(v_an),
                                    'subject', v_betreff, 'text', v_text),
      headers := jsonb_build_object('Content-Type','application/json',
                                    'Authorization','Bearer ' || v_key),
      timeout_milliseconds := 8000
    ) into v_req;

    update public.kunden_alarme
       set net_request_id = v_req, versuch_am = now(), versuche = versuche + 1, kanal = 'mail'
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ampel_uebernehmen(p_hot_lead_id uuid, p_von text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_neu text; v_grund text; v_alt text;
begin
  select empfehlung, begruendung, ampel_heute into v_neu, v_grund, v_alt
  from public.v_ampel_empfehlung where hot_lead_id = p_hot_lead_id;
  if v_neu is null then raise exception 'Kunde % nicht gefunden', p_hot_lead_id; end if;

  update public.kunden
     set ampel = v_neu, ampel_seit = now(), ampel_grund = v_grund
   where hot_lead_id = p_hot_lead_id;

  insert into public.kunden_ereignisse (hot_lead_id, art, von_wert, nach_wert, bemerkung, akteur)
  values (p_hot_lead_id, 'ampel', v_alt, v_neu, v_grund, p_von);
  return v_neu;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.anthropic_zugang()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'anthropic_api_key';
$function$
;

CREATE OR REPLACE FUNCTION public.aufgabe_protokoll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_akteur uuid := coalesce(new.letzter_akteur, new.erledigt_von, new.erstellt_von_user_id);
begin
  if tg_op = 'INSERT' then
    insert into public.aufgaben_ereignisse (aufgabe_id, art, nach_wert, bemerkung, akteur)
    values (new.id, 'angelegt', new.status,
            case new.quelle
              when 'vorlage' then case when new.serie_id is not null
                                       then 'aus einer laufenden Serie'
                                       else 'aus einer Vorlage beim Onboarding' end
              when 'mail'  then 'aus einer Kundenmail'
              when 'alarm' then 'aus einem Alarm'
              else null end,
            v_akteur);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.aufgaben_ereignisse (aufgabe_id, art, von_wert, nach_wert, bemerkung, akteur)
    values (new.id, 'status', old.status, new.status,
            coalesce(new.blockiert_grund, new.ergebnis), v_akteur);
  end if;

  if new.zustaendig_user_id is distinct from old.zustaendig_user_id then
    insert into public.aufgaben_ereignisse (aufgabe_id, art, von_wert, nach_wert, akteur)
    values (new.id, 'zustaendigkeit',
            (select vor_nachname from public.users where id = old.zustaendig_user_id),
            (select vor_nachname from public.users where id = new.zustaendig_user_id),
            v_akteur);
  end if;

  if new.faellig_am is distinct from old.faellig_am then
    insert into public.aufgaben_ereignisse (aufgabe_id, art, von_wert, nach_wert, akteur)
    values (new.id, 'termin', old.faellig_am::text, new.faellig_am::text, v_akteur);
  end if;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.aufgaben_anlegen(p_leistung_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kunde uuid;
  v_leist text;
  v_start date;
  n integer := 0;
begin
  -- Der Start ist die Bestaetigung der Leistung, nicht das Datum des Aufrufs:
  -- wird eine Leistung nachtraeglich erfasst, waeren sonst alle Fristen falsch
  -- in die Zukunft geschoben.
  select hot_lead_id, leistung, coalesce(bestaetigt_am::date, current_date)
    into v_kunde, v_leist, v_start
  from public.kunden_leistungen where id = p_leistung_id;

  if v_kunde is null then
    raise exception 'Leistung % existiert nicht', p_leistung_id;
  end if;

  insert into public.kunden_aufgaben
    (hot_lead_id, leistung_id, vorlage_id, titel, phase, verantwortlich, quelle, faellig_am)
  select v_kunde, p_leistung_id, v.id, v.titel, v.phase, v.verantwortlich, 'vorlage',
         case when v.frist_tage is null then null
              else v_start + v.frist_tage end
  from public.leistung_aufgaben_vorlage v
  where v.leistung = v_leist
    and v.phase in ('beistellung','setup')
    and v.aktiv
    -- Dedup: dieselbe Beistellung nicht zweimal, wenn der Kunde mehrere
    -- Leistungen hat ("Ansprechpartner benennen" steht in drei Plaenen).
    and not exists (
      select 1 from public.kunden_aufgaben a
      where a.hot_lead_id = v_kunde
        and a.titel = v.titel
        and a.erledigt_am is null
    )
  order by v.phase, v.reihenfolge;

  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bericht_versand_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.versendet_am is not null and old.versendet_am is null then
    if new.freigegeben_am is null or new.status not in ('freigegeben','versendet') then
      raise exception 'Bericht % ist nicht freigegeben — kein Versand', new.id
        using hint = 'Erst freigeben (status = freigegeben), dann versenden.';
    end if;
  end if;

  -- Wer freigibt, muss dabeistehen. Eine Freigabe ohne Namen ist keine.
  if new.freigegeben_am is not null and new.freigegeben_von is null then
    raise exception 'Freigabe ohne Person ist keine Freigabe';
  end if;

  -- Ein versendeter Bericht wird nicht mehr angefasst: Was beim Kunden liegt,
  -- laesst sich nicht nachtraeglich aendern.
  if old.status = 'versendet' and new.status <> 'versendet' then
    raise exception 'Ein versendeter Bericht kann nicht zurueckgenommen werden';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.berichte_anstossen(p_wunsch jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_key text; v_req bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null then
    raise notice 'berichte_anstossen: kein service_role_key im Vault';
    return null;
  end if;

  select net.http_post(
    url     := 'https://vyvadzpcqtbgmvwctahq.supabase.co/functions/v1/bericht-erzeugen',
    body    := coalesce(p_wunsch, '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    timeout_milliseconds := 90000
  ) into v_req;
  return v_req;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.berichts_anfragen(p_hot_lead_id uuid, p_von date, p_bis date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with echt as (
    select eingegangen_am::date as tag
      from public.kunden_anfragen
     where hot_lead_id = p_hot_lead_id
       and quelle <> 'sheet-import-geschaetzt'
  ), spanne as (
    select min(tag) as ab, max(tag) as bis from echt
  ), monatlich as (
    select date_trunc('month', e.tag)::date as monat, count(*) as anzahl
      from echt e
     where e.tag <= p_bis
       -- Nur ganz abgedeckte Monate: der erste erfasste Monat ist angebrochen,
       -- der letzte endet dort, wo unsere Erfassung endet.
       and date_trunc('month', e.tag) > date_trunc('month', (select ab from spanne))
       and (date_trunc('month', e.tag) + interval '1 month - 1 day')::date
             <= (select bis from spanne)
     group by 1
  )
  select case
    when (select bis from spanne) is null or (select bis from spanne) < p_bis then
      jsonb_build_object(
        'messbar', false,
        'erfasst_bis', (select bis from spanne),
        'grund', case when (select bis from spanne) is null
                      then 'keine Anfragen erfasst'
                      else 'Erfassung endet vor dem Berichtsende' end)
    else
      jsonb_build_object(
        'messbar', true,
        'erfasst_bis', (select bis from spanne),
        'im_zeitraum', (select count(*) from echt where tag between p_von and p_bis),
        'vorher',      (select count(*) from echt
                         where tag between p_von - (p_bis - p_von) - 1 and p_von - 1),
        'monate', coalesce((
          select jsonb_agg(jsonb_build_object('monat', monat, 'anzahl', anzahl)
                           order by monat)
            from (select * from monatlich order by monat desc limit 14) m), '[]'::jsonb))
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.berichts_monate(p_site text, p_bis date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
  select coalesce(jsonb_agg(x order by monat), '[]'::jsonb) from (
    select monat,
           jsonb_build_object(
             'monat',         monat,
             'klicks',        klicks,
             'impressionen',  impressionen,
             'tage_gemessen', tage_gemessen,
             'tage_moeglich', least(
                (monat + interval '1 month - 1 day')::date, p_bis) - monat + 1
           ) as x
      from (
        select date_trunc('month', d.datum)::date as monat,
               sum(d.clicks)      as klicks,
               sum(d.impressions) as impressionen,
               count(*)           as tage_gemessen
          from seo.daily_totals d
         where d.site_url = p_site and d.datum <= p_bis
         group by 1
      ) g
     order by monat desc
     limit 14
  ) t;
$function$
;

CREATE OR REPLACE FUNCTION public.berichts_reichweite(p_site text, p_bis date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
  with kandidaten as (
    select snapshot_date as tag,
           count(*) as begriffe,
           count(*) filter (where position <= 3)  as top3,
           count(*) filter (where position <= 10) as top10,
           public.ist_gekappt(count(*)::int) as gekappt
      from seo.query_snapshots
     where site_url = p_site
       and snapshot_date between p_bis - 45 and p_bis + 14
     group by snapshot_date
  ), stichtag as (
    select * from kandidaten order by gekappt asc, tag desc limit 1
  ), vergleich as (
    select * from kandidaten
     where not gekappt and tag <= (select tag from stichtag) - 20
     order by tag desc limit 1
  ), seiten as (
    select count(*) as anzahl from seo.page_snapshots
     where site_url = p_site
       and snapshot_date = (select max(snapshot_date) from seo.page_snapshots
                             where site_url = p_site and snapshot_date <= p_bis + 14)
  )
  select jsonb_build_object(
    'stichtag',           s.tag,
    'begriffe',           s.begriffe,
    'begriffe_top3',      s.top3,
    'begriffe_top10',     s.top10,
    'begriffe_gekappt',   s.gekappt,
    'seiten',             (select anzahl from seiten),
    'seiten_gekappt',     public.ist_gekappt((select anzahl from seiten)::int),
    'begriffe_vorher',    case when not s.gekappt then v.begriffe end,
    'top10_vorher',       case when not s.gekappt then v.top10 end,
    'vergleich_stichtag', case when not s.gekappt then v.tag end,
    'vergleich_moeglich', (v.tag is not null and not s.gekappt)
  )
  from stichtag s left join vergleich v on true;
$function$
;

CREATE OR REPLACE FUNCTION public.berichtsdaten(p_hot_lead_id uuid, p_von date, p_bis date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
declare
  v_tage    integer := (p_bis - p_von) + 1;
  v_vor_von date := p_von - v_tage;
  v_vor_bis date := p_von - 1;
  v_site    text;
  v_stichtag date;
  v_daten   jsonb;
begin
  select p.site_url into v_site
    from seo.properties p where p.hot_lead_id = p_hot_lead_id and p.aktiv
    order by p.zuletzt_gesehen desc nulls last limit 1;

  select max(snapshot_date) into v_stichtag
    from seo.query_snapshots where site_url = v_site and snapshot_date <= p_bis + 14;

  select jsonb_build_object(
    'kunde', jsonb_build_object(
      'name', kurzname(hl.unternehmen), 'voll', hl.unternehmen,
      'website', hl.website, 'phase', k.phase, 'ampel', k.ampel),
    'zeitraum', jsonb_build_object(
      'von', p_von, 'bis', p_bis, 'tage', v_tage,
      'vergleich_von', v_vor_von, 'vergleich_bis', v_vor_bis),
    'property', v_site,

    'sichtbarkeit', case when v_site is null then null else (
      select jsonb_build_object(
        'klicks',              coalesce(sum(d.clicks) filter (where d.datum between p_von and p_bis), 0),
        'klicks_vorher',       coalesce(sum(d.clicks) filter (where d.datum between v_vor_von and v_vor_bis), 0),
        'impressionen',        coalesce(sum(d.impressions) filter (where d.datum between p_von and p_bis), 0),
        'impressionen_vorher', coalesce(sum(d.impressions) filter (where d.datum between v_vor_von and v_vor_bis), 0),
        'position', round((sum(d.position * d.impressions) filter (where d.datum between p_von and p_bis))
                        / nullif(sum(d.impressions) filter (where d.datum between p_von and p_bis), 0), 1),
        'position_vorher', round((sum(d.position * d.impressions) filter (where d.datum between v_vor_von and v_vor_bis))
                        / nullif(sum(d.impressions) filter (where d.datum between v_vor_von and v_vor_bis), 0), 1),
        'tage_mit_daten', count(*) filter (where d.datum between p_von and p_bis),
        'tage_mit_daten_vorher', count(*) filter (where d.datum between v_vor_von and v_vor_bis)
      ) from seo.daily_totals d where d.site_url = v_site) end,

    'reichweite', case when v_site is null then null
                  else public.berichts_reichweite(v_site, p_bis) end,

    'monate', case when v_site is null then '[]'::jsonb
              else public.berichts_monate(v_site, p_bis) end,

    'suchanfragen', case when v_site is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('anfrage', q.query, 'klicks', q.clicks,
                                  'impressionen', q.impressions,
                                  'position', round(q.position, 1)) as x
          from seo.query_snapshots q
         where q.site_url = v_site and q.snapshot_date = v_stichtag
         order by q.clicks desc, q.impressions desc limit 10) t) end,

    'seiten', case when v_site is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(x order by klicks desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'seite', adresse, 'klicks', klicks,
                 'impressionen', impressionen,
                 'position', round(position_gewichtet, 1)) as x,
               klicks
          from (
            select regexp_replace(s.page, '^https?://(www\.)?', '') as adresse,
                   sum(s.clicks)      as klicks,
                   sum(s.impressions) as impressionen,
                   sum(s.position * s.impressions) / nullif(sum(s.impressions), 0)
                     as position_gewichtet
              from seo.page_snapshots s
             where s.site_url = v_site
               and s.snapshot_date = (select max(snapshot_date) from seo.page_snapshots
                                       where site_url = v_site and snapshot_date <= p_bis + 14)
             group by 1
             order by klicks desc
             limit 8) g) t) end,

    'geleistet', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'titel', titel || case when anzahl > 1
                                      then ' (' || anzahl || 'x)' else '' end,
               'erledigt_am', zuletzt,
               'leistung', leistung) order by zuletzt desc), '[]'::jsonb)
        from (
          select a.titel,
                 count(*)                 as anzahl,
                 max(a.erledigt_am::date) as zuletzt,
                 min(lk.anzeigename)      as leistung
            from kunden_aufgaben a
            left join kunden_leistungen kl on kl.id = a.leistung_id
            left join leistungskatalog lk on lk.schluessel = kl.leistung
           where a.hot_lead_id = p_hot_lead_id and a.geloescht_am is null
             and not a.intern and a.verantwortlich = 'sunside'
             and a.erledigt_am::date between p_von and p_bis
           group by a.titel
        ) g),

    'inhalte_veroeffentlicht', (
      select count(*) from kunden_aufgaben a
       where a.hot_lead_id = p_hot_lead_id and a.geloescht_am is null
         and not a.intern and a.verantwortlich = 'sunside'
         and a.erledigt_am::date between p_von and p_bis
         and (a.titel ilike '%beitrag%' or a.titel ilike '%content%'
              or a.titel ilike '%landingpage%' or a.titel ilike '%seite%')),

    'geplant', (
      select coalesce(jsonb_agg(x order by sortier nulls last), '[]'::jsonb) from (
        select jsonb_build_object('titel', titel, 'faellig_am', faellig_am) as x,
               faellig_am as sortier
          from (
            select distinct on (a.titel) a.titel, a.faellig_am
              from kunden_aufgaben a
             where a.hot_lead_id = p_hot_lead_id and a.geloescht_am is null
               and not a.intern and a.status <> 'erledigt'
               and a.verantwortlich = 'sunside'
             order by a.titel, a.faellig_am nulls last
          ) e
         order by faellig_am nulls last
         limit 5) t),

    'anfragen', public.berichts_anfragen(p_hot_lead_id, p_von, p_bis),

    'leistungen', (
      select coalesce(jsonb_agg(lk.anzeigename order by lk.sortierung), '[]'::jsonb)
        from kunden_leistungen l
        join leistungskatalog lk on lk.schluessel = l.leistung
       where l.hot_lead_id = p_hot_lead_id and l.status = 'live')
  ) into v_daten
  from hot_leads hl
  join kunden k on k.hot_lead_id = hl.id
  where hl.id = p_hot_lead_id;

  return v_daten;
end;
$function$
;

CREATE OR REPLACE FUNCTION seo.domain_aus(eingabe text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(eingabe, '')), '^sc-domain:', ''),
        '^https?://', ''),
      '^www\.|[/?#].*$', '', 'g'),
    '');
$function$
;

CREATE OR REPLACE FUNCTION public.get_unassigned_leads(limit_count integer DEFAULT 100)
 RETURNS SETOF leads
 LANGUAGE sql
 STABLE
AS $function$
  SELECT l.*
  FROM public.leads l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id
  )
    AND (l.bereits_kontaktiert IS NULL OR l.bereits_kontaktiert = false)
    AND (l.ergebnis IS NULL OR l.ergebnis::text != 'Ungültiger Lead')
  ORDER BY l.created_at DESC NULLS LAST
  LIMIT limit_count;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_leads(p_user_id uuid, p_wiedervorlage boolean DEFAULT NULL::boolean, p_contacted boolean DEFAULT NULL::boolean, p_ergebnis text DEFAULT NULL::text, p_land text DEFAULT NULL::text, p_quelle text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50)
 RETURNS TABLE(lead_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_total bigint;
BEGIN
  -- Total für Pagination zählen
  SELECT COUNT(*) INTO v_total
  FROM public.leads l
  JOIN public.lead_assignments la ON la.lead_id = l.id
  WHERE la.user_id = p_user_id
    AND (p_wiedervorlage IS NULL OR (p_wiedervorlage = true AND l.wiedervorlage_datum IS NOT NULL))
    AND (p_contacted    IS NULL OR COALESCE(l.bereits_kontaktiert, false) = p_contacted)
    AND (p_ergebnis     IS NULL OR l.ergebnis::text = p_ergebnis)
    AND (p_land         IS NULL OR l.land::text     = p_land)
    AND (p_quelle       IS NULL OR l.quelle::text   = p_quelle)
    AND (p_search       IS NULL OR
         l.unternehmensname ILIKE '%' || p_search || '%' OR
         l.stadt            ILIKE '%' || p_search || '%');

  -- Daten als jsonb zurückgeben (kompatibel mit aktuellem Mapper)
  RETURN QUERY
  SELECT to_jsonb(l.*), v_total
  FROM public.leads l
  JOIN public.lead_assignments la ON la.lead_id = l.id
  WHERE la.user_id = p_user_id
    AND (p_wiedervorlage IS NULL OR (p_wiedervorlage = true AND l.wiedervorlage_datum IS NOT NULL))
    AND (p_contacted    IS NULL OR COALESCE(l.bereits_kontaktiert, false) = p_contacted)
    AND (p_ergebnis     IS NULL OR l.ergebnis::text = p_ergebnis)
    AND (p_land         IS NULL OR l.land::text     = p_land)
    AND (p_quelle       IS NULL OR l.quelle::text   = p_quelle)
    AND (p_search       IS NULL OR
         l.unternehmensname ILIKE '%' || p_search || '%' OR
         l.stadt            ILIKE '%' || p_search || '%')
  ORDER BY l.unternehmensname ASC
  OFFSET p_offset
  LIMIT  p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gsc_zugang()
 RETURNS TABLE(client_id text, client_secret text, refresh_token text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'gsc_client_id'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'gsc_client_secret'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'gsc_refresh_token');
$function$
;

CREATE OR REPLACE FUNCTION public.hot_lead_opener_setzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.imap_zugang()
 RETURNS TABLE(host text, nutzer text, passwort text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select
    coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'imap_host'),
             'imap.ionos.de'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'imap_user'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'imap_passwort');
$function$
;

CREATE OR REPLACE FUNCTION public.ist_gekappt(n bigint)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select n in (100, 250, 500, 1000, 5000);
$function$
;

CREATE OR REPLACE FUNCTION public.kurzname(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_name is null then '(ohne Namen)'
    when position(' - ' in p_name) > 0
     and length(btrim(split_part(p_name, ' - ', 1))) >= 12
      then btrim(split_part(p_name, ' - ', 1))
    else left(btrim(p_name), 45)
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.lauf_beenden(p_id bigint, p_ergebnis jsonb DEFAULT NULL::jsonb, p_fehler text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update system_laeufe
     set beendet_am = now(), ergebnis = p_ergebnis, fehler = p_fehler
   where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.lauf_starten(p_name text)
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into system_laeufe (name) values (p_name) returning id;
$function$
;

CREATE OR REPLACE FUNCTION public.lead_assignment_protokoll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.lead_assignments_freigeben(p_user_id uuid, p_lead_ids uuid[], p_grund text DEFAULT 'offboarding'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.mail_senden(p_an text, p_betreff text, p_text text, p_anhang_name text DEFAULT NULL::text, p_anhang_base64 text DEFAULT NULL::text, p_von text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
declare
  v_key  text;
  v_von  text;
  v_body jsonb;
  v_req  bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_key is null or v_key = '' then
    raise exception 'kein resend_api_key im Vault';
  end if;

  v_von := coalesce(p_von,
    (select decrypted_secret from vault.decrypted_secrets where name = 'alarm_absender'),
    'Sunside AI <contact@sunsideai.de>');

  v_body := jsonb_build_object('from', v_von, 'to', jsonb_build_array(p_an),
                               'subject', p_betreff, 'text', p_text);

  if p_anhang_name is not null and p_anhang_base64 is not null then
    v_body := v_body || jsonb_build_object('attachments',
      jsonb_build_array(jsonb_build_object('filename', p_anhang_name, 'content', p_anhang_base64)));
  end if;

  select net.http_post(
    url     := 'https://api.resend.com/emails',
    body    := v_body,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key),
    timeout_milliseconds := 20000
  ) into v_req;

  return v_req;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mails_holen_anstossen(p_tage integer DEFAULT 3)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_key text; v_req bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null then
    raise notice 'mails_holen_anstossen: kein service_role_key im Vault';
    return null;
  end if;

  select net.http_post(
    url     := 'https://vyvadzpcqtbgmvwctahq.supabase.co/functions/v1/mails-holen',
    body    := jsonb_build_object('tage', p_tage),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    -- Grosszuegig: Der Abruf dauert je nach Postfach ein paar Sekunden. Laeuft
    -- er laenger, arbeitet die Function trotzdem zu Ende — pg_net wartet nur
    -- nicht mehr auf die Antwort.
    timeout_milliseconds := 20000
  ) into v_req;
  return v_req;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mails_zuordnen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n1 integer; n2 integer;
begin
  with ziel as (
    select k.hot_lead_id,
           lower(regexp_replace(regexp_replace(coalesce(hl.website,''),'^(https?://)',''),'^www\.','')) as domain,
           lower(btrim(coalesce(hl.mail,''))) as mail
    from public.kunden k
    join public.hot_leads hl on hl.id = k.hot_lead_id
  )
  update public.kunden_kommunikation m
     set hot_lead_id = z.hot_lead_id,
         zuordnung   = 'sicher',
         thread_schluessel = z.hot_lead_id::text || '|' ||
           lower(btrim(regexp_replace(coalesce(m.betreff,''), '^((AW|RE|WG|FWD)\s*:\s*)+', '', 'i')))
    from ziel z
   where m.hot_lead_id is null
     and (
       (z.mail <> '' and (m.absender = z.mail or z.mail = any(m.empfaenger)))
       or (z.domain <> '' and m.gegenstelle_domain is not null
           and split_part(z.domain,'/',1) = m.gegenstelle_domain)
     );
  get diagnostics n1 = row_count;

  with eindeutig as (
    select ordner, (array_agg(distinct hot_lead_id))[1] as hot_lead_id
    from public.kunden_kommunikation
    where ordner is not null and hot_lead_id is not null
    group by ordner
    having count(distinct hot_lead_id) = 1
       and count(*) >= 2
  )
  update public.kunden_kommunikation m
     set hot_lead_id = e.hot_lead_id,
         zuordnung   = 'aus der Ablage',
         thread_schluessel = e.hot_lead_id::text || '|' ||
           lower(btrim(regexp_replace(coalesce(m.betreff,''), '^((AW|RE|WG|FWD)\s*:\s*)+', '', 'i')))
    from eindeutig e
   where m.hot_lead_id is null and m.ordner = e.ordner
     -- Nicht ableiten, wo gar keine Gegenstelle beteiligt ist.
     and m.gegenstelle_domain is not null;
  get diagnostics n2 = row_count;

  return n1 + n2;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_bridge_lead_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Nur feuern wenn status auf 'Abgeschlossen' wechselt
  IF NEW.status = 'Abgeschlossen' AND (OLD.status IS DISTINCT FROM 'Abgeschlossen') THEN
    PERFORM net.http_post(
      url     := 'https://sumsideaicrmbillingbridge-production.up.railway.app/webhooks/supabase/lead-closed',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <GEHEIM: bridge_token - im Live-Stand fest einkodiert, gehoert in den Vault>'
      ),
      body    := jsonb_build_object('hot_lead_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.onboarding_starten(p_hot_lead_id uuid, p_paket text, p_user_id uuid DEFAULT NULL::uuid, p_notiz text DEFAULT NULL::text)
 RETURNS TABLE(angelegte_leistung text, anzahl_aufgaben integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_leistungen text[];
  v_l          text;
  v_id         bigint;
  v_n          integer;
begin
  select p.leistungen into v_leistungen from public.pakete p
   where p.schluessel = p_paket and p.aktiv;
  if v_leistungen is null then
    raise exception 'Paket % gibt es nicht', p_paket;
  end if;

  insert into public.kunden (hot_lead_id, phase, notiz)
  values (p_hot_lead_id, 'einrichtung', p_notiz)
  on conflict (hot_lead_id) do nothing;

  foreach v_l in array v_leistungen loop
    insert into public.kunden_leistungen as kl (hot_lead_id, leistung, status, bestaetigt_am, notiz)
    values (p_hot_lead_id, v_l, 'bestaetigt', now(), p_notiz)
    on conflict (hot_lead_id, leistung) do update
      set bestaetigt_am = coalesce(kl.bestaetigt_am, now())
    returning kl.id into v_id;

    select count(*) into v_n from public.kunden_aufgaben a where a.leistung_id = v_id;

    if p_user_id is not null then
      update public.kunden_aufgaben a
         set zustaendig_user_id = p_user_id
       where a.leistung_id = v_id and a.verantwortlich = 'sunside' and a.zustaendig_user_id is null;
    end if;

    angelegte_leistung := v_l;
    anzahl_aufgaben    := v_n;
    return next;
  end loop;

  insert into public.kunden_ereignisse (hot_lead_id, art, nach_wert, bemerkung, akteur)
  values (p_hot_lead_id, 'onboarding_gestartet', p_paket, p_notiz, p_user_id::text);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.parse_german_datetime(input text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$
DECLARE
  date_part TEXT;
  time_part TEXT;
  day_num INT;
  month_num INT;
  year_num INT;
  hour_num INT;
  minute_num INT;
  is_pm BOOLEAN;
  result TIMESTAMPTZ;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN NULL;
  END IF;

  -- Split date and time
  date_part := split_part(input, ' ', 1);
  time_part := lower(split_part(input, ' ', 2));

  -- Parse date (format: D.M.YYYY)
  day_num := split_part(date_part, '.', 1)::INT;
  month_num := split_part(date_part, '.', 2)::INT;
  year_num := split_part(date_part, '.', 3)::INT;

  -- Parse time (format: H:MMam or H:MMpm)
  is_pm := time_part LIKE '%pm';
  time_part := replace(replace(time_part, 'am', ''), 'pm', '');
  hour_num := split_part(time_part, ':', 1)::INT;
  minute_num := split_part(time_part, ':', 2)::INT;

  -- Convert 12-hour to 24-hour format
  IF is_pm AND hour_num < 12 THEN
    hour_num := hour_num + 12;
  ELSIF NOT is_pm AND hour_num = 12 THEN
    hour_num := 0;
  END IF;

  -- Build timestamp (in Berlin timezone)
  result := make_timestamptz(year_num, month_num, day_num, hour_num, minute_num, 0, 'Europe/Berlin');

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.properties_nach_kundenanlage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.seo_properties_zuordnen();
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resend_zugang()
 RETURNS TABLE(schluessel text, absender text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key'),
    coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'bericht_absender'),
             (select decrypted_secret from vault.decrypted_secrets where name = 'alarm_absender'),
             'Sunside AI <alarm@sunsideai.de>');
$function$
;

CREATE OR REPLACE FUNCTION public.schema_dump(p_schemas text[] DEFAULT ARRAY['public'::text, 'seo'::text])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  t text := '';
  r record;
  spalten text;
begin
  t := t || '-- Live-Schema Sunside CRM/Operations' || chr(10);
  t := t || '-- Erzeugt am ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' aus der laufenden Datenbank.' || chr(10);
  t := t || '-- Dokumentation des Ausgangszustands. NICHT gegen die Live-DB ausfuehren.
-- ACHTUNG: In notify_bridge_lead_closed() stand ein fest einkodiertes Bearer-Token.
-- Es ist hier geschwaerzt. Es gehoert in den Vault und muss rotiert werden.' || chr(10) || chr(10);

  -- Enums
  t := t || '-- ===== Aufzaehlungstypen =====' || chr(10);
  for r in
    select n.nspname, ty.typname,
           string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as werte
      from pg_type ty
      join pg_namespace n on n.oid = ty.typnamespace
      join pg_enum e on e.enumtypid = ty.oid
     where n.nspname = any(p_schemas) and ty.typtype = 'e'
     group by n.nspname, ty.typname
     order by 1, 2
  loop
    t := t || format('create type %I.%I as enum (%s);', r.nspname, r.typname, r.werte) || chr(10);
  end loop;

  -- Tabellen
  t := t || chr(10) || '-- ===== Tabellen =====' || chr(10);
  for r in
    select n.nspname, c.relname, c.oid, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any(p_schemas) and c.relkind = 'r'
     order by 1, 2
  loop
    select string_agg(
             format('  %I %s%s%s',
               a.attname,
               format_type(a.atttypid, a.atttypmod),
               case when a.attnotnull then ' not null' else '' end,
               case when ad.adbin is not null
                    then ' default ' || pg_get_expr(ad.adbin, ad.adrelid) else '' end),
             ',' || chr(10) order by a.attnum)
      into spalten
      from pg_attribute a
      left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped;

    t := t || chr(10) || format('create table %I.%I (', r.nspname, r.relname) || chr(10)
           || coalesce(spalten, '') || chr(10) || ');' || chr(10);

    if r.relrowsecurity then
      t := t || format('alter table %I.%I enable row level security;', r.nspname, r.relname) || chr(10);
    end if;
  end loop;

  -- Constraints
  t := t || chr(10) || '-- ===== Schluessel und Regeln =====' || chr(10);
  for r in
    select n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid) as def, con.contype
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any(p_schemas)
     order by case con.contype when 'p' then 1 when 'u' then 2 when 'f' then 3 else 4 end, 1, 2, 3
  loop
    t := t || format('alter table %I.%I add constraint %I %s;', r.nspname, r.relname, r.conname, r.def) || chr(10);
  end loop;

  -- Indizes (ohne die von Constraints erzeugten)
  t := t || chr(10) || '-- ===== Indizes =====' || chr(10);
  for r in
    select i.schemaname, i.indexname, i.indexdef
      from pg_indexes i
     where i.schemaname = any(p_schemas)
       and not exists (select 1 from pg_constraint con
                        join pg_class ic on ic.oid = con.conindid
                       where ic.relname = i.indexname)
     order by 1, 2
  loop
    t := t || r.indexdef || ';' || chr(10);
  end loop;

  -- Views
  t := t || chr(10) || '-- ===== Views =====' || chr(10);
  for r in
    select n.nspname, c.relname, pg_get_viewdef(c.oid, true) as def
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any(p_schemas) and c.relkind in ('v','m')
     order by 1, 2
  loop
    t := t || chr(10) || format('create or replace view %I.%I as', r.nspname, r.relname) || chr(10) || r.def || chr(10);
  end loop;

  -- Funktionen
  t := t || chr(10) || '-- ===== Funktionen =====' || chr(10);
  for r in
    select pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = any(p_schemas) and p.prokind in ('f','p')
     order by p.proname
  loop
    t := t || chr(10) || r.def || ';' || chr(10);
  end loop;

  -- Trigger
  t := t || chr(10) || '-- ===== Trigger =====' || chr(10);
  for r in
    select pg_get_triggerdef(tg.oid) as def
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any(p_schemas) and not tg.tgisinternal
     order by c.relname, tg.tgname
  loop
    t := t || r.def || ';' || chr(10);
  end loop;

  -- Policies
  t := t || chr(10) || '-- ===== Zugriffsregeln (RLS) =====' || chr(10);
  for r in
    select p.schemaname, p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
      from pg_policies p
     where p.schemaname = any(p_schemas)
     order by 1, 2, 3
  loop
    t := t || format('create policy %I on %I.%I as %s for %s to %s%s%s;',
           r.policyname, r.schemaname, r.tablename,
           lower(r.permissive), lower(r.cmd), array_to_string(r.roles, ', '),
           case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
           case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end
         ) || chr(10);
  end loop;

  return t;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seo_properties_ids_gleichziehen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.hot_lead_id is distinct from old.hot_lead_id then
    new.crm_lead_id := new.hot_lead_id;
  elsif new.crm_lead_id is distinct from old.crm_lead_id then
    new.hot_lead_id := new.crm_lead_id;
  end if;
  -- Beim INSERT gibt es kein old: die gefuellte Spalte gewinnt.
  if tg_op = 'INSERT' then
    new.hot_lead_id := coalesce(new.hot_lead_id, new.crm_lead_id);
    new.crm_lead_id := coalesce(new.crm_lead_id, new.hot_lead_id);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seo_properties_zuordnen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
declare n integer;
begin
  with treffer as (
    select p.site_url,
           -- Aggregat statt einfacher Auswahl: So laesst sich in einem Zug
           -- pruefen, dass es *genau einen* Kunden gibt. Bei zweien bleibt die
           -- Property offen — eine geratene Zuordnung ist schlechter als eine
           -- sichtbare Luecke.
           (select case when count(*) = 1 then (array_agg(hl.id))[1] end
              from hot_leads hl
              join kunden k on k.hot_lead_id = hl.id      -- nur betreute Kunden
             where hl.website is not null
               and split_part(
                     regexp_replace(lower(btrim(hl.website)), '^(https?://)?(www\.)?', ''),
                     '/', 1) = p.domain) as kunde_id
      from seo.properties p
     where p.hot_lead_id is null
       and p.domain is not null
       and coalesce(p.zuordnung, '') <> 'ausnahme'
  )
  update seo.properties p
     set hot_lead_id = t.kunde_id,
         crm_lead_id = t.kunde_id,
         zuordnung   = 'auto',
         -- Den Anzeigenamen nur setzen, solange dort der Platzhalter steht.
         -- Beim Anlegen traegt eine neue Property ihre Domain als Namen; sobald
         -- der Kunde bekannt ist, gehoert dort sein Name hin. Ein von Hand
         -- gepflegter Name ("Klose & Partner (ohne www)") bleibt unberuehrt —
         -- er sagt etwas, was aus den Daten nicht hervorgeht.
         kunde = case when p.kunde is null or p.kunde = p.domain
                      then kurzname((select unternehmen from hot_leads where id = t.kunde_id))
                      else p.kunde end
    from treffer t
   where p.site_url = t.site_url and t.kunde_id is not null;

  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seo_push(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'seo', 'public', 'pg_temp'
AS $function$
declare
  n_daily int := 0; n_query int := 0; n_page int := 0;
  n_status int := 0; n_mass int := 0;
begin
  if p ? 'daily' then
    insert into seo.daily_totals (site_url, datum, clicks, impressions, ctr, position)
    select site_url, datum, clicks, impressions, ctr, position
    from jsonb_to_recordset(p->'daily') as x(
      site_url text, datum date, clicks int, impressions int,
      ctr numeric, position numeric)
    where exists (select 1 from seo.properties pr where pr.site_url = x.site_url)
    on conflict (site_url, datum) do update set
      clicks = excluded.clicks, impressions = excluded.impressions,
      ctr = excluded.ctr, position = excluded.position, erfasst_am = now();
    get diagnostics n_daily = row_count;
  end if;

  if p ? 'queries' then
    insert into seo.query_snapshots (site_url, snapshot_date, query, clicks, impressions, ctr, position)
    select site_url, snapshot_date, query, clicks, impressions, ctr, position
    from jsonb_to_recordset(p->'queries') as x(
      site_url text, snapshot_date date, query text, clicks int,
      impressions int, ctr numeric, position numeric)
    where exists (select 1 from seo.properties pr where pr.site_url = x.site_url)
    on conflict (site_url, snapshot_date, query) do update set
      clicks = excluded.clicks, impressions = excluded.impressions,
      ctr = excluded.ctr, position = excluded.position;
    get diagnostics n_query = row_count;
  end if;

  if p ? 'pages' then
    insert into seo.page_snapshots (site_url, snapshot_date, page, clicks, impressions, ctr, position)
    select site_url, snapshot_date, page, clicks, impressions, ctr, position
    from jsonb_to_recordset(p->'pages') as x(
      site_url text, snapshot_date date, page text, clicks int,
      impressions int, ctr numeric, position numeric)
    where exists (select 1 from seo.properties pr where pr.site_url = x.site_url)
    on conflict (site_url, snapshot_date, page) do update set
      clicks = excluded.clicks, impressions = excluded.impressions,
      ctr = excluded.ctr, position = excluded.position;
    get diagnostics n_page = row_count;
  end if;

  if p ? 'status' then
    insert into seo.status (site_url, snapshot_date, ampel, aussage, achse_wachstum,
      achse_effizienz, achse_reichweite, achse_potenzial, kennzahlen, clicks, impressions)
    select site_url, snapshot_date, ampel, aussage, achse_wachstum,
           achse_effizienz, achse_reichweite, achse_potenzial,
           coalesce(kennzahlen, '{}'::jsonb), clicks, impressions
    from jsonb_to_recordset(p->'status') as x(
      site_url text, snapshot_date date, ampel text, aussage text,
      achse_wachstum numeric, achse_effizienz numeric, achse_reichweite numeric,
      achse_potenzial numeric, kennzahlen jsonb, clicks int, impressions int)
    where exists (select 1 from seo.properties pr where pr.site_url = x.site_url)
    on conflict (site_url, snapshot_date) do update set
      ampel = excluded.ampel, aussage = excluded.aussage,
      achse_wachstum = excluded.achse_wachstum, achse_effizienz = excluded.achse_effizienz,
      achse_reichweite = excluded.achse_reichweite, achse_potenzial = excluded.achse_potenzial,
      kennzahlen = excluded.kennzahlen, clicks = excluded.clicks,
      impressions = excluded.impressions, erfasst_am = now();
    get diagnostics n_status = row_count;
  end if;

  if p ? 'massnahmen' then
    insert into seo.massnahmen (site_url, typ, titel, begruendung, prioritaet,
      potenzial_clicks, ziel_queries, fingerprint)
    select site_url, typ, titel, begruendung, prioritaet,
           potenzial_clicks, coalesce(ziel_queries, '[]'::jsonb), fingerprint
    from jsonb_to_recordset(p->'massnahmen') as x(
      site_url text, typ text, titel text, begruendung text, prioritaet int,
      potenzial_clicks int, ziel_queries jsonb, fingerprint text)
    where exists (select 1 from seo.properties pr where pr.site_url = x.site_url)
    -- erledigte oder verworfene Masznahmen NICHT wiederbeleben
    on conflict (site_url, fingerprint) do update set
      titel = excluded.titel, begruendung = excluded.begruendung,
      potenzial_clicks = excluded.potenzial_clicks,
      ziel_queries = excluded.ziel_queries, zuletzt_gesehen = current_date
      where seo.massnahmen.status in ('offen', 'in_arbeit');
    get diagnostics n_mass = row_count;
  end if;

  return jsonb_build_object('daily', n_daily, 'queries', n_query, 'pages', n_page,
                            'status', n_status, 'massnahmen', n_mass);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seo_push_stammdaten(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'seo', 'public', 'pg_temp'
AS $function$
declare
  n_prop int := 0; n_luecke int := 0; n_still int := 0;
begin
  if p ? 'properties' then
    insert into seo.properties (site_url, kunde, domain, crm_lead_id, crm_name,
      produkt, vertragsstart, arbeitsbeginn, ist_seo, zuordnung, aktiv, zuletzt_gesehen)
    select site_url, kunde, domain, crm_lead_id, crm_name, produkt, vertragsstart,
           arbeitsbeginn, coalesce(ist_seo, false), coalesce(zuordnung, 'offen'),
           true, current_date
    from jsonb_to_recordset(p->'properties') as x(
      site_url text, kunde text, domain text, crm_lead_id uuid, crm_name text,
      produkt text, vertragsstart date, arbeitsbeginn date, ist_seo boolean,
      zuordnung text)
    on conflict (site_url) do update set
      kunde = excluded.kunde, domain = excluded.domain,
      crm_lead_id = excluded.crm_lead_id, crm_name = excluded.crm_name,
      produkt = excluded.produkt, vertragsstart = excluded.vertragsstart,
      arbeitsbeginn = excluded.arbeitsbeginn, ist_seo = excluded.ist_seo,
      zuordnung = excluded.zuordnung, aktiv = true,
      zuletzt_gesehen = current_date
      -- eine von Hand auf 'ignoriert' gesetzte Property bleibt ignoriert
      where seo.properties.zuordnung <> 'ignoriert';
    get diagnostics n_prop = row_count;

    -- Properties, die in der Search Console verschwunden sind, stillegen
    -- statt loeschen: die Historie bleibt erhalten.
    update seo.properties
       set aktiv = false
     where zuletzt_gesehen is distinct from current_date
       and aktiv = true;
    get diagnostics n_still = row_count;
  end if;

  if p ? 'luecken' then
    insert into seo.abdeckungsluecken (crm_lead_id, kunde, domain, produkt,
      vertragsstart, ist_seo)
    select crm_lead_id, kunde, domain, produkt, vertragsstart, coalesce(ist_seo, false)
    from jsonb_to_recordset(p->'luecken') as x(
      crm_lead_id uuid, kunde text, domain text, produkt text,
      vertragsstart date, ist_seo boolean)
    on conflict (crm_lead_id) do update set
      kunde = excluded.kunde, domain = excluded.domain,
      produkt = excluded.produkt, vertragsstart = excluded.vertragsstart,
      ist_seo = excluded.ist_seo, behoben_am = null;
    get diagnostics n_luecke = row_count;

    -- Luecken, die nicht mehr gemeldet werden, gelten als behoben
    update seo.abdeckungsluecken
       set behoben_am = current_date
     where behoben_am is null
       and crm_lead_id not in (
         select (x->>'crm_lead_id')::uuid
         from jsonb_array_elements(p->'luecken') x
         where x->>'crm_lead_id' is not null);
  end if;

  return jsonb_build_object('properties', n_prop, 'stillgelegt', n_still,
                            'luecken', n_luecke);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.serie_periode(p_turnus text, p_tag integer, p_stichtag date)
 RETURNS TABLE(periode text, faellig_am date)
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  v_faellig date;
  v_tag integer;
  v_schritt integer;
  i integer;
begin
  if p_turnus in ('woechentlich','zweiwoechentlich') then
    v_tag := least(greatest(coalesce(p_tag, 5), 1), 7);
    v_faellig := p_stichtag + (v_tag - extract(isodow from p_stichtag)::integer);
    if v_faellig < p_stichtag then
      v_faellig := v_faellig + 7;
    end if;
    if p_turnus = 'zweiwoechentlich' and (extract(week from v_faellig)::integer % 2) = 1 then
      v_faellig := v_faellig + 7;   -- eine Woche weiter, nicht aussetzen
    end if;
    return query select to_char(v_faellig, 'IYYY-"KW"IW'), v_faellig;

  else
    v_tag := least(greatest(coalesce(p_tag, 1), 1), 28);
    v_schritt := case p_turnus when 'zweimonatlich' then 2
                               when 'quartalsweise' then 3
                               else 1 end;

    v_faellig := date_trunc('month', p_stichtag)::date + (v_tag - 1);
    if v_faellig < p_stichtag then
      v_faellig := (date_trunc('month', p_stichtag) + interval '1 month')::date + (v_tag - 1);
    end if;

    -- Bis zu zwoelf Monate nach dem naechsten passenden Termin suchen. Die
    -- Obergrenze ist eine Sicherung gegen eine Endlosschleife, kein fachliches Mass.
    for i in 0..11 loop
      exit when (extract(month from v_faellig)::integer % v_schritt) = (1 % v_schritt);
      v_faellig := (v_faellig + interval '1 month')::date;
    end loop;

    return query select to_char(v_faellig, 'YYYY-MM'), v_faellig;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.serien_ausfuehren(p_stichtag date DEFAULT CURRENT_DATE)
 RETURNS TABLE(angelegt integer, uebersprungen integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
  p record;
  n_neu integer := 0;
  n_alt integer := 0;
begin
  for s in
    select se.*, kl.status as leistung_status
    from public.aufgaben_serie se
    left join public.kunden_leistungen kl on kl.id = se.leistung_id
    where se.aktiv
      and (se.pausiert_bis is null or se.pausiert_bis < p_stichtag)
      and (se.laeuft_ab_am is null or se.laeuft_ab_am >= p_stichtag)
      -- Eine pausierte oder beendete Leistung erzeugt keine Arbeit mehr.
      and (se.leistung_id is null or kl.status in ('live','ausgerollt','entwicklung_abgeschlossen'))
  loop
    for p in select * from public.serie_periode(s.turnus, s.faellig_am_tag, p_stichtag) loop
      -- Vorlauf: erst anlegen, wenn die Faelligkeit nah genug ist. Sonst stuende
      -- die Aufgabe fuer Dezember schon im August in der Liste.
      continue when p.faellig_am - s.vorlauf_tage > p_stichtag;

      insert into public.kunden_aufgaben
        (hot_lead_id, leistung_id, vorlage_id, serie_id, titel, beschreibung, phase,
         verantwortlich, zustaendig_user_id, erstellt_von_user_id, faellig_am,
         prioritaet, quelle, periode, status)
      values
        (s.hot_lead_id, s.leistung_id, s.vorlage_id, s.id, s.titel,
         coalesce(s.beschreibung, '') ||
           case when s.menge_text is not null then
             case when s.beschreibung is null then '' else E'\n' end || 'Umfang: ' || s.menge_text
           else '' end,
         'laufend', s.verantwortlich, s.zustaendig_user_id, s.erstellt_von_user_id,
         p.faellig_am, s.prioritaet, 'vorlage', p.periode, 'offen')
      on conflict (serie_id, periode) where serie_id is not null do nothing;

      if found then n_neu := n_neu + 1; else n_alt := n_alt + 1; end if;
    end loop;
  end loop;

  return query select n_neu, n_alt;
end $function$
;

CREATE OR REPLACE FUNCTION public.serien_einrichten(p_leistung_id bigint DEFAULT NULL::bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  insert into public.aufgaben_serie
    (hot_lead_id, leistung_id, vorlage_id, titel, beschreibung, verantwortlich,
     prioritaet, turnus, faellig_am_tag, vorlauf_tage, menge_text, notiz)
  select
    kl.hot_lead_id, kl.id, v.id, v.titel, v.hinweis, v.verantwortlich,
    'normal', v.turnus,
    case
      -- Woechentlich: Freitag. Was die Woche ueber entsteht, wird zum Wochenschluss
      -- fertig - nicht am Montag, wo die Woche noch vor einem liegt.
      when v.turnus in ('woechentlich','zweiwoechentlich') then 5
      -- Monatlich: nach Reihenfolge gestaffelt, damit nicht alles am Ersten auflaeuft.
      -- Der Report kommt zuletzt, weil er die Arbeit der anderen zusammenfasst.
      else least(5 + (v.reihenfolge - 1) * 5, 25)
    end,
    case when v.turnus in ('woechentlich','zweiwoechentlich') then 4 else 7 end,
    case when v.hinweis ~ '[0-9]' and v.hinweis ilike '%beitr%' then v.hinweis else null end,
    'bei der Einrichtung der Serien angelegt'
  from public.kunden_leistungen kl
  join public.leistung_aufgaben_vorlage v
       on v.leistung = kl.leistung and v.phase = 'laufend' and v.aktiv
  where kl.status in ('live','ausgerollt')
    and (p_leistung_id is null or kl.id = p_leistung_id)
  on conflict (leistung_id, vorlage_id) where leistung_id is not null and vorlage_id is not null
  do nothing;

  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sichtbarkeit_anstossen(p_tage integer DEFAULT 40)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_key text; v_req bigint;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null then
    raise notice 'sichtbarkeit_anstossen: kein service_role_key im Vault';
    return null;
  end if;

  select net.http_post(
    url     := 'https://vyvadzpcqtbgmvwctahq.supabase.co/functions/v1/sichtbarkeit-holen',
    body    := jsonb_build_object('tage', p_tage),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_key),
    timeout_milliseconds := 20000
  ) into v_req;
  return v_req;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sichtbarkeit_properties_melden(p_sites jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
declare v_neu integer;
begin
  with gemeldet as (
    select s->>'site_url' as site_url, s->>'domain' as domain
    from jsonb_array_elements(p_sites) s
  ),
  angelegt as (
    insert into seo.properties (site_url, domain, kunde, aktiv, zuordnung, angelegt_am)
    select g.site_url, g.domain, g.domain, true, 'offen', now()
    from gemeldet g
    where not exists (select 1 from seo.properties p where p.site_url = g.site_url)
    returning 1
  )
  select count(*) into v_neu from angelegt;

  update seo.properties p
     set zuletzt_gesehen = current_date
    from jsonb_array_elements(p_sites) s
   where p.site_url = s->>'site_url';

  return v_neu;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sichtbarkeit_seiten_schreiben(p_zeilen jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
declare n integer;
begin
  insert into seo.page_snapshots (site_url, snapshot_date, page, clicks, impressions, ctr, position)
  select z->>'site_url', (z->>'stichtag')::date, z->>'page',
         (z->>'clicks')::integer, (z->>'impressions')::integer,
         (z->>'ctr')::numeric, (z->>'position')::numeric
  from jsonb_array_elements(p_zeilen) z
  on conflict (site_url, snapshot_date, page) do update
     set clicks = excluded.clicks, impressions = excluded.impressions,
         ctr = excluded.ctr, position = excluded.position;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sichtbarkeit_suchanfragen_schreiben(p_zeilen jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
declare n integer;
begin
  insert into seo.query_snapshots (site_url, snapshot_date, query, clicks, impressions, ctr, position)
  select z->>'site_url', (z->>'stichtag')::date, z->>'query',
         (z->>'clicks')::integer, (z->>'impressions')::integer,
         (z->>'ctr')::numeric, (z->>'position')::numeric
  from jsonb_array_elements(p_zeilen) z
  on conflict (site_url, snapshot_date, query) do update
     set clicks = excluded.clicks, impressions = excluded.impressions,
         ctr = excluded.ctr, position = excluded.position;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sichtbarkeit_zahlen_schreiben(p_zeilen jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'seo'
AS $function$
declare n integer;
begin
  insert into seo.daily_totals (site_url, datum, clicks, impressions, ctr, position, erfasst_am)
  select z->>'site_url', (z->>'datum')::date,
         (z->>'clicks')::integer, (z->>'impressions')::integer,
         (z->>'ctr')::numeric, (z->>'position')::numeric, now()
  from jsonb_array_elements(p_zeilen) z
  on conflict (site_url, datum) do update
     set clicks = excluded.clicks, impressions = excluded.impressions,
         ctr = excluded.ctr, position = excluded.position, erfasst_am = now();
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.system_laeufe_aufraeumen()
 RETURNS void
 LANGUAGE sql
AS $function$
  delete from public.system_laeufe where gestartet_am < now() - interval '30 days';
$function$
;

CREATE OR REPLACE FUNCTION public.system_stillstand_melden()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_key text; v_von text; v_an text := 'contact@sunsideai.de';
  v_wache bigint; v_zuletzt timestamptz; r record; s record;
  v_betreff text; v_text text; v_req bigint; n integer := 0;
begin
  v_wache := public.lauf_starten('stillstandswache');

  select max(gestartet_am) into v_zuletzt
    from public.system_laeufe
   where name = 'stillstandswache' and (ergebnis->>'gemeldet')::boolean is true;

  if v_zuletzt is not null and v_zuletzt > now() - interval '12 hours' then
    perform public.lauf_beenden(v_wache,
      jsonb_build_object('gemeldet', false, 'grund', 'zuletzt gemeldet ' || v_zuletzt));
    return 0;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_key is null or v_key = '' then
    perform public.lauf_beenden(v_wache, null, 'kein resend_api_key im Vault');
    return -1;
  end if;

  select coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'alarm_absender'),
                  'Sunside AI Alarm <alarm@sunsideai.de>') into v_von;

  -- 1. Geplante Laeufe, die ausbleiben
  for r in
    select * from public.v_system_stand
     where steht is true and name <> 'stillstandswache'
  loop
    v_betreff := format('[OPS-ALARM] %s steht seit %s Stunden', r.name,
                        to_char(extract(epoch from r.her) / 3600, 'FM990.0'));
    v_text := format(
      E'Der geplante Lauf "%s" ist ueberfaellig.\n\n'
      'Zuletzt gestartet: %s (vor %s)\n'
      'Zuletzt beendet:   %s\n'
      'Letzter Fehler:    %s\n'
      'Groesster ueblicher Abstand: %s (aus %s Messungen ueber %s)\n\n'
      'Der Takt wird gemessen, nicht hinterlegt — die naechtliche Pause loest\n'
      'deshalb keinen Alarm aus. Diese Meldung heisst: Es haette laengst wieder\n'
      'laufen muessen.\n\n'
      'Der Mailabruf laeuft als Edge Function in Supabase, angestossen von\n'
      'pg_cron (Job "mails-holen"). Von Hand:\n'
      '  select public.mails_holen_anstossen(3);\n',
      r.name, r.zuletzt, r.her,
      coalesce(r.beendet_am::text, 'nie — hart abgebrochen'),
      coalesce(r.fehler, 'keiner'),
      r.groesster_abstand, r.belege, r.spanne);

    select net.http_post(
      url     := 'https://api.resend.com/emails',
      body    := jsonb_build_object('from', v_von, 'to', jsonb_build_array(v_an),
                                    'subject', v_betreff, 'text', v_text),
      headers := jsonb_build_object('Content-Type','application/json',
                                    'Authorization','Bearer ' || v_key),
      timeout_milliseconds := 8000
    ) into v_req;
    n := n + 1;
  end loop;

  -- 2. Sichtbarkeitszahlen, die alt werden
  select * into s from public.v_sichtbarkeit_stand;
  if s.abruf_steht then
    v_betreff := format('[OPS-ALARM] Search-Console-Zahlen sind vom %s', s.aeltester_stand);
    v_text := format(
      E'Die Sichtbarkeitszahlen im Dashboard werden nicht mehr juenger.\n\n'
      'Aeltester Stand:  %s\n'
      'Juengster Stand:  %s\n'
      'Properties:       %s, davon %s mit Daten der letzten fuenf Tage\n'
      'Ohne jede Daten:  %s\n\n'
      'Der Abruf laeuft im SEO-Projekt auf dem Mac\n'
      '(SEO-Uebersicht-Console/scripts/tageslauf.sh). Er steht, wenn der Rechner\n'
      'aus ist — und er scheitert still am Dateischutz von macOS, wenn er aus\n'
      'einem geschuetzten Ordner (Schreibtisch, Dokumente) gestartet wird:\n'
      '"Operation not permitted".\n\n'
      'Achtung beim Lesen der Zahlen: Die Search Console liefert fuer Tage ohne\n'
      'Klicks gar keine Zeile. Ein alter Stand bei einer einzelnen Property\n'
      'heisst deshalb nicht, dass der Abruf steht — deshalb wird hier die\n'
      'Mehrheit gezaehlt, nicht das Maximum.\n',
      s.aeltester_stand, s.juengster_stand, s.properties, s.aktuell, s.ohne_daten);

    select net.http_post(
      url     := 'https://api.resend.com/emails',
      body    := jsonb_build_object('from', v_von, 'to', jsonb_build_array(v_an),
                                    'subject', v_betreff, 'text', v_text),
      headers := jsonb_build_object('Content-Type','application/json',
                                    'Authorization','Bearer ' || v_key),
      timeout_milliseconds := 8000
    ) into v_req;
    n := n + 1;
  end if;

  perform public.lauf_beenden(v_wache,
    jsonb_build_object('gemeldet', n > 0, 'meldungen', n));
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_kunde_holt_mails()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.mails_zuordnen();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_leistung_bestaetigt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.bestaetigt_am is not null and (tg_op = 'INSERT' or old.bestaetigt_am is null) then
    perform public.aufgaben_anlegen(new.id);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_leistung_protokoll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.kunden_ereignisse (hot_lead_id, leistung_id, art, nach_wert)
    values (new.hot_lead_id, new.id, 'leistung_angelegt', new.status);
  elsif new.status is distinct from old.status then
    insert into public.kunden_ereignisse (hot_lead_id, leistung_id, art, von_wert, nach_wert)
    values (new.hot_lead_id, new.id, 'leistung_status', old.status, new.status);
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_leistung_statuswechsel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.kunden_ereignisse (hot_lead_id, leistung_id, art, von_wert, nach_wert)
    values (new.hot_lead_id, new.id, 'leistung_status', old.status, new.status);

    -- live_seit setzt sich selbst, sobald eine Leistung live geht
    if new.status = 'live' and new.live_seit is null then
      new.live_seit := now();
    end if;
    if new.status = 'beendet' and new.beendet_am is null then
      new.beendet_am := now();
    end if;
  elsif tg_op = 'INSERT' then
    insert into public.kunden_ereignisse (hot_lead_id, leistung_id, art, nach_wert)
    values (new.hot_lead_id, new.id, 'leistung_angelegt', new.status);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_leistung_werte_setzen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'live' and old.status <> 'live' and new.live_seit is null then
      new.live_seit := now();
    end if;
    if new.status = 'beendet' and old.status <> 'beendet' and new.beendet_am is null then
      new.beendet_am := now();
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.vault_setzen(p_name text, p_wert text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_wert, p_name);
  else
    perform vault.update_secret(v_id, p_wert, p_name);
  end if;
end;
$function$
;

-- ===== Trigger =====
CREATE TRIGGER trg_billing_contacts_updated_at BEFORE UPDATE ON public.billing_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_billing_invoices_updated_at BEFORE UPDATE ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_billing_recurring_updated_at BEFORE UPDATE ON public.billing_recurring FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER hot_lead_opener_setzen_tr BEFORE INSERT ON public.hot_leads FOR EACH ROW EXECUTE FUNCTION hot_lead_opener_setzen();
CREATE TRIGGER trg_lead_closed_bridge AFTER UPDATE ON public.hot_leads FOR EACH ROW EXECUTE FUNCTION notify_bridge_lead_closed();
CREATE TRIGGER trg_lead_closed_to_bridge AFTER UPDATE OF status ON public.hot_leads FOR EACH ROW WHEN (((new.status = 'Abgeschlossen'::text) AND (old.status IS DISTINCT FROM 'Abgeschlossen'::text) AND (new.billing_mode = 'none'::text))) EXECUTE FUNCTION notify_bridge_lead_closed();
CREATE TRIGGER update_hot_leads_updated_at BEFORE UPDATE ON public.hot_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER kunde_zieht_properties_nach AFTER INSERT ON public.kunden FOR EACH STATEMENT EXECUTE FUNCTION properties_nach_kundenanlage();
CREATE TRIGGER trg_kunde_mails AFTER INSERT ON public.kunden FOR EACH ROW EXECUTE FUNCTION trg_kunde_holt_mails();
CREATE TRIGGER trg_aufgabe_protokoll AFTER INSERT OR UPDATE ON public.kunden_aufgaben FOR EACH ROW EXECUTE FUNCTION aufgabe_protokoll();
CREATE TRIGGER bericht_versand_pruefen BEFORE UPDATE ON public.kunden_berichte FOR EACH ROW EXECUTE FUNCTION bericht_versand_pruefen();
CREATE TRIGGER trg_leistung_bestaetigt_aufgaben AFTER INSERT OR UPDATE OF bestaetigt_am ON public.kunden_leistungen FOR EACH ROW EXECUTE FUNCTION trg_leistung_bestaetigt();
CREATE TRIGGER trg_leistung_prot AFTER INSERT OR UPDATE ON public.kunden_leistungen FOR EACH ROW EXECUTE FUNCTION trg_leistung_protokoll();
CREATE TRIGGER trg_leistung_werte BEFORE INSERT OR UPDATE ON public.kunden_leistungen FOR EACH ROW EXECUTE FUNCTION trg_leistung_werte_setzen();
CREATE TRIGGER trg_lead_assignment_protokoll AFTER INSERT OR DELETE ON public.lead_assignments FOR EACH ROW EXECUTE FUNCTION lead_assignment_protokoll();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_product_catalog_updated_at BEFORE UPDATE ON public.product_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER properties_ids_gleichziehen BEFORE INSERT OR UPDATE ON seo.properties FOR EACH ROW EXECUTE FUNCTION seo_properties_ids_gleichziehen();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Zugriffsregeln (RLS) =====
create policy "GFs read mapping review" on public.billing_mapping_review as permissive for select to public using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('Geschäftsführer'::text = ANY (users.rollen))))));
create policy "GFs update mapping review" on public.billing_mapping_review as permissive for update to public using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ('Geschäftsführer'::text = ANY (users.rollen))))));
create policy einstellungen_lesen on public.einstellungen as permissive for select to authenticated using (true);
create policy "Authenticated users can read email_templates" on public.email_templates as permissive for select to public using (true);
create policy "Service role can manage email_templates" on public.email_templates as permissive for all to public using (true);
create policy "Service role can manage follow_up_actions" on public.follow_up_actions as permissive for all to public using (true) with check (true);
create policy "Authenticated users can read hot_leads" on public.hot_leads as permissive for select to public using (true);
create policy "Service role can delete hot_leads" on public.hot_leads as permissive for delete to public using (true);
create policy "Service role can insert hot_leads" on public.hot_leads as permissive for insert to public with check (true);
create policy "Service role can update hot_leads" on public.hot_leads as permissive for update to public using (true);
create policy kunden_anfragen_insert_anon on public.kunden_anfragen as permissive for insert to anon, authenticated with check (true);
create policy kunden_anfragen_select_anon on public.kunden_anfragen as permissive for select to anon, authenticated using (true);
create policy "Service role can manage lead_archive" on public.lead_archive as permissive for all to public using (true);
create policy "service role manages assignment history" on public.lead_assignment_history as permissive for all to public using ((auth.role() = 'service_role'::text)) with check ((auth.role() = 'service_role'::text));
create policy "Service role can manage lead_assignments" on public.lead_assignments as permissive for all to public using (true);
create policy "Service role can manage lead_requests" on public.lead_requests as permissive for all to public using (true);
create policy "Authenticated users can read leads" on public.leads as permissive for select to public using (true);
create policy "Service role can insert leads" on public.leads as permissive for insert to public with check (true);
create policy "Service role can update leads" on public.leads as permissive for update to public using (true);
create policy product_catalog_read_authenticated on public.product_catalog as permissive for select to authenticated using (true);
create policy "Service role can manage system_messages" on public.system_messages as permissive for all to public using (true);
create policy "Authenticated users can read users" on public.users as permissive for select to public using (true);
create policy "Service role can insert users" on public.users as permissive for insert to public with check (true);
create policy "Service role can update users" on public.users as permissive for update to public using (true);
