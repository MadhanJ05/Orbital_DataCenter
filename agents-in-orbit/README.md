# Agents in Orbit: case B, the whole agent fleet in space

Companion strand to the `twin/` package: a napkin model, an interactive explorer and a parametric satellite
for case B (50M agent developers), with the whole fleet in a 575 km dawn-dusk sun-synchronous orbit.
Every number comes from the slides unless tagged ASSUMED; a few first-pass guesses are now DERIVED
(PUE from components, eclipse seasons from orbit geometry, the eclipse battery and margin).

| File | What it is |
|---|---|
| `model.py` | The model. `python model.py` prints: per-GPU throughput, Earth vs LEO rack (bare and complete), PUE from components, joules per task, the lever optimiser, a one-year simulation, the case tables, the all-space fleet and a launch/solar what-if. No dependencies. |
| `explorer.html` | Interactive twin of the fleet: sliders for demand, software levers, decode rate, placement, economics; joules per task and PUE; one year in orbit with eclipse seasons and backlog. Open in a browser. Published copy: https://claude.ai/artifact/WEPaqypHpvX1gx5SC2y2Xn |
| `node3d.html` | Three.js model of one 8-rack orbital node with bill of materials. Published copy: https://claude.ai/artifact/KfZ2oyhyrLV1Taf8KEWD4B |
| `node.scad` | Same node in OpenSCAD (F6, export STL/3MF). |
| `NOTES.md` | Working notes: every number, what changed in each review pass, open items. |

Headline (case B, all levers, twin-optimised): 261 racks in 33 nodes, 237 MW of IT, 0 MW of grid,
$16.7B over 5 years, 1,837 GWh/yr at PUE 1.0495, 100% of users served.
Key findings: background decode should run at the bandwidth/memory balance point (67 tok/s, not 30);
eclipses are 4.6% of the year, not 1%; pooling background work onto idle interactive racks at night cuts
the fleet by a third.
