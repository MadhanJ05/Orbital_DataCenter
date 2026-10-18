"""
Napkin model for the 2035 AI data-center challenge: Earth vs orbit.
Every number comes from the challenge slides unless tagged ASSUMED.
Run:  python model.py
"""
from dataclasses import dataclass
import math

# ---------------- catalog from the slides ----------------
MODELS = {  # total params, active params, KV bytes per token, per-user state bytes
    'kimi-k3':      dict(total=2.8e12, active=104e9, kv=14e3, state=217e6),
    'qwen3.5-397b': dict(total=397e9,  active=17e9,  kv=15e3, state=94e6),
    'qwen3.5-122b': dict(total=122e9,  active=10e9,  kv=12e3, state=75e6),
    'gpt-oss-120b': dict(total=117e9,  active=5.1e9, kv=18e3, state=2e6),
}
GPU = dict(mem=3e12, bw=120e12, per_rack=144, rack_kw=792, rack_usd=23.8e6,
           flops=150e15,  # ASSUMED dense FP4 FLOP/s per 2035 GPU: ~15x B200, same ratio as its memory/bandwidth
           replica=8,     # ASSUMED chips sharing one copy of the weights
           rack_kg=3000)  # ASSUMED launch mass of a bare rack
BW_EFF = 0.6            # slide: 72 TB/s usable out of 120
MFU = 0.5               # ASSUMED prefill utilisation
BYTES_PER_PARAM = 0.5   # ASSUMED 4-bit weights
MEM_HEADROOM = 0.9

# workloads: context, uncached (new) tokens per step, output, steps per task, tok/s, TTFT, peak factor
# peak factors calibrated so the slides' per-user peaks come out (A: 2.4/5.6, B: 28/333)
WORKLOADS = {
    'chat':    dict(model='qwen3.5-397b', ctx=64e3,  new=8e3, out=3500, steps=1,  tps=60,  ttft=0.6, peak=2.0, tool_wait=0.0),
    'agent_i': dict(model='kimi-k3',      ctx=256e3, new=6e3, out=500,  steps=80, tps=100, ttft=2.0, peak=2.0, tool_wait=25*60/80 - 5),
    'agent_b': dict(model='kimi-k3',      ctx=256e3, new=6e3, out=500,  steps=80, tps=30,  ttft=10,  peak=1.2, tool_wait=10.0),  # tool wait ASSUMED
}
CASES = {
    'A prompters':         dict(users=4e9,   chat=30),
    'B agent devs':        dict(users=50e6,  agent_i=12, agent_b=30),
    'C knowledge workers': dict(users=400e6, chat=20, agent_i=1, agent_b=4),
}
LATENCY_ORDER = ['agent_i', 'chat', 'agent_b']   # what we keep on Earth first

# ---------------- sites ----------------
EARTH = dict(pue=1.15, pue_assumed=1.15, capex_per_mw=10e6, usd_mwh=50, cap_mw=500,  # pue: first-pass ASSUMED 1.15; replaced below by the DERIVED value for the complete rows
             ops_frac=0.01)                                        # ASSUMED staff, maintenance, network: 1%/yr of hardware + building capex
LEO = dict(pue=1.05, pue_assumed=1.05, launch_usd_kg=200, sun=0.99,  # pue: first-pass ASSUMED 1.05, replaced below by the DERIVED value; sun: first-pass guess, replaced by orbit geometry
           solar_w_kg=300, solar_usd_w=10,              # ASSUMED 2035 thin-film arrays, mass-produced
           rad_w_m2=1000, rad_kg_m2=5, rad_usd_m2=1000, # ASSUMED two-sided radiator at ~70 C
           bus_factor=1.5, bus_usd=2e6,                 # ASSUMED structure/power electronics/avionics (comms now separate, below)
           spare=0.2,                                   # ASSUMED extra chips for radiation + no repair
           # ---- added after the design review; everything below is ASSUMED, one-line rationale each ----
           sandbox_racks=1.0,                           # CPU/storage racks per GPU rack: ~170k concurrent background tasks per GPU rack, each a mostly idle microVM; one rack of ~16k cores + 1 PB NVMe hosts them at ~10 per core
           sandbox_kw=100, sandbox_kg=1500, sandbox_usd=2e6,  # one 2035 CPU/NVMe rack as a sealed conduction-cooled box: 100 kW, 1.5 t, $2M
           shield_kg=600, shield_usd_kg=100,            # 5 mm Al-equivalent (13.5 kg/m2) over ~40 m2 of HBM stacks and power electronics only, not the whole rack; machined Al/polyethylene laminate
           batt_kwh=30, batt_kg_kwh=4, batt_usd_kwh=300,  # housekeeping only: 20 kW of avionics, loop pumps and sandbox state through a 35 min eclipse (250 Wh/kg, $300/kWh); the GPUs pause instead
           eclipse_throttle=0.99,                       # capacity factor: interruptible background work is paused in eclipse (~1% of the year at 550-600 km dawn-dusk) rather than carried on a GPU-sized battery
           prop_kg=350, prop_usd=1e6,                   # electric propulsion share per rack: ~200 m/s over 5 yr (drag make-up + end-of-life perigee lowering for the 5-year rule) at Isp 2000 s is ~1% propellant on 18 t, plus thruster/tank/PPU
           comms_kg=150, comms_usd=1.5e6,               # two laser inter-satellite terminals (ring) plus a share of a relay/gateway terminal: ~50 kg and ~$0.5M each at 2035 volume
           rad_earth_derate=0.14,                       # Earth IR + albedo cut the Earth-facing face of each two-sided radiator by 14%; averaged over both faces that is 7% more panel area
           # ---- second review pass: masses the 1.5x structure factor was silently carrying, and the costs orbit had none of ----
           sandbox_slots=170e3,                         # concurrent microVM sandboxes one sandbox rack hosts (~16k cores at ~10 mostly idle VMs per core); sets the sandbox energy per task
           pcdu_kg_kw=1.5,                              # power conditioning, HV distribution and harness: 1.5 kg per kW electrical (cost sits in the bus line)
           loop_kg=750,                                 # pumps, two-phase fluid, cold plates, piping and a redundant second loop per rack; radiator kg/m2 covers panels only
           acs_kg=50,                                   # share of control moment gyros, star trackers and momentum dumping: ~400 kg per 8-rack node
           solar_eol=0.85,                              # thin-film arrays sized for end of life: 15% degradation over 5 yr in LEO, so 1/0.85 more array
           ops_frac=0.025,                              # mission ops, conjunction screening, gateway stations, spectrum: 2.5%/yr of hardware capex (launch excluded)
           nre_usd=1.5e9, nre_racks=270,                # spacecraft non-recurring engineering amortised over the fleet that puts all of case B's background work in orbit
           # ---- all-in-space design: interactive steps cannot be paused, so their racks carry a full-load eclipse battery instead of the throttle ----
           batt_full_min=35)                            # first-pass guess; replaced below by the DERIVED longest eclipse + 20% margin

