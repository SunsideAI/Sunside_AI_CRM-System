// Welche Mailvorlage passt, und womit werden ihre Platzhalter gefüllt?
//
// Die Wortlaute stehen nicht hier, sondern in der Mailstrecken-Datei und von
// dort (scripts/vorlagen-einpflegen.mjs) in der Tabelle email_templates. Hier
// steht nur die Regel: eine Empfehlung mit einer Zeile Begründung, und die
// Zuordnung der Platzhalter zu den Feldern.

import { BRANCHE, noetigeAnfragen } from './felder.js'
import { segmentMailFassung, empfehlung as nachfassEmpfehlung, HOECHSTENS_VERSUCHE } from './mailstrecken.js'

const SEGMENT_NAME = {
  eigentuemer: 'Ziel Eigentümer',
  kaeufer: 'Ziel Kaufinteressenten',
  automatisierung: 'Ziel Zeitersparnis',
  sachverstaendige: 'Sachverständiger, gilt unabhängig vom Ziel',
  vorhaben: 'eigenes Vorhaben, schlägt das Segment'
}

// Welches Toolkit-Stück welche Vorlage hat. Karten ohne Mailtext (KI-Hacks,
// Webinar, Voicebot-Demo) haben keine; dort schreibt der Closer frei.
const WERKZEUG_VORLAGE = {
  zusammenfassung: 'nachfass_zusammenfassung',
  fallbeispiel: 'nachfass_fallbeispiel',
  auswirkungsfrage: 'nachfass_auswirkungsfrage',
  sichtbarkeits_check: 'nachfass_sichtbarkeits_check',
  ratgeber: 'nachfass_ratgeber',
  beweisstueck: 'nachfass_beweisstueck',
  referenzanruf: 'nachfass_referenzanruf',
  abschied: 'nachfass_abschied',
  sv_ranking: 'nachfass_sv_ranking'
}

/**
 * Die eine Empfehlung für einen Anlass.
 *
 *   'opening'     Segment-Mail mit Video direkt nach dem Erstanruf
 *   'setting'     Bestätigungsmail mit VSL nach dem Beratungsgespräch
 *   'nachfassen'  das Toolkit-Stück aus Diagnose und Segment
 *
 * Rückgabe: { schluessel, grund } oder { schluessel: null, grund } wenn das
 * System nichts empfehlen kann und der Mensch wählt.
 */
export function empfohleneVorlage(anlass, lead, bereitsGesendet = []) {
  if (anlass === 'opening') {
    const fassung = segmentMailFassung(lead)
    if (!fassung) {
      return { schluessel: null, grund: 'Mehrere Ziele ohne Vorrang oder noch keins besprochen: bitte die Fassung wählen, die zu seinem Problem passt.' }
    }
    return { schluessel: `segment_${fassung}`, grund: SEGMENT_NAME[fassung] }
  }

  if (anlass === 'setting') {
    // Feedback 21.09.: Automatisierung und Vorhaben bekommen dasselbe VSL.
    let fassung = segmentMailFassung(lead)
    if (fassung === 'vorhaben') fassung = lead?.berufsgruppe === BRANCHE.SV ? 'sachverstaendige' : 'automatisierung'
    if (!fassung) return { schluessel: null, grund: 'Kein Ziel festgelegt: bitte die Fassung wählen, die zum Gespräch passt.' }
    return { schluessel: `bestaetigung_${fassung}`, grund: SEGMENT_NAME[fassung] }
  }

  if (anlass === 'nachfassen') {
    // Leitplanke 1: Ein gebuchter Termin schlägt jede Mail.
    const termin = lead?.termin_abschlussgespraech
    if (termin && new Date(termin).getTime() > Date.now()) {
      return { schluessel: null, grund: 'Es steht ein Termin. Bis dahin ruht das Nachfassen.' }
    }
    // Leitplanke 4: Nach fünf Versuchen der Abschied.
    const versuche = Number(lead?.nachfass_schritt) || 0
    if (versuche >= HOECHSTENS_VERSUCHE && !bereitsGesendet.includes('abschied')) {
      return { schluessel: 'nachfass_abschied', grund: `${versuche} Versuche ohne Ergebnis. Mehr rechnet sich nicht, jetzt der Abschied.` }
    }
    const e = nachfassEmpfehlung(lead, bereitsGesendet)
    if (!e) return { schluessel: null, grund: 'Alle passenden Stücke sind schon verschickt.' }
    const schluessel = WERKZEUG_VORLAGE[e.werkzeug.id] || null
    return {
      schluessel,
      grund: `Versuch ${versuche + 1} von ${HOECHSTENS_VERSUCHE}. ${e.werkzeug.name}: ${e.grund}`
        + (schluessel ? '' : '. Dafür gibt es keine Mailvorlage, bitte frei schreiben.')
    }
  }

  return { schluessel: null, grund: '' }
}

const datum = (wert) => wert
  ? new Date(wert).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
  : null

const zahl = (wert) => (wert === null || wert === undefined || wert === '') ? null : Number(wert).toLocaleString('de-DE')

/**
 * Welcher Video- bzw. VSL-Link zu diesem Kontakt gehört. `links` sind die
 * Einstellungen link_video_* und link_vsl_*.
 */
