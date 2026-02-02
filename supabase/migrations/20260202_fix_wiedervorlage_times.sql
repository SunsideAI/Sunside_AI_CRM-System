-- =====================================================
-- MIGRATION: Korrigiere Wiedervorlage-Zeiten aus CSV-Import
-- Problem: Alte Wiedervorlagen haben keine korrekte Uhrzeit
-- Lösung: Update basierend auf den tatsächlichen Daten aus dem CSV-Export
-- =====================================================

-- Hilfsfunktion: Konvertiert deutsches Datumsformat mit AM/PM in TIMESTAMPTZ
-- Format: "18.3.2026 4:32pm" -> TIMESTAMPTZ
CREATE OR REPLACE FUNCTION parse_german_datetime(input TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  date_part TEXT;
  time_part TEXT;
  day_num INT;
  month_num INT;
  year_num INT;
  hour_num INT;
  minute_num INT;
  is_pm BOOLEAN;
  result TIMESTAMPTZ;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN NULL;
  END IF;

  -- Split date and time
  date_part := split_part(input, ' ', 1);
  time_part := lower(split_part(input, ' ', 2));

  -- Parse date (format: D.M.YYYY)
  day_num := split_part(date_part, '.', 1)::INT;
  month_num := split_part(date_part, '.', 2)::INT;
  year_num := split_part(date_part, '.', 3)::INT;

  -- Parse time (format: H:MMam or H:MMpm)
  is_pm := time_part LIKE '%pm';
  time_part := replace(replace(time_part, 'am', ''), 'pm', '');
  hour_num := split_part(time_part, ':', 1)::INT;
  minute_num := split_part(time_part, ':', 2)::INT;

  -- Convert 12-hour to 24-hour format
  IF is_pm AND hour_num < 12 THEN
    hour_num := hour_num + 12;
  ELSIF NOT is_pm AND hour_num = 12 THEN
    hour_num := 0;
  END IF;

  -- Build timestamp (in Berlin timezone)
  result := make_timestamptz(year_num, month_num, day_num, hour_num, minute_num, 0, 'Europe/Berlin');

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE Wiedervorlage-Daten basierend auf Unternehmensname
-- =====================================================

-- Lakemann Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('18.3.2026 4:32pm')
WHERE unternehmensname = 'Lakemann Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Weinmann Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('14.1.2026 8:00pm')
WHERE unternehmensname = 'Weinmann Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- RD Immokontor GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('9.1.2026 2:12am')
WHERE unternehmensname = 'RD Immokontor GmbH' AND wiedervorlage_datum IS NOT NULL;

-- LR Immobilien - Leuschner & Riemer Immobilien GbR
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('15.1.2026 9:27pm')
WHERE unternehmensname = 'LR Immobilien - Leuschner & Riemer Immobilien GbR' AND wiedervorlage_datum IS NOT NULL;

-- Thorsten Marquardt Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('8.1.2026 9:49am')
WHERE unternehmensname = 'Thorsten Marquardt Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Hohe Mark Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 10:12am')
WHERE unternehmensname = 'Hohe Mark Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Brock Immobilien Oldenburg
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('7.1.2026 10:00am')
WHERE unternehmensname = 'Brock Immobilien Oldenburg' AND wiedervorlage_datum IS NOT NULL;

-- Immobilien Anne Zeller e.K.
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 2:00pm')
WHERE unternehmensname = 'Immobilien Anne Zeller e.K.' AND wiedervorlage_datum IS NOT NULL;

-- Genth- Immobilien UG (haftungsbeschränkt)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.1.2026 9:00am')
WHERE unternehmensname = 'Genth- Immobilien UG (haftungsbeschränkt)' AND wiedervorlage_datum IS NOT NULL;

-- Franz Rothenbacher Immobilien - Inh. Elmar Rothenbacher
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('4.5.2026 11:31am')
WHERE unternehmensname = 'Franz Rothenbacher Immobilien - Inh. Elmar Rothenbacher' AND wiedervorlage_datum IS NOT NULL;

-- projekthoch4
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('15.1.2026 11:44am')
WHERE unternehmensname = 'projekthoch4' AND wiedervorlage_datum IS NOT NULL;

-- Dr. Fritz Peter Schmidt
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 9:36am')
WHERE unternehmensname = 'Dr. Fritz Peter Schmidt' AND wiedervorlage_datum IS NOT NULL;

