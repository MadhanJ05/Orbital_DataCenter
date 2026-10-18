// Orbital compute node for "Agents in Orbit" (case B, the whole agent fleet in LEO: 261 racks in 33 nodes of 8, background work pooled onto interactive nodes at night).
// Parametric OpenSCAD model. Units: metres. Open in OpenSCAD, F6, then export STL / 3MF.
// Same formulas as model.py / explorer.html: one 2035 GPU rack = 792 kW IT.

racks       = 8;      // GPU racks on this node (8 = 6.3 MW IT, ~199 t complete, two 100 t launches)
rack_kw     = 792;    // slide: 2035 GPU rack, 144 chips
pue         = 1.05;   // orbit: pumped loop + power electronics overhead
solar_w_m2  = 400;    // 1361 W/m2 x ~30% cell efficiency (ASSUMED 2035)
rad_w_m2    = 1000;   // net rejection per m2 of two-sided panel at ~70 C (ASSUMED)
wing_aspect = 4;      // wing length : width

// Design-review additions (all ASSUMED; same numbers as model.py's "complete" rack)
sandbox_kw  = 100;    // one CPU/NVMe tool-sandbox rack per GPU rack: ~170k mostly idle microVMs for the 80 tool calls per task
rad_derate  = 0.14;   // Earth IR + albedo on the Earth-facing radiator face; averaged over both faces = 7% more panel
interactive = false;  // true: node serves interactive steps, which cannot pause in eclipse -> full-load battery per rack (436 kWh = 21 min eclipse + 20%, 1.7 t)
rack_t      = interactive ? 27.4 : 24.9;   // launch mass per GPU rack incl. sandbox, shielding, battery (436 kWh on interactive nodes), propulsion, comms, power conditioning, loop, ACS, 1.5x structure
solar_eol   = 0.85;   // arrays sized for end-of-life output after 5 yr of LEO degradation
pcdu_kg_kw  = 1.5;    // power conditioning + harness mass per kW electrical
loop_kg     = 750;    // pumps, fluid, cold plates, piping and a redundant loop, per rack
acs_kg      = 400;    // CMG cluster + star trackers per node
// Eclipse (~1% of the year in dawn-dusk SSO) is handled by throttling the background workload, so the array is
// not oversized for it and there is only a 30 kWh housekeeping battery (green box beside the avionics).

elec_kw     = racks * (rack_kw + sandbox_kw) * pue;
solar_m2    = elec_kw * 1000 / solar_eol / solar_w_m2;
rad_m2      = elec_kw * 1000 / (rad_w_m2 * (1 - rad_derate / 2));
solar_w     = sqrt(solar_m2 / (2 * wing_aspect));   // each of 2 wings: w x aspect*w
solar_l     = wing_aspect * solar_w;
rad_w       = sqrt(rad_m2 / (2 * wing_aspect));
rad_l       = wing_aspect * rad_w;

rack_pitch  = 1.6;                       // along the spine
truss_len   = racks * rack_pitch + 4;
truss_side  = 2.4;
boom        = 10;                        // solar wing stand-off from the spine
rad_gap     = 3;                         // radiator root clearance from truss end

echo(str("IT MW: ", racks * rack_kw / 1000, " (+", racks * sandbox_kw / 1000, " MW sandbox)  electrical MW: ", elec_kw / 1000));
echo(str("launch mass t: ", racks * rack_t, "  launches of 100 t: ", ceil(racks * rack_t / 100)));
echo(str("power conditioning kg: ", elec_kw * pcdu_kg_kw, "  loop kg: ", racks * loop_kg, "  ACS kg: ", acs_kg));
echo(str("solar: ", solar_m2, " m2 as 2 wings ", solar_w, " x ", solar_l, " m"));
echo(str("radiator: ", rad_m2, " m2 as 2 wings ", rad_w, " x ", rad_l, " m"));

// Frame: spine along Y. Sun along +Z (arrays face it). Radiators in the YZ plane, edge-on to the sun.

module spine() {
    color("silver") difference() {
        cube([truss_side, truss_len, truss_side], center = true);
        cube([truss_side - 0.3, truss_len + 1, truss_side - 0.3], center = true);
    }
}

