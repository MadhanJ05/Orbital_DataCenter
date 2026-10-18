"""Track 1 catalog: every constant the scorer uses, in one place.

DECK sN  = taken from the organizers' Track 1 slides (slide N).
ASSUMED  = not in the deck; our estimate. Change it here and every score follows.
CALIB    = assumed, but tuned so the twin reproduces a number printed in the deck.

Units: bytes, seconds, watts, US dollars, unless the name says otherwise.
"""

# ---------------------------------------------------------------- challenge
YEARS = 5                          # DECK s9: 5-year budget
HOURS = YEARS * 8760
BUDGET_USD = 30e9                  # DECK s9
EARTH_GRID_CAP_MW = 500            # DECK s9: all Earth sites together
CARBON_USD_PER_T = 100             # DECK s14
EVAP_WATER_L_PER_KWH = 1.8         # DECK s14
WATER_USD_PER_M3 = 2.0             # ASSUMED

# ---------------------------------------------------------------- models
# DECK s10. Weights FP4, KV cache FP8 (DECK s16). kv = bytes per context token,
# state = fixed per-session state of the hybrid layers.
BYTES_PER_WEIGHT = 0.5
MODELS = {
    "kimi-k3":      dict(total=2.8e12, active=104e9, kv=14e3, state=217e6, max_ctx=1_000_000),
    "qwen3.5-397b": dict(total=397e9,  active=17e9,  kv=15e3, state=94e6,  max_ctx=262_000),
    "qwen3.5-122b": dict(total=122e9,  active=10e9,  kv=12e3, state=75e6,  max_ctx=262_000),
    "gpt-oss-120b": dict(total=117e9,  active=5.1e9, kv=18e3, state=2e6,   max_ctx=131_000),
}

# ---------------------------------------------------------------- workloads
# DECK s10. ctx = tokens read per request, cached = of those already in cache,
# out = tokens written, steps = requests per task, tool_s = wait between steps.
# rtt_per_step: interactive work pays a user round trip every step; background
# agents run their sandbox next to the model and pay one round trip per task.
# peak = peak-hour multiplier on the daily average (DECK s16; the s11 per-user
# peaks only reproduce with these factors).
_CHAT = dict(ctx=64_000, cached=56_000, out=3_500, steps=1, tool_s=0.0,
             ttft=0.6, rate=60, rtt_per_step=True, task_deadline=None, peak=2.0)
_AGENT_INT = dict(ctx=256_000, cached=250_000, out=500, steps=80, tool_s=8.0,
                  ttft=2.0, rate=100, rtt_per_step=True, task_deadline=25 * 60, peak=2.5)
_AGENT_BG = dict(_AGENT_INT, ttft=10.0, rate=30, rtt_per_step=False,
                 task_deadline=4 * 3600, peak=1.0)   # tool_s=8 for the sandbox is ASSUMED
# Sub-agents: Qwen3.5-122B on 32k contexts (DECK s10). The 6k uncached share
# matches the main agent's and is ASSUMED.
_SUB = dict(ctx=32_000, cached=26_000)

STREAMS = {
    "chat":          dict(_CHAT, model="qwen3.5-397b"),
    "chat_easy":     dict(_CHAT, model="gpt-oss-120b"),   # routed easy prompts
    "agent_int":     dict(_AGENT_INT, model="kimi-k3"),
    "agent_int_sub": dict(_AGENT_INT, **_SUB, model="qwen3.5-122b"),
    "agent_bg":      dict(_AGENT_BG, model="kimi-k3"),
    "agent_bg_sub":  dict(_AGENT_BG, **_SUB, model="qwen3.5-122b"),
}
MAX_EASY_CHAT_SHARE = 0.5          # DECK s10: route easy chat to gpt-oss-120b, up to 50%
MAX_SUBAGENT_SHARE = 0.5           # DECK s10: sub-agents do up to half of the steps

# DECK s11. Per user per day: chat prompts, interactive agent tasks, background tasks.
CASES = {
    "A": dict(label="Prompters",         users=4e9,   chat=30, agent_int=0,  agent_bg=0),
    "B": dict(label="Agent developers",  users=50e6,  chat=0,  agent_int=12, agent_bg=30),
    "C": dict(label="Knowledge workers", users=400e6, chat=20, agent_int=1,  agent_bg=4),
}

# ---------------------------------------------------------------- chips
# Racks: DECK s12. GPU memory and bandwidth: DECK s13. LPU: DECK s13.
# phases = what the deck lets each chip do (DECK s9: prefill GPU or air card,
# decode GPU or LPU).
CHIPS = {
    "gpu": dict(mem=3e12,   bw=120e12, flops=250e15, rack_chips=144, rack_kw=792, rack_usd=23.8e6,
                phases=("prefill", "decode")),
    "lpu": dict(mem=160e9,  bw=200e12, flops=50e15,  rack_chips=256, rack_kw=516, rack_usd=14.3e6,
                phases=("decode",)),
    "air": dict(mem=96e9,   bw=4e12,   flops=30e15,  rack_chips=32,  rack_kw=37,  rack_usd=0.5e6,
                phases=("prefill",)),
}
# flops (FP4 peak) for all three, and mem/bw for the air card: ASSUMED.
BW_EFFICIENCY = 0.6                # DECK s13: a 120 TB/s GPU reads ~72 TB/s
FLOPS_EFFICIENCY = 0.5             # ASSUMED
STEP_SYNC_S = 1.7e-3               # DECK s17: per decode step, one-chip replica
SYNC_PER_DOUBLING_S = 0.25e-3      # ASSUMED: extra sync each time chips per replica doubles
WEIGHT_READ_FACTOR = 2.5           # CALIB: weight bytes read per step = 2.5 x active
                                   # weights (MoE experts spread across a batch). Puts
                                   # one GPU at ~950 chat / ~118 agent sessions vs
                                   # DECK s13's 960 / 117.
