"""Render the guide's deliberately small Markdown subset without dependencies.

Run: python3 scripts/build-user-guide.py
The source stays in docs; output is a self-contained, printable HTML asset.
"""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/studio-pm-user-guide.md"
TARGET = SOURCE.with_suffix(".html")


def inline(text):
    codes = []

    def stash(match):
        codes.append("<code>" + html.escape(match.group(1)) + "</code>")
        return f"\x00{len(codes)-1}\x00"

    text = re.sub(r"`([^`]+)`", stash, text)
    text = html.escape(text)
    text = re.sub(r"\[([^\]]+)\]\((#[a-z0-9-]+|https://[^\s)]+)\)",
                  r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], text)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def render(text):
    lines = text.splitlines()
    output = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            output.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            i += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            title = line[level:].strip()
            output.append(f'<h{level} id="{slug(title)}">{inline(title)}</h{level}>')
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                if not re.fullmatch(r"[|\s:-]+", lines[i]):
                    rows.append([part.strip() for part in lines[i].strip("|").split("|")])
                i += 1
            header = "".join(f'<th scope="col">{inline(cell)}</th>' for cell in rows[0])
            body = "".join("<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in row)
                           + "</tr>" for row in rows[1:])
            output.append('<div class="table-wrap"><table><thead><tr>' + header
                          + "</tr></thead><tbody>" + body + "</tbody></table></div>")
            continue
        if re.match(r"(- |\d+\. )", line):
            ordered = bool(re.match(r"\d+\.", line))
            tag = "ol" if ordered else "ul"
            pattern = r"\d+\. (.*)" if ordered else r"- (.*)"
            items = []
            while i < len(lines) and (match := re.fullmatch(pattern, lines[i])):
                items.append("<li>" + inline(match.group(1)) + "</li>")
                i += 1
            output.append(f"<{tag}>" + "".join(items) + f"</{tag}>")
            continue
        output.append("<p>" + inline(line) + "</p>")
        i += 1
    return "\n".join(output)


CSS = """
:root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:#202020; background:#efefed; }
* { box-sizing:border-box; }
body { margin:0; line-height:1.7; font-size:16px; }
.toolbar { max-width:920px; margin:auto; padding:18px 32px; display:flex; justify-content:space-between; align-items:center; gap:16px; font-size:13px; }
.toolbar a { color:#333; }
button { border:1px solid #333; background:#222; color:white; border-radius:6px; padding:10px 16px; cursor:pointer; font:inherit; }
main { max-width:920px; margin:0 auto 48px; background:#fff; padding:56px 64px; border:1px solid #ddd; border-radius:8px; }
h1,h2,h3 { line-height:1.25; color:#111; letter-spacing:-.025em; scroll-margin-top:20px; }
h1 { font-size:44px; margin:0 0 16px; }
h1 + p { font-size:22px; color:#555; margin-top:0; }
h1 + p + p { font-size:13px; color:#666; margin-bottom:32px; }
h2 { font-size:28px; border-top:1px solid #ddd; margin:44px 0 20px; padding-top:28px; }
h3 { font-size:20px; margin:28px 0 12px; }
p { margin:14px 0; }
li { margin:9px 0; padding-left:4px; }
ul,ol { padding-left:25px; }
a { color:#252525; text-underline-offset:3px; }
a:focus-visible,button:focus-visible { outline:3px solid #555; outline-offset:3px; }
code { font: .88em ui-monospace,SFMono-Regular,Consolas,monospace; background:#f1f1ef; padding:2px 4px; border-radius:3px; overflow-wrap:anywhere; }
pre { background:#f5f5f3; padding:20px; border-left:3px solid #777; white-space:pre-wrap; overflow-wrap:anywhere; }
pre code { padding:0; background:transparent; }
.table-wrap { overflow-x:auto; }
table { width:100%; border-collapse:collapse; margin:18px 0; font-size:14px; text-align:left; }
th,td { padding:12px; border-bottom:1px solid #ddd; vertical-align:top; }
th { background:#f3f3f1; font-weight:650; }
footer { border-top:1px solid #ddd; margin-top:44px; padding-top:16px; color:#666; font-size:12px; }
@media(max-width:640px) {
 body { font-size:15px; } main { padding:28px 22px; border-radius:0; margin-bottom:0; }
 .toolbar { padding:14px 22px; } h1 { font-size:34px; } h2 { font-size:24px; }
 th,td { padding:9px; } h1 + p { font-size:19px; }
}
@media print {
 @page { margin:18mm; } :root { background:white; } body { font-size:10pt; line-height:1.5; }
 .toolbar { display:none; } main { max-width:none; border:0; border-radius:0; padding:0; margin:0; }
 h1 { font-size:28pt; } h2 { font-size:18pt; margin-top:24pt; padding-top:14pt; }
 h3 { font-size:13pt; } h1,h2,h3 { break-after:avoid; } tr,pre { break-inside:avoid; }
 table { font-size:9pt; } .table-wrap { overflow:visible; } a { color:inherit; }
 p,li { orphans:3; widows:3; } button { display:none; }
}
"""

document = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="A plain-language walkthrough of Studio PM, from first project to proposals, invoices and Google Docs.">
<title>Studio PM — User Guide</title><style>""" + CSS + """</style></head>
<body><div class="toolbar"><a href="#contents">Jump to contents</a>
<button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<main>""" + render(SOURCE.read_text()) + """
<footer>Studio PM · Everyday user guide · Reviewed November 11, 2026</footer>
</main></body></html>
"""
TARGET.write_text(document)
print(f"Built {TARGET.relative_to(ROOT)} ({len(document.encode()):,} bytes)")