export function linksFuer(lead, links = {}) {
  const fassung = segmentMailFassung(lead)
  const video = {
    eigentuemer: links.link_video_streil,
    // Übergang laut Datei: Streil-Kurzschnitt, bis das Käufer-Video steht.
    kaeufer: links.link_video_kaeufer || links.link_video_streil,
    automatisierung: links.link_video_beier,
    sachverstaendige: links.link_video_beier,
    vorhaben: links.link_video_beier
  }[fassung] || null
  const vsl = {
    eigentuemer: links.link_vsl_eigentuemer,
    kaeufer: links.link_vsl_kaeufer,
    automatisierung: links.link_vsl_automatisierung,
    sachverstaendige: links.link_vsl_automatisierung,
    vorhaben: links.link_vsl_automatisierung
  }[fassung] || null
  return { video, vsl }
}

/**
 * Die Platzhalter der Mailstrecken-Datei, gefüllt aus Kontakt, Absender und
 * Links. Was sich nicht füllen lässt, fehlt in der Liste und bleibt im Text
 * stehen; der Mail-Dialog lässt dann nicht senden, bis es jemand ersetzt.
 *
 * Die Anrede („Herr/Frau") bleibt bewusst stehen: Das CRM kennt das
 * Geschlecht nicht, der Absender setzt sie beim Durchlesen richtig.
 */
export function platzhalterWerte({ lead = {}, absender = '', links = {}, schluessel = null }) {
  const nachname = lead.ansprechpartner_nachname || lead.ansprechpartnerNachname || ''
  const vorname = lead.ansprechpartner_vorname || lead.ansprechpartnerVorname || ''
  const { video, vsl } = linksFuer(lead, links)
  const monat = noetigeAnfragen(lead) ?? (lead.noetige_anfragen ?? null)
  const schmerz = lead.schmerzpunkt_vertieft || lead.schmerzpunkt_wortlaut || null
  const ort = lead.ort || lead.stadt || null

  const werte = {
    'Nachname': nachname || null,
    'Vorname Nachname': `${vorname} ${nachname}`.trim() || null,
    // Füllregel vom 15.09.: „Hallo" in den Nachfass-Mails, „Guten Tag" im Abschiedsbrief.
    'Anrede': nachname ? `${schluessel === 'nachfass_abschied' ? 'Guten Tag' : 'Hallo'} Herr/Frau ${nachname}` : null,
    'Absender': absender || null,
    'Video-Link': video ? `[Zum Video](${video})` : null,
    'VSL-Link': vsl ? `[dieses Video](${vsl})` : null,
    'Ausgesprochener Bedarf, seine Worte': lead.bedarf_wortlaut ? `„${lead.bedarf_wortlaut}"` : null,
    'Ausgesprochener Bedarf': lead.bedarf_wortlaut ? `„${lead.bedarf_wortlaut}"` : null,
    'Schmerzpunkt im Wortlaut': schmerz,
    'Offener Punkt': lead.offene_huerde || null,
    'Zuwachs': zahl(lead.zuwachs_auftraege),
    'Nötige Anfragen im Monat': zahl(monat),
    'Nötige Anfragen': monat === null ? null : zahl(Math.round(monat * 12)),
    'Gesprächsdatum': datum(lead.termin_abschlussgespraech || lead.termin_beratungsgespraech),
    'Region': ort,
    'Ort': ort,
    'Ziel': lead.ziel || null
  }
  return Object.fromEntries(Object.entries(werte).filter(([, w]) => w !== null && w !== ''))
}

/** Setzt die Werte ein. Unbekannte oder leere Platzhalter bleiben stehen. */
export function platzhalterFuellen(text, werte) {
  return String(text || '').replace(/\{([^{}]+)\}/g, (ganz, name) =>
    Object.prototype.hasOwnProperty.call(werte, name) ? werte[name] : ganz)
}

/** Alle `{…}`-Platzhalter, die noch im Text stehen. `{{…}}` zählt mit. */
export function offenePlatzhalter(text) {
  return [...new Set((String(text || '').match(/\{\{?[^{}]+\}?\}/g) || []))]
}

/**
 * Endet die Mail schon mit einem Gruß? Die Vorlagen aus der Mailstrecken-Datei
 * schließen selbst („Viele Grüße {Absender}"). Die Signatur hängt dann nur noch
 * den Firmenblock an, sonst stünde der Gruß zweimal beim Kunden.
 */
export function hatEigenenGruss(text) {
  const zeilen = String(text || '').split('\n').map(z => z.trim()).filter(Boolean).slice(-3)
  return zeilen.some(z => /^(Viele|Beste|Freundliche|Herzliche|Liebe) Grüße|^Mit freundlichen Grüßen|^Bis dahin|^Bis morgen|^Alles Gute/i.test(z))
}

/**
 * Welche Toolkit-Stücke schon raus sind. `material_versendet` hält die Namen
 * der gesendeten Vorlagen; über den Schlüssel kommen wir zum Werkzeug zurück.
 */
export function gesendeteWerkzeuge(materialVersendet = [], vorlagen = []) {
  const namen = new Set(materialVersendet || [])
  const schluessel = new Set(vorlagen.filter(v => namen.has(v.name)).map(v => v.schluessel))
  return Object.entries(WERKZEUG_VORLAGE).filter(([, s]) => schluessel.has(s)).map(([id]) => id)
}