-- Susanne Beyer Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('7.1.2026 11:00am')
WHERE unternehmensname = 'Susanne Beyer Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Andreas Lier
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('5.1.2026 12:30pm')
WHERE unternehmensname = 'Andreas Lier' AND wiedervorlage_datum IS NOT NULL;

-- Financial Service Center - Beratungsgruppe
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 9:47am')
WHERE unternehmensname = 'Financial Service Center - Beratungsgruppe' AND wiedervorlage_datum IS NOT NULL;

-- Gibbesch Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 9:51am')
WHERE unternehmensname = 'Gibbesch Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Florin Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.1.2026 10:00am')
WHERE unternehmensname = 'Florin Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Immocenter Hardt
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('8.6.2026 1:08pm')
WHERE unternehmensname = 'Immocenter Hardt' AND wiedervorlage_datum IS NOT NULL;

-- Zastrow Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 9:42am')
WHERE unternehmensname = 'Zastrow Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Störmer Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 11:46am')
WHERE unternehmensname = 'Störmer Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Dagmar Kurth Grundstücksverwaltung & Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 11:50am')
WHERE unternehmensname = 'Dagmar Kurth Grundstücksverwaltung & Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- DAHLER Starnberg - Immobilienmakler
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('1.3.2026 10:00am')
WHERE unternehmensname = 'DAHLER Starnberg - Immobilienmakler' AND wiedervorlage_datum IS NOT NULL;

-- Immobilien Seegerer
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 1:51pm')
WHERE unternehmensname = 'Immobilien Seegerer' AND wiedervorlage_datum IS NOT NULL;

-- Immobilienverkauf- und verwaltung
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.1.2026 2:12pm')
WHERE unternehmensname = 'Immobilienverkauf- und verwaltung' AND wiedervorlage_datum IS NOT NULL;

-- Rosenberg Doll Immobilien GmbH - Immobilienmakler Mendig
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.1.2026 2:44pm')
WHERE unternehmensname = 'Rosenberg Doll Immobilien GmbH - Immobilienmakler Mendig' AND wiedervorlage_datum IS NOT NULL;

-- Bohlander Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('22.12.2025 10:52am')
WHERE unternehmensname = 'Bohlander Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Lützeler Elke - Immobilien Wirtzfeld
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('16.4.2026 10:34pm')
WHERE unternehmensname = 'Lützeler Elke - Immobilien Wirtzfeld' AND wiedervorlage_datum IS NOT NULL;

-- DIERGARTEN & Team GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.1.2026 8:33pm')
WHERE unternehmensname = 'DIERGARTEN & Team GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Buxtehuder-Hof Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('20.1.2026 11:08am')
WHERE unternehmensname = 'Buxtehuder-Hof Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Bendl & Partner Immobilien - Inh. R. Bendl
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 12:26pm')
WHERE unternehmensname = 'Bendl & Partner Immobilien - Inh. R. Bendl' AND wiedervorlage_datum IS NOT NULL;

-- Bens - van den Berg Immobilien GbR
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('9.1.2026 12:31pm')
WHERE unternehmensname = 'Bens - van den Berg Immobilien GbR' AND wiedervorlage_datum IS NOT NULL;

-- gastro makler
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 12:53pm')
WHERE unternehmensname = 'gastro makler' AND wiedervorlage_datum IS NOT NULL;

-- Alfred X. Kiesling Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('28.12.2025 11:00am')
WHERE unternehmensname = 'Alfred X. Kiesling Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Brainstorm Immobilien - Büro Strasshof
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('5.2.2026 11:00am')
WHERE unternehmensname = 'Brainstorm Immobilien - Büro Strasshof' AND wiedervorlage_datum IS NOT NULL;

-- Alt & Kelber Immobilienkontor Torsten Lubinsky
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('22.1.2026 11:30am')
WHERE unternehmensname = 'Alt & Kelber Immobilienkontor Torsten Lubinsky' AND wiedervorlage_datum IS NOT NULL;

-- Bielak Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('11.2.2026 3:00pm')
WHERE unternehmensname = 'Bielak Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Lorenzen Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 12:31pm')
WHERE unternehmensname = 'Lorenzen Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Waterkant Immo Kontor
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 12:32pm')
WHERE unternehmensname = 'Waterkant Immo Kontor' AND wiedervorlage_datum IS NOT NULL;

