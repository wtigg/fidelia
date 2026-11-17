import copy, shutil
from pptx import Presentation
from pptx.util import Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

SRC = "/Users/paulsoubigou/Work/Perso/HEC/Cours HEC/TECH60711 - Realisation applications IA/files/TECH 60711_S02_AI Canvas_2_.pptx"
DST = "/Users/paulsoubigou/Work/Perso/HEC/Développement d'app IA/fidelia/docs/canevas/Canevas-IA-Fidelia.pptx"
shutil.copyfile(SRC, DST)
p = Presentation(DST)
s = p.slides[0]
by = {sh.name: sh for sh in s.shapes}
GRAY = RGBColor(0x59, 0x59, 0x59)
FONT = "Segoe UI"

CASES = [
  ("Rectangle 4", "Rectangle 3", "PRÉDICTION", "Que faut-il savoir pour décider ?",
   ["La probabilité qu'un donateur mensuel arrête son don dans les 90 prochains jours."]),
  ("Rectangle 6", "Rectangle 5", "JUGEMENT", "Quelle valeur donner aux résultats et aux erreurs ?",
   ["Rater un départ coûte le don annuel : environ 240 $ par an au don médian de 20 $ par mois.", "Relancer à tort coûte peu, mais peut agacer.", "L'équipe fixe le seuil et le ton."]),
  ("Rectangle 8", "Rectangle 7", "ACTION", "Que cherche-t-on à faire ?",
   ["Envoyer un courriel de relance :", "• mise à jour de la carte expirée ;", "• rappel de l'impact du don ;", "• option de pause."]),
  ("Rectangle 10", "Rectangle 9", "RÉSULTAT", "Quelle mesure du succès ?",
   ["Le donateur est-il toujours mensuel 90 jours plus tard ?", "Comparaison avec un groupe témoin non contacté."]),
  ("Rectangle 12", "Rectangle 11", "ENTRÉE", "Quelles données pour prédire ?",
   ["Le comportement récent du donateur, par exemple :", "• ouvertures de courriels sur 3 mois ;", "• jours depuis le dernier don ;", "• échecs de paiement sur 90 jours ;", "• canal de recrutement (rue, Web, courrier) ;", "• tendance de l'engagement.", "18 variables au total. Ni âge, ni région."]),
  ("Rectangle 14", "Rectangle 13", "ENTRAÎNEMENT", "Quelles données pour entraîner ?",
   ["L'historique des dons et des ouvertures de l'organisation, sur 3,5 ans.", "Des photos tous les 2 à 6 mois, selon le modèle.", "Pour chaque photo : le donateur est-il parti dans les 90 jours suivants ?"]),
  ("Rectangle 16", "Rectangle 15", "RÉTROACTION", "Comment les résultats améliorent-ils le modèle ?",
   ["Les résultats des relances et du groupe témoin (10 %) s'ajoutent à l'historique.", "Réentraînement chaque trimestre."]),
]

import re as _re
def nb(t):
    t = _re.sub(r" ([:;?!%$»])", "\u00a0\\1", t)
    return t.replace("« ", "«\u00a0")
def run(par, text, size, bold=False, italic=False, color=None):
    r = par.add_run(); r.text = nb(text)
    f = r.font; f.size = Pt(size); f.bold = bold; f.italic = italic; f.name = FONT
    if color: f.color.rgb = color
    return r

for head, body, label, q, lines in CASES:
    h = by[head].text_frame
    h.paragraphs[0].runs[0].text = label
    h.paragraphs[0].runs[0].font.bold = True
    tf = by[body].text_frame
    tf.clear(); tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(91440); tf.margin_top = Emu(64008)
    p0 = tf.paragraphs[0]
    run(p0, q, 10, italic=True, color=GRAY)
    p0.space_after = Pt(6)
    for ln in lines:
        par = tf.add_paragraph(); par.space_after = Pt(3)
        run(par, ln, 13)

# Titre et pied de page dans les marges libres du gabarit
tb = s.shapes.add_textbox(Emu(774245), Emu(40000), Emu(10712000), Emu(380000))
tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
tf.margin_left = tf.margin_right = 0
par = tf.paragraphs[0]
run(par, "Fidélia · Canevas d'IA principal : relancer les donateurs mensuels à risque", 16, bold=True)
run(par, "   (Agrawal, Gans et Goldfarb, 2018)", 11, color=GRAY)

fb = s.shapes.add_textbox(Emu(774245), Emu(6440000), Emu(10712000), Emu(330000))
tf = fb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = 0
par = tf.paragraphs[0]
run(par, "L'IA rend la prédiction bon marché. L'équipe garde le jugement : seuils, ton, validation. Les résultats des campagnes réalimentent le modèle.", 11, italic=True, color=GRAY)

# Diapositive 2 : les trois autres canevas
s2 = p.slides.add_slide(p.slide_layouts[6] if len(p.slide_layouts) > 6 else p.slide_layouts[-1])
for ph in list(s2.placeholders):
    ph._element.getparent().remove(ph._element)
tb = s2.shapes.add_textbox(Emu(774245), Emu(300000), Emu(10712000), Emu(500000))
tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = 0
run(tf.paragraphs[0], "Les trois autres canevas : ce qui change", 20, bold=True)
par = tf.add_paragraph()
run(par, "Les cases Entrée, Entraînement et Rétroaction sont les mêmes pour les quatre canevas.", 12, color=GRAY)

rows = [
  ("Case", "Passage au mensuel", "Hausse du don mensuel", "Réactivation"),
  ("PRÉDICTION", "Probabilité qu'un donateur ponctuel ou annuel passe au mensuel dans les 6 mois.",
   "Probabilité qu'un mensuel augmente son don dans les 6 mois. Modèle évalué, règle RFM conservée tant que R1 et R2 échouent.",
   "Probabilité qu'un inactif redonne dans les 6 mois."),
  ("JUGEMENT", "Solliciter trop tôt peut faire fuir. Le montant suggéré doit rester raisonnable.",
   "Ne jamais demander plus à un donateur à risque de départ.", "Coût d'un envoi contre le don moyen espéré."),
  ("ACTION", "Proposition de don mensuel, avec un montant suggéré.", "Demande de hausse de 5 ou 10 $.", "Courriel « vous nous manquez »."),
  ("RÉSULTAT", "Conversion ou non en 6 mois.", "Hausse ou non en 6 mois.", "Nouveau don ou non en 6 mois."),
]
left, top, width = Emu(774245), Emu(1250000), Emu(10712000)
gt = s2.shapes.add_table(len(rows), 4, left, top, width, Emu(4600000))
tbl = gt.table
tbl.columns[0].width = Emu(1700000)
for c in (1, 2, 3):
    tbl.columns[c].width = Emu((10712000 - 1700000) // 3)
for i, row in enumerate(rows):
    for j, txt in enumerate(row):
        cell = tbl.cell(i, j); cell.text = ""
        cell.margin_left = cell.margin_right = Emu(91440)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE if (i == 0 or j == 0) else MSO_ANCHOR.TOP
        par = cell.text_frame.paragraphs[0]
        r = run(par, txt, 13 if (i == 0 or j == 0) else 12, bold=(i == 0 or j == 0))
        if i == 1 and j == 2:
            pass
p.save(DST)
print("ok", len(p.slides))
