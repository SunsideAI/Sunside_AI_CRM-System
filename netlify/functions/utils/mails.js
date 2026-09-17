// Jede Mail, die das CRM an das Team schickt - als reine Funktion.
//
// Eine Function holt die Daten und ruft hier auf; was in der Mail steht,
// steht nur hier. So laesst sich jede Mail ohne Datenbank rendern und
// pruefen (scripts/mails-vorschau.mjs).
//
// Rueckgabe immer { betreff, mail: { html, text } }.

import { systemMail, betreff, fett } from './mailLayout.js'

const plural = (n, eins, mehr) => `${n} ${n === 1 ? eins : mehr}`
const terminart = art => (art === 'video' ? 'Video-Call' : art ? 'Telefon' : null)

/** Ein Opener hat ein Beratungsgespräch gelegt, noch ohne Setter. */
export function neuerTerminImPool({ gebuchtVon, unternehmen, ansprechpartner, datum, art }) {
  return {
    betreff: betreff('Setting', `Neuer Termin im Pool: ${unternehmen}`),
    mail: systemMail({
      bereich: 'Setting', ton: 'aktion', zustand: 'Zu erledigen',
      titel: 'Neuer Beratungstermin im Pool',
      einleitung: `${fett(gebuchtVon || 'Ein Opener')} hat ein Beratungsgespräch gelegt. Noch ist kein Setter eingeteilt.`,
      fakten: [['Unternehmen', unternehmen], ['Ansprechpartner', ansprechpartner], ['Termin', datum], ['Terminart', terminart(art)]],
      knopf: ['Im Setter-Pool bewerben', '/setting'],
      grund: 'Du bekommst diese Mail, weil du Setter oder in der Leitung bist.'
    })
  }
}

/** Ein Closer hat einen Termin zurück in den Closer-Pool gegeben. */
export function terminWiederFrei({ freigegebenVon, unternehmen, ansprechpartner, datum, art }) {
  return {
    betreff: betreff('Closing', `Termin wieder frei: ${unternehmen || 'Kontakt'}`),
    mail: systemMail({
      bereich: 'Closing', ton: 'aktion', zustand: 'Zu erledigen',
      titel: 'Ein Termin ist wieder frei',
      einleitung: `${fett(freigegebenVon || 'Ein Closer')} hat den Termin zurück in den Closer-Pool gegeben. Wer ihn übernehmen kann, bewirbt sich dort.`,
      fakten: [['Unternehmen', unternehmen], ['Ansprechpartner', ansprechpartner], ['Termin', datum], ['Terminart', terminart(art)]],
      knopf: ['Zum Closer-Pool', '/closing'],
      grund: 'Du bekommst diese Mail, weil du Closer oder in der Leitung bist.'
    })
  }
}

/** Ein Closer wurde deaktiviert, seine Termine liegen wieder im Pool. */
export function termineZurueckImPool({ closerName, anzahl }) {
  return {
    betreff: betreff('Closing', `${plural(anzahl, 'Termin', 'Termine')} wieder im Pool`),
    mail: systemMail({
      bereich: 'Closing', ton: 'aktion', zustand: 'Zu erledigen',
      titel: `${plural(anzahl, 'Termin', 'Termine')} wieder im Pool`,
      einleitung: `Das Konto von ${fett(closerName)} wurde deaktiviert. Die offenen Termine liegen jetzt im Closer-Pool und warten auf einen Closer.`,
      fakten: [['Zurück im Pool', plural(anzahl, 'Termin', 'Termine')]],
      knopf: ['Zum Closer-Pool', '/closing'],
      grund: 'Du bekommst diese Mail, weil du Closer oder in der Leitung bist.'
    })
  }
}

