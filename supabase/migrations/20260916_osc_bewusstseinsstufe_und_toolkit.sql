-- =====================================================================
-- Bewusstseinsstufe, Tiefe und die Felder des Nachfass-Toolkits
-- =====================================================================
-- Eingespielt am 2026-09-16.
--
-- Quelle: docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md, Teil A
-- (die zwei Formeln) und Teil C (die Feldliste).
--
-- WAS DIESE MIGRATION ERSETZT: 20260913_osc_nachfass_serien.sql war fuer
-- zwei getaktete Nachfass-Strecken gebaut (Tag 0/4/10/21/35 und 0/3/7/14/28)
-- nach Miro F25.1. Teil D der Ressourcen-Datei hebt das auf:
--
--     "Es gibt keine getaktete Mail-Serie mehr." (Entscheidung Niklas, 15.09.2026)
--
-- Die Serien-Migration wurde nie eingespielt und ist geloescht. An ihre
-- Stelle tritt ein Empfehlungs-Motor ohne Kalender.
--
-- DIE AUSLEGUNG, DIE HIER GETROFFEN WIRD: Vorerfahrung kennt drei Zustaende -
-- 'Anbieter beauftragt'/'Eigenes Werkzeug'/'Beides' (= ja), 'Nichts genannt'
-- (= nein) und 'Nicht gefragt' (= unbekannt). Die Formel in Teil A kennt nur
-- ja und nein. Unbekannt wird vorsichtig wie nein behandelt, der Kontakt
-- landet also auf der niedrigeren Stufe. Das ist eine Auslegung, keine
-- Vorgabe. Faellt die Entscheidung anders, ist es eine Zeile hier.
-- =====================================================================

alter table public.hot_leads
  add column if not exists entscheider                 text,
  add column if not exists fragt_nach_konditionen      boolean,
  add column if not exists zuletzt_gesendetes_material jsonb default '[]'::jsonb,
  add column if not exists empfohlenes_nachfass_stueck text;

comment on column public.hot_leads.entscheider is
  'Wer entscheidet. Pflicht ab Opening (Teil C der Ressourcen-Datei).';
comment on column public.hot_leads.fragt_nach_konditionen is
  'Haekchen C: Er hat von sich aus nach Preis, Ablauf oder Start gefragt. Das einzige Haekchen, das ein Mensch setzt - A und B rechnet das System.';
comment on column public.hot_leads.zuletzt_gesendetes_material is
  'Welche Nachfass-Stuecke schon rausgingen, als JSON-Liste. Jedes Stueck geht je Kontakt nur einmal raus (Teil D).';
comment on column public.hot_leads.empfohlenes_nachfass_stueck is
  'Was das CRM vorschlaegt. Der Closer darf ueberstimmen - kein automatischer Versand.';

-- Berechnet, nicht eingegeben: "Der Vertriebler klickt ein Haekchen, sonst
-- nichts. Er waehlt keine Stufe, er benennt keine Tiefe, er bewertet
-- niemanden." Genau das unterscheidet dieses Feld von den sechs Reifegraden,
-- an denen der erste Versuch gescheitert waere.
alter table public.hot_leads
  add column if not exists bewusstseinsstufe smallint
    generated always as (
      case
        when fragt_nach_konditionen is true then 5
        when coalesce(btrim(schmerzpunkt_wortlaut), '') = ''
             and vorerfahrung is distinct from 'Anbieter beauftragt'
             and vorerfahrung is distinct from 'Eigenes Werkzeug im Einsatz'
             and vorerfahrung is distinct from 'Beides' then 1
        when coalesce(btrim(schmerzpunkt_wortlaut), '') <> ''
             and vorerfahrung is distinct from 'Anbieter beauftragt'
             and vorerfahrung is distinct from 'Eigenes Werkzeug im Einsatz'
             and vorerfahrung is distinct from 'Beides' then 2
        when coalesce(btrim(schmerzpunkt_wortlaut), '') = '' then 3
        else 4
      end
    ) stored,
  add column if not exists tiefe text
    generated always as (
      case
        when fragt_nach_konditionen is true then 'Angebot'
        when vorerfahrung in ('Anbieter beauftragt', 'Eigenes Werkzeug im Einsatz', 'Beides') then 'Beweis'
        else 'Grundlage'
      end
    ) stored;

comment on column public.hot_leads.bewusstseinsstufe is
  'Berechnet nach Teil A: C sticht (Stufe 5); sonst A/B -> 1, 2, 3 oder 4. A = Schmerzpunkt im Wortlaut gefuellt, B = Vorerfahrung mit Anbieter/Werkzeug/beidem. ACHTUNG: Vorerfahrung "Nicht gefragt" heisst unbekannt, nicht nein - unbekannt wird hier vorsichtig wie nein behandelt.';
comment on column public.hot_leads.tiefe is
  'Berechnet aus der Stufe: Grundlage (1, 2), Beweis (3, 4), Angebot (5). Regie-Wissen fuer Setter und Closer, steuert nicht das Material im Hauptstrang.';
