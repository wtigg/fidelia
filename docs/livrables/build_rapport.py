#!/usr/bin/env python3
"""Génère le rapport final (PDF lettre + DOCX) depuis docs/RAPPORT.md et docs/ANNEXES.md.

Usage : python3 docs/livrables/build_rapport.py
Sorties : docs/livrables/Rapport-Fidelia-Equipe4.pdf et .docx
Dépendances : markdown, beautifulsoup4, playwright (chromium), pymupdf ; soffice pour le DOCX.
"""
import base64
import re
import sys
from pathlib import Path

import fitz  # pymupdf
import markdown
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
OUT_PDF = HERE / "Rapport-Fidelia-Equipe4.pdf"
OUT_DOCX = HERE / "Rapport-Fidelia-Equipe4.docx"
OUT_HTML = HERE / "Rapport-Fidelia-Equipe4.html"

TITLE = "Fidélia"
SUBTITLE = "Qui relancer, remercier ou solliciter : un assistant de fidélisation des donateurs pour les petits OBNL"
TEAM = ["Geoffrey Carel", "Juliette Ponce", "Juliette Violon", "Paul Soubigou"]
DATE = "5 décembre 2026"
DEMO = "https://wtigg.github.io/fidelia/"
REPO = "https://github.com/wtigg/fidelia"


def read_md(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    # Supprime le titre et le bloc d'en-tête (remplacés par la page de titre)
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("## "))
    text = "\n".join(lines[start:])
    # Liens Markdown vers des fichiers du dépôt : garder le texte seul
    text = re.sub(r"\[(`[^`]+`)\]\(([^)]+)\)", r"\1", text)
    # Une ligne vide avant chaque liste (sinon Python-Markdown la colle au paragraphe)
    out, prev = [], ""
    for l in text.split("\n"):
        if re.match(r"^(- |\d+\. )", l) and prev.strip() and not re.match(r"^(\s*- |\s*\d+\. )", prev):
            out.append("")
        out.append(l); prev = l
    text = "\n".join(out)
    # Règles horizontales inutiles en PDF
    text = re.sub(r"^---\s*$", "", text, flags=re.M)
    return text


def md_to_html(text: str) -> str:
    return markdown.markdown(text, extensions=["tables", "fenced_code", "attr_list", "sane_lists"])