ATTN_FLOPS_PER_KV_BYTE = 16        # ASSUMED: 2 FLOPs x 8 query heads per KV head

# Speculative decoding: draft k tokens, each accepted with probability ACCEPT.
SPEC_ACCEPT = 0.7                  # ASSUMED (2035 multi-token-prediction heads)
SPEC_DRAFT_OVERHEAD_S = 0.05e-3    # ASSUMED: per draft token per step
SPEC_MAX_DRAFT = 8

# Context-memory tier: holds agent KV caches while they wait for tools.
CONTEXT_MEM_USD_PER_GB = 3.0       # ASSUMED (pooled CXL DRAM, 2035)
CONTEXT_MEM_W_PER_GB = 0.25        # ASSUMED

IDLE_POWER_FRACTION = 0.3          # ASSUMED: an idle rack still draws 30% of nameplate
KV_LINK_BYTES_S = 50e9             # ASSUMED: 400 Gb/s per replica between sites

# ---------------------------------------------------------------- cooling
# PUE: DECK s14 (cold / desert); "temperate" sites use the midpoint (ASSUMED).
# max_rack_kw: DECK s14. capex per MW of IT: ASSUMED.
COOLING = {
    "air_chillers":  dict(pue={"cold": 1.16, "desert": 1.54}, max_rack_kw=50,   capex_per_mw=1.0e6, water=False),
    "air_evap":      dict(pue={"cold": 1.10, "desert": 1.26}, max_rack_kw=50,   capex_per_mw=0.8e6, water=True),
    "direct_liquid": dict(pue={"cold": 1.07, "desert": 1.14}, max_rack_kw=1500, capex_per_mw=1.0e6, water=False),
    "immersion":     dict(pue={"cold": 1.06, "desert": 1.10}, max_rack_kw=2000, capex_per_mw=1.5e6, water=False),
    "radiators":     dict(pue=None, max_rack_kw=10_000, capex_per_mw=0.0, water=False),  # space only
}
FACILITY_USD_PER_MW = 7.0e6        # ASSUMED: Earth building + electrical, per MW of IT

# ---------------------------------------------------------------- sites
# rtt: round trip to users, DECK s12. Everything else: ASSUMED 2035 values,
# with Nordics and West Texas CALIB so orbit breaks even with them at the
# deck's ~$95/kg and ~$170/kg (DECK s14).
SITES = {
    "n_virginia": dict(kind="earth", rtt=0.025, climate="temperate", usd_per_mwh=70, g_co2_kwh=320, cap_mw=100),
    "midwest":    dict(kind="earth", rtt=0.035, climate="temperate", usd_per_mwh=55, g_co2_kwh=420, cap_mw=150),
    "west_texas": dict(kind="earth", rtt=0.045, climate="desert",    usd_per_mwh=30, g_co2_kwh=230, cap_mw=300),
    "nordics":    dict(kind="earth", rtt=0.070, climate="cold",      usd_per_mwh=25, g_co2_kwh=25,  cap_mw=150),
    "iceland":    dict(kind="earth", rtt=0.080, climate="cold",      usd_per_mwh=28, g_co2_kwh=10,  cap_mw=100),
    "gulf":       dict(kind="earth", rtt=0.110, climate="desert",    usd_per_mwh=32, g_co2_kwh=400, cap_mw=300),
    "leo":        dict(kind="space", rtt=0.040,  launch_usd_per_kg=200),        # DECK s9
    "moon":       dict(kind="space", rtt=2.6,    launch_usd_per_kg=200 * 6),    # DECK s14: 6x
    "mars":       dict(kind="space", rtt=25 * 60, launch_usd_per_kg=200 * 15),  # DECK s12/s14: 15x
}

# ---------------------------------------------------------------- space
SPACE_KG_PER_MW = 18_000           # DECK s14: compute 5 t, solar 5, radiators 4, structure 4
SPACE_MASS_SPLIT_T = dict(compute=5, solar=5, radiators=4, structure=4)
SPACE_CHIP_SURVIVAL = 0.95         # DECK s14: no repairs, 95% of chips keep working
SPACE_HW_USD_PER_MW = 6.0e6        # CALIB: solar + radiators + bus hardware, per MW
RADIATOR = dict(emissivity=0.9, temp_k=330, sink_k=220, sides=2)  # DECK s14 -> 972 W/m^2
STEFAN_BOLTZMANN = 5.67e-8
