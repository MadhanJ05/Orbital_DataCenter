"""Every external source the deck and the briefing dashboard cite, and the estimate-vs-source table.

REFS:    key -> (title, publisher and date, url). Pages cite a key as <a class="ref" data-k="KEY"></a>;
         build.py numbers them in order of first appearance and keeps only the ones a page uses.
SOURCES: one row per input the organizers did not give: our value, what the source says, a verdict.
         Verdicts: matches, conservative, below today, optimistic, stretch, projection.
"""

REFS = {
    'suncatcher': (
        'Google Research, Project Suncatcher: a space-based, scalable AI infrastructure design study',
        'arXiv 2511.19468, 2025–2026',
        'https://arxiv.org/abs/2511.19468'),
    'turyshev': (
        'S. Turyshev (JPL), orbital data center analysis: eclipse geometry (eqs. 21–22, Table 9), optical ground-site costs',
        'arXiv 2604.27197, 2026',
        'https://arxiv.org/abs/2604.27197'),
    'hinode': (
        'JAXA/ISAS, Hinode operations remarks: 2007 eclipse season May 7–Aug 10, peak 19.4 min per 98-min orbit',
        'JAXA, 2007',
        'https://www.isas.jaxa.jp/home/solar/hinode_op/remarks.php?rmk=0001'),
    'bargatin': (
        "Bargatin et al., dawn-dusk orbits from ~1,600 km avoid Earth's shadow",
        'arXiv 2512.09044, 2025',
        'https://arxiv.org/abs/2512.09044'),
    'vanallen': (
        'NASA Earth Observatory, Probing the electric space around Earth: inner belt reaches down to ~1,000 km',
        'NASA',
        'https://earthobservatory.nasa.gov/images/78985/probing-the-electric-space-around-earth'),
    'nasasoa': (
        'NASA Small Spacecraft Technology State of the Art: Power Subsystems',
        'NASA, 2026 edition',
        'https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems'),
    'woods': (
        'Woods et al., thin-film solar arrays: blanket >2,000 W/kg, array 150–500 W/kg projected',
        'NASA NTRS, 2007',
        'https://ntrs.nasa.gov/citations/20090022290'),
    'techbriefs': (
        'NASA Tech Briefs, lightweight carbon-carbon space radiator (~2.2 kg/m²; metal ≈10 kg/m²)',
        'NASA Tech Briefs, 2008',
        'https://www.techbriefs.com/component/content/article/3156-lew-18210-1'),
    'redwire': (
        'Redwire Q-Rad deployable radiator: 3.5–4.9 kg/m²',
        'satsearch listing',
        'https://satsearch.co/products/redwirespace-q-rad-deployable-radiator'),
    'bnef': (
        'BloombergNEF, lithium-ion battery pack prices fall to $108 per kWh',
        'BNEF, Dec 2025',
        'https://about.bnef.com/insights/clean-energy/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/'),
    'tbird': (
        'NASA / MIT Lincoln Laboratory, TBIRD: 200 Gbps laser downlink from a 6U CubeSat',
        'SmallSat 2023 (NTRS)',
        'https://ntrs.nasa.gov/citations/20230007959'),
    'tesat': (
        'Tesat laser terminals: SCOT80 11.9 kg, 10 Gbps; SCOT135 28 kg, up to 100 Gbps',
        'Tesat product data',
        'https://www.tesat.de/products'),
    'aerospace': (
        'The Aerospace Corporation, State of Play: Lasercom (terminals produced in the ~$10M range)',
        'Aerospace Corp., 2023',
        'https://aerospace.org/sites/default/files/2023-05/FY23_12205_SOP_Lasercom%20Ppr_r10.pdf'),
    'spacenews': (
        'SpaceNews, Officina Stellare wins $2 million contract for a lasercom ground station',
        'SpaceNews, Mar 2026',
        'https://spacenews.com/officina-stellare-wins-2-million-contract-for-lasercom-ground-station-in-spain/'),
    'birch': (
        'Birch et al., availability of optical ground-station networks: 69% per site, 99.97% for 8 sites',
        'J. Opt. Commun. Netw. 2023, arXiv 2211.09248',
        'https://arxiv.org/abs/2211.09248'),
    'starship': (
        'SpaceX roadshow presentation: Starship V3 100 t to LEO, V4 ~200 t expected, 99%+ cost-reduction target',
        'SpaceX, May 2026',
        'https://content.spacex.com/cms-assets/assets/SpaceX%20IPO%20Roadshow.pdf'),
    'eia': (
        'U.S. EIA, Electric Power Monthly, Table 5.6.B: average industrial price by state',
        'EIA, 2026',
        'https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_b'),
    'potomac': (
        'Potomac Economics, 2024 State of the Market Report for the ERCOT Electricity Markets',
        'June 2025',
        'https://potomaceconomics.com/wp-content/uploads/2025/06/2024-State-of-the-Market-Report.pdf'),
    'ssb': (
        'Statistics Norway, electricity prices: power-intensive industry 42 øre/kWh in 2025',
        'SSB, 2026',
        'https://www.ssb.no/en/energi-og-industri/energi/statistikk/elektrisitetspriser/article-for-electricity-prices/lowest-electricity-price-since-2020'),
    'landsvirkjun': (
        'Landsvirkjun, average price to power-intensive industry just under $43 per MWh',
        'Landsvirkjun, 2022 results',
        'https://landsvirkjun.com/news/all-time-best-results'),
    'saudi': (
        'Argaam, Saudi tariff for electricity-intensive industry: 12 halalas/kWh on transmission',
        'Argaam, Oct 2021',
        'https://www.argaam.com/en/article/articledetail/id/1500079'),
    'egrid': (
        'U.S. EPA, eGRID summary data: CO2 output rate by subregion',
        'EPA, 2023 data',
        'https://www.epa.gov/egrid/summary-data'),
    'owid': (
        'Ember via Our World in Data, carbon intensity of electricity by country',
        'OWID, 2024–2025',
        'https://ourworldindata.org/grapher/carbon-intensity-electricity'),
    'jll': (
        'JLL, 2026 Global Data Center Outlook: shell and core $10.7M per MW in 2025',
        'JLL, Jan 2026',
        'https://www.jll.com/en-us/insights/market-outlook/data-center-outlook'),
    'cw': (
        'Cushman & Wakefield, Data Center Development Cost Guide 2026: $17.6M per MW for the newest sites',
        'C&W, 2026',
        'https://www.cushmanwakefield.com/en/united-states/insights/data-center-development-cost-guide'),
    'tt': (
        'Turner & Townsend, AI data centers carry a 7–10% construction cost premium',
        'Nov 2025',
        'https://www.turnerandtownsend.com/en-us/news/ai-data-center-rush-raises-alarm-over-construction-supply-chain/'),
    'epri': (
        'EPRI via APPA, new data centers range from 100 to 1,000 MW',
        'June 2024',
        'https://www.publicpower.org/periodical/article/epri-report-examines-power-demand-data-centers-artificial-intelligence'),
    'specpower': (
        '16 Years of SPEC Power: idle power 25.7% of full load in 2024',
        'arXiv 2411.07062, 2024',
        'https://arxiv.org/abs/2411.07062'),
    'dramx': (
        'DRAMeXchange (TrendForce), DRAM spot prices',
        'Oct 2026',
        'https://www.dramexchange.com/'),
    'micron': (
        'StorageReview, Micron CZ120 CXL memory modules: 27 W for 128 GB',
        'Aug 2023',
        'https://www.storagereview.com/news/micron-launch-cxl-expansion-module-portfolio'),
    'pond': (
        'Li et al., Pond: CXL-based memory pooling for cloud platforms',
        'ASPLOS 2023, arXiv 2203.00241',
        'https://arxiv.org/abs/2203.00241'),
    'firecracker': (
        'Agache et al., Firecracker: lightweight virtualization for serverless applications',
        'USENIX NSDI 2020',
        'https://www.usenix.org/system/files/nsdi20-paper-agache.pdf'),
    'e2b': (
        'E2B documentation, sandbox persistence: pause ~4 s per GiB, resume ~1 s',
        'E2B',
        'https://docs.e2b.dev/sandbox/persistence'),
    'eagle': (
        'Li et al., EAGLE: speculative sampling requires rethinking feature uncertainty',
        'ICML 2024, arXiv 2401.15077',
        'https://arxiv.org/abs/2401.15077'),
    'deepseek': (
        'DeepSeek-AI, DeepSeek-V3 technical report (second-token acceptance 85–90%)',
        'arXiv 2412.19437, 2024',
        'https://arxiv.org/abs/2412.19437'),
    'pope': (
        'Pope et al., Efficiently scaling transformer inference',
        'MLSys 2023, arXiv 2211.05102',
        'https://arxiv.org/abs/2211.05102'),
    'ercot': (
        'ERCOT, Assessing the Grid: ~474 GW of large loads requesting connection, ~90% data centers',
        'Texas Senate testimony, July 2026',
        'https://www.ercot.com/files/docs/2026/07/29/ERCOT-Senate-July-29-Panel-1-Assessing-The-Grid.pdf'),
    'gemini': (
        'Google Cloud, Measuring the environmental impact of AI inference: median Gemini Apps text prompt uses 0.24 Wh',
        'Google, Aug 2025',
        'https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference'),
}


