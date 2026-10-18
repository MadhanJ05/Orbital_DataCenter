#!/usr/bin/env python3
"""Build twin.html and twin3d.html (repo root) from their templates and designs/twin.json, each one standalone file.

    python3 twin/physical.py && python3 twin/build_twin_page.py
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
data = (ROOT / "designs" / "twin.json").read_text().replace("</", "<\\/")
for template, out in (("twin_page.html", "twin.html"), ("twin3d_page.html", "twin3d.html")):
    page = (HERE / template).read_text().replace("__TWIN_DATA__", data)
    (ROOT / out).write_text(page)
    print(f"wrote {ROOT / out} ({len(page) / 1024:.0f} kB)")
