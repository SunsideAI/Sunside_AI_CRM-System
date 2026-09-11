// Absender-Adressen an einer Stelle.
//
// Vorher standen drei verschiedene im Code, darunter eine auf einer ganz
// anderen Domain (noreply@sunside.io in notify-no-show.js). Mail von einer
// Domain, die nicht fuer den Versanddienst eingerichtet ist, scheitert an der
// Signaturpruefung des Empfaengers oder landet im Spam - und niemand merkt es,
// weil der Versand selbst als erfolgreich gilt.

/** Systemnachrichten an das eigene Team. Antworten sind nicht vorgesehen. */
export const ABSENDER_SYSTEM = 'Sunside CRM <noreply@sunsideai.de>'

/** Mail an Kunden. Hier muss eine Antwort ankommen koennen. */
export const ABSENDER_KUNDE = 'Sunside AI <team@sunsideai.de>'
