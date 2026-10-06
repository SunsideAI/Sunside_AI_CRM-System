-- ───────────────────────────────────────────────────────────────────────────
-- Ein Kontakt, zwei Tabellen: Name, Anrede und Mail halten zusammen.
--
-- Jeder Hot Lead zeigt über `lead_id` auf seinen kalten Lead. Beide tragen
-- Namen, Anrede und Mailadresse - und bisher pflegte jede Seite ihre eigene.
-- Der Kommentar wird seit jeher gespiegelt („SINGLE SOURCE OF TRUTH" in
-- hot-leads.js), die Kontaktfelder nicht.
--
-- Stand am 06.10.2026, bei 633 verknüpften Paaren:
--   492  gleich
--   110  Hot Lead leer, kalter gefüllt (der Impressum-Scraper befüllte nur
--        die kalten Leads, die Hot Leads blieben, wie sie waren)
--    35  beide gefüllt und verschieden
--
-- Wer den Namen in der einen Akte berichtigt, erwartet ihn auch in der
-- anderen. Das gehört in die Datenbank und nicht in eine Function: Eine
-- Prüfung im Code gilt für den Weg, der sie aufruft. Eine Regel hier gilt für
-- alle Wege, auch für den, den es noch nicht gibt.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.kontakt_spiegeln()
returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare
  v_ziel_tabelle text := tg_argv[0];
  v_ziel_id uuid;
begin
  -- Welche Zeile auf der anderen Seite gemeint ist.
  if v_ziel_tabelle = 'leads' then
    v_ziel_id := new.lead_id;
  else
    select h.id into v_ziel_id from public.hot_leads h where h.lead_id = new.id;
  end if;
  if v_ziel_id is null then return new; end if;

  /* Nur was sich wirklich geändert hat, und nur wenn die andere Seite etwas
     anderes trägt. Ohne diese zweite Bedingung schriebe Trigger A nach B,
     B wieder nach A, und das liefe im Kreis. */
  if v_ziel_tabelle = 'leads' then
    update public.leads l set
      ansprechpartner_vorname  = new.ansprechpartner_vorname,
      ansprechpartner_nachname = new.ansprechpartner_nachname,
      anrede                   = new.anrede
    where l.id = v_ziel_id
      and (l.ansprechpartner_vorname  is distinct from new.ansprechpartner_vorname
        or l.ansprechpartner_nachname is distinct from new.ansprechpartner_nachname
        or l.anrede                   is distinct from new.anrede);
  else
    update public.hot_leads h set
      ansprechpartner_vorname  = new.ansprechpartner_vorname,
      ansprechpartner_nachname = new.ansprechpartner_nachname,
      anrede                   = new.anrede
    where h.id = v_ziel_id
      and (h.ansprechpartner_vorname  is distinct from new.ansprechpartner_vorname
        or h.ansprechpartner_nachname is distinct from new.ansprechpartner_nachname
        or h.anrede                   is distinct from new.anrede);
  end if;

  return new;
end $$;

comment on function public.kontakt_spiegeln() is
  'Spiegelt Name und Anrede zwischen hot_leads und leads. Schreibt nur bei echter Abweichung - sonst liefen die beiden Trigger im Kreis.';

/* AFTER, nicht BEFORE: Die Zeile soll erst stehen, bevor die andere Seite
   nachzieht. Und nur bei den drei Feldern - ein Statuswechsel oder eine
   Terminänderung hat hier nichts zu suchen. */
drop trigger if exists trg_kontakt_spiegeln_hot on public.hot_leads;
create trigger trg_kontakt_spiegeln_hot
  after update of ansprechpartner_vorname, ansprechpartner_nachname, anrede
  on public.hot_leads
  for each row execute function public.kontakt_spiegeln('leads');

drop trigger if exists trg_kontakt_spiegeln_kalt on public.leads;
create trigger trg_kontakt_spiegeln_kalt
  after update of ansprechpartner_vorname, ansprechpartner_nachname, anrede
  on public.leads
  for each row execute function public.kontakt_spiegeln('hot_leads');