def img_data_uri(path: Path) -> str:
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def postprocess(html: str, prefix: str) -> BeautifulSoup:
    # Intervalles [a ; b] insécables dans les tableaux
    html = re.sub(r"(\[[−\-]?\d+,\d+\u00a0?; ?[−\-]?\d+,\d+\])", r'<span style="white-space:nowrap">\1</span>', html)
    soup = BeautifulSoup(html, "html.parser")
    # Schéma ASCII du système remplacé par la figure SVG
    for pre in soup.find_all("pre"):
        if "CRM / plateforme" in pre.get_text():
            fig = soup.new_tag("figure", attrs={"class": "schema"})
            img = soup.new_tag("img", src=img_data_uri(HERE / "schema-systeme.svg"))
            fig.append(img)
            pre.replace_with(fig)
    # Images : chemins relatifs à docs/, embarquées ; légende = paragraphe en italique qui suit
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if src.startswith("data:"):
            continue
        p = (DOCS / src).resolve()
        if p.exists():
            img["src"] = img_data_uri(p)
        if "Raisons" in img.get("alt", ""):
            img["class"] = "narrow"
        parent = img.parent
        if parent.name == "p":
            parent.name = "figure"
            parent["class"] = "fig"
    # Légendes APA (au-dessus) : « Tableau N. » ou « Figure N. » en gras
    for p in soup.find_all("p"):
        st = p.find("strong")
        if st is not None and p.contents and p.contents[0] == st and re.match(r"(Tableau|Figure) [A-Z]?\d+\.", st.get_text()):
            p["class"] = "caption"
    # Saut de page avant le résumé, la section 1 et les références seulement
    for h in soup.find_all("h2"):
        if h.get_text().strip() in ("Résumé", "1. Idée", "Références"):
            h["class"] = "newpage"
    # Légende à l'intérieur du tableau ou de la figure (jamais séparée par un saut de page)
    for p in soup.find_all("p", class_="caption"):
        nxt = p.find_next_sibling()
        if nxt is None or nxt.name not in ("table", "figure"):
            continue
        tag = soup.new_tag("caption" if nxt.name == "table" else "figcaption")
        tag["class"] = "cap"
        for c in list(p.contents):
            tag.append(c.extract())
        nxt.insert(0, tag)
        p.decompose()
    # Identifiants des titres
    for i, h in enumerate(soup.find_all(["h2", "h3"])):
        h["id"] = f"{prefix}-{i}"
    # Tableaux : classe selon le nombre de colonnes ; petits tableaux d'un seul bloc
    for t in soup.find_all("table"):
        ncol = len(t.find("tr").find_all(["th", "td"]))
        t["class"] = f"c{ncol}" + (" short" if len(t.find_all("tr")) <= 9 else "")
    # Notes de tableau (APA) : « Note. Source : … »
    for p in soup.find_all("p"):
        if p.get_text().startswith("Note."):
            p["class"] = "tnote"
    # Note de tableau rattachée au tableau (pied de tableau, jamais orpheline)
    for p in soup.find_all("p", class_="tnote"):
        prev = p.find_previous_sibling()
        if prev is not None and prev.name == "table":
            ncol = len(prev.find("tr").find_all(["th", "td"]))
            tfoot = soup.new_tag("tfoot"); tr = soup.new_tag("tr"); td = soup.new_tag("td", colspan=str(ncol))
            td["class"] = "tnote"
            for c in list(p.contents):
                td.append(c.extract())
            tr.append(td); tfoot.append(tr); prev.append(tfoot); p.decompose()
    # Paragraphe d'introduction (finit par « : ») gardé avec ce qui suit
    for p in soup.find_all("p"):
        if p.get_text().rstrip().endswith(":") and not p.get("class"):
            p["class"] = "lead"
    # Références : paragraphes en retrait suspendu
    for h in soup.find_all("h2"):
        if h.get_text().strip() == "Références":
            first = True
            for sib in h.find_next_siblings():
                if sib.name != "p":
                    break
                if first:
                    first = False
                    sib["class"] = "refnote"
                    continue
                sib["class"] = "ref"
    return soup


