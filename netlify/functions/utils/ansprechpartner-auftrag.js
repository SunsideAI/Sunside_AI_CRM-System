/**
 * Der Auftrag an das Modell, das die Ansprechpartner aus den Impressen liest.
 *
 * Steht hier und nicht im Scraper, weil ansprechpartner-diagnose denselben
 * Text braucht. Liefe die Diagnose mit einem anderen Auftrag, zeigte sie
 * nicht, was der echte Lauf tut - und genau das ist ihr Zweck.
 */
export const AUFTRAG =
    'Du liest Ausschnitte aus Impressen von Immobilienfirmen und nennst den '
  + 'Ansprechpartner - den Inhaber, Geschäftsführer oder gesetzlichen Vertreter.\n\n'
  + 'Antworte als JSON: {"treffer":[{"nr":1,"vorname":"...","nachname":"..."}]}.\n'
  + 'Nenne JEDEN Ausschnitt in der Antwort. Findest du keinen Namen, schreibe '
  + '{"nr":3,"vorname":null,"nachname":null} - so ist unterscheidbar, ob du '
  + 'einen Eintrag geprüft und verworfen oder bloß übersehen hast.\n\n'
  + 'STEHT EIN NAME DA, NIMM IHN. Diese Firmen sind meist Ein-Personen-Betriebe, '
  + 'und der Name im Impressum ist genau der Mensch, den wir suchen.\n\n'
  /* Diese vier Regeln stehen so ausführlich da, weil der Scraper sie dreimal
     weicher formuliert bekam und das Modell die Namen trotzdem wegliess:
     "Johannes Rudert Immobilien", "KLEINER Immobilien | Lisa Kleiner",
     "Geschäftsführer: Alexander Johannes" und "Verantwortlicher: Monika
     Haumann" - alle vier eindeutig, alle vier verworfen. */
  + 'Die vier Fälle, in denen Zurückhaltung falsch ist:\n\n'
  + '1. DER NACHNAME STECKT IM FIRMENNAMEN. Das ist der Normalfall bei '
  + 'Immobilienmaklern, kein Warnsignal. "KLEINER Immobilien" mit "Lisa Kleiner" '
  + '-> Lisa Kleiner. "Johannes Immobilien" mit "Geschäftsführer: Alexander '
  + 'Johannes" -> Alexander Johannes. "Vollmers Immobilien" mit "Björn Vollmers" '
  + '-> Björn Vollmers.\n'
  + '2. FIRMENNAME UND NAME VERSCHMOLZEN. "Johannes Rudert Immobilien" ist '
  + '"Johannes Rudert" plus Branche -> Johannes Rudert. "Peter Maier '
  + 'Hausverwaltung" -> Peter Maier. Streiche das Branchenwort und behalte den '
  + 'Menschen.\n'
  + '3. EIN ZWEITER NAME DANEBEN. Steht neben dem Verantwortlichen noch ein '
  + 'Webdesigner, eine Agentur oder ein Hoster, nimm den mit der Rolle und '
  + 'übergeh den Rest. "Verantwortlicher gemäß § 5 TMG: Monika Haumann | Design '
  + '& Hosting: KreativStudio Sebastian Hohmann" -> Monika Haumann.\n'
  + '4. DIE MAILADRESSE PASST NICHT ZUR FIRMA. Das ist normal (zweite Domain, '
  + 'alter Name) und kein Grund, den Namen wegzulassen. Ob die Domain fremd '
  + 'ist, wird vorher geprüft - das ist nicht deine Aufgabe.\n\n'
  + 'Lass einen Eintrag nur WEG, wenn:\n'
  + '- wirklich kein Personenname dasteht, sondern nur eine Firma '
  + '("MEISSLER & CO Verwaltungs GmbH", "Heimburger Immobilien")\n'
  + '- der einzige Name erkennbar dem Webdesigner, der Agentur oder dem Hoster '
  + 'gehört und sonst niemand genannt wird\n'
  + '- es ein Gründer aus der Firmenhistorie ist und daneben die heutige Leitung steht\n'
  + '- es ein Begriffspaar ist und kein Name ("Ansprechpartner '
  + 'Immobilienverwaltung", "Mark Wohnungsgesellschaft", "Gesetzlicher Vertreter")\n'
  + '- nur ein Nachname ohne Vornamen dasteht, oder nur ein Vorname\n'
  + '- es eine Abkürzung ist (WEG, IVD, RDM, HV) oder ein Begriff aus dem '
  + 'Seitentext, den du mangels Namen genommen hast\n'
  + '- die Firma die Niederlassung einer Kette ist und das Impressum der Zentrale '
  + 'gehört. Erkennbar daran, dass die Adresse auf eine Unterseite zeigt '
  + '(ksk-immobilien.de/standort/siegburg) oder der Firmenname einen Ort trägt, '
  + 'den das Impressum nicht nennt. Der dort genannte Vorstand ist nicht der '
  + 'Ansprechpartner dieser Niederlassung.\n\n'
  + 'Stehen mehrere gleichrangige Personen da, nimm die erste. Titel wie '
  + 'Dipl.-Ing., Mag., MMag. oder Dr. gehören nicht in den Namen. Schreibe Namen '
  + 'in normaler Gross- und Kleinschreibung, auch wenn der Ausschnitt sie in '
  + 'Grossbuchstaben zeigt.'
