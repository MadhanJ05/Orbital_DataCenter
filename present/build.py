#!/usr/bin/env python3
"""Build explained.html (the 15-slide deck) and briefing.html (the dashboard) at the repo root,
each one standalone file, from their templates, present/sources.py and the NASA Earth images.
The pages aren't committed: the Pages workflow runs this on every push.

    python3 present/build.py
    python3 present/build.py --fragments /tmp/out    # also write content-only copies for claude.ai artifacts

Numbers on the pages are written into the templates; their sources are noted on each slide/panel.
"""
import argparse
import base64
import json
import re
from pathlib import Path

from sources import REFS, SOURCES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PAGES = (("deck_page.html", "explained.html"), ("briefing_page.html", "briefing.html"))
HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>
"""   # the same reset claude.ai wraps an artifact in, so both copies render alike
TAIL = "\n</body>\n</html>\n"


def fragment(template):
    page = (HERE / template).read_text()
    used = set(re.findall(r'data-k="(\w+)"', page)) | {k for r in SOURCES for k in r["refs"]}
    missing = sorted(used - set(REFS))
    if missing:
        raise SystemExit(f"{template} cites unknown references: {', '.join(missing)}")
    refs = {k: dict(title=t, pub=p, url=u) for k, (t, p, u) in REFS.items() if k in used}
    page = page.replace("__REFS__", json.dumps(refs, ensure_ascii=False)).replace("__SOURCES__", json.dumps(SOURCES, ensure_ascii=False))
    for k in ("day", "night", "clouds"):   # NASA imagery, public domain (twin/assets/README.md)
        img = (ROOT / "twin" / "assets" / f"earth_{k}.jpg").read_bytes()
        page = page.replace(f"__EARTH_{k.upper()}__", "data:image/jpeg;base64," + base64.b64encode(img).decode())
    return page, len(refs)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fragments", type=Path, help="also write content-only copies here, for publishing as artifacts")
    a = ap.parse_args()
    for template, out in PAGES:
        page, n = fragment(template)
        (ROOT / out).write_text(HEAD + page + TAIL)
        print(f"wrote {ROOT / out} ({len(page) / 1024:.0f} kB, {n} references)")
        if a.fragments:
            a.fragments.mkdir(parents=True, exist_ok=True)
            (a.fragments / out).write_text(page)


if __name__ == "__main__":
    main()
