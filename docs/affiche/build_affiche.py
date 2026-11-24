#!/usr/bin/env python3
"""Construit l'affiche Fidélia (48 x 36 po) et sa fiche technique (lettre) à partir de reports/.

Affiche (affiche.html → Affiche-Fidelia.pdf, apercu.png) : 5 blocs, 150 à 220 mots, un seul message :
  « L'IA n'est utilisée que là où elle gagne : 3 modèles sur 4 » (réactivation à l'essai : pas confirmée sur de vrais donateurs).
  * graphique des 4 listes (modèle ÷ méthode habituelle, vert = modèle utilisé), reports/synthetique-42.json
  * grand chiffre du ciblage (dons à risque visés, pas récupérés) : liste Relancer, campagne de 300 contacts, multiplicateur
    contre la méthode habituelle, indépendant de l'effet supposé des courriels (reports/impact-42.json, bloc « app », ligne
    « Pour Relancer seul » de l'écran Impact)
  * ligne « vrais donateurs » : KDD Cup 1998, réactivation et don plus élevé (reports/kdd98.json)
  * QR code vers la démo (segno si installé, sinon qr.svg)
  * captures de la fiche donateur (fiche-risque.png, fiche-raisons.png) :
    node docs/affiche/capture_fiche.mjs (après npm run build), recadrées ici en *-affiche.png

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
        ("churn", "Relancer"),
        ("conversion", "Proposer|le mensuel"),
        ("reactivation", "Réactiver"),
        ("upgrade", "Solliciter|plus"),
    ]
    W, H = 1600, 860
    g, d, h, b = 120, 10, 200, 250
    ymax = 0.40
    pw, ph = W - g - d, H - h - b

    def y(v):
        return h + ph * (1 - min(v, ymax) / ymax)

    gagnes = sum(1 for k, _ in taches if synth[k]["deployed"] != "rfm")
    titre = f'<p class="titre-graph">{gagnes} modèles sur {len(taches)} remplissent nos deux conditions (donateurs fictifs).</p>'
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
        lab = ("Utilisé, à l'essai" if k == "reactivation" else "Modèle utilisé") if deploye else "Méthode habituelle"
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
ORANGE = "#c2410c"
VERT_AFF = "#17663f"
NOMS_LISTES = [("churn", "Relancer"), ("conversion", "Proposer|le mensuel"),
               ("reactivation", "Réactiver|(à l'essai)"), ("upgrade", "Solliciter|plus")]


def svg_listes(synth):
    """Petit graphique de l'affiche : précision du modèle ÷ méthode habituelle, une barre par liste.
    Vert = modèle utilisé (R1 et R2 remplies), orange = méthode habituelle gardée."""
    W, H = 1580, 560
    haut, bas = 140, 200  # place pour la légende et les ×N, puis pour les noms
    ph = H - haut - bas
    rmax = 3.4

    def y(v):
        return haut + ph * (1 - v / rmax)

    o = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter, sans-serif" role="img" '
         'aria-label="Précision du modèle divisée par celle de la méthode habituelle, pour les quatre listes">']
    o.append(f'<rect x="0" y="6" width="50" height="50" rx="10" fill="{VERT_AFF}"/>'
             f'<text x="66" y="48" font-size="44" font-weight="700" fill="#0a2f1e">IA utilisée</text>'
             f'<rect x="420" y="6" width="50" height="50" rx="10" fill="{ORANGE}"/>'
             f'<text x="486" y="48" font-size="44" font-weight="700" fill="#0a2f1e">méthode habituelle gardée</text>')
    gw = W / 4
    bw = 220
    for i, (k, nom) in enumerate(NOMS_LISTES):
        t = synth[k]
        ev = {e["algorithm"]: e for e in t["evaluations"]}
        ratio = ev[t["selected"]]["ap"] / ev["rfm"]["ap"]
        coul = VERT_AFF if t["deployed"] != "rfm" else ORANGE
        cx = gw * i + gw / 2
        o.append(f'<rect x="{cx - bw / 2:.1f}" y="{y(ratio):.1f}" width="{bw}" height="{y(0) - y(ratio):.1f}" rx="14" fill="{coul}"/>')
        o.append(f'<text x="{cx:.1f}" y="{y(ratio) - 20:.1f}" font-size="80" font-weight="800" fill="{coul}" text-anchor="middle">×{fr(ratio, 1)}</text>')
        for n, l in enumerate(nom.split("|")):
            o.append(f'<text x="{cx:.1f}" y="{y(0) + 62 + 54 * n:.1f}" font-size="48" font-weight="700" fill="#0a2f1e" text-anchor="middle">{l}</text>')
    o.append(f'<line x1="0" y1="{y(0):.1f}" x2="{W}" y2="{y(0):.1f}" stroke="#0a2f1e" stroke-width="5"/>')
    o.append(f'<text x="0" y="{H - 8}" font-size="44" font-weight="600" fill="#0a2f1e">×2,7 = 2,7 fois mieux que la méthode habituelle (donateurs fictifs)</text>')
    o.append("</svg>")
    return '<div class="graph-listes">' + "".join(o) + "</div>"


def relancer(impact, capacite):
    bloc = impact.get("app", impact)
    c = next(c for c in bloc["impact"] if c["capacity"] == capacite)
    return next(m for m in c["byModel"] if m["kind"] == "churn")


def html_resultat(impact):
    t = relancer(impact, 300)
    m = round(t["multiplierVsRfm"])
    return (f'<div class="x3"><span class="badge">Démo 2</span><b><span class="fois">×</span>{m}</b>'
            f'<p>de dons menacés visés, même effort<small>Liste Relancer, 300 contacts, donateurs fictifs, '
            f'contre la méthode habituelle</small></p></div>')


def kdd_hausse_ok(kdd):
    """La tâche « don plus élevé » de KDD 98 remplit-elle R1 et R2 ?"""
    h = kdd["hausse"]
    ev = {e["algorithm"]: e for e in h["evaluations"]}
    m = ev[h["selected"]]
    return m["ap"] >= 2 * h["baseRate"] and m["apDiffVsRfmCI"][0] > 0, m, ev["rfm"], h


def html_kdd(kdd):
    n = kdd["reactivation"]["nTest"]
    ok, *_ = kdd_hausse_ok(kdd)
    gagne = "l'IA repère qui dépassera son dernier don ; réactiver n'est pas encore prouvé (« à l'essai »)" if ok else "l'IA ne gagne pas : méthode habituelle gardée"
    return f'<p class="reel"><b>{milliers(n)} vrais donateurs</b> : {gagne}.</p>'


ICONE_GENS = ('<svg viewBox="0 0 24 24" fill="none" stroke="#163e6e" stroke-width="2" stroke-linecap="round" '
              'stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/>'
              '<path d="M2 20a7 7 0 0 1 14 0M15 14.5a5 5 0 0 1 7 5.5"/></svg>')


def recadrer_captures():
    """Recadre les captures de la fiche donateur pour l'affiche : ligne clé (risque, action, raisons) lisible à 2 m."""
    from PIL import Image
    for src, dst, boite in [("fiche-risque.png", "fiche-risque-affiche.png", (40, 60, 1600, 710)),
                            ("fiche-raisons.png", "fiche-raisons-affiche.png", (40, 360, 1600, 900))]:
        if (ICI / src).exists():
            Image.open(ICI / src).crop(boite).save(ICI / dst, optimize=True)


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
    r100, r300 = relancer(impact, 100), relancer(impact, 300)
    t = synth["churn"]
    ev = {e["algorithm"]: e for e in t["evaluations"]}
    pts = ev[t["selected"]]["valueGain"]
    p10 = min(pts, key=lambda p: abs(p["x"] - 0.10))
    r10 = min(ev["rfm"]["valueGain"], key=lambda p: abs(p["x"] - 0.10))
    res = robust["results"].values()
    ok, tot = sum(x["deployed"] for x in res), sum(x["runs"] for x in res)
    return (f'<p>À contacts égaux, dons menacés visés par la liste Relancer, Fidélia contre la méthode habituelle : '
            f'<b>×{fr(r300["multiplierVsRfm"], 1)}</b> avec une campagne de 300 contacts, <b>×{fr(r100["multiplierVsRfm"], 1)}</b> avec 100, '
            f'quel que soit l\'effet des courriels.</p>'
            f'<p>Les 4 listes réunies : ×{mult(par[300]["multiplierVsRfm"])} avec 300 contacts, '
            f'×{mult(par[100]["multiplierVsRfm"])} avec 100 ; contre le hasard, ×{mult(par[300]["multiplierVsRandom"])} et '
            f'×{mult(par[100]["multiplierVsRandom"])}, si l\'effet supposé des courriels se vérifie. Donateurs fictifs.</p>'
            f'<p>Attrition : {round(p10["x"] * 100)} % des mensuels contactés couvrent '
            f'<b>{round(p10["y"] * 100)} %</b> des dons à risque (méthode habituelle : {round(r10["y"] * 100)} %).</p>'
            f'<p>Robustesse : {ok} cas sur {tot} retenus (5 autres jeux de données × 4 modèles).</p>')