def row(input, ours, says, verdict, refs):
    return dict(input=input, ours=ours, says=says, verdict=verdict, refs=refs)


SOURCES = [
    row('Electricity', '$25–70/MWh',
        'Today: Virginia ~$101, Midwest $84–98, ERCOT West $35, Norway ~$40, Iceland ~$43, Saudi $32',
        'below today', ['eia', 'potomac', 'ssb', 'landsvirkjun', 'saudi']),
    row('Building + cooling', '$8M per MW',
        'Shell and core $10.7M/MW (2025), newest sites $17.6M; AI sites 7–10% more',
        'below today', ['jll', 'cw', 'tt']),
    row('Grid carbon', '10–420 g/kWh',
        "28–692 g/kWh across our six sites' grids (2023–2025)",
        'below today', ['egrid', 'owid']),
    row('Orbit', '650 km dawn-dusk',
        'Dawn-dusk sun-synchronous orbit at a mean altitude of 650 km',
        'matches', ['suncatcher']),
    row('Eclipses', '≤21 min, ~95 days',
        'A satellite at 680 km: peak 19.4 min per 98-min orbit, May 7–Aug 10',
        'conservative', ['hinode']),
    row('Eclipse batteries', '250 Wh/kg · $300/kWh',
        'Li-ion cells 150–270 Wh/kg; ground packs $108/kWh, no public space price',
        'optimistic', ['nasasoa', 'bnef']),
    row('Laser terminals', '100 Gbps · 50 kg · $0.5M',
        '200 Gbps already flown; a 100 Gbps unit weighs 28 kg; past units ~$10M',
        'projection', ['tbird', 'tesat', 'aerospace']),
    row('Ground stations', '$10M + $1M/yr · 95%',
        'Optical sites $5–50M; an 8-site network is available 99.97% of the time',
        'matches', ['turyshev', 'birch']),
    row('Solar arrays, Design 2', '500 W/kg',
        'Best flown ~200 W/kg; thin-film arrays projected at 150–500 W/kg',
        'stretch', ['nasasoa', 'woods']),
    row('Drafted words accepted', '70%',
        '64–79% per position (EAGLE); 85–90% (DeepSeek-V3)',
        'conservative', ['eagle', 'deepseek']),
    row('Tool sandboxes', '170k per $2M rack',
        'Under 5 MiB per microVM, 10× oversubscription in production; no public rack price',
        'projection', ['firecracker']),
    row('Agent memory', '$3 per GB',
        'DRAM spot ~$30/GB during the 2026 shortage',
        'projection', ['dramx']),
]