# ---------------- orbit geometry: eclipse seasons of the dawn-dusk SSO (DERIVED, replaces the 'sun=0.99' and '35 min' guesses) ----------------
ORBIT = dict(alt_km=575, inc_deg=97.6, ltan_h=6.0, r_earth_km=6371.0, mu=3.986e14)   # middle of the 550-600 km band; SSO inclination at that height; 06:00 LTAN

def beta_deg(day):
    """Sun-orbit beta angle on day-of-year for a 06:00 LTAN SSO: the orbit normal sits 90 deg from the sun's right ascension,
    so beta = asin(sin(i + delta)) with delta the solar declination."""
    delta = 23.44 * math.sin(2 * math.pi * (day - 81) / 365.25)
    x = ORBIT['inc_deg'] + delta
    return 180 - x if x > 90 else x

def eclipse_fraction(beta):
    """Fraction of one orbit inside Earth's (cylindrical) shadow at beta angle `beta`."""
    R, h = ORBIT['r_earth_km'], ORBIT['alt_km']
    c = math.cos(math.radians(beta))
    if c <= 0: return 0.0
    x = math.sqrt(h * h + 2 * R * h) / ((R + h) * c)
    return 0.0 if x >= 1 else math.acos(x) / math.pi

def eclipse_year():
    per_day = [eclipse_fraction(beta_deg(d)) for d in range(365)]
    period_min = 2 * math.pi * math.sqrt(((ORBIT['r_earth_km'] + ORBIT['alt_km']) * 1e3) ** 3 / ORBIT['mu']) / 60
    return dict(frac=sum(per_day) / 365, max_frac=max(per_day), max_min=max(per_day) * period_min, days=sum(1 for f in per_day if f > 0),
                period_min=period_min, per_day=per_day, beta_min=min(beta_deg(d) for d in range(365)))

ECL = eclipse_year()
# DERIVED: background racks that stop in eclipse must still clear each day's work on the worst eclipse day, so the usable
# capacity factor is (1 - longest eclipse fraction) x the 1.2 peak-to-mean headroom, capped at 1. (A yearly average,
# 1 - 4.6%, would let the backlog grow for weeks in the season; the year simulation below checks this.)
LEO['eclipse_throttle'] = round(min(1.0, (1 - ECL['max_frac']) * WORKLOADS['agent_b']['peak']), 4)
LEO['batt_full_min'] = math.ceil(ECL['max_min'] * 1.2)      # DERIVED: longest eclipse of the year + 20% margin

# ---------------- PUE from components (DERIVED; the component values are ASSUMED) ----------------
PUE_LEO = dict(mppt=0.985, harness=0.99, pdu=0.98,            # array regulator -> HV harness -> rack-level converter, 2035 SiC/GaN
               loop_dp_kpa=200, fluid_hfg_kj_kg=1050, fluid_rho=600, pump_eff=0.4,   # ammonia two-phase loop: 200 kPa over the 280 m loop, latent heat carries the load
               housekeeping_kw=2.0,                            # avionics, CMGs, three laser terminals, star trackers: per-rack share of the node
               batt_rt=0.92)                                   # battery round-trip efficiency, counted only for the eclipse fraction on battery racks
PUE_EARTH = dict(ups=0.96, pdu=0.985, cooling_frac=0.08, misc_frac=0.01)   # double-conversion UPS, PDUs; CDU pumps + dry coolers for direct liquid; lighting, security

def leo_pue(battery=False, leo=LEO):
    """PUE of one orbital rack = 1 + (conversion + pump + housekeeping + battery) / IT. Returns (pue, parts as fractions of IT)."""
    c = PUE_LEO
    it_kw = GPU['rack_kw'] + leo['sandbox_racks'] * leo['sandbox_kw']
    conv = 1 / (c['mppt'] * c['harness'] * c['pdu']) - 1
    mdot = it_kw * (1 + conv) / c['fluid_hfg_kj_kg']                       # kg/s of ammonia to carry the heat as latent heat
    pump_kw = mdot * c['loop_dp_kpa'] / c['fluid_rho'] / c['pump_eff']
    parts = dict(conversion=conv, pumps=pump_kw / it_kw, housekeeping=c['housekeeping_kw'] / it_kw,
                 battery=ECL['frac'] * (1 / c['batt_rt'] - 1) if battery else 0.0)
    return 1 + sum(parts.values()), parts

def earth_pue():
    c = PUE_EARTH
    parts = dict(conversion=1 / (c['ups'] * c['pdu']) - 1, cooling=c['cooling_frac'], misc=c['misc_frac'])
    return 1 + sum(parts.values()), parts