/** Jemand hat über die Website das E-Book angefordert. */
export function neuerEbookLead({ vorname, nachname, unternehmen, email, telefon, kategorie }) {
  const name = [vorname, nachname].filter(Boolean).join(' ') || 'Unbekannt'
  return {
    betreff: betreff('Opening', `Neuer E-Book-Lead: ${name}${unternehmen ? ` (${unternehmen})` : ''}`),
    mail: systemMail({
      bereich: 'Opening', ton: 'aktion', zustand: 'Zu erledigen',
      titel: 'Neuer E-Book-Lead',
      einleitung: `${fett(name)} hat das E-Book angefordert. Der Lead liegt im E-Book-Pool, bis ihn jemand übernimmt.`,
      fakten: [['Name', name], ['Unternehmen', unternehmen], ['Kategorie', kategorie], ['E-Mail', email], ['Telefon', telefon]],
      knopf: ['Im E-Book-Pool übernehmen', '/opening'],
      grund: 'Du bekommst diese Mail, weil du im Vertrieb oder in der Leitung bist.'
    })
  }
}

const STUFE_WORTE = {
  Setter: { was: 'Beratungsgespräch', bereich: 'Setting', pfad: '/setting' },
  Closer: { was: 'Abschlussgespräch', bereich: 'Closing', pfad: '/closing' }
}
const stufeWorte = stufe => STUFE_WORTE[stufe] || STUFE_WORTE.Closer

/** Jemand bewirbt sich auf einen Kontakt - die Leitung entscheidet. */
export function neueBewerbung({ bewerber, stufe, unternehmen, ansprechpartner, termin, kommentar, bewerbungId }) {
  const w = stufeWorte(stufe)
  return {
    betreff: betreff('Leitung', `Bewerbung von ${bewerber}: ${unternehmen}`),
    mail: systemMail({
      bereich: 'Leitung', ton: 'aktion', zustand: 'Zu entscheiden',
      titel: `Bewerbung auf das ${w.was}`,
      einleitung: `${fett(bewerber)} möchte das ${w.was} bei ${fett(unternehmen)} übernehmen.`,
      fakten: [['Unternehmen', unternehmen], ['Ansprechpartner', ansprechpartner], [w.was, termin], ['Kommentar', kommentar], ['Bewerbungs-ID', bewerbungId]],
      knopf: ['Bewerbung prüfen', '/einstellungen?tab=hot-lead-bewerbungen'],
      grund: 'Du bekommst diese Mail, weil du in der Leitung bist.'
    })
  }
}

/** Die Leitung hat über eine Bewerbung entschieden. */
export function bewerbungEntschieden({ angenommen, stufe, unternehmen, kommentar }) {
  const w = stufeWorte(stufe)
  return {
    betreff: betreff(w.bereich, `Bewerbung ${angenommen ? 'angenommen' : 'abgelehnt'}: ${unternehmen}`),
    mail: systemMail({
      bereich: w.bereich,
      ton: angenommen ? 'erfolg' : 'problem',
      zustand: angenommen ? 'Zugesagt' : 'Abgelehnt',
      titel: angenommen ? `Du führst das ${w.was}` : 'Deine Bewerbung wurde abgelehnt',
      einleitung: angenommen
        ? `Deine Bewerbung für ${fett(unternehmen)} wurde angenommen. Der Kontakt steht ab jetzt im ${w.bereich} unter „Meine Leads“.`
        : `Deine Bewerbung auf das ${w.was} bei ${fett(unternehmen)} wurde nicht angenommen.`,
      fakten: [['Kommentar der Leitung', kommentar]],
      knopf: [`Zum ${w.bereich}`, w.pfad],
      grund: 'Du bekommst diese Mail, weil du dich auf diesen Kontakt beworben hast.'
    })
  }
}

