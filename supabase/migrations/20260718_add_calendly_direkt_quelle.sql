-- Neuer Enum-Wert für die Direktbuchungs-Auto-Anlage.
--
-- Hintergrund: Wenn ein Kunde direkt über den Calendly-Link bucht (ohne
-- vorherigen Cold-Kontakt), legen wir automatisch einen Cold Lead in
-- `leads` UND einen Hot Lead in `hot_leads` an. Für die Attribution
-- brauchen wir eine Quelle, die diese Direktbuchungen sauber von Cold
-- Calling / E-Book / Empfehlung abtrennt - sonst mischen sie sich in
-- der Analytik unter "Cold Calling", weil das aktuell der Default ist,
-- den die Setter manuell wählen wenn sie den Termin manuell nachtragen.

ALTER TYPE quelle_type ADD VALUE IF NOT EXISTS 'Calendly Direkt';