CSS = """
@page { size: Letter; margin: 22mm 22mm 20mm 22mm; }
* { box-sizing: border-box; }
html { font-size: 10.5pt; }
body { font-family: 'Iowan Old Style', Georgia, serif; color: #1a1f1c; line-height: 1.45; margin: 0;
       hyphens: auto; -webkit-hyphens: auto; text-align: left; }
h1, h2, h3, h4, .toc, th, .caption, figure, .cover { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; text-align: left; }
h2 { font-size: 16pt; color: #0f3d2a; margin: 0 0 8pt; padding-bottom: 4pt; border-bottom: 1.5pt solid #1b6b45;
     break-before: auto; break-after: avoid; margin-top: 22pt; }
h2.newpage { break-before: page; margin-top: 0; }
h3 { font-size: 12pt; color: #0f3d2a; margin: 14pt 0 5pt; break-after: avoid; }
h4 { font-size: 10.5pt; margin: 10pt 0 4pt; break-after: avoid; }
p { margin: 0 0 6pt; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 6pt; padding-left: 18pt; }
li { margin-bottom: 2pt; }
code { font-variant-ligatures: none; font-family: Menlo, monospace; font-size: 8.4pt; background: #f1f4f2; padding: 0; border-radius: 2pt;
       word-break: normal; overflow-wrap: break-word; hyphens: none; -webkit-hyphens: none; }
pre { font-family: Menlo, monospace; font-size: 7.4pt; font-variant-ligatures: none; background: #f4f6f5; padding: 6pt 8pt; border-radius: 4pt;
      white-space: pre-wrap; break-inside: avoid; text-align: left; }
pre code { background: none; padding: 0; word-break: normal; }
blockquote { margin: 6pt 0; padding: 6pt 10pt; background: #f4f7f5; border-left: 3pt solid #1b6b45; font-size: 9.5pt; }
blockquote p { margin: 0; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 8.4pt; line-height: 1.3;
        text-align: left; break-inside: auto; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
th { background: #0f3d2a; color: #fff; font-weight: 600; padding: 4pt 5pt; vertical-align: bottom; }
td { padding: 3.5pt 5pt; border-bottom: 0.6pt solid #d5ddd8; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f7f9f8; }
table.c2 td:first-child { width: 30%; }
figure { margin: 8pt 0 2pt; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: 120mm; border: 0.6pt solid #d5ddd8; border-radius: 4pt; }
figure.schema img { border: none; max-height: 135mm; }
figure img.narrow { max-width: 62%; }
table { hyphens: manual; -webkit-hyphens: manual; }
p.caption { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 8.8pt; color: #1a1f1c; text-align: left;
            margin: 10pt 0 3pt; break-after: avoid; }
p.caption em { color: #33413a; }
p.caption strong, .cap strong { display: block; margin-bottom: 1pt; }
caption.cap, figcaption.cap { caption-side: top; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 8.8pt;
  color: #1a1f1c; text-align: left; padding: 0 0 4pt; }
figcaption.cap { margin-bottom: 4pt; }
.cap em { color: #33413a; }
p.tnote { font-size: 8.2pt; color: #4c5a53; margin: -6pt 0 10pt; }
td.tnote { font-size: 7.8pt; color: #4c5a53; border-bottom: none; background: none !important; padding-top: 3pt; }
tfoot { display: table-row-group; }
p.caption + table { margin-top: 2pt; }
p.lead { break-after: avoid; }
table.short { break-inside: avoid; }
p.refnote { font-size: 9pt; color: #4c5a53; }
p.ref { font-size: 9pt; text-align: left; padding-left: 18pt; text-indent: -18pt; margin-bottom: 3.5pt; overflow-wrap: anywhere; }
a { color: #1b6b45; text-decoration: none; }
strong { color: #0f2219; }
.annexes-title { break-before: page; font-family: 'Inter', Arial, sans-serif; font-size: 20pt; color: #0f3d2a;
                 margin: 0 0 4pt; }
.annexes-title + p { color: #4c5a53; }
.annexes h2 { break-before: auto; margin-top: 18pt; }
.annexes h2:first-of-type { break-before: auto; }
/* table des matières */
.toc { break-after: page; }
.toc h1 { font-size: 18pt; color: #0f3d2a; margin: 0 0 8pt; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; margin: 0; font-size: 9.2pt; line-height: 1.2; }
.toc li.l3 { padding-left: 16pt; font-size: 8.6pt; color: #33413a; }
.toc li.l2 { font-weight: 600; margin-top: 1.5pt; }
.toc li .dots { flex: 1; border-bottom: 0.8pt dotted #9aa8a1; margin: 0 4pt; transform: translateY(-3pt); }
.toc li .pg { min-width: 14pt; text-align: right; }
"""