/** Die Leitung hat über eine Anfrage nach neuen Leads entschieden. */
export function leadAnfrageEntschieden({ status, angefragt, zugewiesen, kommentar }) {
  const fall = {
    Genehmigt: { ton: 'erfolg', zustand: 'Genehmigt', titel: 'Deine Lead-Anfrage wurde genehmigt',
      einleitung: `Dir wurden ${fett(plural(zugewiesen, 'Lead', 'Leads'))} zugewiesen. Sie stehen ab jetzt im Opening.`,
      kurz: `genehmigt (${plural(zugewiesen, 'Lead', 'Leads')})` },
    Teilweise_Genehmigt: { ton: 'warnung', zustand: 'Teilweise genehmigt', titel: 'Deine Lead-Anfrage wurde teilweise genehmigt',
      einleitung: `Dir wurden ${fett(`${zugewiesen} von ${angefragt} Leads`)} zugewiesen. Sie stehen ab jetzt im Opening.`,
      kurz: `teilweise genehmigt (${zugewiesen} von ${angefragt})` },
    Abgelehnt: { ton: 'problem', zustand: 'Abgelehnt', titel: 'Deine Lead-Anfrage wurde abgelehnt',
      einleitung: `Deine Anfrage über ${plural(angefragt, 'Lead', 'Leads')} wurde nicht genehmigt.`,
      kurz: 'abgelehnt' }
  }[status]
  if (!fall) return null
  return {
    betreff: betreff('Opening', `Lead-Anfrage ${fall.kurz}`),
    mail: systemMail({
      bereich: 'Opening', ton: fall.ton, zustand: fall.zustand, titel: fall.titel, einleitung: fall.einleitung,
      fakten: [['Angefragt', plural(angefragt, 'Lead', 'Leads')],
        ['Zugewiesen', status === 'Abgelehnt' ? null : plural(zugewiesen, 'Lead', 'Leads')],
        ['Kommentar der Leitung', kommentar]],
      knopf: ['Zum Opening', '/opening'],
      grund: 'Du bekommst diese Mail, weil du neue Leads angefragt hast.'
    })
  }
}

/** Ein Closer meldet: Kunde nicht erschienen. Der Kontakt geht an den Setter. */
export function nichtErschienen({ gemeldetVon, unternehmen, ansprechpartner, termin, anzahl }) {
  return {
    betreff: betreff('Setting', `Nicht erschienen: ${unternehmen}`),
    mail: systemMail({
      bereich: 'Setting', ton: 'warnung', zustand: 'Neu terminieren',
      titel: 'Kunde nicht erschienen',
      einleitung: `${fett(gemeldetVon || 'Ein Closer')} hat gemeldet, dass ${ansprechpartner ? `${fett(ansprechpartner)} von ` : ''}${fett(unternehmen)} nicht zum Termin erschienen ist. Bitte vereinbare einen neuen Termin.`,
      fakten: [['Geplanter Termin', termin], ['Nicht erschienen', `${anzahl || 1}-mal`]],
      knopf: ['Neuen Termin legen', '/setting'],
      hinweis: 'Meldet sich der Kunde nicht mehr, setze den Kontakt im CRM auf „Verloren“.',
      grund: 'Du bekommst diese Mail, weil du Setter dieses Kontakts bist.'
    })
  }
}

