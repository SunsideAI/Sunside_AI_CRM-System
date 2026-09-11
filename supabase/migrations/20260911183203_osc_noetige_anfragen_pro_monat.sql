-- Eingespielt am 2026-09-11 um 18:32 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Korrektur: die Spalte hiess "pro Monat", rechnete aber Jahreswerte.
--
-- Eingabe ist "Gewuenschte zusaetzliche Auftraege pro JAHR" (F24), die Anzeige
-- ist "Noetige Anfragen pro MONAT". Der Teiler 12 fehlte. Ohne ihn haette der
-- Setter dem Kunden das Zwoelffache seines tatsaechlichen Bedarfs vorgerechnet -
-- und dieselbe Zahl steht laut F24 spaeter im Strategiepapier.
alter table public.hot_leads drop column if exists noetige_anfragen;

alter table public.hot_leads
  add column noetige_anfragen numeric
    generated always as (
      case when zuwachs_auftraege is not null
            and abschlussquote is not null
            and abschlussquote > 0
           then round(zuwachs_auftraege / (abschlussquote / 10.0) / 12.0, 1)
      end
    ) stored;

comment on column public.hot_leads.noetige_anfragen is
  'Noetige Anfragen pro Monat. Aus Wunsch-Auftraegen pro Jahr und Abschlussquote (x von 10), geteilt durch 12. Null, sobald eine Zahl fehlt - eine fehlende Angabe ist keine Null.';

-- Der Bereich daraus, Grundlage des Empfehlungs-Pakets (F23/F24).
alter table public.hot_leads
  add column if not exists anfragen_bereich text
    generated always as (
      case
        when zuwachs_auftraege is null or abschlussquote is null or abschlussquote <= 0 then null
        when zuwachs_auftraege / (abschlussquote / 10.0) / 12.0 < 2 then 'unter 2'
        when zuwachs_auftraege / (abschlussquote / 10.0) / 12.0 <= 4 then '2 bis 4'
        else 'über 4'
      end
    ) stored;

comment on column public.hot_leads.anfragen_bereich is
  'Zeigt dem Closer, welches Paket die Zahlen begruenden. Berechnet, nicht eingegeben.';

-- Der Setter vertieft im Gespraech, was der Opener woertlich aufgenommen hat.
-- Zwei getrennte Saetze laut F24, nicht einer, der ueberschrieben wird.
alter table public.hot_leads
  add column if not exists schmerzpunkt_vertieft text;

comment on column public.hot_leads.schmerzpunkt_vertieft is
  'Groesstes Problem, bestaetigt und vertieft, woertlich. Der Satz aus dem Erstanruf, durch Nachfragen bestaetigt.';