-- Christian Kamp Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.5.2026 4:30pm')
WHERE unternehmensname = 'Christian Kamp Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Immobilienmakler B.I.S. Berliner Immobilien Service
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 2:58pm')
WHERE unternehmensname = 'Immobilienmakler B.I.S. Berliner Immobilien Service' AND wiedervorlage_datum IS NOT NULL;

-- HTG Immobilien GmbH. Ihr Makler vor Ort! Im Hachinger Tal und in München.
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('8.2.2026 4:00pm')
WHERE unternehmensname = 'HTG Immobilien GmbH. Ihr Makler vor Ort! Im Hachinger Tal und in München.' AND wiedervorlage_datum IS NOT NULL;

-- Borgmann Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('9.1.2026 1:00pm')
WHERE unternehmensname = 'Borgmann Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Dr. Gerlach Gebäudemanagement
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 1:00pm')
WHERE unternehmensname = 'Dr. Gerlach Gebäudemanagement' AND wiedervorlage_datum IS NOT NULL;

-- iMMO.ideal GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('14.1.2026 2:30pm')
WHERE unternehmensname = 'iMMO.ideal GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Dreyer Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.1.2026 8:11pm')
WHERE unternehmensname = 'Dreyer Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Endres Immobilien Breuberg
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.2.2026 8:17pm')
WHERE unternehmensname = 'Endres Immobilien Breuberg' AND wiedervorlage_datum IS NOT NULL;

-- HB-HB-Immobilien - Immobilienmakler Bremen
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('10.3.2026 8:27pm')
WHERE unternehmensname = 'HB-HB-Immobilien - Immobilienmakler Bremen' AND wiedervorlage_datum IS NOT NULL;

-- Antje Möbes Immobilienmanagement
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.1.2026 10:00am')
WHERE unternehmensname = 'Antje Möbes Immobilienmanagement' AND wiedervorlage_datum IS NOT NULL;

-- Oesterle Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.1.2026 9:00am')
WHERE unternehmensname = 'Oesterle Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Petersen-Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.1.2026 4:00pm')
WHERE unternehmensname = 'Petersen-Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- csk immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.3.2026 10:00am')
WHERE unternehmensname = 'csk immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Milz Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('14.1.2026 3:02pm')
WHERE unternehmensname = 'Milz Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Philipp Pisi (Einzelunternehmen)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.5.2026 3:30pm')
WHERE unternehmensname = 'Philipp Pisi (Einzelunternehmen)' AND wiedervorlage_datum IS NOT NULL;

-- Sparkasse Lemgo - Immobilien-Center
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('16.1.2026 10:02am')
WHERE unternehmensname = 'Sparkasse Lemgo - Immobilien-Center' AND wiedervorlage_datum IS NOT NULL;

-- Thord Schick - Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('12.1.2026 8:45am')
WHERE unternehmensname = 'Thord Schick - Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Bethke-Immobilien-Kontor
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('15.1.2026 10:00am')
WHERE unternehmensname = 'Bethke-Immobilien-Kontor' AND wiedervorlage_datum IS NOT NULL;

-- Active Agent Asset Management und Verwertung GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('14.1.2026 1:41pm')
WHERE unternehmensname = 'Active Agent Asset Management und Verwertung GmbH' AND wiedervorlage_datum IS NOT NULL;

-- IZD-Immobilien Zentrum Deutschland
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('15.1.2026 10:00am')
WHERE unternehmensname = 'IZD-Immobilien Zentrum Deutschland' AND wiedervorlage_datum IS NOT NULL;

-- König Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('15.1.2026 10:00am')
WHERE unternehmensname = 'König Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Kopitz Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('16.2.2026 2:30pm')
WHERE unternehmensname = 'Kopitz Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- CASA Immobilien Dienstleistungs GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('14.1.2026 10:00pm')
WHERE unternehmensname = 'CASA Immobilien Dienstleistungs GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Vosse Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('16.1.2026 12:00pm')
WHERE unternehmensname = 'Vosse Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Halle Wohnbau GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.3.2026 4:30pm')
WHERE unternehmensname = 'Halle Wohnbau GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Andersen Immobilien & Projektierung GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.3.2026 9:00am')
WHERE unternehmensname = 'Andersen Immobilien & Projektierung GmbH' AND wiedervorlage_datum IS NOT NULL;

