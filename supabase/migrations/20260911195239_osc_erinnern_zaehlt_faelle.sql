-- Eingespielt am 2026-09-11 um 19:52 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Korrektur: Die Funktion gab bisher die Zahl der verschickten NACHRICHTEN
-- zurueck. Bei drei Admins meldete der Lauf damit drei Vorgaenge, wo es einer
-- war - die Zaehler im Lauf-Protokoll waren um den Faktor "Anzahl Admins"
-- zu hoch, und niemand haette es gemerkt, weil die Zahl plausibel aussieht.
--
-- Rueckgabe ist jetzt: 1 = erinnert, 0 = war schon erinnert.
create or replace function public.crm_erinnern(
  p_schluessel text, p_art text, p_hot_lead uuid,
  p_typ text, p_titel text, p_nachricht text
) returns integer
language plpgsql security definer set search_path = public as $$
begin
  insert into public.crm_erinnerungen (schluessel, hot_lead_id, art)
  values (p_schluessel, p_hot_lead, p_art)
  on conflict (schluessel) do nothing;

  if not found then
    return 0;   -- schon erinnert
  end if;

  insert into public.system_messages (message_id, empfaenger_id, titel, nachricht, typ, hot_lead_id, gelesen)
  select 'CRM-' || substr(md5(p_schluessel), 1, 12) || '-' || substr(u.id::text, 1, 8),
         u.id, p_titel, p_nachricht, p_typ, p_hot_lead, false
    from public.users u
   where u.status = true
     and ('Admin' = any(u.rollen::text[]) or 'Geschäftsführer' = any(u.rollen::text[]));

  return 1;     -- ein Vorgang, unabhaengig von der Zahl der Empfaenger
end;
$$;
