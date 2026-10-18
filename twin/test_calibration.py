"""The twin must reproduce the numbers the deck prints. Run: python3 twin/test_calibration.py"""
import catalog as C
import score as S

BASE = dict(S.SERVING_DEFAULTS)


def close(x, target, tol):
    assert abs(x - target) <= tol * target, f"{x:,.1f} not within {tol:.0%} of {target:,.1f}"


def test_chat_sessions_per_gpu():          # DECK s13: ~960 users, 58,000 tok/s
    r = S.decode_replica("chat", "gpu", 1, BASE)
    close(r["sessions"], 960, 0.03)
    close(r["tps"], 58_000, 0.03)


def test_agent_sessions_per_gpu():         # DECK s13: ~117 users, 11,700 tok/s
    r = S.decode_replica("agent_int", "gpu", 1, BASE)
    close(r["sessions"], 117, 0.03)
    close(r["tps"], 11_700, 0.03)


def test_session_kv():                     # DECK s13: 1.1 GB chat, 3.8 GB agent
    close(S.session_kv_bytes("chat"), 1.1e9, 0.03)
    close(S.session_kv_bytes("agent_int"), 3.8e9, 0.03)


def test_per_user_peaks():                 # DECK s11: peak tokens/s per user, out + in
    for case, out, inp in (("A", 2.4, 5.6), ("B", 28, 333), ("C", 4.6, 40)):
        d_out, d_in, _ = S.demand([case], BASE)
        users = C.CASES[case]["users"]
        close(sum(d_out.values()) / users, out, 0.03)
        close(sum(d_in.values()) / users, inp, 0.03)


def test_radiator_and_launch():            # DECK s14: 972 W/m^2, $3.6M per MW
    close(S.radiator_w_per_m2(), 972, 0.01)
    close(C.SITES["leo"]["launch_usd_per_kg"] * C.SPACE_KG_PER_MW, 3.6e6, 0.001)


def test_breakeven():                      # DECK s14: Nordics ~$95/kg, West Texas ~$170/kg
    be = {r["site"]: r["breakeven_usd_per_kg"] for r in S.breakeven_table() if r["chip"] == "gpu"}
    close(be["nordics"], 95, 0.03)
    close(be["west_texas"], 170, 0.03)


def _single_site(stream, site):
    design = dict(cases=["C"], pools=[
        dict(stream=stream, phase="prefill", site=site, chip="gpu", racks=1),
        dict(stream=stream, phase="decode", site=site, chip="gpu", racks=1)])
    r = S.evaluate(design)
    return next(p for p in r["pools"] if p["phase"] == "decode")["slo_ok"]


def test_distance_rules():                 # DECK s12: Moon fails chat + interactive, Mars only background
    assert _single_site("chat", "leo") and _single_site("agent_int", "leo")
    assert not _single_site("chat", "moon") and not _single_site("agent_int", "moon")
    assert _single_site("agent_bg", "moon")
    assert not _single_site("agent_int", "mars") and _single_site("agent_bg", "mars")


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_")]
    for name, fn in tests:
        fn()
        print(f"ok  {name}")
    print(f"{len(tests)} passed")