LEO['pue'] = round(leo_pue()[0], 4)      # DERIVED (complete rows); bare rows keep pue_assumed
EARTH['pue'] = round(earth_pue()[0], 4)  # DERIVED (complete rows); bare rows keep pue_assumed

@dataclass
class Levers:
    spec: float = 1.0        # accepted tokens per decode step (speculative decoding)
    multi_agent: float = 0.0 # fraction of agent steps done by Qwen3.5-122B on 32k context
    route: float = 0.0       # fraction of chat routed to gpt-oss-120b
    ctx_mem: bool = False    # KV parked in context memory while a user waits on tools
    tps_b: float = None      # background decode rate to serve at (None = the slides' 30 tok/s); a design variable, see tps_balance()
    snapshot: bool = False   # snapshot idle sandboxes between tool calls: a slot is resident only while its tool runs

NAIVE = Levers()
ALL = Levers(spec=2.5, multi_agent=0.5, route=0.5, ctx_mem=True)

# ---------------- per-chip throughput ----------------
def decode_users_per_gpu(w, lv):
    m = MODELS[w['model']]
    kv_user = w['ctx'] * m['kv'] + m['state']
    w_share = m['total'] * BYTES_PER_PARAM / GPU['replica']
    step = lv.spec / w['tps']                       # seconds per decode step
    bw_users = (GPU['bw'] * BW_EFF * step - w_share) / kv_user
    dec_time = w['out'] / w['tps']
    duty = 1.0 if (lv.ctx_mem or w['tool_wait'] == 0) else dec_time / (dec_time + w['tool_wait'])
    mem_users = (GPU['mem'] * MEM_HEADROOM - w_share) / kv_user * duty
    return max(0.0, min(bw_users, mem_users)), kv_user

def prefill_tps_per_gpu(w):
    m = MODELS[w['model']]
    return GPU['flops'] * MFU / (2 * m['active'])

def tps_balance(lv, w):
    """Decode rate at which the bandwidth-bound and memory-bound user counts meet. Below it the GPU is memory-bound and
    every token served slower than this wastes GPU-seconds; above it bandwidth caps the users. Same for every model
    to first order: BW_eff x spec / (0.9 x HBM)."""
    m = MODELS[w['model']]
    kv_user = w['ctx'] * m['kv'] + m['state']
    w_share = m['total'] * BYTES_PER_PARAM / GPU['replica']
    mem_users = (GPU['mem'] * MEM_HEADROOM - w_share) / kv_user
    return GPU['bw'] * BW_EFF * lv.spec / (mem_users * kv_user + w_share)

def sandbox_active_frac(w):
    """Share of a task's wall time during which its sandbox is actually running a tool."""
    return w['tool_wait'] / (w['tool_wait'] + w['out'] / w['tps']) if w['tool_wait'] else 0.0

# ---------------- demand -> chips ----------------
def variants(name, lv):
    """Split a workload into (variant workload, share of steps) after levers."""
    w = WORKLOADS[name]
    if name == 'agent_b' and lv.tps_b:
        w = dict(w, tps=lv.tps_b)
    if name == 'chat' and lv.route > 0:
        return [(w, 1 - lv.route), (dict(w, model='gpt-oss-120b'), lv.route)]
    if name.startswith('agent') and lv.multi_agent > 0:
        sub = dict(w, model='qwen3.5-122b', ctx=32e3)
        return [(w, 1 - lv.multi_agent), (sub, lv.multi_agent)]
    return [(w, 1.0)]

def size(case, lv):
    """Return per-workload dict: peak out/in tok/s, decode gpus, prefill gpus."""
    users = case['users']
    out = {}
    for name in LATENCY_ORDER:
        if name not in case:
            continue
        per_day = case[name]
        w = WORKLOADS[name]
        peak_out = users * per_day * w['steps'] * w['out'] / 86400 * w['peak']
        peak_in = users * per_day * w['steps'] * w['new'] / 86400 * w['peak']
        dec = pre = 0.0
        for v, share in variants(name, lv):
            u, _ = decode_users_per_gpu(v, lv)
            dec += peak_out * share / (u * v['tps'])
            pre += peak_in * share / prefill_tps_per_gpu(v)
        out[name] = dict(peak_out=peak_out, peak_in=peak_in, dec_gpus=dec, pre_gpus=pre, gpus=dec + pre)
    return out

# ---------------- cost per rack, 5 years ----------------
def earth_rack_cost(earth=EARTH, complete=True):
    """One GPU rack on Earth for 5 years: (total $, $ parts). complete=False is the bare first pass (chips, building, energy).
    complete=True adds the same tool-sandbox rack the orbital rack carries (background agents need it on either site) and ops."""
    it_kw = GPU['rack_kw'] + (LEO['sandbox_racks'] * LEO['sandbox_kw'] if complete else 0)
    kw = it_kw * (earth['pue'] if complete else earth['pue_assumed'])
    parts = dict(chips=GPU['rack_usd'], building=kw / 1000 * earth['capex_per_mw'], energy=kw / 1000 * 8760 * 5 * earth['usd_mwh'])
    if complete:
        parts['sandbox'] = LEO['sandbox_racks'] * LEO['sandbox_usd']
        parts['ops'] = (parts['chips'] + parts['sandbox'] + parts['building']) * earth['ops_frac'] * 5
    return sum(parts.values()), parts

