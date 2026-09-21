-- ERZEUGT von scripts/vorlagen-einpflegen.mjs am 2026-09-21.
-- Nicht von Hand ändern: Wortlaute in docs/ressourcen/2026-08-12-ressourcen-crm-mailstrecken.md
-- pflegen und das Skript neu laufen lassen.
-- Übergang: VSL Eigentümer fertig = false, VSL Automatisierung fertig = false

insert into public.email_templates (schluessel, name, kategorie, betreff, inhalt, hinweis, aktiv) values
  ('segment_eigentuemer', 'Segment-Mail Eigentümer (Video Streil)', 'Opening', 'Ein kurzer Einblick vor unserem Gespräch', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das gute Gespräch eben und dass Sie sich die Zeit für unseren Termin nehmen. Wie versprochen ein kurzer Einblick vorab, von einem Kollegen: Michael Streil führt ein Maklerbüro in Augsburg und arbeitet seit rund zwei Jahren mit uns. Seine Website-Besucher wurden in dieser Zeit zu über 300 qualifizierten Anfragen, darunter mehr als 25 Bewertungsanfragen und mehr als 25 Eigentümeranfragen. Wie er das erlebt, erzählt er am besten selbst:

{Video-Link}

Das Video dauert wenige Minuten. Und weil immer mehr Eigentümer gar nicht mehr googeln, sondern ChatGPT fragen, sorgen wir dafür, dass unsere Makler auch in den KI-Suchen auftauchen. Sichtbarkeit ist dabei nur einer unserer Hebel: Eigentümergewinnung für Maklerbüros ist genau unser Fach. Welcher Weg bei Ihnen am schnellsten wirkt, schauen wir uns in unserem Gespräch gemeinsam an.

Ich freue mich darauf!

Viele Grüße
{Absender}', null, true),
  ('segment_kaeufer', 'Segment-Mail Kaufinteressenten (Zielfassung, wartet aufs Käufer-Video)', 'Opening', 'Ein kurzer Einblick vor unserem Gespräch', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das gute Gespräch eben und dass Sie sich die Zeit für unseren Termin nehmen. Wie versprochen ein kurzer Einblick vorab: In diesem Video sehen Sie, wie wir für Maklerbüros gezielte Anzeigen schalten und aus den Besuchern ernsthafte Kaufinteressenten machen, mit Kontaktdaten, konkretem Wunsch und geklärter Finanzierung, statt endloser Rückrufe bei Leuten, die nur gucken.

{Video-Link}

Das Video dauert wenige Minuten. Bei Van Hoorn Immobilien wurden aus 30 solchen Kaufinteressenten in vier Wochen zwei Verkäufe. Anzeigen sind dabei nur einer unserer Hebel: Kaufinteressentengewinnung für Maklerbüros ist genau unser Fach. Welcher Weg bei Ihnen am schnellsten wirkt, schauen wir uns in unserem Gespräch gemeinsam an. Und falls Sie auch mehr Eigentümer brauchen: Genau dafür sind wir eigentlich bekannt.

Ich freue mich darauf!

Viele Grüße
{Absender}', 'Zielfassung. Solange das Käufer-Video fehlt, gilt laut Datei die Übergangsfassung mit dem Streil-Kurzschnitt; ihr Wortlaut ist noch in Freigabe.', true),
  ('segment_automatisierung', 'Segment-Mail Automatisierung (Video Beier)', 'Opening', 'Ein kurzer Einblick vor unserem Gespräch', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das gute Gespräch eben und dass Sie sich die Zeit für unseren Termin nehmen. Wie versprochen ein kurzer Einblick vorab: Patrick Beier ist öffentlich bestellter und vereidigter Sachverständiger für Immobilienbewertung, Co-Autor eines Standardwerks im Sprengnetter Verlag und Referent in der Branche. Also jemand, der sehr genau hinschaut, bevor er seinen Namen mit etwas verbindet.

Wir haben sein Büro komplett digitalisiert, und genau das machen wir auch für Makler: Anfragen kommen automatisiert rein, die Abläufe im CRM laufen von selbst, und typischerweise wird dabei rund 30 Prozent des Backoffice frei. In seinen Worten ersetzt die KI-Assistenz heute fast eine ganze Vollzeitkraft im Vertrieb. Wie er das erlebt, erzählt er am besten selbst:

{Video-Link}

Das Video dauert wenige Minuten. Welche Ihrer Abläufe sich so entlasten lassen, schauen wir uns in unserem Gespräch gemeinsam an. Und falls Sie auch mehr Eigentümer brauchen: Genau dafür sind wir eigentlich bekannt.

Ich freue mich darauf!

Viele Grüße
{Absender}', null, true),
  ('segment_sachverstaendige', 'Segment-Mail Sachverständige (Video Beier)', 'Opening', 'Ein kurzer Einblick vor unserem Gespräch', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das gute Gespräch eben und dass Sie sich die Zeit für unseren Termin nehmen. Wie versprochen ein kurzer Einblick vorab, von einem Kollegen aus Ihrem Fach: Patrick Beier ist öffentlich bestellter und vereidigter Sachverständiger für Immobilienbewertung, Co-Autor eines Standardwerks im Sprengnetter Verlag und Referent in der Branche. Also jemand, der sehr genau hinschaut, bevor er seinen Namen mit etwas verbindet.

Wir haben sein Büro komplett digitalisiert. Heute kommen seine Bewertungs- und Gutachtenanfragen automatisiert rein, fünf bis zehn qualifizierte Gutachten-Anfragen im Monat allein über die KI-Assistenz, und im Backoffice ist rund 30 Prozent frei geworden. In seinen Worten ersetzt die Assistenz heute fast eine ganze Vollzeitkraft im Vertrieb. Wie er das erlebt, erzählt er am besten selbst:

{Video-Link}

Das Video dauert wenige Minuten. Ob es Ihnen eher um mehr Anfragen geht oder um weniger Verwaltung: Wo bei Ihnen der größte Hebel liegt, schauen wir uns in unserem Gespräch gemeinsam an.

Ich freue mich darauf!

Viele Grüße
{Absender}', null, true),
  ('segment_vorhaben', 'Segment-Mail Vorhaben (Video Beier)', 'Opening', 'Ihr Vorhaben und unser Gespräch', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das offene Gespräch eben und dass Sie sich die Zeit für unseren Termin nehmen. Sie haben ein konkretes Vorhaben: {Vorhaben in einem Satz, wörtlich aus dem Anruf}. Genau darum geht es in unserem Gespräch: was davon technisch machbar ist, was es braucht und womit man am besten anfängt.

Damit Sie vorab sehen, wie so etwas bei uns aussieht, wenn es fertig ist: Patrick Beier, öffentlich bestellter und vereidigter Sachverständiger, hat sein Büro mit uns Schritt für Schritt automatisiert. Im Video erzählt er, was sich dadurch in seinem Alltag verändert hat: {Video-Link}

Ich freue mich auf unser Gespräch!

Viele Grüße
{Absender}', 'Das Vorhaben in einem Satz wörtlich aus dem Anruf einsetzen.', true),
  ('bestaetigung_eigentuemer', 'Bestätigungsmail nach dem Setting: Eigentümer', 'Setting', 'Ihr nächster Termin, und was bis dahin für Sie entsteht', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das offene Gespräch eben und dass Sie sich die Zeit für den nächsten Termin nehmen. Was der Kollege mitgenommen hat: {Ausgesprochener Bedarf, seine Worte}.

Bis zu unserem nächsten Gespräch entsteht daraus eine SEO- und GEO-Analyse zur Eigentümergewinnung in {Region} und Umgebung.

Eine Bitte vorab: Schauen Sie sich dieses Video an. Darin sehen Sie an einem Büro wie Ihrem, mit welchen Maßnahmen wir Eigentümer gewinnen: Sichtbarkeit bei Google, Empfehlungsmanagement und KI-Assistenzen, Schritt für Schritt: {VSL-Link}. Notieren Sie sich gern Ihre Fragen dazu, die klären wir dann im Gespräch.

Dann steigen wir im Gespräch direkt beim Wesentlichen ein.

Bis dahin
{Absender}

PS: Im Anhang finden Sie das Referenzschreiben von Wüstenrot Immobilien, falls Sie lesen möchten, wie andere Makler die Zusammenarbeit mit uns erleben.', 'Bis der VSL aufgenommen ist, läuft das Loom-Video als {VSL-Link}. Anhang: Referenzschreiben Wüstenrot. Versand-Vermerke: Hast du das Beratungsgespräch selbst geführt, heißt es „Was ich mitgenommen habe". Geht die Mail erst am Folgetag raus, „für das offene Gespräch gestern" statt „eben".', true),
  ('bestaetigung_kaeufer', 'Bestätigungsmail nach dem Setting: Kaufinteressenten', 'Setting', 'Ihr nächster Termin, und was bis dahin für Sie entsteht', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das offene Gespräch eben und dass Sie sich die Zeit für den nächsten Termin nehmen. Was der Kollege mitgenommen hat: {Ausgesprochener Bedarf, seine Worte}.

Bis zu unserem nächsten Gespräch entsteht daraus eine Kalkulation mit Ihren Zahlen und eine Muster-Anzeige für eines Ihrer Objekte.

Eine Bitte vorab: Schauen Sie sich dieses Video an. Darin sehen Sie an einem Büro wie Ihrem, wie der Weg von der heutigen Lage zum Ziel aussieht, Schritt für Schritt: {VSL-Link}

Dann steigen wir im Gespräch direkt beim Wesentlichen ein.

Bis dahin
{Absender}

PS: Im Anhang finden Sie das Referenzschreiben von Wüstenrot Immobilien, falls Sie lesen möchten, wie andere Makler die Zusammenarbeit mit uns erleben.', 'Bis der Käufer-VSL steht: statt des Videos die Van-Hoorn-Fallstudie anhängen und den Video-Absatz entsprechend anpassen. Anhang: Referenzschreiben Wüstenrot. Versand-Vermerke: Hast du das Beratungsgespräch selbst geführt, heißt es „Was ich mitgenommen habe". Geht die Mail erst am Folgetag raus, „für das offene Gespräch gestern" statt „eben".', true),
  ('bestaetigung_automatisierung', 'Bestätigungsmail nach dem Setting: Automatisierung und Vorhaben', 'Setting', 'Ihr nächster Termin, und was bis dahin für Sie entsteht', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das offene Gespräch eben und dass Sie sich die Zeit für den nächsten Termin nehmen. Was der Kollege mitgenommen hat: {Ausgesprochener Bedarf, seine Worte}.

Bis zu unserem nächsten Gespräch entsteht daraus Ihre Automatisierungs-Kurzanalyse: Ihre drei größten Zeitfresser aus dem Gespräch und was davon KI übernehmen kann.

Eine Bitte vorab: Schauen Sie sich dieses Video an. Darin sehen Sie an einem Büro wie Ihrem, wie der Weg von der heutigen Lage zum Ziel aussieht, Schritt für Schritt: {VSL-Link}

Dann steigen wir im Gespräch direkt beim Wesentlichen ein.

Bis dahin
{Absender}', 'Bis der VSL aufgenommen ist: Beier-Referenzschreiben als Anhang, dann ohne zusätzliches PS. Versand-Vermerke: Hast du das Beratungsgespräch selbst geführt, heißt es „Was ich mitgenommen habe". Geht die Mail erst am Folgetag raus, „für das offene Gespräch gestern" statt „eben".', true),
  ('bestaetigung_sachverstaendige', 'Bestätigungsmail nach dem Setting: Sachverständige', 'Setting', 'Ihr nächster Termin, und was bis dahin für Sie entsteht', 'Schönen guten Tag Herr/Frau {Nachname},

vielen Dank für das offene Gespräch eben und dass Sie sich die Zeit für den nächsten Termin nehmen. Was der Kollege mitgenommen hat: {Ausgesprochener Bedarf, seine Worte}.

Bis zu unserem nächsten Gespräch entsteht daraus Ihre Automatisierungs-Kurzanalyse: Ihre größten Zeitfresser im Gutachtenprozess und was davon KI übernehmen kann.

Eine Bitte vorab: Schauen Sie sich dieses Video an. Darin sehen Sie an einem Büro wie Ihrem, wie der Weg von der heutigen Lage zum Ziel aussieht, Schritt für Schritt: {VSL-Link}

Dann steigen wir im Gespräch direkt beim Wesentlichen ein.

Bis dahin
{Absender}', 'Bis der VSL aufgenommen ist: Beier-Referenzschreiben als Anhang, dann ohne zusätzliches PS. Versand-Vermerke: Hast du das Beratungsgespräch selbst geführt, heißt es „Was ich mitgenommen habe". Geht die Mail erst am Folgetag raus, „für das offene Gespräch gestern" statt „eben".', true),
  ('nachfass_zusammenfassung', 'Nachfassen 1: Die Zusammenfassung seiner Zahlen', 'Nachfassen', 'Unser Gespräch vom {Gesprächsdatum}', '{Anrede},

danke für Ihre Zeit gestern. Was ich mitgenommen habe: Sie wollen {Zuwachs} Aufträge im Jahr dazugewinnen, und dafür fehlen Ihnen rund {Nötige Anfragen im Monat} Eigentümeranfragen im Monat. Ihre Worte waren: „{Schmerzpunkt im Wortlaut}".

Das ist keine große Zahl. Genau deshalb finde ich sie interessant.

Ich melde mich in ein paar Tagen mit einem Beispiel, wie ein Büro in einer ähnlichen Lage das gelöst hat.

Viele Grüße
{Absender}', 'Kein Anhang. Das Fallbeispiel als nächsten Kontakt einplanen.', true),
  ('nachfass_fallbeispiel', 'Nachfassen 2: Das Fallbeispiel', 'Nachfassen', 'Wie ein Büro aus {Region} das gelöst hat', '{Anrede},

ich hatte Ihnen ein Beispiel versprochen. Im Anhang finden Sie eines, das Ihrer Lage ziemlich nahe kommt: ähnliche Größe, dasselbe Thema mit {Schmerzpunkt im Wortlaut}.

Interessant ist dabei weniger das Ergebnis als der Weg dahin. Es hat keine großen Umbauten gebraucht.

Sagen Sie mir gern, ob das für Sie übertragbar aussieht.

Viele Grüße
{Absender}', 'Anhang: {Fallbeispiel}', true),
  ('nachfass_auswirkungsfrage', 'Nachfassen 3: Die Auswirkungsfrage', 'Nachfassen', 'Eine Frage, die mir nicht aus dem Kopf geht', '{Anrede},

wir hatten ausgerechnet, dass Ihnen {Nötige Anfragen im Monat} Eigentümeranfragen im Monat zu Ihrem Ziel fehlen. Über ein Jahr sind das {Nötige Anfragen} Anfragen und rechnerisch {Lücke} Aufträge.

Meine Frage: Wenn sich in den nächsten zwölf Monaten nichts ändert, wo stehen Sie dann?

Ich frage nicht rhetorisch. Vielleicht ist die Antwort ja: völlig in Ordnung. Dann ist das auch ein Ergebnis, und ich höre auf zu fragen.

Viele Grüße
{Absender}', 'Zuerst anrufen. Bei Mailbox sprechen und die Mail gleichzeitig schicken.', true),
  ('nachfass_sichtbarkeits_check', 'Nachfassen 4: Der Sichtbarkeits-Check seiner Region', 'Nachfassen', 'Ich habe Ihre Region geprüft', '{Anrede},

ich habe gemacht, was Ihre Eigentümer machen: Ich habe ChatGPT gefragt, welchen Makler es in {Ort} für einen Verkauf empfiehlt. Genannt wurden {Büro 1} und {Büro 2}. Sie waren nicht dabei. Bei Google sieht es ähnlich aus.

Genau dort entstehen die rund {Nötige Anfragen im Monat} Anfragen im Monat, die Ihnen zu Ihrem Ziel fehlen. Sie landen gerade bei den Büros, die sichtbar sind.

Wenn Sie sehen wollen, wie das in Ihrer Region im Detail aussieht, antworten Sie einfach kurz auf diese Mail.

Viele Grüße
{Absender}', 'Den Check vor dem Versand wirklich machen. Nur senden, wenn er bei ChatGPT und Google fehlt.', true),
  ('nachfass_ratgeber', 'Nachfassen 5: Der Ratgeber „Sichtbarer in Ihrer Region"', 'Nachfassen', 'Ein Ratgeber, der zu Ihrem Thema passt', 'Hallo Herr/Frau {Nachname},

Sie sagten damals: „{Schmerzpunkt im Wortlaut}". Dazu passt unser Ratgeber „Sichtbarer in Ihrer Region": wie Eigentümer heute ihren Makler finden, bei Google und zunehmend in KI-Suchen wie ChatGPT, und was ein Büro selbst tun kann, um dort aufzutauchen.

Den können Sie komplett ohne uns nutzen. Wenn Sie beim Lesen eine Frage haben, melden Sie sich gern.

Viele Grüße
{Absender}', 'Anhang: Ratgeber „Sichtbarer in Ihrer Region"', true),
  ('nachfass_beweisstueck', 'Nachfassen 6: Das eine Beweisstück', 'Nachfassen', 'Zu Ihrer Frage aus unserem Gespräch', '{Anrede},

Sie wollten wissen, {Offener Punkt}.

Im Anhang ist das, was ich Ihnen dazu zeigen kann: {ein Beweisstück}. Ohne Kommentar von mir, schauen Sie es sich in Ruhe an.

Wenn danach noch etwas offen ist, sagen Sie mir das gern direkt.

Viele Grüße
{Absender}', 'Genau ein Anhang, passend zu seinem offenen Punkt.', true),
  ('nachfass_referenzanruf', 'Nachfassen 7: Das Referenzanruf-Angebot', 'Nachfassen', 'Wollen Sie mit jemandem sprechen, der nichts davon hat?', '{Anrede},

ich habe nachgedacht: Alles, was ich Ihnen schicke, kommt von uns. Das hilft bei Ihrer Frage nur bedingt.

Deshalb ein Angebot. Ich stelle Ihnen den Kontakt zu einem unserer Kunden her, einem Maklerbüro in ähnlicher Größe. Sie rufen ihn an und fragen ihn, was Sie wollen. Ich bin nicht dabei und bekomme nichts davon mit.

Sagen Sie einfach ja, dann frage ich ihn.

Viele Grüße
{Absender}', 'Zuerst anrufen, bei Mailbox Mail gleichzeitig. Danach beim Zweifler nichts mehr; 14 Tage ohne Reaktion, dann wiedervorlagefähig.', true),
  ('nachfass_abschied', 'Nachfassen 8: Der Abschied', 'Nachfassen', 'Hat sich das Thema für Sie erledigt?', '{Anrede},

ich schließe den Vorgang bei mir, offenbar passt es gerade nicht.

Worum es ging: Sie wollten {Zuwachs} Aufträge im Jahr dazugewinnen, und dafür fehlten rund {Nötige Anfragen im Monat} Eigentümeranfragen im Monat.

Eine Frage habe ich noch, und ich kann die Wahrheit gut vertragen. Ist das noch ein Thema, passt es gerade nur nicht, oder ist es für Sie doch nichts?

Wenn es später wieder aufkommt, schreiben Sie mir einfach. Ich melde mich sonst nicht mehr.

Alles Gute Ihnen
{Absender}', null, true),
  ('nachfass_sv_ranking', 'Nachfassen: SV-Ranking-Beweis (Scheffler vor Heid)', 'Nachfassen', 'Ein Ranking-Beispiel, das Sie interessieren dürfte', 'Hallo Herr/Frau {Nachname},

ich habe kürzlich etwas geprüft und dabei einen Sachverhalt gesehen, der Sie interessieren dürfte. Heid Immobilienbewertung kennen Sie vermutlich: eines der renommiertesten und deutschlandweit sichtbarsten Sachverständigenbüros, das seit Jahren erheblich in seine Google-Sichtbarkeit investiert. In Luckenwalde steht unser Kunde Scheffler Immobilienbewertung trotzdem darüber, nach zwei Monaten, mit unseren Artikeln und Unterseiten, bei Google und in den KI-Suchen.

Den Screenshot habe ich angehängt, prüfen Sie es gern selbst bei Google. Unsere SEO- und GEO-Analyse für Ihre Region zeigt: Das können wir auch für Sie in einigen Ihrer Orte erreichen.

Wenn Sie wissen möchten, welche Orte das bei Ihnen wären, antworten Sie einfach kurz auf diese Mail.

Viele Grüße
{Absender}', 'Screenshot vor jedem Versand aktuell ziehen und nachprüfen. Je Kontakt nur einmal.', true)
on conflict (schluessel) where schluessel is not null do update set
  name = excluded.name,
  kategorie = excluded.kategorie,
  betreff = excluded.betreff,
  inhalt = excluded.inhalt,
  hinweis = excluded.hinweis,
  updated_at = now();
