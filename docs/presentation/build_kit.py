"""Construit le kit de pitch : Kit-pitch-juges.md -> .html -> .pdf (Letter).

Usage : python3 docs/presentation/build_kit.py [--png]
Chrome tourne sans fenêtre (Playwright, headless). --png rend aussi chaque page en PNG (PyMuPDF).
"""
import pathlib
import re
import sys

import markdown

ICI = pathlib.Path(__file__).resolve().parent
MD = ICI / "Kit-pitch-juges.md"
HTML = ICI / "Kit-pitch-juges.html"
PDF = ICI / "Kit-pitch-juges.pdf"

CSS = r"""
@page { size: Letter; margin: 0.5in 0.55in 0.6in }
:root { --forest:#0a2f1e; --g700:#0f5132; --g500:#1f7a4d; --g50:#eef7f1; --g100:#d5ecdd;
  --gold:#f4c95d; --gold50:#fdf6e3; --red:#d61f45; --ink:#1c1917; --muted:#57534e; --line:#d6d3d1 }
* { box-sizing: border-box }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact }
body { font-family: Inter, Helvetica, Arial, sans-serif; color: var(--ink); background: #fff;
  font-size: 12.5pt; line-height: 1.38; margin: 0 }
h1 { font-family: Fraunces, Georgia, serif; font-weight: 700; color: var(--forest);
  font-size: 25pt; line-height: 1.1; margin: 0 0 6pt; display: flex; align-items: center; gap: 10pt; flex-wrap: wrap }
h3 { font-size: 13.5pt; color: var(--g700); margin: 12pt 0 5pt; text-transform: none }
p { margin: 0 0 6pt }
ul { margin: 0 0 6pt; padding-left: 16pt } li { margin: 2pt 0 }
.lead { color: var(--muted); font-size: 12pt; margin-bottom: 8pt }
.tag { font-family: Inter, sans-serif; font-size: 10.5pt; font-weight: 700; color: var(--forest);
  background: var(--gold); border-radius: 20pt; padding: 3pt 10pt; letter-spacing: .3pt }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; page-break-inside: auto }
tr { page-break-inside: avoid; break-inside: avoid }
th { background: var(--forest); color: #fff; text-align: left; font-size: 11pt; padding: 5pt 7pt }
td { border-bottom: 1px solid var(--line); padding: 5pt 7pt; vertical-align: top }
tbody tr:nth-child(even) td { background: #fafaf9 }
.p, .b { display: inline-block; font-size: 10pt; font-weight: 700; border-radius: 5pt; padding: 1.5pt 6pt; white-space: nowrap; line-height: 1.35 }
.p { background: var(--g100); color: var(--g700); border: 1px solid #a9d6b9 }
.p.ft { background: var(--gold50); color: #7a5300; border-color: #e8cf86 }
.b { background: var(--red); color: #fff }
.b::before { content: "\25B6\00a0"; font-size: 7pt; vertical-align: 1pt }
.card { border: 1.5px solid var(--g100); background: var(--g50); border-radius: 10pt; padding: 8pt 12pt }
.card h3 { margin-top: 0 }
.cue { font-size: 19pt; line-height: 1.3 } .cue td { padding: 8pt 8pt } .cue td:first-child { width: 130pt }
.cue .p, .cue .b { font-size: 14pt; padding: 3pt 9pt } .cue p { margin-top: 12pt }
.warn { color: var(--red); font-weight: 700; font-size: 11pt; margin: 0 0 4pt }
.check ul { list-style: none; padding-left: 2pt }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin: 6pt 0 }
.tip { background: var(--gold50); border-left: 5pt solid var(--gold); border-radius: 6pt; padding: 6pt 11pt; margin: 6pt 0; font-size: 11pt; break-inside: avoid }
.tip p { margin: 0 0 3pt }
.pb { break-after: page; height: 0 }
.cover h1 { font-size: 28pt }
.compact { font-size: 12pt } .compact td { padding: 5pt 7pt } .compact h3 { margin-top: 8pt }
table.rot td:first-child { white-space: nowrap; width: 100pt } table.rot td { padding: 4pt 7pt } .check li { margin: 1pt 0 }
.cover table td:first-child { font-weight: 700; color: var(--g700); width: 54pt }
.map td:first-child { width: 150pt }
/* pitch 2 min : plus gros, lisible à bout de bras */
.pitch { font-size: 12.2pt; line-height: 1.26 }
.pitch .tip { font-size: 11pt }
.pitch td:first-child { width: 96pt }
.pitch td { padding: 4pt 7pt }
/* version complète : colonnes compactes */
table.full td:nth-child(1) { width: 24pt; font-weight: 700; color: var(--g700) }
table.full td:nth-child(2) { width: 36pt }
table.full td:nth-child(3) { width: 92pt }
table.full td:last-child { width: 34pt; color: var(--muted); font-size: 10.5pt; white-space: nowrap }
table.full { font-size: 11.2pt } table.full td { padding: 4pt 6pt }
table.short td:nth-child(1) { width: 18pt; font-weight: 700; color: var(--g700) }
table.short td:nth-child(2) { width: 120pt }
table.short td:last-child { width: 34pt; color: var(--muted); font-size: 10.5pt; white-space: nowrap }
.qa p { margin: 0 0 7pt; break-inside: avoid; font-size: 12.4pt; line-height: 1.34 }
.qa strong:first-child { display: inline; color: var(--forest); font-size: 12.8pt }
.qa p > strong:first-child + br { display: block }
table.cal td:nth-child(1) { width: 92pt; white-space: nowrap }
table.cal td:nth-child(3) { width: 40pt }
table.cal td:last-child { width: 18pt; text-align: center }
table.cal { font-size: 11pt } table.cal td { padding: 3.5pt 6pt }
.board-wrap { display: grid; grid-template-columns: 250pt 1fr; gap: 14pt; align-items: start; margin-top: 4pt }
.board { position: relative; width: 250pt; height: 166.7pt; border: 3pt solid #8a6d3b; background: #c8a46a; border-radius: 3pt }
.board .z { position: absolute; display: grid; place-items: center; text-align: center; font-size: 8.5pt; font-weight: 700; line-height: 1.2; border-radius: 2pt; padding: 2pt }
.board .poster { left: 0; top: 0; width: 66.67%; height: 75%; background: var(--forest); color: #fff; font-size: 10pt }
.board .poster small { font-weight: 500; font-size: 7.5pt; opacity: .85 }
.board .canvas { left: 66.67%; top: 0; width: 33.33%; height: 41.7%; background: #fff; color: var(--g700); border: 1px solid var(--g100) }
.board .fiche { left: 70%; top: 47%; width: 26.67%; height: 38%; background: var(--gold50); color: #7a5300 }
.board .free { left: 0; top: 75%; width: 66.67%; height: 25%; background: transparent; color: #3b2a10; font-weight: 600; font-size: 7.5pt }
code { font-size: 10.5pt; background: #f5f5f4; padding: 0 3pt; border-radius: 3pt }
"""

