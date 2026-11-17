#!/usr/bin/env python3
"""Construit l'affiche Fidélia (48 x 36 po) et sa fiche technique (lettre) à partir de reports/.

Affiche (affiche.html → Affiche-Fidelia.pdf, apercu.png) : 5 blocs, 150 à 220 mots.
  * grand chiffre du résultat : multiplicateur contre la méthode habituelle à 300 contacts
    (reports/impact-42.json, bloc « app », identique à l'écran Impact de l'application)
  * pictogramme « vrais donateurs » : taille du jeu de test KDD Cup 1998 (reports/kdd98.json)
  * QR code vers la démo (segno si installé, sinon qr.svg)
  * captures de la fiche donateur (fiche-risque.png, fiche-raisons.png) :
    node docs/affiche/capture_fiche.mjs (après npm run build)

Fiche technique (fiche-technique.html → Fiche-technique.pdf, fiche-technique.png) : tout le détail
retiré de l'affiche : graphique AUC-PR (reports/synthetique-42.json), deux conditions R1/R2,
ciblage à 100 et 300 contacts, KDD 98 nuancé, équité par âge (impact-42.json), robustesse
(robustesse.json).

Usage : python3 docs/affiche/build_affiche.py [--sans-rendu]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL_DEMO = "https://wtigg.github.io/fidelia/"

BLEU = "#1f5fa8"
GRIS = "#9aa4b2"
ENCRE = "#14213d"
VERT = "#1e7a4c"
AMBRE = "#a85d00"
POLICE = "Avenir Next, Helvetica Neue, Helvetica, Arial, sans-serif"


def fr(x, d=3):
    return f"{x:.{d}f}".replace(".", ",")


def mult(x):
    t = fr(x, 1)
    return t[:-2] if t.endswith(",0") else t


def milliers(n):
    return f"{n:,}".replace(",", "&nbsp;")


def charger(nom):
    return json.loads((RACINE / "reports" / nom).read_text(encoding="utf-8"))


def par_capacite(impact):
    bloc = impact.get("app", impact)
    return {c["capacity"]: c["total"] for c in bloc["impact"]}


# ---------------------------------------------------------------- AUC-PR
def svg_aucpr(synth):
    taches = [
        ("churn", "Attrition"),
        ("conversion", "Passage|au mensuel"),
        ("reactivation", "Réactivation"),
        ("upgrade", "Hausse|du don"),
    ]
    W, H = 1600, 860
    g, d, h, b = 120, 10, 200, 250
    ymax = 0.40
    pw, ph = W - g - d, H - h - b

    def y(v):
        return h + ph * (1 - min(v, ymax) / ymax)

    gagnes = sum(1 for k, _ in taches if synth[k]["deployed"] != "rfm")
    titre = f'<p class="titre-graph">{gagnes} listes sur {len(taches)} : le modèle gagne.</p>'
    o = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="{POLICE}" role="img" '
         'aria-label="Précision pour trouver les bons donateurs : Fidélia contre la méthode habituelle, quatre modèles">']
    # légende
    o.append(f'<rect x="{g}" y="14" width="56" height="56" rx="8" fill="{BLEU}"/>'
             f'<text x="{g + 74}" y="58" font-size="46" fill="{ENCRE}" font-weight="700">Fidélia</text>')
    o.append(f'<rect x="{g + 330}" y="14" width="56" height="56" rx="8" fill="{GRIS}"/>'
             f'<text x="{g + 404}" y="58" font-size="46" fill="{ENCRE}" font-weight="700">Méthode habituelle</text>')
    o.append(f'<line x1="{g + 870}" y1="42" x2="{g + 950}" y2="42" stroke="{ENCRE}" stroke-width="6" stroke-dasharray="14 10"/>'
             f'<text x="{g + 966}" y="58" font-size="46" fill="{ENCRE}" font-weight="700">2 × le hasard</text>')
    # grille
    for i in range(5):
        v = i * 0.1
        yy = y(v)
        o.append(f'<line x1="{g}" y1="{yy:.1f}" x2="{W - d}" y2="{yy:.1f}" stroke="#e3e7ee" stroke-width="3"/>')
        o.append(f'<text x="{g - 22}" y="{yy + 15:.1f}" font-size="40" fill="#5b6472" text-anchor="end">{fr(v, 1)}</text>')
    o.append(f'<text transform="translate(34 {h + ph / 2:.0f}) rotate(-90)" font-size="40" fill="#5b6472" text-anchor="middle">Précision (plus haut = mieux)</text>')
    gw = pw / len(taches)
    bw = 140
    etiquettes = []  # dessinées en dernier, au-dessus des seuils R1
    for i, (k, nom) in enumerate(taches):
        t = synth[k]
        evals = {e["algorithm"]: e for e in t["evaluations"]}
        m, r = evals[t["selected"]], evals["rfm"]
        seuil = 2 * t["baseRate"]
        cx = g + gw * i + gw / 2
        for j, (e, c) in enumerate([(m, BLEU), (r, GRIS)]):
            x0 = cx - bw - 12 if j == 0 else cx + 12
            o.append(f'<rect x="{x0:.1f}" y="{y(e["ap"]):.1f}" width="{bw}" height="{y(0) - y(e["ap"]):.1f}" rx="6" fill="{c}"/>')
            lo, hi = e["apCI"]
            xm = x0 + bw / 2
            o.append(f'<line x1="{xm:.1f}" y1="{y(lo):.1f}" x2="{xm:.1f}" y2="{y(hi):.1f}" stroke="{ENCRE}" stroke-width="5"/>')
            for v in (lo, hi):
                o.append(f'<line x1="{xm - 22:.1f}" y1="{y(v):.1f}" x2="{xm + 22:.1f}" y2="{y(v):.1f}" stroke="{ENCRE}" stroke-width="5"/>')
            yb = y(hi) - 18
            # l'étiquette ne doit pas être barrée par le seuil R1 pointillé
            if yb - 40 < y(seuil) + 8 and yb + 8 > y(seuil) - 8:
                yb = y(seuil) - 16
            etiquettes.append(f'<text x="{xm:.1f}" y="{yb:.1f}" font-size="32" font-weight="600" '
                     f'fill="{BLEU if j == 0 else "#5b6472"}" text-anchor="middle" stroke="#fff" stroke-width="10" paint-order="stroke">{fr(e["ap"])}</text>')
        # rapport lisible de loin, calculé à partir des deux barres affichées
        rapport = m["ap"] / r["ap"]
        deploye_ = t["deployed"] != "rfm"
        o.append(f'<text x="{cx:.1f}" y="{h - 62}" font-size="76" font-weight="800" fill="{BLEU if deploye_ else AMBRE}" '
                 f'text-anchor="middle">×{fr(rapport, 1)}</text>')
        o.append(f'<line x1="{cx - bw - 40:.1f}" y1="{y(seuil):.1f}" x2="{cx + bw + 40:.1f}" y2="{y(seuil):.1f}" '
                 f'stroke="{ENCRE}" stroke-width="6" stroke-dasharray="14 10"/>')
        lignes = nom.split("|")
        for n, l in enumerate(lignes):
            o.append(f'<text x="{cx:.1f}" y="{y(0) + 58 + 52 * n:.1f}" font-size="48" font-weight="700" fill="{ENCRE}" text-anchor="middle">{l}</text>')
        deploye = t["deployed"] != "rfm"
        lab = "Modèle utilisé" if deploye else "Méthode habituelle"
        coul = VERT if deploye else AMBRE
        pw_ = 356
        o.append(f'<rect x="{cx - pw_ / 2:.1f}" y="{y(0) + 138:.1f}" width="{pw_}" height="66" rx="33" fill="{coul}"/>')
        o.append(f'<text x="{cx:.1f}" y="{y(0) + 184:.1f}" font-size="{38 if deploye else 34}" font-weight="700" fill="#fff" text-anchor="middle">{lab}</text>')
    o.extend(etiquettes)
    o.append(f'<line x1="{g}" y1="{y(0):.1f}" x2="{W - d}" y2="{y(0):.1f}" stroke="{ENCRE}" stroke-width="4"/>')
    o.append(f'<text x="{g}" y="{H - 4}" font-size="34" fill="#5b6472">×N = Fidélia ÷ méthode habituelle. Donateurs fictifs de test. Traits noirs : incertitude.</text>')
    o.append("</svg>")
    return titre + "\n" + "\n".join(o)



# ================================================================ AFFICHE
def html_resultat(impact):
    t = par_capacite(impact)[300]
    m = round(t["multiplierVsRfm"])
    return (f'<div class="res-haut"><div class="gros-chiffre">×{m}</div>'
            f'<p class="res-txt">plus de dons à risque repérés, à effort égal.</p></div>'
            f'<p class="res-note">Comparé à la méthode habituelle, avec {t["contacted"]} contacts.'
            f'<small>Donateurs fictifs de test.</small></p>')


ICONE_GENS = ('<svg viewBox="0 0 24 24" fill="none" stroke="#163e6e" stroke-width="2" stroke-linecap="round" '
              'stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/>'
              '<path d="M2 20a7 7 0 0 1 14 0M15 14.5a5 5 0 0 1 7 5.5"/></svg>')


def html_kdd(kdd):
    n = kdd["reactivation"]["nTest"]
    return (f'<li><span class="ico">{ICONE_GENS}</span><span>Testé sur {milliers(n)} vrais donateurs.'
            f'<small>Là, l\'IA ne gagne pas : on garde la méthode habituelle.</small></span></li>')


def svg_qr():
    try:
        import segno  # noqa: WPS433
    except ImportError:
        return (ICI / "qr.svg").read_text(encoding="utf-8").strip()
    import io
    q = segno.make(URL_DEMO, error="m")
    buf = io.BytesIO()
    q.save(buf, kind="svg", scale=10, border=2, dark="#163e6e", xmldecl=False, svgns=True,
           title="QR code vers " + URL_DEMO)
    s = buf.getvalue().decode()
    taille = re.search(r'width="(\d+)" height="(\d+)"', s)
    s = s.replace(taille.group(0), f'viewBox="0 0 {taille.group(1)} {taille.group(2)}" width="100%" height="100%"', 1)
    (ICI / "qr.svg").write_text(s + "\n", encoding="utf-8")
    return s


# ================================================================ FICHE TECHNIQUE
def html_regle(synth):
    t = synth["churn"]
    ev = {e["algorithm"]: e for e in t["evaluations"]}
    m, r = ev[t["selected"]], ev["rfm"]
    lo, hi = m["apCI"]
    dlo, dhi = m["apDiffVsRfmCI"]
    return (f'<p>On n\'utilise le modèle que s\'il remplit les deux ; sinon l\'outil garde la méthode habituelle '
            f'(règle RFM : dernier don, fréquence, montant).</p>'
            f'<ul><li><b>R1</b> : précision (AUC-PR) ≥ 2 × le hasard (taux de base).</li>'
            f'<li><b>R2</b> : intervalle de confiance à 95 % (bootstrap) de l\'écart avec RFM au-dessus de 0.</li></ul>'
            f'<p class="encadre" style="margin-top:6px">Attrition : AUC-PR <b>{fr(m["ap"])}</b> (IC 95 % : {fr(lo)} à {fr(hi)}) '
            f'contre {fr(r["ap"])} pour RFM. Seuil R1 : {fr(2 * t["baseRate"])}. Écart avec RFM : {fr(dlo)} à {fr(dhi)}.</p>')


def html_ciblage(impact, synth, robust):
    par = par_capacite(impact)
    t = synth["churn"]
    ev = {e["algorithm"]: e for e in t["evaluations"]}
    pts = ev[t["selected"]]["valueGain"]
    p10 = min(pts, key=lambda p: abs(p["x"] - 0.10))
    res = robust["results"].values()
    ok, tot = sum(x["deployed"] for x in res), sum(x["runs"] for x in res)
    return (f'<p>À contacts égaux, valeur des dons à risque visée, Fidélia contre la méthode habituelle : '
            f'<b>×{mult(par[100]["multiplierVsRfm"])}</b> avec 100 contacts, '
            f'<b>×{mult(par[300]["multiplierVsRfm"])}</b> avec 300 '
            f'({fr(par[300]["multiplierVsRfm"], 2)} exactement).</p>'
            f'<p>Attrition : {round(p10["x"] * 100)} % des mensuels contactés couvrent '
            f'<b>{round(p10["y"] * 100)} %</b> des dons à risque.</p>'
            f'<p>Robustesse : {ok} cas sur {tot} retenus (5 autres jeux de données × 4 modèles).</p>'
            f'<p class="note">On mesure le ciblage, pas l\'effet d\'un courriel : il reste une hypothèse, '
            f'qu\'un groupe témoin mesurera.</p>')


def html_kdd_detail(kdd):
    k = kdd["reactivation"]
    ev = {e["algorithm"]: e for e in k["evaluations"]}
    ap = ev[k["selected"]]["ap"]
    pr = k["profit"]
    gain20 = pr["modelTop20"]["net"] / pr["rfmTop20"]["net"] - 1
    pct20 = round(pr["modelTop20"]["mailed"] / k["nTest"] * 100)
    return (f'<p><b>Méthode validée, modèle non utilisé.</b> {milliers(k["nTest"])} vrais donateurs américains '
            f'inactifs (données publiques, 1998) : le modèle obtient une AUC-PR de {fr(ap)}, sous le seuil R1 '
            f'({fr(2 * k["baseRate"])}). Il ne fait pas 2 fois mieux que le hasard.</p>'
            f'<p>À gros volume ({milliers(pr["rfmSameVolume"]["mailed"])} envois), la méthode habituelle fait même un peu mieux : '
            f'{milliers(round(pr["rfmSameVolume"]["net"]))}&nbsp;$ de profit net contre {milliers(round(pr["modelExpectedValue"]["net"]))}&nbsp;$.</p>'
            f'<p>Seul signe positif : avec {pct20} % des envois, <b>+{round(gain20 * 100)} %</b> de profit net '
            f'contre la méthode habituelle. Selon nos propres conditions, on garde la méthode habituelle.</p>')


def html_equite(impact):
    mod = {m["kind"]: m for m in impact["fairnessAge"]["models"]}
    grp = {g["group"]: g for g in mod["conversion"]["groups"]}["70 ans et plus"]
    lo, hi = grp["ci95"]
    return (f'<p>Pour proposer le don mensuel, le modèle choisit <b>{fr(grp["selectionRatio"], 1)} fois</b> plus souvent '
            f'les 70 ans et plus (ratio {fr(grp["selectionRatio"], 2)}, IC 95 % : {fr(lo, 2)} à {fr(hi, 2)}).</p>'
            f'<p>L\'âge n\'est pas utilisé, mais d\'autres indices le reflètent. Écart à surveiller, '
            f'à revérifier sur de vraies données.</p>')


# ================================================================ assemblage
def inserer(html, cle, contenu):
    motif = re.compile(rf"(<!-- {cle}:debut -->)(.*?)(<!-- {cle}:fin -->)", re.S)
    if not motif.search(html):
        sys.exit(f"Marqueur {cle} introuvable")
    return motif.sub(lambda m: m.group(1) + "\n" + contenu + "\n" + m.group(3), html)


def chrome(*args):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", *args], check=True, capture_output=True)


def rendre(nom_html, nom_pdf, nom_png, largeur, hauteur, apercu):
    page = (ICI / nom_html).as_uri()
    chrome(f"--print-to-pdf={ICI / nom_pdf}", "--no-pdf-header-footer", page)
    grand = ICI / "_plein.png"
    chrome(f"--screenshot={grand}", f"--window-size={largeur},{hauteur}", "--force-device-scale-factor=1", page)
    from PIL import Image
    im = Image.open(grand)
    im.thumbnail(apercu, Image.LANCZOS)
    im.save(ICI / nom_png, optimize=True)
    grand.unlink()


def compter_mots():
    """Compte les mots visibles de l'affiche (hors attributs et SVG)."""
    h = (ICI / "affiche.html").read_text(encoding="utf-8")
    h = re.sub(r"<(style|svg|title)[^>]*>.*?</\1>", " ", h, flags=re.S)
    h = re.sub(r"<!--.*?-->", " ", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h).replace("&nbsp;", " ")
    return len([w for w in h.split() if re.search(r"\w", w)])