module rack_module(i) {
    y = -truss_len / 2 + 2 + rack_pitch * (i + 0.5);
    // sealed, conduction-cooled rack box on the -Z (shaded) face of the spine, cold plate against the loop
    color([0.18, 0.2, 0.3]) translate([-0.4, y - 0.65, -truss_side / 2 - 2.4]) cube([0.8, 1.3, 2.4]);
    color([0.85, 0.3, 0.75]) translate([-0.42, y - 0.67, -truss_side / 2 - 0.3]) cube([0.84, 1.34, 0.3]); // cold plate manifold
    // tool-sandbox box (CPU + NVMe, 100 kW) beside the GPU rack, on the same cold plate loop
    color([0.1, 0.45, 0.55]) translate([0.55, y - 0.55, -truss_side / 2 - 2.2]) cube([0.5, 1.1, 2.2]);
    color([0.85, 0.3, 0.75]) translate([0.53, y - 0.57, -truss_side / 2 - 0.3]) cube([0.54, 1.14, 0.3]);
}

module propulsion_module() {
    // krypton tank inside the aft truss bay; two Hall-thruster pods out on the solar booms, 11 m off the spine and canted
    // 20 deg outboard so the plume (along -Y) clears the aft radiator wing, which lies in the x = 0 plane
    ya = -truss_len / 2;
    color([0.75, 0.75, 0.8]) translate([0, ya + 1.2, 0]) sphere(d = 1.6, $fn = 32);
    cant = 20;
    for (dx = [-1, 1]) translate([dx * (truss_side / 2 + boom - 0.8), -0.9, 0]) rotate([0, 0, dx * cant]) {
        color([0.9, 0.55, 0.15]) rotate([90, 0, 0]) cylinder(h = 0.8, d = 0.5, center = true, $fn = 24);          // thruster body, axis Y
        color([0.3, 0.3, 0.32]) translate([0, -0.6, 0]) rotate([90, 0, 0]) cylinder(h = 0.4, d1 = 0.5, d2 = 0.7, center = true, $fn = 24); // nozzle, exhaust -Y (canted)
        color([0.4, 0.4, 0.45]) translate([0, 0.6, 0]) cube([0.3, 0.4, 0.3], center = true);                    // mount to the boom
    }
}

module pcdu_box(i) {
    // power conditioning + distribution for one rack, on the -X face of the spine, on the same cold-plate loop
    y = -truss_len / 2 + 2 + rack_pitch * (i + 0.5);
    color([0.8, 0.6, 0.2]) translate([-truss_side / 2 - 0.7, y - 0.5, -0.5]) cube([0.7, 1.0, 1.0]);
    // interactive node: full-load eclipse battery pack under the PCDU box
    if (interactive) color([0.2, 0.5, 0.3]) translate([-truss_side / 2 - 0.7, y - 0.5, -2.0]) cube([0.7, 1.0, 1.4]);
}

module loop_lines() {
    // supply and return lines of the pumped two-phase loop, along the -Z face above the cold plates
    for (dx = [-0.7, 0.7]) color([0.6, 0.25, 0.55]) translate([dx, 0, -truss_side / 2 - 0.08])
        rotate([90, 0, 0]) cylinder(h = truss_len - 1, d = 0.15, center = true, $fn = 12);
}

module pump_pack(dir) {
    // two redundant pump units on each radiator manifold
    for (dx = [-0.5, 0.5]) color([0.5, 0.55, 0.6]) translate([dx, dir * (truss_len / 2 + rad_gap / 2), 0.9])
        rotate([90, 0, 0]) cylinder(h = 1.0, d = 0.4, center = true, $fn = 16);
}

module cmg_cluster() {
    // four control moment gyros in a box on the +Z face near the centre of mass, with their spin axes up
    translate([0, -4, truss_side / 2 + 0.5]) {
        color([0.25, 0.3, 0.45]) cube([1.2, 1.2, 1.0], center = true);
        for (dx = [-0.3, 0.3], dy = [-0.3, 0.3]) color([0.6, 0.62, 0.7]) translate([dx, dy, 0.5]) cylinder(h = 0.3, d = 0.4, $fn = 16);
    }
}

module star_trackers() {
    // two star trackers on the avionics box, canted away from each other
    for (dx = [-1, 1]) color([0.2, 0.22, 0.3]) translate([dx * 0.4, truss_len / 2 - 2, truss_side / 2 + 1.2])
        rotate([0, dx * 30, 0]) cylinder(h = 0.4, d = 0.2, $fn = 12);
}