-- deinimmoberater
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 11:00am')
WHERE unternehmensname = 'deinimmoberater' AND wiedervorlage_datum IS NOT NULL;

-- Ditmar Alfes Immobilien OHG
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 11:00am')
WHERE unternehmensname = 'Ditmar Alfes Immobilien OHG' AND wiedervorlage_datum IS NOT NULL;

-- EXTERNI Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 12:00pm')
WHERE unternehmensname = 'EXTERNI Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Hatz & Team Immobilien - Immobilienmakler in Passau
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 2:30pm')
WHERE unternehmensname = 'Hatz & Team Immobilien - Immobilienmakler in Passau' AND wiedervorlage_datum IS NOT NULL;

-- Karla Fricke Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 2:00pm')
WHERE unternehmensname = 'Karla Fricke Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- GF Immobilien UG (haftungsbeschränkt)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 12:00pm')
WHERE unternehmensname = 'GF Immobilien UG (haftungsbeschränkt)' AND wiedervorlage_datum IS NOT NULL;

-- ELVIRA Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.1.2026 3:00pm')
WHERE unternehmensname = 'ELVIRA Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Behnen Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('21.3.2028 4:17pm')
WHERE unternehmensname = 'Behnen Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Bengi Immobilien - Ihr Immobilienmakler für Bruchsal und Umgebung
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('20.1.2026 8:00am')
WHERE unternehmensname = 'Bengi Immobilien - Ihr Immobilienmakler für Bruchsal und Umgebung' AND wiedervorlage_datum IS NOT NULL;

-- City Immobilien GmbH & CO KG
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('28.1.2026 4:25pm')
WHERE unternehmensname = 'City Immobilien GmbH & CO KG' AND wiedervorlage_datum IS NOT NULL;

-- ENDERS IMMOBILIEN IVD - Bewertung - Verkauf - Vermietung - Verwaltung
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('29.1.2026 4:44pm')
WHERE unternehmensname = 'ENDERS IMMOBILIEN IVD - Bewertung - Verkauf - Vermietung - Verwaltung' AND wiedervorlage_datum IS NOT NULL;

-- Dr. Lehner Immobilien Parchim
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('22.1.2026 10:32am')
WHERE unternehmensname = 'Dr. Lehner Immobilien Parchim' AND wiedervorlage_datum IS NOT NULL;

-- Molter Unternehmensgruppe
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('21.1.2026 2:47pm')
WHERE unternehmensname = 'Molter Unternehmensgruppe' AND wiedervorlage_datum IS NOT NULL;

-- Kollitsch Immobilien NW GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('30.1.2026 11:24am')
WHERE unternehmensname = 'Kollitsch Immobilien NW GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Peges Immobilien GesmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('22.1.2026 11:34am')
WHERE unternehmensname = 'Peges Immobilien GesmbH' AND wiedervorlage_datum IS NOT NULL;

-- Immobilien GmbH der Volksbank Herford-Mindener Land, Büro Bünde
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('23.1.2026 9:37am')
WHERE unternehmensname = 'Immobilien GmbH der Volksbank Herford-Mindener Land, Büro Bünde' AND wiedervorlage_datum IS NOT NULL;

-- Bernd Müller Immobilien Agentur
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('22.6.2026 10:52am')
WHERE unternehmensname = 'Bernd Müller Immobilien Agentur' AND wiedervorlage_datum IS NOT NULL;

-- EMO IMMOBILIEN
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('22.4.2026 1:16pm')
WHERE unternehmensname = 'EMO IMMOBILIEN' AND wiedervorlage_datum IS NOT NULL;

-- Gronninger Immobilien GmbH & Co.KG
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('16.2.2026 12:25pm')
WHERE unternehmensname = 'Gronninger Immobilien GmbH & Co.KG' AND wiedervorlage_datum IS NOT NULL;

-- ImmobilienZentrale Aachen
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('26.1.2026 2:37pm')
WHERE unternehmensname = 'ImmobilienZentrale Aachen' AND wiedervorlage_datum IS NOT NULL;

-- HERGET IMMOBILIEN
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('4.2.2026 3:18pm')
WHERE unternehmensname = 'HERGET IMMOBILIEN' AND wiedervorlage_datum IS NOT NULL;

