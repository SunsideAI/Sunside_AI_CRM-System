// Backfill: Reaktivierungs-Kampagne vom 02.07.2026 sauber ziehen.
//
// Am 02.07. wurden 269 Hot Leads via closer_id = Max Lehmann gesetzt, um
// Max die Leads für Re-Kontakt sichtbar zu machen. Dadurch verlor der
// eigentliche Closer die Attribution und die Statistik ist verzerrt.
//
// Dieses Script:
//   1) liest den Snapshot (CSV mit lead_id + zustaendiger_closer VOR dem Update)
//   2) findet alle hot_leads mit closer_id = Max UND lead_id in Snapshot
//   3) setzt closer_id zurück auf den Snapshot-Closer
//   4) setzt reaktivierung_bearbeiter_id = Max Lehmann
//
// Startet standardmäßig im Dry-Run. Zum tatsächlichen Update mit --apply
// aufrufen:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
//     node supabase/backfill-reaktivierung.js \
//     --snapshot=./followup-snapshot.csv --apply

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const MAX_LEHMANN_ID = 'd05f6368-807d-4afc-80ba-9cf101a5a10d'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const snapshotArg = args.find(a => a.startsWith('--snapshot='))
const SNAPSHOT_PATH = snapshotArg ? snapshotArg.split('=', 2)[1] : './followup-snapshot.csv'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_KEY müssen gesetzt sein.')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// CSV einlesen. Erwartet Header-Zeile mit den Spalten:
//   lead_id, zustaendiger_closer
// (weitere Spalten werden ignoriert)
function parseSnapshot(path) {
  const raw = readFileSync(path, 'utf8')
  const lines = raw.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) throw new Error('Snapshot-Datei ist leer')

  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const leadIdIdx = header.findIndex(h => h.toLowerCase() === 'lead_id')
  const closerIdx = header.findIndex(h => h.toLowerCase() === 'zustaendiger_closer')
  if (leadIdIdx === -1) throw new Error("Spalte 'lead_id' fehlt im Snapshot")
  if (closerIdx === -1) throw new Error("Spalte 'zustaendiger_closer' fehlt im Snapshot")

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const leadId = cells[leadIdIdx]
    const closer = cells[closerIdx]
    if (leadId && closer) rows.push({ leadId, closerName: closer })
  }
  return rows
}

// Alle Snapshot-Closer-Namen einmalig zu User-IDs auflösen
async function resolveCloserNamesToIds(uniqueNames) {
  const nameToId = {}
  for (const name of uniqueNames) {
    const trimmed = name.trim().replace(/\s+/g, ' ')
    // Erster Versuch: exakt ilike
    let { data } = await supabase
      .from('users')
      .select('id, vor_nachname')
      .ilike('vor_nachname', trimmed)
      .limit(1)

    if (!data || data.length === 0) {
      // Zweiter Versuch: Umlaut → Latin
      const latin = trimmed
        .replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').replace(/ß/g, 'ss')
      if (latin !== trimmed) {
        const r = await supabase.from('users').select('id, vor_nachname').ilike('vor_nachname', latin).limit(1)
        data = r.data
      }
    }
    if (!data || data.length === 0) {
      // Dritter Versuch: Latin → Umlaut
      const uml = trimmed
        .replace(/ae/gi, 'ä').replace(/oe/gi, 'ö').replace(/ue/gi, 'ü').replace(/ss/gi, 'ß')
      if (uml !== trimmed) {
        const r = await supabase.from('users').select('id, vor_nachname').ilike('vor_nachname', uml).limit(1)
        data = r.data
      }
    }

    if (data && data.length > 0) {
      nameToId[name] = data[0].id
    } else {
      nameToId[name] = null
      console.warn(`[resolve] Kein User gefunden für "${name}"`)
    }
  }
  return nameToId
}

async function main() {
  console.log('=== Backfill: Reaktivierungs-Kampagne bereinigen ===')
  console.log('Mode:', APPLY ? 'APPLY (schreibt in DB)' : 'DRY-RUN (nur Analyse)')
  console.log('Snapshot:', SNAPSHOT_PATH)

  const snapshot = parseSnapshot(SNAPSHOT_PATH)
  console.log(`Snapshot: ${snapshot.length} Zeilen mit lead_id + zustaendiger_closer`)

  const uniqueCloserNames = Array.from(new Set(snapshot.map(r => r.closerName)))
  console.log(`Distinkte Snapshot-Closer: ${uniqueCloserNames.length} (${uniqueCloserNames.join(', ')})`)

  const nameToId = await resolveCloserNamesToIds(uniqueCloserNames)
  const unresolved = Object.entries(nameToId).filter(([, id]) => !id).map(([n]) => n)
  if (unresolved.length > 0) {
    console.error('ABBRUCH: Folgende Closer aus dem Snapshot konnten nicht aufgelöst werden:', unresolved)
    console.error('Bitte Namen in der users-Tabelle prüfen oder im Snapshot korrigieren.')
    process.exit(1)
  }

  // Alle aktuellen hot_leads auf Max mit lead_id in Snapshot-Menge
  const snapshotLeadIds = snapshot.map(r => r.leadId)
  const { data: candidates, error } = await supabase
    .from('hot_leads')
    .select('id, unternehmen, lead_id, closer_id, reaktivierung_bearbeiter_id, status')
    .eq('closer_id', MAX_LEHMANN_ID)
    .in('lead_id', snapshotLeadIds)

  if (error) {
    console.error('DB-Fehler beim Laden der Kandidaten:', error)
    process.exit(1)
  }

  console.log(`Kandidaten in DB (closer_id=Max UND lead_id im Snapshot): ${candidates.length}`)

  // Für jeden Kandidaten: Snapshot-Closer → neue closer_id, Max → reaktivierung_bearbeiter_id
  const snapshotByLead = Object.fromEntries(snapshot.map(r => [r.leadId, r]))
  const plan = candidates.map(c => {
    const snap = snapshotByLead[c.lead_id]
    return {
      hotLeadId: c.id,
      unternehmen: c.unternehmen,
      status: c.status,
      neuerCloserId: nameToId[snap.closerName],
      neuerCloserName: snap.closerName,
      reaktivierer: 'Max Lehmann'
    }
  })

  // Zusammenfassung pro Ziel-Closer
  const perTarget = {}
  for (const p of plan) {
    perTarget[p.neuerCloserName] = (perTarget[p.neuerCloserName] || 0) + 1
  }
  console.log('\nVerteilung nach Backfill:')
  for (const [name, count] of Object.entries(perTarget).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(24)} ${count}`)
  }

  if (!APPLY) {
    console.log('\nDry-Run – keine Änderungen geschrieben.')
    console.log('Zum Ausführen mit --apply erneut starten.')
    return
  }

  // Apply: in Batches à 50 updaten
  console.log('\nSchreibe Änderungen ...')
  let ok = 0, fail = 0
  for (const p of plan) {
    const { error: uErr } = await supabase
      .from('hot_leads')
      .update({
        closer_id: p.neuerCloserId,
        reaktivierung_bearbeiter_id: MAX_LEHMANN_ID
      })
      .eq('id', p.hotLeadId)
    if (uErr) {
      console.error(`  FAIL ${p.hotLeadId} (${p.unternehmen}): ${uErr.message}`)
      fail++
    } else {
      ok++
    }
  }
  console.log(`\nFertig. Erfolgreich: ${ok}, Fehler: ${fail}`)
}

main().catch(err => {
  console.error('Fataler Fehler:', err)
  process.exit(1)
})