def html_kdd_detail(kdd):
    k = kdd["reactivation"]
    ev = {e["algorithm"]: e for e in k["evaluations"]}
    ap = ev[k["selected"]]["ap"]
    pr = k["profit"]
    gain20 = pr["modelTop20"]["net"] / pr["rfmTop20"]["net"] - 1
    pct20 = round(pr["modelTop20"]["mailed"] / k["nTest"] * 100)
    return (f'<p><b>Réactivation : pas encore validée.</b> {milliers(k["nTest"])} vrais donateurs inactifs (1998) : '
            f'AUC-PR {fr(ap)}, sous le seuil R1 ({fr(2 * k["baseRate"])}). Profit net : <b>+{round(gain20 * 100)} %</b> avec {pct20} % des envois ; '
            f'à gros volume, la méthode habituelle fait un peu mieux ({milliers(round(pr["rfmSameVolume"]["net"]))}&nbsp;$ '
            f'contre {milliers(round(pr["modelExpectedValue"]["net"]))}&nbsp;$). Dans l\'application, ce modèle reste « à l\'essai ».</p>'
            + html_kdd_hausse(kdd))


def html_kdd_hausse(kdd):
    ok, m, r, h = kdd_hausse_ok(kdd)
    lo, hi = m["apDiffVsRfmCI"]
    verdict = "<b>R1 et R2 remplies</b> : résultat positif sur données réelles." if ok else "R1 ou R2 non remplie."
    return (f'<p>Don plus élevé que le dernier : AUC-PR <b>{fr(m["ap"])}</b> contre {fr(r["ap"], 4)} pour RFM, '
            f'soit {fr(m["ap"] / r["ap"], 1)} fois mieux '
            f'(seuil R1 : {fr(2 * h["baseRate"])} ; écart : {fr(lo)} à {fr(hi)}). {verdict}</p>')


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
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=15000", *args], check=True, capture_output=True)


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
    recadrer_captures()
    html = inserer(html, "LISTES", svg_listes(synth))
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