/** Calendly meldet: ein Termin wurde abgesagt oder verschoben. */
export function terminGeaendert({ art, gespraech, unternehmen, grund, alterTermin, neuerTermin }) {
  const abgesagt = art === 'absage'
  const verschoben = art === 'verschiebung'
  return {
    betreff: betreff('Termine', `${gespraech} ${abgesagt ? 'abgesagt' : verschoben ? 'verschoben' : 'geändert'}: ${unternehmen}`),
    mail: systemMail({
      bereich: 'Termine',
      ton: abgesagt ? 'problem' : verschoben ? 'warnung' : 'info',
      zustand: abgesagt ? 'Abgesagt' : verschoben ? 'Verschoben' : 'Info',
      titel: `${gespraech} ${abgesagt ? 'abgesagt' : verschoben ? 'verschoben' : 'geändert'}`,
      einleitung: abgesagt
        ? `Der Kunde hat das ${gespraech} mit ${fett(unternehmen)} über Calendly abgesagt.`
        : verschoben
          ? `Der Kunde hat das ${gespraech} mit ${fett(unternehmen)} über Calendly auf einen neuen Zeitpunkt gelegt. Im Kalender ist er schon eingetragen.`
          : `Beim ${gespraech} mit ${fett(unternehmen)} hat sich etwas geändert.`,
      fakten: [['Unternehmen', unternehmen],
        ['Alter Termin', verschoben ? alterTermin : null, 'alt'],
        [verschoben ? 'Neuer Termin' : 'Termin', verschoben ? neuerTermin : alterTermin],
        ['Grund', abgesagt ? (grund || 'Kein Grund angegeben') : null]],
      knopf: ['Termin ansehen', '/termine'],
      grund: 'Du bekommst diese Mail, weil du an diesem Termin beteiligt bist.'
    })
  }
}

/** Nachrichten, die im CRM zwischen Beteiligten verschickt werden. */
const NACHRICHT_ART = {
  'Termin abgesagt':    { bereich: 'Termine', ton: 'problem', zustand: 'Abgesagt',  pfad: '/termine' },
  'Termin verschoben':  { bereich: 'Termine', ton: 'warnung', zustand: 'Verschoben', pfad: '/termine' },
  'termin_rescheduled': { bereich: 'Termine', ton: 'warnung', zustand: 'Verschoben', pfad: '/termine' },
  'Lead gewonnen':      { bereich: 'Closing', ton: 'erfolg',  zustand: 'Gewonnen',  pfad: '/dashboard' },
  'Lead verloren':      { bereich: 'Closing', ton: 'info',    zustand: 'Verloren',  pfad: '/dashboard' },
  'Pool Update':        { bereich: 'Pool',    ton: 'aktion',  zustand: 'Zu erledigen', pfad: '/dashboard' },
  'Direktbuchung':      { bereich: 'Termine', ton: 'info',    zustand: 'Neu',       pfad: '/termine' },
  'no_show':            { bereich: 'Setting', ton: 'warnung', zustand: 'Neu terminieren', pfad: '/setting' },
  'no_show_rescheduled':{ bereich: 'Closing', ton: 'erfolg',  zustand: 'Neuer Termin', pfad: '/closing' },
  'Info':               { bereich: 'CRM',     ton: 'info',    zustand: 'Info',      pfad: '/dashboard' }
}

export function crmNachricht({ typ, titel, nachricht }) {
  const a = NACHRICHT_ART[typ] || NACHRICHT_ART.Info
  return {
    betreff: betreff(a.bereich, titel),
    mail: systemMail({
      bereich: a.bereich, ton: a.ton, zustand: a.zustand,
      titel,
      einleitung: nachricht || titel,
      knopf: ['Im CRM ansehen', a.pfad],
      grund: 'Du bekommst diese Mail, weil du an diesem Kontakt beteiligt bist.'
    })
  }
}

/** Passwort vergessen: ein neues, vorläufiges Passwort. */
export function neuesPasswort({ vorname, passwort }) {
  return {
    betreff: betreff('Konto', 'Dein neues Passwort'),
    mail: systemMail({
      bereich: 'Konto', ton: 'info', zustand: 'Info',
      titel: 'Dein neues Passwort',
      einleitung: `Hallo ${vorname || ''}, du hast ein neues Passwort für das Sunside CRM angefordert. Ändere es nach dem Login in deinem Profil.`.replace('Hallo , ', 'Hallo, '),
      hervorgehoben: ['Dein neues Passwort', passwort],
      knopf: ['Zum Login', '/login'],
      hinweis: 'Du hast kein neues Passwort angefordert? Dann melde dich bitte bei deinem Admin.',
      grund: 'Du bekommst diese Mail, weil für dein Konto ein neues Passwort angefordert wurde.'
    })
  }
}
