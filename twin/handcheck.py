#!/usr/bin/env python3
"""Hand-check Design 1 with plain arithmetic, then compare with the scorer.

    python3 twin/handcheck.py

Nothing here calls the scorer's physics. Every number is typed in from the deck
(or from catalog.py's labeled assumptions) and every step is one line of
arithmetic you can redo on a calculator. Only the final comparison reads the
scorer's result for designs/final_resilient.json.
"""
import json
import math
from pathlib import Path

import score as S

ROOT = Path(__file__).resolve().parent.parent
GB, TB = 1e9, 1e12

# ---------------------------------------------------------------- inputs, typed in
users = {"A": 4e9, "B": 50e6, "C": 400e6}                    # DECK s11
chat_per_day = {"A": 30, "B": 0, "C": 20}                    # DECK s11
int_tasks = {"A": 0, "B": 12, "C": 1}                        # DECK s11
bg_tasks = {"A": 0, "B": 30, "C": 4}                         # DECK s11
steps, agent_out, chat_out = 80, 500, 3500                   # DECK s10
peak_chat, peak_int = 2.0, 2.5                               # DECK s16
accept = 0.7                                                 # ASSUMED draft acceptance

qwen_total, qwen_active, qwen_kv, qwen_state = 397e9, 17e9, 15e3, 94e6   # DECK s10
lpu_mem, lpu_bw, lpu_flops = 160 * GB, 200 * TB, 50e15       # DECK s13 (mem, bw); flops ASSUMED
air_mem, air_bw, air_flops = 96 * GB, 4 * TB, 30e15          # ASSUMED
bw_eff, flops_eff = 0.6, 0.5                                 # DECK s13 (72/120); ASSUMED
sync = 1.7e-3                                                # DECK s17
usable, margin = 0.95, 1.0                                   # our safety rules: 5% memory free, no demand margin

rows = []


def show(what, by_hand, scorer, unit=""):
    """scorer=None marks a hand-only margin with nothing to compare against."""
    if scorer is None:
        rows.append((what, by_hand, None, unit, 0.0))
        return
    diff = abs(by_hand - scorer) / abs(scorer) if scorer else abs(by_hand)
    rows.append((what, by_hand, scorer, unit, diff))


design = json.loads((ROOT / "designs" / "final_resilient.json").read_text())
racks = {p["name"]: p["racks"] for p in design["pools"]}        # the design's inputs, read as given
sub_share, spec_draft = design["serving"]["subagent_share"], design["serving"]["spec_draft"]
r = S.evaluate(design)
pools = {p["name"]: p for p in r["pools"]}

# ---------------------------------------------------------------- 1. chat demand at peak
prompts_per_s = (users["A"] * chat_per_day["A"] + users["C"] * chat_per_day["C"]) / 86400
chat_peak_out = prompts_per_s * chat_out * peak_chat * margin
chat_peak_in = prompts_per_s * (64_000 - 56_000) * peak_chat * margin
show("chat peak demand, tokens out per s", chat_peak_out, r["demand_out_tps"]["chat"])
show("chat peak demand, new tokens in per s", chat_peak_in, r["demand_in_tps"]["chat"])

# ---------------------------------------------------------------- 2. one chat decode replica: 12 LPUs
n = 12
mem = n * lpu_mem * usable                                   # 1,824 GB usable of 1,920
weights = qwen_total * 0.5                                   # FP4: 198.5 GB
kv = qwen_kv * (64_000 + chat_out / 2) + qwen_state          # 1.080 GB per session
sessions = math.floor((mem - weights) / kv)                  # memory-bound
tau = (1 - accept ** (spec_draft + 1)) / (1 - accept)        # 2.94 tokens per step
bw, fl = n * lpu_bw * bw_eff, n * lpu_flops * flops_eff
fixed = sync + 0.25e-3 * math.log2(n) + 2.5 * qwen_active * 0.5 / bw + spec_draft * 0.05e-3
per = kv / bw + (spec_draft + 1) * (2 * qwen_active + 16 * kv) / fl
step = fixed + sessions * per
replica_tps = sessions * tau / step
show("chat sessions per 12-LPU replica", sessions, pools["chat-decode-nordics"]["rep"]["sessions"])
show("chat tokens/s per LPU", replica_tps / n, pools["chat-decode-nordics"]["rep"]["tps"] / n)
show("chat speed per user (>= 60)", tau / step, tau / pools["chat-decode-nordics"]["step_s"], "tok/s")

