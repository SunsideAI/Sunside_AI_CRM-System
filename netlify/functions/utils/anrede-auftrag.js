/**
 * Der Auftrag an das Modell, das Vornamen ein Geschlecht zuordnet.
 *
 * Steht hier und nicht in anrede-nachtragen, weil die Diagnose denselben
 * Text braucht: Fragte sie anders, zeigte sie nicht, was der echte Lauf
 * tut - und genau das ist ihr Zweck. Dieselbe Trennung wie bei
 * ansprechpartner-auftrag.js.
 */
export const ANREDE_AUFTRAG =
    'Du ordnest Vornamen einem Geschlecht zu, für die Anrede in einer '
  + 'Geschäftsmail. Antworte als JSON: '
  + '{"namen":[{"name":"...","anrede":"Herr|Frau|unklar"}]}.\n'
  + 'Nenne JEDEN Namen in der Antwort, auch die unklaren - sonst ist nicht '
  + 'unterscheidbar, ob du einen geprüft oder übersehen hast.\n\n'
  /* Der alte Auftrag sagte dreimal "im Zweifel unklar" und nannte kein
     Gegenbeispiel. Das Modell nahm das woertlich: von 870 Leads ohne Anrede
     blieben nach einem Lauf 740 uebrig, darunter Jannik, Francesco, Dominic,
     Helge, Frauke und Friederike - alle sechs in Deutschland eindeutig. */
  + '"unklar" ist nur für echte Doppelnamen gedacht: Namen, die in '
  + 'Deutschland regelmäßig für Frauen UND Männer vergeben werden - Kim, '
  + 'Dominique, Toni, Chris, Sidney, Nicola, Kay, Sascha, Conny, Michele, '
  + 'Jean, Sam, Andrea (in Italien männlich, in Deutschland weiblich).\n\n'
  + 'Ein Name, der in Deutschland klar einem Geschlecht zugeordnet wird, '
  + 'bekommt dieses Geschlecht - auch wenn er selten ist, aus dem Ausland '
  + 'kommt oder eine ungewohnte Schreibweise hat. Jannik, Niko, Helge, '
  + 'Yannick und Franz-Josef sind Herr; Frauke, Friederike, Hilke und Viola '
  + 'sind Frau. Francesco, Laurent, François, Selim, Talip und Ueli sind '
  + 'Herr, auch wenn sie nicht deutsch sind.\n\n'
  + '"unklar" gilt außerdem für Nachnamen, Firmen und alles, was kein '
  + 'Vorname ist.\n\n'
  + 'Eine falsche Anrede fällt beim Empfänger sofort auf. Eine fehlende '
  + 'kostet uns aber die persönliche Anrede in jeder Mail an diesen '
  + 'Kontakt - also raten nicht, aber auch nicht aus Bequemlichkeit '
  + '"unklar" sagen.'