-- DAHLER Hanau / Offenbach
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.3.2026 4:20pm')
WHERE unternehmensname = 'DAHLER Hanau / Offenbach' AND wiedervorlage_datum IS NOT NULL;

-- Butterweck Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('26.1.2026 3:20pm')
WHERE unternehmensname = 'Butterweck Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- LINK Immobilien GmbH Stuttgart
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('9.2.2026 10:03am')
WHERE unternehmensname = 'LINK Immobilien GmbH Stuttgart' AND wiedervorlage_datum IS NOT NULL;

-- Luzie Baatz GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('26.1.2026 10:00am')
WHERE unternehmensname = 'Luzie Baatz GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Illg Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('1.4.2026 4:21pm')
WHERE unternehmensname = 'Illg Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Friedemann Immobilien e.K.
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.2.2026 11:30am')
WHERE unternehmensname = 'Friedemann Immobilien e.K.' AND wiedervorlage_datum IS NOT NULL;

-- S. Siemens Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('1.4.2026 5:00pm')
WHERE unternehmensname = 'S. Siemens Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Steinadler Immobilien - Florian Dubovci
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('1.6.2026 5:00pm')
WHERE unternehmensname = 'Steinadler Immobilien - Florian Dubovci' AND wiedervorlage_datum IS NOT NULL;

-- Bettina Dietz Immobilien GbR / Immobilienmakler Aschaffenburg
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('19.2.2026 4:00pm')
WHERE unternehmensname = 'Bettina Dietz Immobilien GbR / Immobilienmakler Aschaffenburg' AND wiedervorlage_datum IS NOT NULL;

-- IMMODRESS Immobilien GmbH - Harz & Börde
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 10:37am')
WHERE unternehmensname = 'IMMODRESS Immobilien GmbH - Harz & Börde' AND wiedervorlage_datum IS NOT NULL;

-- immoHAL - Immobilienberatungs- und Vertriebs GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 2:02pm')
WHERE unternehmensname = 'immoHAL - Immobilienberatungs- und Vertriebs GmbH' AND wiedervorlage_datum IS NOT NULL;

-- CENTURY 21 PRO REAL ESTATE
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('14.7.2026 5:00pm')
WHERE unternehmensname = 'CENTURY 21 PRO REAL ESTATE' AND wiedervorlage_datum IS NOT NULL;

-- da'hoim Immobilien Hochschwarzwald
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('10.3.2026 5:14pm')
WHERE unternehmensname = 'da''hoim Immobilien Hochschwarzwald' AND wiedervorlage_datum IS NOT NULL;

-- Engel & Völkers Kelkheim/Taunus
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('24.2.2026 3:45pm')
WHERE unternehmensname = 'Engel & Völkers Kelkheim/Taunus' AND wiedervorlage_datum IS NOT NULL;

-- Glunz Immobilien GmbH & Co. KG
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('24.2.2026 4:00pm')
WHERE unternehmensname = 'Glunz Immobilien GmbH & Co. KG' AND wiedervorlage_datum IS NOT NULL;

-- Sparkasse Marburg-Biedenkopf - Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('10.2.2026 4:00pm')
WHERE unternehmensname = 'Sparkasse Marburg-Biedenkopf - Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Sparkasse Stade-Altes Land - Immobilienzentrum
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('10.2.2026 4:00pm')
WHERE unternehmensname = 'Sparkasse Stade-Altes Land - Immobilienzentrum' AND wiedervorlage_datum IS NOT NULL;

-- Michael Dreiling Immobilien Agentur
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 10:01am')
WHERE unternehmensname = 'Michael Dreiling Immobilien Agentur' AND wiedervorlage_datum IS NOT NULL;

-- Docks Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.2.2026 2:30pm')
WHERE unternehmensname = 'Docks Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- Immobilienmakler Hamburg | MAKRO IMMOBILIEN
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.2.2026 2:33pm')
WHERE unternehmensname = 'Immobilienmakler Hamburg | MAKRO IMMOBILIEN' AND wiedervorlage_datum IS NOT NULL;

-- Jan H. Tudsen GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.2.2026 2:33pm')
WHERE unternehmensname = 'Jan H. Tudsen GmbH' AND wiedervorlage_datum IS NOT NULL;