COVER_CSS = """
@page { size: Letter; margin: 0; }
body { margin: 0; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #14251d; }
.cover { width: 8.5in; height: 11in; position: relative; overflow: hidden; }
.band { position: absolute; top: 0; left: 0; right: 0; height: 3.4in; background: #0f3d2a; }
.band .course { position: absolute; left: 0.9in; top: 0.75in; color: #cfe3d8; font-size: 11pt; letter-spacing: 0.04em; line-height: 1.5; }
.band .course b { color: #fff; font-weight: 600; }
.logo { position: absolute; left: 0.9in; top: 2.35in; width: 0.75in; height: 0.75in; border-radius: 14pt; background: #f2c94c;
        display: flex; align-items: center; justify-content: center; }
.main { position: absolute; left: 0.9in; right: 0.9in; top: 3.9in; }
.main h1 { font-family: 'Iowan Old Style', Georgia, serif; font-size: 48pt; margin: 0 0 6pt; color: #0f3d2a; }
.main .sub { font-size: 16pt; line-height: 1.35; color: #33413a; margin: 0 0 28pt; max-width: 6in; }
.main .kind { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.12em; color: #1b6b45; font-weight: 600; margin-bottom: 14pt; }
.team { font-size: 12pt; line-height: 1.6; }
.team .lbl { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7a72; }
.links { position: absolute; left: 0.9in; right: 0.9in; bottom: 0.9in; font-size: 10.5pt; line-height: 1.7; border-top: 1pt solid #d5ddd8; padding-top: 12pt; }
.links .lbl { display: inline-block; width: 2.4in; color: #6b7a72; }
.links a { color: #1b6b45; text-decoration: none; font-weight: 600; }
"""

LOGO = """<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0f3d2a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/></svg>"""


def cover_html() -> str:
    team = "<br>".join(TEAM)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>{COVER_CSS}</style></head><body>
<div class="cover">
  <div class="band">
    <div class="course"><b>TECH 60711 · Réalisation d’applications d’intelligence artificielle</b><br>HEC Montréal · Automne 2026<br>Travail d’équipe : rapport final</div>
    <div class="logo">{LOGO}</div>
  </div>
  <div class="main">
    <div class="kind">Rapport de projet</div>
    <h1>{TITLE}</h1>
    <p class="sub">{SUBTITLE}</p>
    <div class="team"><div class="lbl">Équipe 4</div>{team}</div>
  </div>
  <div class="links">
    <div><span class="lbl">Remis le</span>{DATE}</div>
    <div><span class="lbl">Démonstration en ligne</span><a href="{DEMO}">{DEMO.replace('https://', '')}</a> (aucune installation)</div>
    <div><span class="lbl">Dépôt du code et des données</span><a href="{REPO}">{REPO.replace('https://', '')}</a></div>
  </div>
</div></body></html>"""


def toc_html(entries, pages) -> str:
    items = []
    for (hid, level, text) in entries:
        pg = pages.get(hid, "")
        items.append(f'<li class="l{level}"><a href="#{hid}">{text}</a><span class="dots"></span><span class="pg">{pg}</span></li>')
    return f'<nav class="toc"><h1>Table des matières</h1><ol>{"".join(items)}</ol></nav>'


def body_html(rapport: BeautifulSoup, annexes: BeautifulSoup, pages) -> str:
    entries = []
    for h in rapport.find_all(["h2", "h3"]):
        entries.append((h["id"], 2 if h.name == "h2" else 3, h.get_text().strip()))
    entries.append(("annexes", 2, "Annexes"))
    for h in annexes.find_all("h2"):
        entries.append((h["id"], 3, h.get_text().strip()))
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fidélia, rapport final, Équipe 4</title>
<style>{CSS}</style></head><body>
{toc_html(entries, pages)}
<main>{rapport}</main>
<section class="annexes"><h1 class="annexes-title" id="annexes">Annexes</h1>
<p>Détails de calcul, commandes et éléments secondaires. Les références renvoient à la liste du rapport ; les chiffres viennent du dossier <code>reports/</code> du dépôt.</p>
{annexes}</section>
</body></html>""", entries


FOOTER = """<div style="font-family: Arial, sans-serif; font-size: 7.5pt; color: #6b7a72; width: 100%; padding: 0 22mm; display: flex; justify-content: space-between;">
<span>Fidélia · Équipe 4 · TECH 60711</span><span class="pageNumber"></span></div>"""


