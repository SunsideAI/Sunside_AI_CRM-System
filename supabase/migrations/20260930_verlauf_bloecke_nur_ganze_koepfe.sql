-- Der Verlauf schnitt Notizen ab, die selbst eine Datumszeile enthielten.
--
-- verlauf_bloecke() zerlegt das Kommentarfeld in Eintraege. Getrennt wurde an
-- jeder Zeile, die mit [TT.MM.JJJJ beginnt - behalten wurde aber nur, was auch
-- eine Uhrzeit trug. Alles dazwischen fiel heraus. Wer in seiner Notiz eine
-- Zeile wie "[01.10.2026] Wiedervorlage" schrieb, sah im Verlauf nur den ersten
-- Satz; der Rest verschwand, obwohl er im Kommentarfeld erhalten blieb.
--
-- Gemeldet am 30.09.2026. Die Trennung folgt jetzt derselben Bedingung wie der
-- Filter: Datum UND Uhrzeit.

create or replace function public.verlauf_bloecke(p_kommentar text)
 returns setof text
 language sql
 immutable
as $function$
  select btrim(b) from regexp_split_to_table(
    regexp_replace(p_kommentar,
      E'\n(?=\\[[0-9]{2}\\.[0-9]{2}\\.[0-9]{4},? [0-9]{2}:[0-9]{2}\\])',
      E'\n§§§', 'g'),
    '§§§') as b
   where btrim(b) ~ '^\[\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}\]';
$function$;

-- Zweiter Teil derselben Meldung: Beim Eintrag stand kein Autor.
--
-- Der Name steht in Klammern am Ende des Blocks. Haengt danach noch etwas an -
-- etwa der Calendly-Block bei einer Direktbuchung -, greift das Muster nicht
-- mehr, und der Eintrag erschien ohne Namen. Dann zaehlt jetzt das Ende der
-- ersten Zeile.

create or replace function public.kontakt_verlauf_mitschreiben()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_block text; v_autor text;
begin
  if new.kommentar is null or new.kommentar is not distinct from old.kommentar then
    return new;
  end if;

  select b into v_block from public.verlauf_bloecke(new.kommentar) as b limit 1;
  if v_block is null then
    return new;
  end if;

  if exists (select 1 from public.kontakt_verlauf where lead_id = new.id and roh = v_block) then
    return new;
  end if;

  v_autor := substring(v_block from '\(([^()\n]{1,60})\)\s*$');
  if v_autor is null then
    v_autor := substring(split_part(v_block, E'\n', 1) from '\(([^()\n]{1,60})\)\s*$');
  end if;

  insert into public.kontakt_verlauf (lead_id, geschehen_am, art, titel, akteur_name, quelle, roh)
  values (new.id, public.verlauf_zeitpunkt(v_block), public.verlauf_art(v_block),
          public.verlauf_titel(v_block), v_autor, 'kommentar', v_block);
  return new;
end;
$function$;

-- Bestandsdaten: Wo der Name in der ersten Zeile steht, nachtragen.
update public.kontakt_verlauf k
set akteur_name = substring(split_part(k.roh, E'\n', 1) from '\(([^()\n]{1,60})\)\s*$')
where k.quelle = 'kommentar' and k.akteur_name is null and k.roh is not null
  and substring(split_part(k.roh, E'\n', 1) from '\(([^()\n]{1,60})\)\s*$') is not null;