module sada(dir) {
    // solar array drive at the boom root: lets the wing track the small seasonal sun drift of a dawn-dusk orbit
    color([0.55, 0.55, 0.6]) translate([dir * (truss_side / 2 + 0.5), 0, 0]) rotate([0, 90, 0]) cylinder(h = 0.6, d = 1.0, center = true, $fn = 24);
    // deployment hinges: mid-boom and at the array root
    for (x = [truss_side / 2 + boom / 2, truss_side / 2 + boom]) color([0.4, 0.4, 0.45]) translate([dir * x, 0, 0]) cube([0.4, 0.9, 0.9], center = true);
}

module berthing_ring() {
    // androgynous berthing ring on the +Z face: the second launch (wings + radiators) berths here for in-orbit assembly
    color([0.7, 0.7, 0.75]) translate([0, 3, truss_side / 2]) difference() {
        cylinder(h = 0.3, d = 1.6, $fn = 32);
        translate([0, 0, -0.1]) cylinder(h = 0.5, d = 1.2, $fn = 32);
    }
}

module laser_terminal(pos, dir, up = 1) {
    // gimballed telescope on a short post; dir = unit vector it points along; up = -1 hangs it below the mount
    translate(pos) mirror([0, 0, up < 0 ? 1 : 0]) {
        color("silver") cylinder(h = 0.3, d = 0.25, $fn = 16);
        translate([0, 0, 0.45]) {
            color([0.95, 0.85, 0.3]) sphere(d = 0.5, $fn = 24);
            color([0.2, 0.22, 0.3]) rotate([0, 0, atan2(dir[1], dir[0])]) rotate([0, 90, 0]) cylinder(h = 0.6, d = 0.3, $fn = 16);
        }
    }
}

module solar_wing(dir) {
    // yoke boom then a flat array in the XY plane, normal +Z toward the sun
    color("silver") translate([dir * (truss_side / 2 + boom / 2), 0, 0]) cube([boom, 0.6, 0.6], center = true);
    color([0.1, 0.16, 0.42]) translate([dir * (truss_side / 2 + boom + solar_l / 2), 0, 0]) cube([solar_l, solar_w, 0.05], center = true);
    // panel seams
    for (k = [1 : 7]) color([0.3, 0.35, 0.6])
        translate([dir * (truss_side / 2 + boom + solar_l * k / 8), 0, 0.03]) cube([0.15, solar_w, 0.02], center = true);
}

module radiator_wing(dir) {
    // vertical panel (YZ plane) beyond the spine end: both faces see deep space, sun hits the edge only
    color([0.86, 0.88, 0.92]) translate([0, dir * (truss_len / 2 + rad_gap + rad_l / 2), 0]) cube([0.05, rad_l, rad_w], center = true);
    color([0.6, 0.62, 0.68]) translate([0, dir * (truss_len / 2 + rad_gap / 2), 0]) cube([1.2, rad_gap, 1.2], center = true); // fluid manifold
}

module node() {
    spine();
    for (i = [0 : racks - 1]) rack_module(i);
    solar_wing(1); solar_wing(-1);
    radiator_wing(1); radiator_wing(-1);
    for (i = [0 : racks - 1]) pcdu_box(i);
    loop_lines();
    pump_pack(1); pump_pack(-1);
    propulsion_module();
    sada(1); sada(-1);
    cmg_cluster();
    berthing_ring();
    // avionics box (gold) and the 30 kWh housekeeping battery (green) on the +Z face
    color("gold") translate([0, truss_len / 2 - 2, truss_side / 2 + 0.6]) cube([1.2, 1.2, 1.2], center = true);
    color([0.2, 0.5, 0.3]) translate([1.1, truss_len / 2 - 2, truss_side / 2 + 0.35]) cube([0.6, 0.8, 0.7], center = true);
    star_trackers();
    // laser ring terminals on the booms, 6 m off the spine so they look past the radiator wings along +/-Y;
    // relay/gateway terminal hangs below the racks and looks nadir (+X), under the array plane
    laser_terminal([6, 0, 0.3], [0, 1, 0]);
    laser_terminal([-6, 0, 0.3], [0, -1, 0]);
    laser_terminal([0, 1, -truss_side / 2 - 2.4], [1, 0, 0], -1);
}

node();

// Scale reference: a 120 m launcher silhouette, 9 m diameter, parked 80 m off to the side (comment out before export)
// %translate([0, -truss_len / 2 - rad_gap - rad_l - 80, -60]) cylinder(h = 120, d = 9);
