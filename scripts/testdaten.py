#!/usr/bin/env python3
"""Zeigt und entfernt Testdaten des OSC-Durchlaufs.

Testdaten werden am Firmennamen erkannt: Er muss mit "TEST" beginnen. Das ist
die einzige Abmachung des Durchlaufs - halte sie ein, sonst findet dieses
Skript nichts.

    python3 scripts/testdaten.py            zeigt, was da ist
    python3 scripts/testdaten.py --loeschen entfernt es

Loeschen fasst nur Datensaetze an, deren Name mit TEST beginnt, und die daran
haengenden Ereignisse, Bewerbungen, Nachrichten und Anrufversuche.
"""
import sys, os, json, urllib.request, urllib.error

sys.path.insert(0, os.path.expanduser("~/Desktop/KI Agentur /Sunside AI/Systeme/scripts"))
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
            return r.status, (json.loads(roh) if roh.strip() else [])
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

loeschen = "--loeschen" in sys.argv

st, leads = ruf("GET", "hot_leads?select=id,unternehmen,status,termin_beratungsgespraech"
                       "&unternehmen=like.TEST*&order=created_at.desc")
if not isinstance(leads, list):
    sys.exit(f"Abfrage fehlgeschlagen: {st} {leads}")

if not leads:
    print("Keine Testdaten vorhanden.")
    sys.exit(0)

print(f"{len(leads)} Testdatensatz/-saetze:\n")
for l in leads:
    print(f"  {l['unternehmen'][:44]:<46} {l['status']}")

if not loeschen:
    print("\nZum Entfernen: python3 scripts/testdaten.py --loeschen")
    sys.exit(0)

print("\nEntferne ...")
ids = [l["id"] for l in leads]
liste = "(" + ",".join(ids) + ")"

# Reihenfolge: erst was auf die Leads zeigt, dann die Leads selbst.
for tabelle, spalte in [
    ("hot_lead_ereignisse", "hot_lead_id"),
    ("hot_lead_applications", "hot_lead_id"),
    ("system_messages", "hot_lead_id"),
    ("crm_erinnerungen", "hot_lead_id"),
    ("anrufversuche", "hot_lead_id"),
]:
    st, weg = ruf("DELETE", f"{tabelle}?{spalte}=in.{liste}")
    print(f"  {tabelle:<24} {len(weg) if isinstance(weg, list) else weg}")

st, weg = ruf("DELETE", f"hot_leads?unternehmen=like.TEST*")
print(f"  {'hot_leads':<24} {len(weg) if isinstance(weg, list) else weg}")

st, rest = ruf("GET", "hot_leads?select=id&unternehmen=like.TEST*")
print("\n" + ("Rueckstandsfrei." if isinstance(rest, list) and not rest
              else f"ACHTUNG: {len(rest)} Reste geblieben."))