def leo_rack_cost(leo=LEO, complete=True, eclipse='throttle'):
    """One GPU rack in orbit for 5 years: (total $, $ parts, launch mass kg, detail).
    complete=False reproduces the bare first-pass rack (chips, solar, radiator, bus, launch only).
    complete=True adds what the design review found missing: the tool sandbox that must fly with the GPUs,
    shielding, a housekeeping battery with an eclipse throttle instead of a GPU battery, deorbit propulsion,
    laser/relay comms, and the Earth-IR derate on one radiator face.
    eclipse='throttle' pauses the (interruptible) workload in eclipse; 'battery' carries the whole rack through the
    longest eclipse on a full-load battery, for latency-sensitive work that cannot be paused."""
    it_w = GPU['rack_kw'] * 1000
    if complete:
        it_w += leo['sandbox_racks'] * leo['sandbox_kw'] * 1000
        elec_w = it_w * leo['pue']                                   # derived PUE; eclipse is handled by the throttle, so no array oversizing
        array_w = elec_w / leo['solar_eol']                          # ...but the array is sized for end of life
        rad_w_m2 = leo['rad_w_m2'] * (1 - leo['rad_earth_derate'] / 2)
        throttle = 1.0 if eclipse == 'battery' else leo['eclipse_throttle']
        batt_kwh = leo['batt_kwh'] + (elec_w / 1000 * leo['batt_full_min'] / 60 if eclipse == 'battery' else 0)
    else:
        elec_w = it_w * leo['pue_assumed'] / leo['sun']
        array_w = elec_w
        rad_w_m2 = leo['rad_w_m2']
        throttle = 1.0
    rad_m2 = elec_w / rad_w_m2
    kg = dict(rack=GPU['rack_kg'], solar=array_w / leo['solar_w_kg'], radiator=rad_m2 * leo['rad_kg_m2'])
    parts = dict(chips=GPU['rack_usd'] * (1 + leo['spare']), solar=array_w * leo['solar_usd_w'],
                 radiator=rad_m2 * leo['rad_usd_m2'], bus=leo['bus_usd'])
    if complete:
        kg.update(sandbox=leo['sandbox_racks'] * leo['sandbox_kg'], shield=leo['shield_kg'],
                  battery=batt_kwh * leo['batt_kg_kwh'], propulsion=leo['prop_kg'], comms=leo['comms_kg'],
                  pcdu=elec_w / 1000 * leo['pcdu_kg_kw'], loop=leo['loop_kg'], acs=leo['acs_kg'])
        parts.update(sandbox=leo['sandbox_racks'] * leo['sandbox_usd'], shield=leo['shield_kg'] * leo['shield_usd_kg'],
                     battery=batt_kwh * leo['batt_usd_kwh'], propulsion=leo['prop_usd'], comms=leo['comms_usd'])
    mass = sum(kg.values()) * leo['bus_factor']
    if complete:
        parts['ops'] = sum(parts.values()) * leo['ops_frac'] * 5      # hardware capex so far, launch excluded
        parts['nre'] = leo['nre_usd'] / leo['nre_racks']
    parts['launch'] = mass * leo['launch_usd_kg']
    total = sum(parts.values())
    detail = dict(kg=kg, elec_w=elec_w, array_w=array_w, rad_m2=rad_m2, throttle=throttle, per_delivered=total / throttle,
                  batt_kwh=batt_kwh if complete else 0.0)
    return total, parts, mass, detail

# ---------------- digital-twin metrics: joules per task and PUE ----------------
def energy_per_task(name, lv, complete=True):
    """GPU-seconds and kJ for one task of workload `name` after levers `lv`, on Earth and in LEO.
    IT energy = GPU time (decode shared by u users per GPU, plus prefill) x per-GPU power, plus the sandbox slot's
    share of its rack for the task's wall time (agents only). Site energy = IT energy x that site's PUE."""
    w = variants(name, lv)[0][0]                        # the main variant carries any tps override
    gpu_kw = GPU['rack_kw'] / GPU['per_rack']
    gpu_s = 0.0
    for v, share in variants(name, lv):
        u, _ = decode_users_per_gpu(v, lv)
        gpu_s += share * (w['steps'] * v['out'] / v['tps'] / u + w['steps'] * v['new'] / prefill_tps_per_gpu(v))
    it_kj = gpu_kw * gpu_s
    wall_s = w['steps'] * (w['out'] / w['tps'] + w['tool_wait'])
    resident = sandbox_active_frac(w) if lv.snapshot else 1.0
    sandbox_kj = LEO['sandbox_kw'] / LEO['sandbox_slots'] * wall_s * resident if (complete and name.startswith('agent')) else 0.0
    it_kj += sandbox_kj
    pue_e, pue_l = (EARTH['pue'], LEO['pue']) if complete else (EARTH['pue_assumed'], LEO['pue_assumed'])
    return dict(gpu_s=gpu_s, sandbox_kj=sandbox_kj, it_kj=it_kj, earth_kj=it_kj * pue_e, leo_kj=it_kj * pue_l, wall_s=wall_s)

def optimise(lv=ALL):
    """Joules-per-task sweep over the design variables the slides leave open: background decode rate (up to 4x the slides'
    30 tok/s; interactive stays at 100 tok/s for latency), sandbox snapshotting, speculative depth up to the slides' 2.5,
    sub-agent share up to the slides' 50%. Returns (best Levers, rows of [label, levers, kJ background, kJ interactive])."""
    wb = WORKLOADS['agent_b']
    rows = [('slides levers', lv)]
    best = lv
    for tps in [wb['tps'] * k for k in (1.5, 2.0, 2.5, 3.0, 4.0)]:
        rows.append((f'background at {tps:.0f} tok/s', Levers(**dict(lv.__dict__, tps_b=tps))))
    tb = tps_balance(lv, wb)
    rows.append((f'background at balance {tb:.0f} tok/s', Levers(**dict(lv.__dict__, tps_b=tb))))
    rows.append(('+ snapshot idle sandboxes', Levers(**dict(lv.__dict__, tps_b=tb, snapshot=True))))
    for label, l in rows:
        kb, ki = energy_per_task('agent_b', l)['leo_kj'], energy_per_task('agent_i', l)['leo_kj']
        if kb + ki < energy_per_task('agent_b', best)['leo_kj'] + energy_per_task('agent_i', best)['leo_kj']: best = l
    return best, rows

