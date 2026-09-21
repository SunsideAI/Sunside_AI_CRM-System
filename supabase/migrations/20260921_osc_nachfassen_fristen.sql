-- Nachfassen: Zähler, Fristen, Wiedervorlage (Phase 5 im Plan v2)
--
-- Quelle: Mailstrecken-Datei Teil D (fünf Leitplanken) und Feldspezifikation
-- Block 4/4b. Keine getaktete Serie: Das System zählt, erinnert und schlägt
-- vor, der Mensch schreibt.
--
-- crm_fristen_pruefen() wird ersetzt. Die Regeln 1 bis 6 sind wörtlich die
-- Live-Fassung vom 21.09. (aus pg_get_functiondef gelesen), 7 bis 11 kommen
-- dazu. Die neuen Regeln melden an den, der den Kontakt hat, und nur wenn es
-- niemanden gibt, an die Leitung.

alter table public.hot_leads
  -- Wann zuletzt nachgefasst wurde. Der Zähler selbst ist nachfass_schritt.
  add column if not exists nachfass_letzter_versuch timestamptz,
  -- Pflicht bei „Verloren, wiedervorlagefähig", zusammen mit wiedervorlage_am.
  add column if not exists verlust_grund text;

-- Die Regeln 7 bis 11 laufen erst, wenn dieser Schalter an ist. Geprüft am
-- 21.09.: Regel 7 allein hätte beim ersten Lauf 159 Meldungen an Leute
-- geschickt, die noch mit dem veröffentlichten Stand arbeiten. Umlegen gehört
-- ins Go-live (Phase 6).
insert into public.einstellungen (schluessel, wert, beschreibung) values
  ('osc_fristen_aktiv', 'aus', 'Erinnerungen beim Nachfassen (Regeln 7 bis 11 im stündlichen Lauf): an oder aus')
on conflict (schluessel) do nothing;

-- Erinnerung an eine Person; ohne Person an die Leitung.
create or replace function public.crm_erinnern_an(
  p_empfaenger uuid, p_schluessel text, p_art text, p_hot_lead uuid,
  p_typ text, p_titel text, p_nachricht text
) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if p_empfaenger is null then
    return crm_erinnern(p_schluessel, p_art, p_hot_lead, p_typ, p_titel, p_nachricht);
  end if;

  insert into public.crm_erinnerungen (schluessel, hot_lead_id, art)
  values (p_schluessel, p_hot_lead, p_art)
  on conflict (schluessel) do nothing;
  if not found then
    return 0;
  end if;

  insert into public.system_messages (message_id, empfaenger_id, titel, nachricht, typ, hot_lead_id, gelesen)
  values ('CRM-' || substr(md5(p_schluessel), 1, 12) || '-' || substr(p_empfaenger::text, 1, 8),
          p_empfaenger, p_titel, p_nachricht, p_typ, p_hot_lead, false);
  return 1;
end;
$$;

