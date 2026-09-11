-- Eingespielt am 2026-09-11 um 17:40 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Hilfsfunktion: gibt das komplette Live-Schema als DDL-Text zurueck.
-- Zweck: Ticket 0.3 - das Live-Schema ist in keinem Repo dokumentiert.
create or replace function public.schema_dump(p_schemas text[] default array['public','seo'])
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  t text := '';
  r record;
  spalten text;
begin
  t := t || '-- Live-Schema Sunside CRM/Operations' || chr(10);
  t := t || '-- Erzeugt am ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' aus der laufenden Datenbank.' || chr(10);
  t := t || '-- Dokumentation des Ausgangszustands. NICHT gegen die Live-DB ausfuehren.' || chr(10) || chr(10);

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
$$;

revoke all on function public.schema_dump(text[]) from public, anon, authenticated;
grant execute on function public.schema_dump(text[]) to service_role;