def render(page, html: str, out: Path, footer: bool):
    tmp = HERE / ".tmp.html"
    tmp.write_text(html, encoding="utf-8")
    page.goto(tmp.as_uri())
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    page.pdf(path=str(out), format="Letter", print_background=True, prefer_css_page_size=True,
             display_header_footer=footer, header_template="<span></span>", footer_template=FOOTER if footer else "<span></span>")
    tmp.unlink()


def heading_pages(pdf: Path, entries):
    """Numéro de page (1 = première page du corps) de chaque titre, lu dans les liens internes de la TdM."""
    doc = fitz.open(pdf)
    targets = []
    for i in range(len(doc)):
        for l in doc[i].get_links():
            if l.get("kind") == fitz.LINK_GOTO or l.get("kind") == fitz.LINK_NAMED:
                pg = l.get("page")
                if pg is not None and pg >= 0:
                    targets.append(pg + 1)
        if len(targets) >= len(entries):
            break
    pages = {e[0]: targets[k] for k, e in enumerate(entries) if k < len(targets)}
    return pages, len(doc)


def main():
    rapport = postprocess(md_to_html(read_md(DOCS / "RAPPORT.md")), "r")
    annexes = postprocess(md_to_html(read_md(DOCS / "ANNEXES.md")), "a")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        cover_pdf, body_pdf = HERE / ".cover.pdf", HERE / ".body.pdf"
        render(page, cover_html(), cover_pdf, footer=False)
        html, entries = body_html(rapport, annexes, {})
        render(page, html, body_pdf, footer=True)
        pages, _ = heading_pages(body_pdf, entries)
        html, entries = body_html(rapport, annexes, pages)
        render(page, html, body_pdf, footer=True)
        pages2, n = heading_pages(body_pdf, entries)
        if pages2 != pages:  # la TdM a changé de longueur : un passage de plus
            html, entries = body_html(rapport, annexes, pages2)
            render(page, html, body_pdf, footer=True)
        browser.close()
    out = fitz.open()
    out.insert_pdf(fitz.open(cover_pdf))
    out.insert_pdf(fitz.open(body_pdf))
    out.set_metadata({"title": "Fidélia : rapport final (Équipe 4, TECH 60711)", "author": ", ".join(TEAM),
                      "subject": "TECH 60711, HEC Montréal, automne 2026"})
    out.save(OUT_PDF, garbage=3, deflate=True)
    print(f"PDF : {OUT_PDF} ({len(out)} pages)")
    missing = [e[2] for e in entries if e[0] not in pages2]
    if missing:
        print("Titres non retrouvés pour la TdM :", missing, file=sys.stderr)
    cover_pdf.unlink(); body_pdf.unlink()
    build_docx(rapport, annexes)


def _inline(par, node, bold=False, ital=False, code=False):
    from docx.shared import Pt
    from bs4 import NavigableString
    for ch in node.children:
        if isinstance(ch, NavigableString):
            t = str(ch).replace("\n", " ")
            if not t:
                continue
            r = par.add_run(t)
            r.bold, r.italic = bold or None, ital or None
            if code:
                r.font.name = "Menlo"; r.font.size = Pt(8.5)
        elif ch.name in ("strong", "b"):
            _inline(par, ch, True, ital, code)
        elif ch.name in ("em", "i"):
            _inline(par, ch, bold, True, code)
        elif ch.name == "code":
            _inline(par, ch, bold, ital, True)
        elif ch.name == "br":
            par.add_run().add_break()
        else:
            _inline(par, ch, bold, ital, code)


