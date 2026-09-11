-- Eingespielt am 2026-09-11 um 19:51 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Ticket 10: den Angebots-Zweig absichern.
--
-- Heute wird 'Angebot' als Signal an eine externe Automatisierung gesetzt, die
-- mit 'Angebot versendet' zurueckmeldet. Ob sie das je tut, sieht niemand: Es
-- gibt keinen Zeitpunkt, an dem etwas auffallen koennte.
--
-- Die Zeitstempel setzt der Trigger und nicht die Anwendung - so greifen sie
-- auch fuer den Rueckweg der externen Automatisierung, den wir nicht in der
-- Hand haben.

create or replace function public.hot_lead_angebot_zeitstempel()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    -- Angebot angefordert: Stand festhalten, damit das Abschlussformular ihn
    -- spaeter vorbefuellen kann. setup/retainer sind die Vertragsfelder und
    -- koennen sich bis zum Abschluss noch aendern - das Angebot nicht.
    if new.status = 'Angebot' then
      new.angebot_angefordert_am := coalesce(new.angebot_angefordert_am, now());
      new.angebot_setup   := coalesce(new.angebot_setup, new.setup);
      new.angebot_gebuehr := coalesce(new.angebot_gebuehr, new.retainer);
      new.angebot_paket   := coalesce(new.angebot_paket,
                                      array_to_string(new.produkt_dienstleistung, ', '));
    end if;

    if new.status = 'Angebot versendet' then
      new.angebot_verschickt_am := coalesce(new.angebot_verschickt_am, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hot_lead_angebot on public.hot_leads;
create trigger trg_hot_lead_angebot
  before update of status on public.hot_leads
  for each row execute function public.hot_lead_angebot_zeitstempel();

comment on column public.hot_leads.angebot_angefordert_am is
  'Wann das Angebot bei der Automatisierung angefordert wurde. Bleibt ohne Gegenstueck in angebot_verschickt_am, wenn der Versand nicht zurueckmeldet.';
