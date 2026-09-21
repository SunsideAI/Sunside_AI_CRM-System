-- Felder v2: der Zuschnitt nach dem Testlauf vom 21.09.2026
--
-- Quellen: Feedback zum Test (Opening und Setting), Feldspezifikation Block 1
-- und 3 in der Fassung vom 20.09., Miro F24 und Tickets 16 bis 18.
--
-- Nur Ergänzungen, mit einer Ausnahme: investitionsrahmen wird Text
-- (Entscheidung 21.09., das Feedback verlangt Freitext). Geprüft vor dem
-- Lauf: 0 von 606 Kontakten haben dort einen Wert, keine Ansicht und keine
-- Funktion liest die Spalte, und der veröffentlichte Stand (b63a552) kennt sie
-- nicht. Alte Spalten bleiben stehen und lesbar (entscheider_messlatte,
-- rahmen_ausgewichen, quote_art).

alter table public.hot_leads
  -- Erstanruf
  add column if not exists ziele text[],
  add column if not exists ziel_prioritaet text,
  add column if not exists branche_andere text,
  add column if not exists notizen_erstanruf text,
  -- Beratungsgespräch
  add column if not exists versuche_ergebnis text,
  add column if not exists erfolgskriterien text,
  add column if not exists objekte_pro_jahr numeric,
  add column if not exists ernsthafte_von_10 numeric,
  add column if not exists zeitfresser text,
  add column if not exists stunden_pro_woche numeric,
  add column if not exists erreichbarkeit_thema boolean,
  add column if not exists anrufe_pro_woche numeric,
  add column if not exists provision_je_auftrag numeric,
  add column if not exists zahlen_kennzeichen jsonb,
  add column if not exists notizen_setting text,
  add column if not exists ergebnis_beratung text,
  -- Fragen-Vorschlag im Setting: einmal erzeugt, gespeichert
  add column if not exists fragen_vorschlag jsonb,
  add column if not exists fragen_vorschlag_am timestamptz;

alter table public.hot_leads
  alter column investitionsrahmen type text using investitionsrahmen::text;

-- Wertelisten. NOT VALID ist hier unnötig, die Spalten sind neu und leer.
alter table public.hot_leads
  drop constraint if exists hot_leads_ziele_check,
  add constraint hot_leads_ziele_check check (
    ziele is null or ziele <@ array['Mehr Eigentümer-Anfragen','Mehr Kaufinteressenten',
                                    'Zeitersparnis und Entlastung','Noch nicht besprochen']::text[]),
  drop constraint if exists hot_leads_ziel_prioritaet_check,
  add constraint hot_leads_ziel_prioritaet_check check (
    ziel_prioritaet is null or ziel_prioritaet = any (array['Mehr Eigentümer-Anfragen',
      'Mehr Kaufinteressenten','Zeitersparnis und Entlastung']::text[])),
  drop constraint if exists hot_leads_ergebnis_beratung_check,
  add constraint hot_leads_ergebnis_beratung_check check (
    ergebnis_beratung is null or ergebnis_beratung = any (array['Auftrag',
      'Nächster Schritt vereinbart','Vertagt ohne festen Schritt','Absage']::text[])),
  drop constraint if exists hot_leads_ernsthafte_von_10_check,
  add constraint hot_leads_ernsthafte_von_10_check check (
    ernsthafte_von_10 is null or ernsthafte_von_10 between 0 and 10);

-- Die zwei Testkontakte mit einem Ziel bekommen es auch als Liste.
update public.hot_leads
   set ziele = array[ziel]
 where ziel is not null and ziele is null;

-- Vollständigkeit der Übergaben nach den neuen Gates.
-- Übergabe 1: Branche, Ziel, Problem, Vorhaben, Mobilnummer.
-- Übergabe 2: Problem, Wer mitentscheidet, Erfolgskriterien,
-- Investitionsrahmen, Abschlusstermin. Im reduzierten Modus (andere Branche
-- oder eigenes Vorhaben) zählt nur der Abschlusstermin.
create or replace view public.v_uebergabe_vollstaendigkeit as
select date_trunc('month', (created_at at time zone 'Europe/Berlin'))::date as monat,
       count(*) as kontakte,
       count(*) filter (where berufsgruppe is not null) as mit_berufsgruppe,
       count(*) filter (where ziel is not null or coalesce(array_length(ziele, 1), 0) > 0) as mit_ziel,
       count(*) filter (where nullif(schmerzpunkt_wortlaut, '') is not null) as mit_schmerzpunkt,
       count(*) filter (where vorhaben is not null) as mit_vorhaben,
       count(*) filter (where nullif(mobilnummer, '') is not null) as mit_mobilnummer,
       count(*) filter (where berufsgruppe is not null
                          and (ziel is not null or coalesce(array_length(ziele, 1), 0) > 0)
                          and nullif(schmerzpunkt_wortlaut, '') is not null
                          and vorhaben is not null
                          and nullif(mobilnummer, '') is not null) as uebergabe_1_komplett,
       count(*) filter (where termin_abschlussgespraech is not null
                          and (vorhaben is true or berufsgruppe = 'andere'
                               or (nullif(schmerzpunkt_vertieft, '') is not null
                                   and nullif(entscheider, '') is not null
                                   and nullif(erfolgskriterien, '') is not null
                                   and nullif(investitionsrahmen, '') is not null))) as uebergabe_2_komplett
  from public.hot_leads h
 group by 1;