OPT = optimise(ALL)[0]

# ---------------- one year in orbit: the time-domain twin ----------------
def simulate_year(lv=OPT, margin=1.0, pooled=False, step_min=10, idle_gpu=0.3, idle_sandbox=0.5, peak_hour=14):
    """All-space case B through one year at `step_min` resolution, in GPU-seconds. Eclipse per orbit from the geometry above;
    demand follows a diurnal cosine with the slides' peak factors (mean 1, max = peak). Interactive racks ride eclipses on
    battery. Background racks are dark in eclipse and their work (interruptible) queues up and drains afterwards.
    Interactive racks are sized for peak; background racks for peak x `margin`. pooled=True lets queued background work
    run on idle interactive capacity (nights, and through eclipses since those racks have batteries).
    Idle racks draw idle_gpu / idle_sandbox of full power (ASSUMED). Returns fleet energy, fleet-level kJ per task with idle
    time included, utilisation and the worst background backlog in hours of mean demand."""
    caseB = CASES['B agent devs']
    sz = size(caseB, lv)
    racks = {'agent_i': sz['agent_i']['gpus'] / GPU['per_rack'], 'agent_b': sz['agent_b']['gpus'] / GPU['per_rack'] * margin}
    peak = {n: WORKLOADS[n]['peak'] for n in racks}
    gs = {n: energy_per_task(n, lv)['gpu_s'] for n in racks}                 # GPU-seconds per task
    it_kw = GPU['rack_kw'] + LEO['sandbox_racks'] * LEO['sandbox_kw']
    idle_kw = GPU['rack_kw'] * idle_gpu + LEO['sandbox_racks'] * LEO['sandbox_kw'] * idle_sandbox
    pue = {'agent_i': leo_pue(battery=True)[0], 'agent_b': leo_pue()[0]}
    dt_h = step_min / 60; dt_s = step_min * 60
    steps = int(365 * 24 / dt_h)
    tasks_day = {n: caseB['users'] * caseB[n] for n in racks}
    cap_gs = {n: racks[n] * GPU['per_rack'] * dt_s for n in racks}          # GPU-seconds available per step at full power
    energy_kwh = {n: 0.0 for n in racks}; done_tasks = {n: 0.0 for n in racks}
    queue = 0.0; max_queue = 0.0; batt_kwh_rack = 0.0; spill_gs = 0.0; gs_on_b = 0.0; gs_on_i = 0.0
    for k in range(steps):
        t_h = k * dt_h; day = int(t_h // 24) % 365; hour = t_h % 24
        f = ECL['per_day'][day]
        prof = {n: 1 + (peak[n] - 1) * math.cos(2 * math.pi * (hour - peak_hour) / 24) for n in racks}   # mean 1, max = peak
        dem = {n: tasks_day[n] / 24 * prof[n] * dt_h * gs[n] for n in racks}                              # demand in GPU-seconds
        # interactive: always served (sized for peak), battery through eclipse
        done_i = min(dem['agent_i'], cap_gs['agent_i'])
        spare_i = cap_gs['agent_i'] - done_i
        batt_kwh_rack += it_kw * f * dt_h
        # background: dark in eclipse; queue drains onto background racks first, then onto idle interactive racks if pooled
        avail_b = cap_gs['agent_b'] * (1 - f)
        want = queue + dem['agent_b']
        on_b = min(want, avail_b)
        on_i = min(want - on_b, spare_i) if pooled else 0.0
        queue = want - on_b - on_i
        max_queue = max(max_queue, queue); spill_gs += on_i; gs_on_b += on_b; gs_on_i += done_i + on_i
        # energy: utilisation of each rack class; background racks draw nothing for the eclipse fraction
        u_i = (done_i + on_i) / cap_gs['agent_i']
        u_b = on_b / cap_gs['agent_b']
        e_i = racks['agent_i'] * (u_i * it_kw + (1 - u_i) * idle_kw) * pue['agent_i'] * dt_h
        e_b = racks['agent_b'] * (u_b * it_kw + max(0.0, 1 - f - u_b) * idle_kw) * pue['agent_b'] * dt_h
        share_b_on_i = on_i / (done_i + on_i) if done_i + on_i > 0 else 0.0                       # attribute pooled energy to background
        energy_kwh['agent_i'] += e_i * (1 - share_b_on_i)
        energy_kwh['agent_b'] += e_b + e_i * share_b_on_i
        done_tasks['agent_i'] += done_i / gs['agent_i']
        done_tasks['agent_b'] += (on_b + on_i) / gs['agent_b']
    kj = {n: energy_kwh[n] * 3600 / done_tasks[n] for n in racks}
    busy = {n: energy_per_task(n, lv)['leo_kj'] for n in racks}
    mean_b_gs_h = tasks_day['agent_b'] / 24 * gs['agent_b']
    return dict(gwh=sum(energy_kwh.values()) / 1e6, kj=kj, busy_kj=busy, racks=racks, tasks=sum(done_tasks.values()),
                max_queue_h=max_queue / mean_b_gs_h, pooled_share=spill_gs / (tasks_day['agent_b'] * 365 * gs['agent_b']),
                batt_cycles=batt_kwh_rack / (it_kw * LEO['batt_full_min'] / 60),
                util={'agent_i': gs_on_i / (cap_gs['agent_i'] * steps), 'agent_b': gs_on_b / (cap_gs['agent_b'] * steps)})

def size_background_by_sim(lv=OPT, pooled=True, max_backlog_h=3.0):
    """Smallest background-rack margin (x peak sizing) whose worst backlog stays under `max_backlog_h` hours of mean demand."""
    lo, hi = 0.2, 1.3
    for _ in range(12):
        mid = (lo + hi) / 2
        if simulate_year(lv, margin=mid, pooled=pooled, step_min=30)['max_queue_h'] <= max_backlog_h: hi = mid
        else: lo = mid
    return hi

# ---------------- placement ----------------
def place(sizing, orbit=True, leo=LEO, complete=True, orbit_share=None, all_orbit=False):
    """Fill Earth up to the grid cap, latency-sensitive first; overflow to LEO.
    orbit_share: if given, that fraction of the *background-agent* capacity goes to LEO before the cap logic runs
    (how the explorer's slider works); None keeps the pure overflow rule.
    all_orbit: no Earth sites at all. Background racks keep the eclipse throttle; interactive and chat racks
    cannot be paused, so they carry the full-load eclipse battery instead."""
    cap_it_mw = EARTH['cap_mw'] / EARTH['pue']
    earth_mw = leo_mw = earth_sb_mw = 0.0      # GPU IT MW; earth_sb_mw is the sandbox racks' draw on Earth (complete only)
    earth_racks = leo_racks = leo_racks_batt = 0.0
    for name, s in sizing.items():
        racks = s['gpus'] / GPU['per_rack']
        mw = racks * GPU['rack_kw'] / 1000
        sbx = leo['sandbox_racks'] * leo['sandbox_kw'] / GPU['rack_kw'] if (complete and name.startswith('agent')) else 0.0
        if all_orbit:
            leo_mw += mw
            if name == 'agent_b': leo_racks += racks
            else: leo_racks_batt += racks
            continue
        if orbit_share is not None and name == 'agent_b':
            leo_mw += mw * orbit_share
            leo_racks += racks * orbit_share
            mw *= 1 - orbit_share
        room = max(0.0, cap_it_mw - earth_mw - earth_sb_mw) / (1 + sbx)
        on_earth = min(mw, room) if orbit else mw
        earth_mw += on_earth
        earth_sb_mw += on_earth * sbx
        earth_racks += on_earth / GPU['rack_kw'] * 1000
        leo_mw += mw - on_earth
        leo_racks += (mw - on_earth) / GPU['rack_kw'] * 1000
    l_total, _, l_mass, l_detail = leo_rack_cost(leo, complete)
    b_total, _, b_mass, _ = leo_rack_cost(leo, complete, eclipse='battery')
    leo_racks /= l_detail['throttle']          # racks launched: delivered capacity is throttled in eclipse
    cost = earth_racks * earth_rack_cost(complete=complete)[0] + leo_racks * l_total + leo_racks_batt * b_total
    return dict(earth_it_mw=earth_mw, earth_grid_mw=(earth_mw + earth_sb_mw) * EARTH['pue'], leo_it_mw=leo_mw,
                racks=earth_racks + leo_racks + leo_racks_batt, leo_racks=leo_racks + leo_racks_batt, leo_racks_batt=leo_racks_batt,
                leo_mass=leo_racks * l_mass + leo_racks_batt * b_mass, cost=cost,
                feasible=(earth_mw * EARTH['pue'] <= EARTH['cap_mw'] + 1e-6) and cost <= 30e9)

def max_served(case, lv, orbit, complete=True, orbit_share=None, all_orbit=False):
    """Largest share of the case that fits $30B and the 500 MW grid cap (bisection; cost is monotonic in users)."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        p = place(size(dict(case, users=case['users'] * mid), lv), orbit=orbit, complete=complete, orbit_share=orbit_share, all_orbit=all_orbit)
        if p['feasible']: lo = mid
        else: hi = mid
    return lo

def fmt_money(x): return f"${x/1e9:5.1f}B" if x >= 1e9 else f"${x/1e6:5.1f}M"

if __name__ == '__main__':
    print("== per-GPU throughput (users decoding at once / tok/s) ==")
    for name, w in WORKLOADS.items():
        for lv, tag in ((NAIVE, 'naive'), (ALL, 'levers')):
            u, kv = decode_users_per_gpu(w, lv)
            print(f"  {name:8s} {tag:7s} {u:7.0f} users  {u*w['tps']:9,.0f} tok/s   KV/user {kv/1e9:.2f} GB   prefill {prefill_tps_per_gpu(w)/1e6:.1f}M tok/s")

    print("\n== one GPU rack for 5 years (bare = first pass; complete = after the design review, same sandbox on both sites) ==")
    for tag, complete in (('bare', False), ('complete', True)):
        e, eparts = earth_rack_cost(complete=complete)
        print(f"  Earth {tag:8s} {fmt_money(e)}   " + ", ".join(f"{k} {fmt_money(v).strip()}" for k, v in eparts.items()))
    for tag, complete in (('bare', False), ('complete', True)):
        l, parts, mass, d = leo_rack_cost(complete=complete)
        print(f"  LEO {tag:8s} {fmt_money(l)}   mass {mass/1000:5.1f} t   {d['elec_w']/1e3:4.0f} kW electrical ({d['array_w']/1e3:.0f} kW array), {d['rad_m2']:.0f} m2 radiator, "
              f"capacity x{d['throttle']:.2f} -> {fmt_money(d['per_delivered'])} per delivered rack")
        print("           $: " + ", ".join(f"{k} {fmt_money(v).strip()}" for k, v in parts.items()))
        print("          kg: " + ", ".join(f"{k} {v:,.0f}" for k, v in d['kg'].items()) + f"  x{LEO['bus_factor']} structure")
    l, parts, mass, d = leo_rack_cost(eclipse='battery')
    print(f"  LEO complete, full-load eclipse battery for interactive work (cannot be throttled): {fmt_money(l)}   mass {mass/1000:5.1f} t   "
          f"battery {d['batt_kwh']:,.0f} kWh = {d['kg']['battery']:,.0f} kg, {fmt_money(parts['battery'])}")

    print("\n== PUE derived from components (component values ASSUMED) ==")
    pl, pp = leo_pue(); pb, _ = leo_pue(battery=True); pe, ep = earth_pue()
    print(f"  LEO   {pl:.4f}  = 1 + " + " + ".join(f"{k} {v*100:.2f}%" for k, v in pp.items()) + f"   (battery racks {pb:.4f})")
    print(f"  Earth {pe:.4f}  = 1 + " + " + ".join(f"{k} {v*100:.2f}%" for k, v in ep.items()))
    print(f"  orbit geometry: {ORBIT['alt_km']} km, i {ORBIT['inc_deg']} deg, 06:00 LTAN -> beta min {ECL['beta_min']:.1f} deg, eclipses on {ECL['days']} days/yr, "
          f"longest {ECL['max_min']:.1f} min of a {ECL['period_min']:.1f} min orbit, {ECL['frac']*100:.2f}% of the year -> throttle {LEO['eclipse_throttle']}, battery {LEO['batt_full_min']} min")

    print(f"\n== joules per task (digital-twin metric; PUE Earth {EARTH['pue']}, LEO {LEO['pue']}) ==")
    print(f"  {'workload':8s} {'levers':7s} {'GPU-s/task':>10s} {'sandbox kJ':>10s} {'IT kJ':>8s} {'Earth kJ':>9s} {'LEO kJ':>8s} {'Earth Wh':>9s}")
    for name in WORKLOADS:
        for lv, tag in ((NAIVE, 'naive'), (ALL, 'levers')):
            t = energy_per_task(name, lv)
            print(f"  {name:8s} {tag:7s} {t['gpu_s']:10.2f} {t['sandbox_kj']:10.2f} {t['it_kj']:8.1f} {t['earth_kj']:9.1f} {t['leo_kj']:8.1f} {t['earth_kj']/3.6:9.1f}")
    tb, ti = energy_per_task('agent_b', ALL), energy_per_task('agent_i', ALL)
    caseB = CASES['B agent devs']
    tasks_day = caseB['users'] * (caseB['agent_b'] + caseB['agent_i'])
    gwh_earth = (caseB['users'] * caseB['agent_b'] * tb['earth_kj'] + caseB['users'] * caseB['agent_i'] * ti['earth_kj']) * 365 / 3.6e9
    gwh_half = (caseB['users'] * caseB['agent_b'] * (tb['earth_kj'] + tb['leo_kj']) / 2 + caseB['users'] * caseB['agent_i'] * ti['earth_kj']) * 365 / 3.6e9
    print(f"  case B, all levers: {tasks_day/1e9:.1f}B tasks/day; {gwh_earth:,.0f} GWh/yr all on Earth, {gwh_half:,.0f} GWh/yr with half the background work in LEO "
          f"({(1 - gwh_half/gwh_earth)*100:.1f}% less; the levers cut GPU-s per background task {energy_per_task('agent_b', NAIVE)['gpu_s']/tb['gpu_s']:.1f}x)")

    print("\n== joules-per-task optimiser: design variables the slides leave open (all in space, LEO PUE) ==")
    best, rows = optimise(ALL)
    print(f"  {'setting':38s} {'bg tok/s':>8s} {'bg GPU-s':>8s} {'bg kJ':>7s} {'int kJ':>7s} {'all-space 5-yr cost':>19s} {'racks':>6s}")
    for label, l in rows:
        eb_, ei_ = energy_per_task('agent_b', l), energy_per_task('agent_i', l)
        pA = place(size(caseB, l), all_orbit=True)
        print(f"  {label:38s} {(l.tps_b or WORKLOADS['agent_b']['tps']):8.0f} {eb_['gpu_s']:8.2f} {eb_['leo_kj']:7.1f} {ei_['leo_kj']:7.1f} {fmt_money(pA['cost']):>19s} {pA['leo_racks']:6.0f}")
    print(f"  best: background at {best.tps_b:.0f} tok/s (the bandwidth/memory balance point for spec {best.spec}), sandboxes snapshotted. "
          f"Interactive stays at 100 tok/s: it is already bandwidth-bound, slower would not help and faster is capped.")

    print("\n== one year in orbit, all-space case B at the optimised levers (10-minute steps; idle racks draw 30% GPU / 50% sandbox, ASSUMED) ==")
    m_pool = size_background_by_sim(OPT, pooled=True)
    runs = [('peak-sized, no eclipse margin, no pooling', simulate_year(OPT)),
            (f'background racks x{1/LEO["eclipse_throttle"]:.3f} (worst-day margin), no pooling', simulate_year(OPT, margin=1 / LEO['eclipse_throttle'])),
            (f'pooled: background runs on idle interactive racks, background racks x{m_pool:.2f}', simulate_year(OPT, margin=m_pool, pooled=True))]
    print(f"  {'design':68s} {'racks':>5s} {'GWh/yr':>7s} {'int kJ':>7s} {'bg kJ':>6s} {'util i':>6s} {'util b':>6s} {'worst backlog':>14s} {'bg on int racks':>15s}")
    for label, Y in runs:
        print(f"  {label:68s} {sum(Y['racks'].values()):5.0f} {Y['gwh']:7,.0f} {Y['kj']['agent_i']:7.1f} {Y['kj']['agent_b']:6.1f} {Y['util']['agent_i']*100:5.0f}% {Y['util']['agent_b']*100:5.0f}% "
              f"{(f'{Y['max_queue_h']:.1f} h' if Y['max_queue_h'] < 48 else f'{Y['max_queue_h']/24:.0f} days'):>14s} {Y['pooled_share']*100:14.0f}%")
    Y = runs[2][1]
    print(f"  fleet-level kJ/task counts idle time: busy-only would be {Y['busy_kj']['agent_i']:.1f} / {Y['busy_kj']['agent_b']:.1f}. "
          f"Interactive demand peaks at 2x its mean, so those racks idle half the time unless background work fills them.")
    print(f"  interactive battery: {Y['batt_cycles']:.0f} full cycles per year, {LEO['batt_full_min']} min at full load each; eclipses on {ECL['days']} days")
    ri, rb = Y['racks']['agent_i'], Y['racks']['agent_b']
    cost_pool = ri * leo_rack_cost(eclipse='battery')[0] + rb * leo_rack_cost()[0]
    pA = place(size(caseB, OPT), all_orbit=True)
    print(f"  twin-optimised all-space fleet: {ri:.0f} battery racks + {rb:.0f} background racks = {ri + rb:.0f} racks, {math.ceil((ri + rb) / 8)} nodes, "
          f"{fmt_money(cost_pool)} over 5 yr, vs {pA['leo_racks']:.0f} racks / {fmt_money(pA['cost'])} without pooling")

    print("\n== cases ==")
    print(f"  {'case':22s} {'scenario':18s} {'GPUs':>8s} {'IT MW':>7s} {'Earth grid MW':>14s} {'LEO MW':>7s} {'5-yr cost':>9s}  ok   max served")
    for cname, case in CASES.items():
        for lv, tag in ((NAIVE, 'naive, Earth'), (ALL, 'levers, Earth'), (ALL, 'levers, Earth+LEO')):
            s = size(case, lv)
            p = place(s, orbit='LEO' in tag)
            gpus = sum(v['gpus'] for v in s.values())
            it_mw = gpus / GPU['per_rack'] * GPU['rack_kw'] / 1000
            served = max_served(case, lv, 'LEO' in tag)
            print(f"  {cname:22s} {tag:18s} {gpus:8,.0f} {it_mw:7.0f} {p['earth_grid_mw']:14.0f} {p['leo_it_mw']:7.0f} {fmt_money(p['cost']):>9s}  {'yes' if p['feasible'] else 'NO':3s}  serves {served*100:5.1f}%")
        s = size(case, ALL)
        print("    " + "  ".join(f"{k}: {v['dec_gpus']:,.0f} dec + {v['pre_gpus']:,.0f} pre" for k, v in s.items()))

    print("\n== case B ALL IN SPACE: no Earth sites (complete racks; interactive racks battery-backed, background racks throttled) ==")
    print(f"  {'scenario':8s} {'GPUs':>8s} {'LEO IT MW':>9s} {'racks':>6s} {'of which batt':>13s} {'8-rack nodes':>12s} {'to launch':>10s} {'100 t launches':>14s} {'5-yr cost':>9s}  ok   max served  GWh/yr")
    for lv, tag in ((NAIVE, 'naive'), (ALL, 'levers')):
        sB = size(caseB, lv); pA = place(sB, all_orbit=True)
        gpus = sum(v['gpus'] for v in sB.values())
        gwh = sum(caseB['users'] * caseB[n] * energy_per_task(n, lv)['leo_kj'] for n in ('agent_i', 'agent_b')) * 365 / 3.6e9
        print(f"  {tag:8s} {gpus:8,.0f} {pA['leo_it_mw']:9.0f} {pA['leo_racks']:6.0f} {pA['leo_racks_batt']:13.0f} {pA['leo_racks']/8:12.0f} {pA['leo_mass']/1e6:7.1f} kt {pA['leo_mass']/1e5:14.0f} {fmt_money(pA['cost']):>9s}  {'yes' if pA['feasible'] else 'NO':3s}  {max_served(caseB, lv, True, all_orbit=True)*100:5.1f}%     {gwh:,.0f}")
    pA = place(size(caseB, ALL), all_orbit=True); pE = place(size(caseB, ALL), orbit=False)
    print(f"  all-space vs all-Earth, levers: {fmt_money(pA['cost'])} vs {fmt_money(pE['cost'])} ({pA['cost']/pE['cost']:.2f}x); Earth grid draw 0 MW vs {pE['earth_grid_mw']:.0f} MW; "
          f"PUE {LEO['pue']} throughout, {(1 - LEO['pue']/EARTH['pue'])*100:.0f}% fewer joules per task than Earth")

    print("\n== case B, all levers: background-agent capacity moved to orbit (complete rack; bare rack for comparison) ==")
    print(f"  {'bg in LEO':>9s} {'Earth grid MW':>14s} {'LEO IT MW':>9s} {'LEO racks':>9s} {'to launch':>12s} {'5-yr cost':>9s} {'bare rack':>9s}  ok")
    caseB = CASES['B agent devs']; sB = size(caseB, ALL)
    for share in (0.0, 0.25, 0.5, 0.75, 1.0):
        p = place(sB, orbit=True, orbit_share=share)
        pb = place(sB, orbit=True, complete=False, orbit_share=share)
        print(f"  {share*100:8.0f}% {p['earth_grid_mw']:14.0f} {p['leo_it_mw']:9.0f} {p['leo_racks']:9.0f} {p['leo_mass']/1e6:9.1f} kt {fmt_money(p['cost']):>9s} {fmt_money(pb['cost']):>9s}  {'yes' if p['feasible'] else 'NO'}")

    print()
    print("== what-if: complete LEO rack cost vs launch price and solar price (Earth rack for reference) ==")
    print(f"  Earth rack: {fmt_money(earth_rack_cost()[0])}")
    for usd_kg in (1500, 500, 200, 50):
        row = []
        for usd_w in (20, 10, 5, 2):
            c, _, _, _ = leo_rack_cost(dict(LEO, launch_usd_kg=usd_kg, solar_usd_w=usd_w))
            row.append(f"solar ${usd_w:2d}/W -> {fmt_money(c)}")
        print(f"  launch ${usd_kg:4d}/kg:  " + "   ".join(row))
