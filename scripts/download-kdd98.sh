#!/usr/bin/env bash
# Télécharge le jeu public KDD Cup 1998 (archive UCI) dans data/kdd98/.
# Conditions d'usage : ne pas nommer l'organisation commanditaire ; prévenir Epsilon en cas de résultats publiés.
set -euo pipefail
cd "$(dirname "$0")/../data/kdd98"
BASE="https://kdd.ics.uci.edu/databases/kddcup98/epsilon_mirror"
for f in cup98lrn.zip cup98dic.txt cup98doc.txt; do
  [ -f "$f" ] || curl -fL --retry 3 -o "$f" "$BASE/$f"
done
[ -f cup98LRN.txt ] || unzip -o cup98lrn.zip
ls -lh
