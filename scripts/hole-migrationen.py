import sys, os, json, urllib.request, re
sys.path.insert(0, "/Users/paulprobodziak/Desktop/KI Agentur /Sunside AI/Systeme/scripts")
import supa

url, key = supa.zugang()
req = urllib.request.Request(
    url.rstrip("/") + "/rest/v1/rpc/migrationen_lesen",
    data=json.dumps({"p_ab": "20260911"}).encode("utf-8"),
    headers={"apikey": key, "Authorization": "Bearer " + key,
             "Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=60) as r:
    zeilen = json.loads(r.read().decode("utf-8"))

ziel = sys.argv[1]
vorhanden = set(os.listdir(ziel))
geschrieben = []
for z in zeilen:
    datei = f"{z['version']}_{z['name']}.sql"
    if datei in vorhanden:
        continue
    kopf = (f"-- Eingespielt am {z['version'][:4]}-{z['version'][4:6]}-{z['version'][6:8]} "
            f"um {z['version'][8:10]}:{z['version'][10:12]} Uhr.\n"
            f"-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.\n\n")
    with open(os.path.join(ziel, datei), "w", encoding="utf-8") as f:
        f.write(kopf + z["sql"].rstrip() + "\n")
    geschrieben.append(datei)

print(f"{len(zeilen)} Migrationen in der Datenbank, {len(geschrieben)} als Datei ergaenzt:")
for g in geschrieben: print("  ", g)
