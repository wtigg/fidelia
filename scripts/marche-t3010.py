#!/usr/bin/env python3
"""Taille du marché (rapport, section 9.3 et annexe H) : organismes de bienfaisance enregistrés selon leurs revenus.

Source : Agence du revenu du Canada, « Liste des organismes de bienfaisance 2024 » (Gouvernement ouvert du Canada,
jeu 80c00cdb-1358-415c-bb8b-0de7f12675b8), fichiers Identification et Données financières (T3010, ligne 4700 = revenus totaux).
Usage : python3 scripts/marche-t3010.py ident_2024_updated.csv financial_d_and_schedule_6_2024_updated.csv
(fichiers à télécharger depuis ouvert.canada.ca ; non versionnés).
"""
import csv
import sys


def main(ident_csv, fin_csv):
    ident = {r["BN"]: r for r in csv.DictReader(open(ident_csv, encoding="latin-1"))}
    fin = {}
    for r in csv.DictReader(open(fin_csv, encoding="latin-1")):
        if r["BN"] not in fin or r["FPE"] > fin[r["BN"]]["FPE"]:
            fin[r["BN"]] = r  # dernière déclaration de chaque organisme

    def rev(r):
        return float(r["4700"] or 0)

    for prov in ("QC", None):
        rows = [(ident[b], r) for b, r in fin.items() if b in ident and (prov is None or ident[b]["Province"] == prov)]
        moins_1m = sum(rev(r) < 1e6 for _, r in rows)
        moins_100k = sum(rev(r) < 1e5 for _, r in rows)
        cible = sum(i["Designation"] == "C" and 1e5 <= rev(r) < 1e6 for i, r in rows)
        print(f"{prov or 'Canada'} : {len(rows)} déclarations ; < 1 M$ : {moins_1m} ({moins_1m / len(rows):.0%}) ; "
              f"< 100 000 $ : {moins_100k} ; organismes de bienfaisance (hors fondations) de 100 000 $ à 1 M$ : {cible}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