def main():
    synth = charger("synthetique-42.json")
    impact = charger("impact-42.json")
    kdd = charger("kdd98.json")
    robust = charger("robustesse.json")

    html = (ICI / "affiche.html").read_text(encoding="utf-8")
    html = inserer(html, "RESULTAT", html_resultat(impact))
    html = inserer(html, "KDD", html_kdd(kdd))
    html = inserer(html, "QR", svg_qr())
    (ICI / "affiche.html").write_text(html, encoding="utf-8")

    fiche = (ICI / "fiche-technique.html").read_text(encoding="utf-8")
    fiche = inserer(fiche, "REGLE", html_regle(synth))
    fiche = inserer(fiche, "AUCPR", svg_aucpr(synth))
    fiche = inserer(fiche, "CIBLAGE", html_ciblage(impact, synth, robust))
    fiche = inserer(fiche, "KDDDETAIL", html_kdd_detail(kdd))
    fiche = inserer(fiche, "EQUITE", html_equite(impact))
    (ICI / "fiche-technique.html").write_text(fiche, encoding="utf-8")

    if "--sans-rendu" not in sys.argv:
        rendre("affiche.html", "Affiche-Fidelia.pdf", "apercu.png", 4608, 3456, (2304, 1728))
        rendre("fiche-technique.html", "Fiche-technique.pdf", "fiche-technique.png", 816, 1056, (1632, 2112))
    print("Affiche construite :", ICI, "·", compter_mots(), "mots")


if __name__ == "__main__":
    main()