def _blocks(doc, soup, img_png):
    import io
    from docx.shared import Cm, Pt, RGBColor
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    for el in soup.children:
        name = getattr(el, "name", None)
        if name is None:
            continue
        if name in ("h1", "h2", "h3", "h4"):
            lvl = {"h1": 1, "h2": 1, "h3": 2, "h4": 3}[name]
            h = doc.add_heading(el.get_text().strip(), level=lvl)
        elif name == "p":
            par = doc.add_paragraph()
            if "caption" in (el.get("class") or []):
                par.alignment = 1
            _inline(par, el)
        elif name in ("ul", "ol"):
            style = "List Bullet" if name == "ul" else "List Number"
            if "refs" in (el.get("class") or []):
                style = None
            for li in el.find_all("li", recursive=False):
                par = doc.add_paragraph(style=style) if style else doc.add_paragraph()
                if not style:
                    par.paragraph_format.left_indent = Cm(1); par.paragraph_format.first_line_indent = Cm(-1)
                _inline(par, li)
        elif name == "blockquote":
            for p in el.find_all("p"):
                par = doc.add_paragraph(); par.paragraph_format.left_indent = Cm(0.8)
                _inline(par, p, ital=True)
        elif name == "pre":
            par = doc.add_paragraph()
            r = par.add_run(el.get_text()); r.font.name = "Menlo"; r.font.size = Pt(8)
        elif name == "figure":
            cap = el.find("figcaption")
            if cap is not None:
                _inline(doc.add_paragraph(), cap)
            img = el.find("img")
            if img is not None:
                src = img["src"]
                data = img_png if src.startswith("data:image/svg") else base64.b64decode(src.split(",", 1)[1])
                doc.add_picture(io.BytesIO(data), width=Cm(15))
                doc.paragraphs[-1].alignment = 1
        elif name == "table":
            cap = el.find("caption")
            if cap is not None:
                _inline(doc.add_paragraph(), cap)
            rows = el.find_all("tr")
            ncol = len(rows[0].find_all(["th", "td"]))
            t = doc.add_table(rows=0, cols=ncol)
            t.style = "Table Grid"
            for i, tr in enumerate(rows):
                cells = t.add_row().cells
                for j, td in enumerate(tr.find_all(["th", "td"])[:ncol]):
                    par = cells[j].paragraphs[0]
                    _inline(par, td, bold=(td.name == "th"))
                    for r in par.runs:
                        r.font.size = Pt(8.5)
                    if td.name == "th":
                        shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), "DCE8E1")
                        cells[j]._tc.get_or_add_tcPr().append(shd)
            doc.add_paragraph()
        elif name in ("section", "main", "div"):
            _blocks(doc, el, img_png)


def build_docx(rapport, annexes):
    from docx import Document
    from docx.shared import Pt, Inches
    from docx.enum.text import WD_BREAK
    png = HERE / ".schema.png"
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(device_scale_factor=2, viewport={"width": 760, "height": 560})
        pg.goto((HERE / "schema-systeme.svg").as_uri()); pg.screenshot(path=str(png)); b.close()
    img_png = png.read_bytes(); png.unlink()
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    for m in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, m, Inches(0.9))
    st = doc.styles["Normal"]; st.font.name = "Georgia"; st.font.size = Pt(10.5)
    doc.add_paragraph("TECH 60711, Réalisation d’applications d’intelligence artificielle\nHEC Montréal, automne 2026")
    doc.add_paragraph("Rapport de projet")
    t = doc.add_heading(TITLE, level=0)
    doc.add_paragraph(SUBTITLE)
    doc.add_paragraph("Équipe 4 : " + ", ".join(TEAM))
    doc.add_paragraph(f"Remis le {DATE}\nDémonstration en ligne : {DEMO} (aucune installation)\nDépôt du code et des données : {REPO}")
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    _blocks(doc, rapport, img_png)
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    doc.add_heading("Annexes", level=1)
    _blocks(doc, annexes, img_png)
    doc.core_properties.title = "Fidélia : rapport final (Équipe 4, TECH 60711)"
    doc.core_properties.author = ", ".join(TEAM)
    doc.save(OUT_DOCX)
    print(f"DOCX : {OUT_DOCX}")


if __name__ == "__main__":
    main()
