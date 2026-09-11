-- Eingespielt am 2026-09-11 um 19:51 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Zwei weitere Regeln fuer den stuendlichen Lauf: der Angebots-Zweig.
create or replace function public.crm_fristen_pruefen()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lauf bigint := lauf_starten('crm-fristen');
  r record;
  v_termine int := 0; v_bewerbungen int := 0; v_wiedervorlagen int := 0;
  v_vertraege int := 0; v_angebote int := 0; v_unterschriften int := 0;
  v_ergebnis jsonb;
begin
  -- 1. Termin binnen 24 Stunden, aber niemand eingeteilt.
  for r in
    select h.id, h.unternehmen, h.termin_beratungsgespraech
      from public.hot_leads h
     where h.setter_id is null
       and h.termin_beratungsgespraech between now() and now() + interval '24 hours'
       and h.status not in ('Verloren, endgültig', 'Verloren, wiedervorlagefähig', 'Gewonnen')
  loop
    v_termine := v_termine + crm_erinnern(
      'termin-ohne-setter:' || r.id::text, 'termin_ohne_setter', r.id, 'Pool Update',
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
     where b.status = 'Offen' and b.erstellt_am < now() - interval '2 hours'
  loop
    v_bewerbungen := v_bewerbungen + crm_erinnern(
      'bewerbung-offen:' || r.id::text, 'bewerbung_offen', r.hot_lead_id, 'Pool Update',
      'Bewerbung wartet seit über zwei Stunden',
      r.bewerber || ' wartet auf die Entscheidung zu ' || coalesce(r.unternehmen, 'einem Kontakt') ||
        ' (' || coalesce(r.stufe, 'Closer') || '). Eingegangen am ' ||
        to_char(r.erstellt_am at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || ' Uhr.');
  end loop;

  -- 3. Wiedervorlage faellig.
  for r in
    select h.id, h.unternehmen, h.wiedervorlage_am from public.hot_leads h
     where h.wiedervorlage_am is not null and h.wiedervorlage_am <= current_date
       and h.status = 'Verloren, wiedervorlagefähig'
  loop
    v_wiedervorlagen := v_wiedervorlagen + crm_erinnern(
      'wiedervorlage:' || r.id::text || ':' || r.wiedervorlage_am::text,
      'wiedervorlage', r.id, 'Pool Update',
      'Wiedervorlage fällig: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Der Kontakt wurde zum ' || to_char(r.wiedervorlage_am, 'DD.MM.YYYY') ||
      ' zur Wiedervorlage gesetzt. Bitte wieder aufnehmen.');
  end loop;

  -- 4. Vereinbarung endet binnen 30 Tagen.
  for r in
    select h.id, h.unternehmen, h.vertrag_laeuft_bis from public.hot_leads h
     where h.vertrag_laeuft_bis between current_date and current_date + 30
       and h.kuendigung_zum is null
  loop
    v_vertraege := v_vertraege + crm_erinnern(
      'vertragsende:' || r.id::text || ':' || r.vertrag_laeuft_bis::text,
      'vertragsende', r.id, 'Pool Update',
      'Vereinbarung läuft aus: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Die Vereinbarung endet am ' || to_char(r.vertrag_laeuft_bis, 'DD.MM.YYYY') ||
      '. Verlängerung klären.');
  end loop;

  -- 5. Angebot angefordert, aber der Versand hat nach 30 Minuten nicht
  --    zurueckgemeldet. Bisher fiel ein stummer Versanddienst niemandem auf.
  for r in
    select h.id, h.unternehmen, h.angebot_angefordert_am from public.hot_leads h
     where h.status = 'Angebot'
       and h.angebot_angefordert_am < now() - interval '30 minutes'
       and h.angebot_verschickt_am is null
  loop
    v_angebote := v_angebote + crm_erinnern(
      'angebot-ohne-bestaetigung:' || r.id::text, 'angebot_stumm', r.id, 'Pool Update',
      'Angebot ohne Versandbestätigung: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Das Angebot wurde am ' ||
        to_char(r.angebot_angefordert_am at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') ||
        ' Uhr angefordert, der Versand hat aber nicht zurückgemeldet. Bitte prüfen, ob es beim Kunden angekommen ist.');
  end loop;

  -- 6. Angebot verschickt, seit sieben Tagen keine Unterschrift.
  for r in
    select h.id, h.unternehmen, h.angebot_verschickt_am from public.hot_leads h
     where h.status = 'Angebot versendet'
       and h.angebot_verschickt_am < now() - interval '7 days'
  loop
    v_unterschriften := v_unterschriften + crm_erinnern(
      'unterschrift-offen:' || r.id::text || ':' ||
        to_char(date_trunc('week', now()), 'IYYY-IW'),
      'unterschrift_offen', r.id, 'Pool Update',
      'Seit einer Woche keine Unterschrift: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Das Angebot ging am ' ||
        to_char(r.angebot_verschickt_am at time zone 'Europe/Berlin', 'DD.MM.YYYY') ||
        ' raus. Bitte nachfassen oder den Kontakt in die Nachfass-Strecke geben.');
  end loop;

  v_ergebnis := jsonb_build_object(
    'termine_ohne_setter', v_termine,
    'bewerbungen_ueberfaellig', v_bewerbungen,
    'wiedervorlagen', v_wiedervorlagen,
    'vertragsenden', v_vertraege,
    'angebote_ohne_bestaetigung', v_angebote,
    'unterschriften_offen', v_unterschriften);

  perform lauf_beenden(v_lauf, v_ergebnis, null);
  return v_ergebnis;
exception when others then
  perform lauf_beenden(v_lauf, null, sqlerrm);
  raise;
end;
$$;