FOOTER = """<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:8pt;color:#78716c;padding:0 0.55in;display:flex;justify-content:space-between">
<span>Fidélia · Équipe 4 · Kit de pitch, session d'affiches du 3 décembre 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>"""


def build_html() -> str:
    src = MD.read_text(encoding="utf-8")
    body = markdown.markdown(src, extensions=["extra", "sane_lists", "nl2br"])
    # classes de tableaux par section (repérées par leur en-tête)
    body = body.replace("<table>\n<thead>\n<tr>\n<th>#</th>\n<th>Qui</th>", '<table class="full">\n<thead>\n<tr>\n<th>#</th>\n<th>Qui</th>')
    body = body.replace("<table>\n<thead>\n<tr>\n<th>#</th>\n<th>Pointer</th>", '<table class="short">\n<thead>\n<tr>\n<th>#</th>\n<th>Pointer</th>')
    body = body.replace("<table>\n<thead>\n<tr>\n<th>Date</th>", '<table class="cal">\n<thead>\n<tr>\n<th>Date</th>')
    body = body.replace("<table>\n<thead>\n<tr>\n<th>Heure</th>", '<table class="rot">\n<thead>\n<tr>\n<th>Heure</th>')
    if "—" in body:
        raise SystemExit("Tiret cadratin interdit dans le kit")
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Kit pitch Fidélia</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
{body}
</body></html>"""


def main() -> None:
    HTML.write_text(build_html(), encoding="utf-8")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(HTML.as_uri(), wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.pdf(path=str(PDF), format="Letter", print_background=True, prefer_css_page_size=True,
                 display_header_footer=True, header_template="<span></span>", footer_template=FOOTER)
        browser.close()
    import fitz

    doc = fitz.open(PDF)
    print(f"{PDF.name} : {doc.page_count} pages")
    if "--png" in sys.argv:
        out = pathlib.Path(sys.argv[sys.argv.index("--png") + 1]) if len(sys.argv) > sys.argv.index("--png") + 1 else ICI
        out.mkdir(parents=True, exist_ok=True)
        for i, pg in enumerate(doc):
            pg.get_pixmap(dpi=110).save(out / f"kit-p{i + 1}.png")
        print(f"PNG dans {out}")


if __name__ == "__main__":
    main()