-- Meissler & Co Immobilien – Büro Ottensen – Alster
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('13.2.2026 2:35pm')
WHERE unternehmensname = 'Meissler & Co Immobilien – Büro Ottensen – Alster' AND wiedervorlage_datum IS NOT NULL;

-- SPITZE-Immobilien
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.2.2026 2:50pm')
WHERE unternehmensname = 'SPITZE-Immobilien' AND wiedervorlage_datum IS NOT NULL;

-- MK Immobilien & Design Bitburg
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 3:00pm')
WHERE unternehmensname = 'MK Immobilien & Design Bitburg' AND wiedervorlage_datum IS NOT NULL;

-- Immofinanz GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.2.2026 3:45pm')
WHERE unternehmensname = 'Immofinanz GmbH' AND wiedervorlage_datum IS NOT NULL;

-- KPC Immobilien GmbH
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.2.2026 4:04pm')
WHERE unternehmensname = 'KPC Immobilien GmbH' AND wiedervorlage_datum IS NOT NULL;

-- THE Q | Premium-ETW | 80% AfA | Mietpool | voll finanziert | EK-Rendite superior
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('10.3.2026 4:35pm')
WHERE unternehmensname = 'THE Q | Premium-ETW | 80% AfA | Mietpool | voll finanziert | EK-Rendite superior' AND wiedervorlage_datum IS NOT NULL;

-- Grotz & Schlümer Immobiliengesellschaft mbH (falls vorhanden, aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('4.2.2026 10:00am')
WHERE unternehmensname LIKE 'Grotz & Schlümer%' AND wiedervorlage_datum IS NOT NULL;

-- Giebl Immobilien (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('2.2.2026 9:30am')
WHERE unternehmensname LIKE 'Giebl Immobilien%' AND wiedervorlage_datum IS NOT NULL;

-- Daniel Krings Immobilien (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('9.2.2026 11:00am')
WHERE unternehmensname LIKE 'Daniel Krings Immobilien%' AND wiedervorlage_datum IS NOT NULL;

-- Heinz-Ulrich Farthmann (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('11.2.2026 11:30am')
WHERE unternehmensname LIKE 'Heinz-Ulrich Farthmann%' AND wiedervorlage_datum IS NOT NULL;

-- Christin Larisch Immobilien (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('27.1.2026 3:30pm')
WHERE unternehmensname LIKE 'Christin Larisch%' AND wiedervorlage_datum IS NOT NULL;

-- City Immobilien GmbH & (aus dem Screenshot, andere als oben)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('28.1.2026 1:00pm')
WHERE unternehmensname LIKE 'City Immobilien GmbH &%' AND stadt = 'Bergisch Gladbach' AND wiedervorlage_datum IS NOT NULL;

-- Immobilien Feuerpeil (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('29.1.2026 9:00am')
WHERE unternehmensname LIKE '%Feuerpeil%' AND wiedervorlage_datum IS NOT NULL;

-- Detlef Köster Immobilien (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('29.1.2026 10:00am')
WHERE unternehmensname LIKE 'Detlef Köster%' AND wiedervorlage_datum IS NOT NULL;

-- BÜRO GONTARSKI (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('6.2.2026 10:30am')
WHERE unternehmensname LIKE '%GONTARSKI%' AND wiedervorlage_datum IS NOT NULL;

-- Baltic Home Immobilien (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('24.2.2026 12:00pm')
WHERE unternehmensname LIKE 'Baltic Home%' AND wiedervorlage_datum IS NOT NULL;

-- Brocks immobilienhandel (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.3.2026 1:00pm')
WHERE unternehmensname LIKE 'Brocks immobilien%' AND wiedervorlage_datum IS NOT NULL;

-- Die Hanse-Immobilien (aus dem Screenshot)
UPDATE leads SET wiedervorlage_datum = parse_german_datetime('3.3.2026 3:44pm')
WHERE unternehmensname LIKE 'Die Hanse-Immobilien%' AND wiedervorlage_datum IS NOT NULL;

-- =====================================================
-- Hilfsfunktion entfernen (optional, kann auch behalten werden)
-- =====================================================
-- DROP FUNCTION IF EXISTS parse_german_datetime(TEXT);

-- =====================================================
-- HINWEIS: Diese Migration in Supabase SQL Editor ausführen
-- Sie aktualisiert alle Wiedervorlage-Daten mit korrekten Uhrzeiten
-- =====================================================