create or replace function public.crm_fristen_pruefen()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lauf bigint := lauf_starten('crm-fristen');
  r record;
  v_termine int := 0; v_bewerbungen int := 0; v_wiedervorlagen int := 0;
  v_vertraege int := 0; v_angebote int := 0; v_unterschriften int := 0;
  v_geplatzt int := 0; v_vertagt int := 0; v_still int := 0; v_zweifler int := 0; v_fuenf int := 0;
  v_osc boolean := coalesce((select wert = 'an' from public.einstellungen where schluessel = 'osc_fristen_aktiv'), false);
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

  if v_osc then

  -- 7. Termin geplatzt, nach 48 Stunden kein neuer. Dann greift das
  --    Nachfassen (Teil D, Leitplanke 1). Beim Abschlussgespräch an den
  --    Closer, beim Beratungsgespräch an den Setter.
  for r in
    select h.id, h.unternehmen, h.status, h.setter_id, h.closer_id,
           h.termin_abschlussgespraech, h.termin_beratungsgespraech,
           coalesce(h.termin_abschlussgespraech, h.termin_beratungsgespraech) as termin
      from public.hot_leads h
     where h.status in ('Nicht erschienen', 'Termin abgesagt')
       -- Nur die letzten 14 Tage: Ältere geplatzte Termine sind Altbestand und
       -- würden beim Einschalten sonst alle auf einmal melden.
       and coalesce(h.termin_abschlussgespraech, h.termin_beratungsgespraech)
           between now() - interval '14 days' and now() - interval '48 hours'
  loop
    v_geplatzt := v_geplatzt + crm_erinnern_an(
      case when r.termin_abschlussgespraech is not null then r.closer_id else r.setter_id end,
      'geplatzt-48h:' || r.id::text || ':' || r.termin::text, 'geplatzt_48h', r.id, 'Pool Update',
      'Seit 48 Stunden kein neuer Termin: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Der Termin am ' || to_char(r.termin at time zone 'Europe/Berlin', 'DD.MM.YYYY') ||
      ' ist ' || lower(r.status) || '. Bitte neu terminieren oder nachfassen.');
  end loop;

  -- 8. Beratungsgespräch vertagt, nach 48 Stunden noch kein Abschlusstermin.
  --    Der Setter fasst selbst nach (Feldspezifikation Block 3).
  for r in
    select h.id, h.unternehmen, h.setter_id, h.termin_beratungsgespraech
      from public.hot_leads h
     where h.status = 'Beratungsgespräch geführt'
       and h.ergebnis_beratung = 'Vertagt ohne festen Schritt'
       and h.termin_abschlussgespraech is null
       and h.termin_beratungsgespraech < now() - interval '48 hours'
  loop
    v_vertagt := v_vertagt + crm_erinnern_an(
      r.setter_id, 'vertagt-48h:' || r.id::text, 'vertagt_48h', r.id, 'Pool Update',
      'Vertagt, noch kein Abschlusstermin: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Das Beratungsgespräch am ' ||
        to_char(r.termin_beratungsgespraech at time zone 'Europe/Berlin', 'DD.MM.YYYY') ||
        ' endete ohne festen Schritt. Bitte nachfassen und den Abschlusstermin legen.');
  end loop;

  -- 9. Wird nachgefasst, seit sieben Tagen nichts passiert und kein Termin
  --    in Sicht (Feldspezifikation Block 4b, Wiedervorlage-Wecker).
  for r in
    select h.id, h.unternehmen, h.closer_id,
           coalesce(h.nachfass_letzter_versuch, h.termin_abschlussgespraech, h.updated_at) as zuletzt
      from public.hot_leads h
     where h.status = 'Wird nachgefasst'
       and coalesce(h.nachfass_letzter_versuch, h.termin_abschlussgespraech, h.updated_at) < now() - interval '7 days'
       and not (coalesce(h.termin_abschlussgespraech, '-infinity') > now())
  loop
    v_still := v_still + crm_erinnern_an(
      r.closer_id, 'nachfassen-still:' || r.id::text || ':' || to_char(r.zuletzt, 'YYYY-MM-DD'),
      'nachfassen_still', r.id, 'Pool Update',
      'Seit sieben Tagen still: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Seit dem ' || to_char(r.zuletzt at time zone 'Europe/Berlin', 'DD.MM.YYYY') ||
      ' ist beim Nachfassen nichts passiert. Das CRM schlägt das nächste Stück vor.');
  end loop;

  -- 10. Zweifler: Referenzanruf-Angebot ohne Reaktion seit 14 Tagen. Danach
  --     kommt nichts mehr, der Kontakt wird wiedervorlagefähig (Vorlage 7).
  for r in
    select h.id, h.unternehmen, h.closer_id, h.nachfass_letzter_versuch
      from public.hot_leads h
     where h.status = 'Wird nachgefasst'
       and h.nachfass_grund = 'Kunde will, traut sich noch nicht'
       and h.material_versendet[array_length(h.material_versendet, 1)] like 'Nachfassen 7:%'
       and h.nachfass_letzter_versuch < now() - interval '14 days'
  loop
    v_zweifler := v_zweifler + crm_erinnern_an(
      r.closer_id, 'zweifler-14:' || r.id::text, 'zweifler_14', r.id, 'Pool Update',
      'Referenzanruf ohne Reaktion: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Seit 14 Tagen keine Antwort auf das Referenzanruf-Angebot. Bitte auf „Verloren, wiedervorlagefähig" setzen, mit Datum und Grund.');
  end loop;

  -- 11. Fünf Versuche erreicht, der Abschied ist noch nicht raus (Leitplanke 4).
  for r in
    select h.id, h.unternehmen, h.closer_id
      from public.hot_leads h
     where h.status = 'Wird nachgefasst'
       and coalesce(h.nachfass_schritt, 0) >= 5
       and not coalesce(h.material_versendet, '{}') && array['Nachfassen 8: Der Abschied']
  loop
    v_fuenf := v_fuenf + crm_erinnern_an(
      r.closer_id, 'fuenf-versuche:' || r.id::text, 'fuenf_versuche', r.id, 'Pool Update',
      'Fünf Versuche erreicht: ' || coalesce(r.unternehmen, 'Ohne Namen'),
      'Mehr rechnet sich nicht. Das CRM legt jetzt den Abschied vor, danach wird der Kontakt wiedervorlagefähig.');
  end loop;

  end if;

  v_ergebnis := jsonb_build_object(
    'termine_ohne_setter', v_termine,
    'bewerbungen_ueberfaellig', v_bewerbungen,
    'wiedervorlagen', v_wiedervorlagen,
    'vertragsenden', v_vertraege,
    'angebote_ohne_bestaetigung', v_angebote,
    'unterschriften_offen', v_unterschriften,
    'geplatzt_48h', v_geplatzt,
    'vertagt_48h', v_vertagt,
    'nachfassen_still', v_still,
    'zweifler_14', v_zweifler,
    'fuenf_versuche', v_fuenf,
    'osc_fristen_aktiv', v_osc);

  perform lauf_beenden(v_lauf, v_ergebnis, null);
  return v_ergebnis;
exception when others then
  perform lauf_beenden(v_lauf, null, sqlerrm);
  raise;
end;
$$;
