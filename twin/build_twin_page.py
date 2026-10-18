#!/usr/bin/env python3
"""Build twin.html (repo root) from twin_page.html and designs/twin.json, as one standalone file.

    python3 twin/physical.py && python3 twin/build_twin_page.py
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
data = (ROOT / "designs" / "twin.json").read_text().replace("</", "<\\/")
page = (HERE / "twin_page.html").read_text().replace("__TWIN_DATA__", data)
(ROOT / "twin.html").write_text(page)
print(f"wrote {ROOT / 'twin.html'} ({len(page) / 1024:.0f} kB)")
