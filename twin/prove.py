#!/usr/bin/env python3
"""Show, live, why our numbers are not made up. Runs in under a minute.

    python3 twin/prove.py

1. The model reproduces the organizers' own numbers before it is trusted.
2. Every organizer rule, re-checked from the raw design files.
3. Key numbers redone by hand, with plain arithmetic, without the model's code.
4. Full days simulated minute by minute: normal, every outage, eclipses.
5. What happens if our own guesses are wrong (from twin/stress.py, about 2 minutes to re-run).
6. Where every input comes from: the organizers' slides, or a labeled guess we stress-tested.
"""
import contextlib
import io
import json
import re
from pathlib import Path

import catalog as C
import score as S

ROOT = Path(__file__).resolve().parent.parent
D1, D2 = ROOT / "designs" / "final_resilient.json", ROOT / "designs" / "whatif_all_orbit_light.json"


def title(n, text):
    print(f"\n{n}. {text}\n" + "-" * (len(text) + 3))


def quiet(fn, *a):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        out = fn(*a)
    return out, buf.getvalue()


# ---------------------------------------------------------------- 1. organizers' numbers
title(1, "Our model reproduces the organizers' own numbers")
base = dict(S.SERVING_DEFAULTS)
chat, agent = S.decode_replica("chat", "gpu", 1, base), S.decode_replica("agent_int", "gpu", 1, base)
be = {r["site"]: r["breakeven_usd_per_kg"] for r in S.breakeven_table() if r["chip"] == "gpu"}
rows = [
    ("chat users one 2035 GPU can serve", "~960 (slide 13)", f"{chat['sessions']}"),
    ("agents one 2035 GPU can serve", "~117 (slide 13)", f"{agent['sessions']}"),
    ("memory per chat / agent session", "1.1 / 3.8 GB (slide 13)", f"{S.session_kv_bytes('chat') / 1e9:.2f} / {S.session_kv_bytes('agent_int') / 1e9:.2f} GB"),
    ("radiator heat per m^2 at 330 K", "972 W (slide 14)", f"{S.radiator_w_per_m2():.0f} W"),
    ("cost to launch 1 MW at $200/kg", "$3.6M (slide 14)", f"${C.SITES['leo']['launch_usd_per_kg'] * C.SPACE_KG_PER_MW / 1e6:.1f}M"),
    ("launch price where orbit ties the Nordics", "~$95/kg (slide 14)", f"${be['nordics']:.0f}/kg"),
    ("launch price where orbit ties West Texas", "~$170/kg (slide 14)", f"${be['west_texas']:.0f}/kg"),
]
for case, out, inp in (("A", 2.4, 5.6), ("B", 28, 333), ("C", 4.6, 40)):
    d_out, d_in, _ = S.demand([case], base)
    u = C.CASES[case]["users"]
    rows.append((f"peak tokens/s per user, case {case}", f"{out} out + {inp} in (slide 11)", f"{sum(d_out.values()) / u:.1f} + {sum(d_in.values()) / u:.1f}"))
print(f"  {'what':<44} {'organizers say':<26} {'our model'}")
for a, b, c in rows:
    print(f"  {a:<44} {b:<26} {c}")
import test_calibration as T
tests = [(n, f) for n, f in sorted(vars(T).items()) if n.startswith("test_")]
passed = 0
for n, f in tests:
    try:
        f(); passed += 1
    except AssertionError as e:
        print(f"  FAILED {n}: {e}")
print(f"  -> {passed} of {len(tests)} automatic tests pass (twin/test_calibration.py)")

# ---------------------------------------------------------------- 2. every rule
title(2, "Every organizer rule, re-checked from the raw design files")
import check_rules as R
for path in (D1, D2):
    _, text = quiet(R.check, path)
    name = next(l for l in text.splitlines() if l.startswith("==="))
    verdict = [l for l in text.splitlines() if "->" in l][-1].strip()
    keys = ("5-year cost", "Earth grid, all", "chat: time to first", "agent_int: time to first", "users served",
            "failure test", "worst eclipse", "network:")
    print("  " + name.replace("===", "").strip())
    for slide, rule, limit, value, ok in R.check.rows:
        if rule.startswith(keys):
            short = rule.split(" (")[0].replace("network: busiest plane's Earth links", "network: busiest plane's link to Earth")
            print(f"     {short[:52]:<52} limit {limit:<14} ours {value:<22} {'PASS' if ok else 'FAIL'}")
    print(f"     {verdict}")

# ---------------------------------------------------------------- 3. by hand
title(3, "Key numbers redone by hand, without the model's code (twin/handcheck.py)")
_, text = quiet(lambda: __import__("handcheck"))
for l in text.splitlines():
    if l.strip().startswith(("chat sessions", "chat tokens/s", "chat first token", "Nordics chat pool: electricity", "total =", "->")):
        print("  " + l.strip())

# ---------------------------------------------------------------- 4. simulated days
title(4, "Full days, simulated minute by minute (twin/simulate.py)")
import simulate as M
for path in (D1, D2):
    design, r, days = M.run(path, outages=True, eclipse=True)
    worst_live = max(x["live_shortfall_pct"] for x in days)
    worst_wait = max(x["streams"]["agent_bg"]["max_wait_min"] for x in days)
    allowed = days[0]["streams"]["agent_bg"]["allowance_min"]
    ecl = sum(1 for x in days if x.get("eclipse"))
    print(f"  {design['name']:<24} {len(days)} days (normal, each of {len(days) - ecl - 1} outages, {ecl} eclipse days with and without an outage): "
          f"{sum(x['ok'] for x in days)} OK | live users unserved: {worst_live:.0f}% | longest background wait {worst_wait} of {allowed} min")

# ---------------------------------------------------------------- 5. stress
title(5, "If our own guesses are wrong: each one made 25% worse (twin/stress.py)")
for f, label in (("stress_25.json", "Design 1"), ("stress_25_light_orbit_only.json", "Design 2")):
    p = ROOT / "designs" / f
    if not p.exists():
        continue
    rows = json.loads(p.read_text())[1:-1]
    fits = sum(1 for x in rows if x["best_valid"])
    breaks = [x["scenario"] for x in rows if not x["best_valid"]]
    print(f"  {label}: still fits the budget in {fits} of {len(rows)} cases; breaks on: {', '.join(breaks)}")

# ---------------------------------------------------------------- 6. sources
title(6, "Where every input comes from (twin/catalog.py)")
src = (Path(__file__).parent / "catalog.py").read_text()
tags = {t: len(re.findall(r"#\s*" + t + r"\b", src)) for t in ("DECK", "ASSUMED", "CALIB", "DERIVED")}
print(f"  {tags['DECK']} lines taken from the organizers' slides (tagged DECK, with the slide number)")
print(f"  {tags['ASSUMED']} lines are our own guesses (tagged ASSUMED); step 5 makes 16 of the guessed inputs 25% worse")
print(f"  {tags['CALIB']} lines are tuned so the model reproduces an organizer number (tagged CALIB); {tags['DERIVED']} derived from organizer numbers")
print("  Teammates' numbers (sandboxes, eclipses, comms) are reused from agents-in-orbit/ and app/ and say so in the code.")
print("\nEverything above is open: github.com/MadhanJ05/Orbital_DataCenter")