# ---------------------------------------------------------------- 3. capacity of the Nordics and LEO chat pools
chat_racks = racks["chat-decode-nordics"]                    # same count at every chat site
replicas = chat_racks * 256 // n                             # racks x 256 LPUs per rack
show("Nordics chat decode capacity", replicas * replica_tps, pools["chat-decode-nordics"]["cap"])
show("one LEO plane chat capacity (95% chips)", replicas * replica_tps * 0.95, pools["chat-decode-leo_p1"]["cap"])
total_chat = 6 * replicas * replica_tps + 8 * replicas * replica_tps * 0.95
after_loss = total_chat - replicas * replica_tps             # lose one Earth site
show("chat capacity left after losing an Earth site / demand", after_loss / chat_peak_out,
     sum(p["cap"] for p in r["pools"] if p["stream"] == "chat" and p["phase"] == "decode" and p["site"] != "nordics")
     / r["demand_out_tps"]["chat"], "x")

# ---------------------------------------------------------------- 4. chat first-token time, worst pair
pre = pools["chat-prefill-gulf"]                             # farthest prefill site from users
air_n = pre["chips_per_replica"]
t_prefill = 8000 * (2 * qwen_active + 16 * qwen_kv * 60_000) / (air_n * air_flops * flops_eff) \
    + 56_000 * qwen_kv / (air_n * air_bw * bw_eff)
pre_cap = sum(p["cap"] for p in r["pools"] if p["stream"] == "chat" and p["phase"] == "prefill")
rho = chat_peak_in / pre_cap
queue = rho / (2 * (1 - rho)) * t_prefill                    # M/D/1 wait
one_way = {"gulf": 0.055, "nordics": 0.035}                  # DECK s12 round trips / 2
link = one_way["gulf"] + one_way["nordics"] + 8000 * qwen_kv / 50e9
ttft = one_way["gulf"] + one_way["nordics"] + queue + t_prefill + link + step / 2 + step
show("chat first token, worst case (<= 0.6 s)", ttft, pools["chat-decode-nordics"]["ttft_s"], "s")

# ---------------------------------------------------------------- 5. Nordics chat pool, 5-year bill
it_mw = chat_racks * 516 / 1000                              # DECK s12: 516 kW per LPU rack
rho_d = chat_peak_out / total_chat
load = 0.3 + 0.7 * rho_d / margin / peak_chat                # ASSUMED 30% idle draw; billed at real demand
mwh = it_mw * load * 1.07 * 5 * 8760                         # DECK s14: PUE 1.07, cold site
show("Nordics chat pool: building", it_mw * 8e6, pools["chat-decode-nordics"]["cost"]["facility"], "$")
show("Nordics chat pool: electricity", mwh * 25, pools["chat-decode-nordics"]["cost"]["energy"], "$")
show("Nordics chat pool: carbon", mwh * 25 / 1000 * 100, pools["chat-decode-nordics"]["cost"]["carbon"], "$")
show("LEO chat pool: launch", it_mw * 18_000 * 200, pools["chat-decode-leo_p1"]["cost"]["launch"], "$")

# ---------------------------------------------------------------- 6. night shift
int_out = (users["B"] * int_tasks["B"] + users["C"] * int_tasks["C"]) * (1 - sub_share) * steps * agent_out / 86400 * peak_int * margin
bg_out = (users["B"] * bg_tasks["B"] + users["C"] * bg_tasks["C"]) * (1 - sub_share) * steps * agent_out / 86400 * margin
spare = int_out - int_out / peak_int                         # interactive peak minus its average
show("background work left for its own racks", bg_out - min(bg_out, spare), r["demand_out_tps"]["agent_bg"])
int_cap = sum(p["cap"] for p in r["pools"] if p["stream"] == "agent_int" and p["phase"] == "decode")
biggest = max(p["cap"] for p in r["pools"] if p["stream"] == "agent_int" and p["phase"] == "decode")
left_spare = int_cap - biggest - int_out / peak_int
show("after an outage: spare / night-shift work (>= 1, hand only)", left_spare / min(bg_out, spare), None, "x")

# ---------------------------------------------------------------- 7. the total
show("total = sum of every pool's bill (consistency)", sum(p["cost_usd"] for p in r["pools"]), r["cost_usd"], "$")

print(f"\nHand check of Design 1 ({len(rows)} quantities): by hand vs scorer")
print(f"  {'quantity':<55} {'by hand':>16} {'scorer':>16}  diff")
bad = 0
for what, a, b, unit, d in rows:
    fmt = (lambda x: f"{x:,.3f}") if abs(a) < 100 else (lambda x: f"{x:,.0f}")
    if b is None:
        flag = "ok" if a >= 1 else "FAIL"
        bad += flag == "FAIL"
        print(f"  {what:<55} {fmt(a):>16} {'-':>16}      - {flag}")
        continue
    flag = "ok" if d < 0.005 else ("~" if d < 0.02 else "MISMATCH")
    bad += flag == "MISMATCH"
    print(f"  {what:<55} {fmt(a):>16} {fmt(b):>16}  {d:6.2%} {flag}")
print(f"  -> {len(rows) - bad} of {len(rows)} ok")
