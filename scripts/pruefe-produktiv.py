#!/usr/bin/env python3
"""Prueft, ob der LAUFENDE Produktivstand von Datenbank-Aenderungen betroffen ist.

Vor jeder Migration gegen die Live-Datenbank auszufuehren, und danach noch
einmal. Ruft alles ueber PostgREST mit dem Service-Key auf - genau der Weg,
den die Netlify-Functions nehmen. Direktes SQL wuerde Trigger, RLS und
PostgREST umgehen und waere damit kein Beleg.

WICHTIG, aus Schaden gelernt: Ein Testdatensatz darf NICHT auf 'Abgeschlossen'
bzw. 'Gewonnen' gesetzt werden, solange billing_mode 'none' ist - dann feuert
trg_lead_closed_to_bridge einen echten HTTP-Aufruf an die Abrechnung. Deshalb
setzt dieses Skript billing_mode auf 'manual_external' - der Trigger verlangt 'none'.

Aufruf: python3 scripts/pruefe-produktiv.py
"""
import sys, os, json, urllib.request, urllib.error, uuid

sys.path.insert(0, os.path.expanduser(
    "~/Desktop/KI Agentur /Sunside AI/Systeme/scripts"))
import supa

URL, KEY = supa.zugang()
KOPF = {"apikey": KEY, "Authorization": "Bearer " + KEY,
        "Content-Type": "application/json", "Prefer": "return=representation"}

def ruf(methode, pfad, daten=None):
    req = urllib.request.Request(URL.rstrip("/") + "/rest/v1/" + pfad,
        data=json.dumps(daten).encode() if daten is not None else None,
        headers=KOPF, method=methode)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            roh = r.read().decode()
            return r.status, (json.loads(roh) if roh.strip() else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]

brueche = []
def pruefe(name, ok, detail=""):
    if not ok: brueche.append(name)
    print(("  OK    " if ok else "  BRUCH ") + name + (("  -> " + str(detail)) if detail else ""))

MARKE = "ZZ Produktivpruefung " + uuid.uuid4().hex[:6]
print("Alter Produktivcode gegen die aktuelle Datenbank:\n")

# Hot Lead anlegen wie der alte Code: nur alte Spalten, alter Statuswert.
# billing_mode 'manual_external' haelt den Bridge-Trigger von echten Aufrufen ab.
st, lead = ruf("POST", "hot_leads", {
    "unternehmen": MARKE, "status": "Lead", "quelle": "Kaltakquise",
    "billing_mode": "manual_external",
    "termin_beratungsgespraech": "2026-12-01T10:00:00Z"})
pruefe("Hot Lead anlegen mit altem Status 'Lead'", st in (200, 201), st if st not in (200,201) else "")
lead_id = lead[0]["id"] if isinstance(lead, list) and lead else None

if lead_id:
    for neu in ["Im Closing", "Angebot", "Angebot versendet", "Abgeschlossen"]:
        st, _ = ruf("PATCH", f"hot_leads?id=eq.{lead_id}", {"status": neu})
        pruefe(f"Statuswechsel auf '{neu}'", st in (200, 204), st if st not in (200,204) else "")

    ruf("DELETE", f"hot_lead_ereignisse?hot_lead_id=eq.{lead_id}")
    st, _ = ruf("DELETE", f"hot_leads?id=eq.{lead_id}")
    pruefe("Hot Lead wieder entfernen", st in (200, 204), st if st not in (200,204) else "")

# Zuweisung anlegen und loeschen wie assign-leads / archive-leads
st, leads = ruf("GET", "leads?select=id&limit=1")
if isinstance(leads, list) and leads:
    lid, uid = leads[0]["id"], "81bb6699-6e4f-4411-befa-d47823596326"
    ruf("DELETE", f"lead_assignments?lead_id=eq.{lid}&user_id=eq.{uid}")
    st, _ = ruf("POST", "lead_assignments", {"lead_id": lid, "user_id": uid})
    pruefe("Lead-Zuweisung anlegen", st in (200, 201), st if st not in (200,201) else "")
    st, _ = ruf("DELETE", f"lead_assignments?lead_id=eq.{lid}&user_id=eq.{uid}")
    pruefe("Lead-Zuweisung loeschen (Offboarding)", st in (200, 204), st if st not in (200,204) else "")
    ruf("DELETE", f"lead_assignment_history?lead_id=eq.{lid}&user_id=eq.{uid}")

# Bewerbung wie der alte Code: ohne das neue Feld 'stufe'
st, hl = ruf("GET", "hot_leads?select=id&closer_id=is.null&limit=1")
if isinstance(hl, list) and hl:
    st, b = ruf("POST", "hot_lead_applications", {
        "bewerbung_id": "ZZ-" + uuid.uuid4().hex[:8],
        "hot_lead_id": hl[0]["id"],
        "closer_id": "81bb6699-6e4f-4411-befa-d47823596326",
        "status": "Offen"})
    pruefe("Bewerbung ohne Feld 'stufe' (alter Code)", st in (200, 201), st if st not in (200,201) else "")
    if isinstance(b, list) and b:
        ruf("DELETE", f"hot_lead_applications?id=eq.{b[0]['id']}")

# Rueckstaende?
st, rest = ruf("GET", "hot_leads?select=id,unternehmen&unternehmen=like.ZZ*")
pruefe("Keine Testdaten zurueckgelassen",
       not (isinstance(rest, list) and rest),
       f"{len(rest)} Reste" if isinstance(rest, list) and rest else "")

print()
if brueche:
    print(f"ERGEBNIS: {len(brueche)} Bruch/Brueche - " + ", ".join(brueche))
    sys.exit(1)
print("ERGEBNIS: Kein Bruch. Der laufende Produktivstand ist nicht betroffen.")
