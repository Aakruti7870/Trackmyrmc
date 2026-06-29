// Public domain knowledge for the AI Help Agent.
//
// This is a curated, NON-private reference the assistant may use freely (together
// with the model's own expertise) to answer general questions about concrete,
// ready-mix concrete (RMC), mix design, Indian Standard (IS) codes, units,
// measurements, mathematics, and how to use this application. It contains NO
// account/plant/customer data — that is gathered separately by the scoped
// retrieval layer and stays strictly tenant-isolated.
export const RMC_KNOWLEDGE = `
=== ABOUT THIS APPLICATION (CONCRETE KING / TrackMyRMC) ===
TrackMyRMC (brand: CONCRETE KING) is a ready-mix concrete (RMC) marketplace and
plant-management platform. Two audiences:
• Customers: discover nearby approved RMC plants, place concrete orders, track
  deliveries (challans) live, view order status and account balance, reorder, and
  request a plant be added to the network.
• Plant staff / owners: manage orders, dispatch & generate challans, clients,
  the transit-mixer vehicle fleet, batch/production records, mix designs, reports
  & analytics, onboarding and team users.
Key modules: Dashboard (KPIs), Orders, Dispatch/Challans, Clients, Vehicles,
Batch Report, Mix Design, Reports, Nearby Plants (customer discovery).
Common how-to: To place an order a customer picks a plant, grade, quantity (m³)
and delivery date. Staff generate a challan (delivery note) from an active order
for each transit-mixer trip and mark it delivered on arrival.

=== CONCRETE BASICS ===
Concrete = cement + fine aggregate (sand) + coarse aggregate (stone) + water,
optionally with admixtures. "Grade" denotes characteristic compressive strength
at 28 days on a 150mm cube, e.g. M25 = 25 N/mm² (MPa). "M" = Mix.
Ready-Mix Concrete (RMC) is batched at a central plant and delivered by transit
mixers, in contrast to site-mixed concrete.

=== CONCRETE GRADES & NOMINAL MIX RATIOS (cement:sand:aggregate, by volume) ===
Per IS 456:2000, nominal mixes are permitted up to M20; M25 and above should use
design mixes (IS 10262).
• M5  — 1:5:10   (lean, fill)
• M7.5— 1:4:8
• M10 — 1:3:6    (PCC, leveling)
• M15 — 1:2:4    (PCC, flooring)
• M20 — 1:1.5:3  (RCC, light structures)
• M25 — 1:1:2    (RCC; design mix recommended)
• M30, M35, M40, M45, M50 and above — design mix only.
Strength classes (IS 456): Ordinary M10–M20, Standard M25–M55, High M60–M80.

=== KEY IS CODES FOR RMC ===
• IS 456:2000 — Plain & Reinforced Concrete — Code of Practice (durability,
  exposure, min cement, max w/c, nominal cover, grades).
• IS 10262:2019 — Concrete Mix Proportioning (design-mix) Guidelines.
• IS 383:2016 — Coarse & Fine Aggregates for concrete — Specification.
• IS 269:2015 — Ordinary Portland Cement (OPC) Specification (33/43/53 grade).
• IS 8112 / IS 12269 — OPC 43-grade / 53-grade specifications.
• IS 1489 — Portland Pozzolana Cement (PPC).
• IS 1199:2018 — Methods of sampling & analysis of fresh concrete (workability).
• IS 516:2021 — Methods of test for strength of concrete (cube/cylinder).
• IS 4926:2003 — Ready-Mixed Concrete — Specification (plant & delivery).
• IS 7861 — Hot/Cold weather concreting. IS 9103 — Admixtures specification.
• IS 1199 slump test; IS 456 nominal cover & exposure (Mild/Moderate/Severe/
  Very severe/Extreme) with corresponding min grade & max free w/c ratio.

=== UNITS & CONVERSIONS ===
• 1 m³ = 1000 litres = 35.3147 cubic feet (cft). 1 cft = 0.0283 m³.
• 1 bag of cement = 50 kg. Loose bulk density of cement ≈ 1440 kg/m³, so
  1 bag = 50/1440 = 0.0347 m³ (≈ 34.7 litres ≈ 1.226 cft).
• Density of fresh normal-weight concrete ≈ 2400 kg/m³ (2350–2450).
• Water: 1 litre = 1 kg. 1 tonne = 1000 kg.
• Strength: 1 N/mm² = 1 MPa = 10.197 kg/cm².
• Aggregate/sand are usually batched by mass; densities ~1500–1750 kg/m³ loose.

=== CORE CONCRETE CALCULATIONS ===
Dry volume factor: wet concrete shrinks, so dry volume of ingredients ≈ 1.54 ×
wet volume (use 1.52–1.57). Always multiply the required wet m³ by 1.54 first.

Nominal-mix material take-off (per 1 m³, ratio a:b:c, sum = a+b+c):
  dry volume = 1.54 m³
  cement volume = 1.54 × a/(a+b+c);  cement bags = cement_volume / 0.0347
  sand volume   = 1.54 × b/(a+b+c)
  aggregate vol = 1.54 × c/(a+b+c)

Worked example — M20 (1:1.5:3, sum = 5.5) per 1 m³:
  cement = 1.54 × 1/5.5 = 0.28 m³ → 0.28/0.0347 ≈ 8.06 bags ≈ 403 kg
  sand   = 1.54 × 1.5/5.5 = 0.42 m³ (≈ 0.42 × 1600 ≈ 672 kg)
  aggregate = 1.54 × 3/5.5 = 0.84 m³ (≈ 0.84 × 1550 ≈ 1302 kg)
  water (w/c 0.5) = 403 × 0.5 ≈ 200 litres.
Rule of thumb cement content: M15≈6.3 bags, M20≈8 bags, M25≈11 bags per m³
(design-mix figures vary with materials — treat as indicative).

Water–cement (w/c) ratio = mass of water / mass of cement. Lower w/c → higher
strength & durability. Typical 0.40–0.55; IS 456 caps max free w/c by exposure
(e.g. ~0.55 Moderate, ~0.45 Severe for RCC). Min cement content also set by
exposure (e.g. 300–360 kg/m³).

Other useful formulas:
• Volume of a slab = length × breadth × thickness (all in m).
• Quantity for a batch = wet volume needed × 1.54 then split by mix ratio.
• Compressive strength = failure load (N) / cross-section area (mm²).
• Slump (IS 1199) indicates workability: 25–50mm low, 75–100mm medium,
  100–150mm high (pumpable).

=== MATHEMATICS HELP ===
The assistant can do general arithmetic, unit conversions, percentages, ratios,
areas/volumes and the concrete-specific calculations above. Show the steps and
state the assumptions (densities, w/c, dry-volume factor) used.
`.trim();
