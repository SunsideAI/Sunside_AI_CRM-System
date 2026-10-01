-- Herr oder Frau, aus dem Vornamen bestimmt.
--
-- Bis hierher stand in jeder Mail woertlich "Herr/Frau Berg", und der Absender
-- sollte es beim Durchlesen richtigstellen. Das passierte nicht immer.
--
-- Die Regel: Geraten wird nicht. Wo das Geschlecht unklar ist - Unisex-Namen,
-- Doppelnennungen wie "Claudia und Iosif", Firmen im Namensfeld -, bleibt die
-- Anrede leer, und die Mail gruesst mit vollem Namen. Eine falsche Anrede
-- faellt beim Empfaenger sofort auf, eine neutrale nicht.

alter table hot_leads add column if not exists anrede text
  check (anrede is null or anrede in ('Herr','Frau'));
alter table leads add column if not exists anrede text
  check (anrede is null or anrede in ('Herr','Frau'));

-- Das Nachschlagewerk. Unisex-Namen stehen bewusst NICHT drin.
create table if not exists vorname_anrede (
  vorname text primary key,
  anrede  text not null check (anrede in ('Herr','Frau'))
);

-- Umlaute koennen zusammengesetzt gespeichert sein (NFD): "u" plus Trema sind
-- dann zwei Zeichen und finden "ue" nicht. normalize() legt beide Seiten auf
-- dieselbe Form - sonst scheitert der Vergleich an etwas Unsichtbarem.
create or replace function public.anrede_aus_vorname(p_vorname text)
 returns text language sql stable as $$
  with roh as (select btrim(normalize(coalesce(p_vorname,''), nfc)) as v)
  select case
    when (select v from roh) ~* '^(herr|hr\.?)( |$)' then 'Herr'
    when (select v from roh) ~* '^(frau|fr\.?)( |$)' then 'Frau'
    when (select v from roh) ~ '[&+,/]| und | oder ' then null
    else (select a.anrede from vorname_anrede a
           where a.vorname = lower(split_part((select v from roh), ' ', 1)))
  end;
$$;

-- Beim Schreiben setzen. Eine von Hand gesetzte Anrede bleibt stehen.
create or replace function public.anrede_setzen()
 returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.ansprechpartner_vorname is distinct from old.ansprechpartner_vorname then
    if tg_op = 'INSERT' and new.anrede is not null then return new; end if;
    if tg_op = 'UPDATE' and new.anrede is distinct from old.anrede then return new; end if;
    new.anrede := public.anrede_aus_vorname(new.ansprechpartner_vorname);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_anrede_hot_leads on hot_leads;
create trigger trg_anrede_hot_leads before insert or update of ansprechpartner_vorname, anrede
  on hot_leads for each row execute function public.anrede_setzen();
drop trigger if exists trg_anrede_leads on leads;
create trigger trg_anrede_leads before insert or update of ansprechpartner_vorname, anrede
  on leads for each row execute function public.anrede_setzen();

-- Zieht nach, wo das Nachschlagewerk inzwischen weiter ist (nach einem Lauf
-- von anrede-nachtragen.js).
create or replace function public.anrede_nachziehen()
 returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer := 0; m integer := 0;
begin
  update hot_leads set anrede = anrede_aus_vorname(ansprechpartner_vorname)
   where anrede is null and nullif(btrim(ansprechpartner_vorname),'') is not null
     and anrede_aus_vorname(ansprechpartner_vorname) is not null;
  get diagnostics n = row_count;
  update leads set anrede = anrede_aus_vorname(ansprechpartner_vorname)
   where anrede is null and nullif(btrim(ansprechpartner_vorname),'') is not null
     and anrede_aus_vorname(ansprechpartner_vorname) is not null;
  get diagnostics m = row_count;
  return n + m;
end;
$$;

-- Die Namensliste selbst steht nicht hier: Sie wurde einmalig aus dem Bestand
-- erhoben (699 verschiedene Vornamen) und waechst ueber anrede-nachtragen.js.
