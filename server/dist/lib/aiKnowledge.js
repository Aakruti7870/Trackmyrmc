// Public domain knowledge for the AI Help Agent.
//
// A curated, NON-private reference the assistant may use freely (together with
// the model's own expertise) to answer general questions about concrete, RMC,
// mix design, IS codes, units, measurements, mathematics, and this application.
// Contains ZERO account/plant/customer data — that is gathered separately by
// the scoped retrieval layer and stays strictly tenant-isolated.
export const RMC_KNOWLEDGE = `
=== ABOUT THIS APPLICATION (CONCRETE KING / TrackMyRMC) ===
TrackMyRMC (brand: CONCRETE KING) is a ready-mix concrete (RMC) marketplace and
plant-management platform for the Indian construction industry. Two audiences:

CUSTOMERS (role: client):
• Discover nearby approved RMC plants on the map, compare grades and pricing.
• Place concrete orders (grade, quantity in m³, delivery date, site address).
• Track every delivery in real time via challan (delivery note) status.
• View full order history, outstanding balance, and challan PDFs.
• Reorder from a previous order with one tap.
• Request a new plant be added to the network.
• Chat with the plant, raise support tickets.

PLANT STAFF & OWNERS:
• Dashboard — live KPIs (m³ today, pending/active orders, vehicle utilisation),
  recent challans, and active order list.
• Orders — create, edit, confirm, cancel orders; track dispatch progress per order.
• Dispatch / Challans — generate challans from active orders for each transit-mixer
  trip; mark as delivered; attach proof photos; download PDF.
• Clients — add/edit client companies; contact details, GST, credit limit, outstanding.
• Vehicles — fleet of transit mixers; driver assignment, status (available/on-trip).
• Batch Report — log each production batch: grade, quantity, operator, time, slump.
• Mix Design — store concrete proportions (cement/water/sand/aggregate) by grade;
  visualise bar charts; W/C ratio.
• Reports — time-range analytics, daily volume bar chart, grade breakdown, client volumes.
• Users — invite/manage staff accounts with role-based access.

How to place an order (customer): Open "Nearby Plants" → pick a plant → tap
"Place Order" → select grade, quantity, delivery date → confirm → track via Orders.
How to dispatch (staff): Open Orders → find active order → tap "Generate Challan"
→ assign vehicle & driver → save → mark "Delivered" after trip.

=== CONCRETE BASICS ===
Concrete = Portland cement + fine aggregate (sand) + coarse aggregate (stone/gravel)
+ water, optionally with chemical/mineral admixtures.
"Grade" = characteristic compressive strength at 28 days on a 150 mm cube, e.g.
M25 = 25 N/mm² (MPa). "M" = Mix. "RMC" = Ready-Mix Concrete — batched centrally
and delivered by transit mixers (drum trucks that keep concrete agitated).

Fresh concrete quality checks:
• Slump (IS 1199): workability. Measure with slump cone; low 25–50 mm, medium
  75–100 mm, high/pumpable 100–175 mm.
• Flow table test (IS 9103): for self-compacting concrete (SCC).
• Temperature: max 30–35 °C at delivery point preferred; hot-weather limits in IS 7861.
• Air content: for freeze-thaw environments.

Hardened concrete tests (IS 516):
• Cube crush (150×150×150 mm) at 7 days (~65% of 28-day) and 28 days.
• Core test (IS 516 Part 4) for existing structures.
• NDT: rebound hammer (IS 13311-2), ultrasonic pulse velocity (IS 13311-1).

=== CONCRETE GRADES & NOMINAL MIX RATIOS (cement : fine agg : coarse agg, by volume) ===
Per IS 456:2000, nominal mixes are permitted up to M20; M25 and above must use
design mixes (IS 10262). The proportions below are indicative starting points.
• M5   — 1:5:10  (lean, PCC fill, under-slabs — rarely used in RMC)
• M7.5 — 1:4:8   (light PCC)
• M10  — 1:3:6   (PCC, levelling course, foundations in dry soil)
• M15  — 1:2:4   (PCC, flooring, pathways)
• M20  — 1:1.5:3 (RCC, columns, slabs — most common residential grade)
• M25  — 1:1:2   (RCC slabs, beams, bridges — design mix recommended)
• M30  — design mix only (water-retaining structures, bridges, piers)
• M35, M40, M45, M50, M55 — design mix only; higher admixture dosages, controlled w/c.
• M60, M70, M80 — high-strength; silica fume, superplasticisers, very low w/c (≤0.35).

IS 456:2000 Strength Classes:
• Ordinary concrete: M10, M15, M20
• Standard concrete: M25, M30, M35, M40, M45, M50, M55
• High-strength: M60, M65, M70, M75, M80

IS 456 Exposure classification (for RCC):
Mild        — M20, min cement 300 kg/m³, max w/c 0.55, min cover 20 mm
Moderate    — M25, min cement 300 kg/m³, max w/c 0.50, min cover 30 mm
Severe      — M30, min cement 320 kg/m³, max w/c 0.45, min cover 40 mm
Very Severe — M35, min cement 340 kg/m³, max w/c 0.45, min cover 45 mm
Extreme     — M40, min cement 360 kg/m³, max w/c 0.40, min cover 50 mm

=== KEY IS CODES FOR RMC & CONCRETE ===
• IS 456:2000  — Plain & Reinforced Concrete — Code of Practice (primary reference for
  design, durability, grades, cover, reinforcement, quality control).
• IS 10262:2019 — Concrete Mix Proportioning Guidelines (design-mix procedure,
  step-by-step from target strength to final proportions).
• IS 383:2016  — Coarse & Fine Aggregates for Concrete — Specification
  (grading zones I–IV for sand; 40/20/10/4.75 mm nominal size for coarse agg).
• IS 269:2015  — OPC (Ordinary Portland Cement) Specification.
  Sub-grades: OPC 33 (IS 269), OPC 43 (IS 8112), OPC 53 (IS 12269).
• IS 1489     — Portland Pozzolana Cement (PPC) — Part 1 (flyash), Part 2 (calcined clay).
• IS 455      — Portland Slag Cement (PSC) — ground granulated blast-furnace slag (GGBS).
• IS 1199:2018 — Sampling & Testing of Fresh Concrete (slump, compaction factor,
  flow table, Vebe time, air content).
• IS 516:2021  — Methods of Test for Strength of Concrete.
• IS 516 Part 5 Sec 1 — Self-Compacting Concrete testing.
• IS 4926:2003 — Ready-Mixed Concrete — Specification (plant, production, delivery,
  batch ticket, acceptance criteria, transit mixer requirements, batching tolerances).
• IS 9103:1999 — Admixtures for Concrete (plasticisers, superplasticisers, retarders,
  accelerators, air-entraining agents).
• IS 7861      — Hot Weather (Part 1) and Cold Weather (Part 2) concreting.
• IS 13311     — NDT: Part 1 ultrasonic pulse velocity, Part 2 rebound hammer.
• IS 2386      — Aggregate testing (Part 1 sieve analysis, Part 3 specific gravity,
  Part 4 mechanical properties, Part 5 soundness).
• IS 3812      — Specification for Pulverised Fuel Ash (Fly Ash) for use in concrete.
• IS 15388:2003 — Silica Fume — Specification.
• IS 17452     — Ground Granulated Blast Furnace Slag (GGBS).
• SP 23        — Handbook on Concrete Mixes (BIS supplement, useful worked examples).

BIS Quality Certification: RMC plants follow IS 4926 and may obtain BIS certification
(CM/L licence) which is increasingly required for government and infrastructure projects.

=== CEMENT TYPES & CHARACTERISTICS ===
OPC 33 — older grade, rarely used for structural concrete now.
OPC 43 — intermediate, used for M20–M30, sets moderately fast.
OPC 53 — high-strength, used for M30+, rapid early strength.
PPC     — flyash blended (15–35%); slower gain, lower heat of hydration, better
  durability; popular for mass concrete, hot weather. Usually Grade-equivalent to OPC 43.
PSC     — GGBS blended (25–70%); excellent sulphate resistance, marine structures.
Silica fume (micro-silica) — pozzolanic addition for M60+; very fine (1/100th cement),
  dramatically reduces permeability.

=== ADMIXTURES (IS 9103) ===
Plasticisers (WRAs) — reduce water 5–10%, improve workability. Dosage 0.1–0.4% of cement.
Superplasticisers (HRWRAs) — reduce water 12–30%; polycarboxylate ether (PCE) or
  sulfonated naphthalene/melamine. Dosage 0.3–2% of cement. Essential for M40+.
Retarders — extend setting time (hot weather, long hauls); dose carefully.
Accelerators — faster set/strength (cold weather, precast); beware of chlorides for RCC.
Air-entraining agents — freeze-thaw protection; not common in tropical India.
Viscosity modifiers — for SCC (self-compacting concrete) to prevent segregation.

=== UNITS & CONVERSIONS ===
Volume:
  1 m³ = 1000 litres = 35.3147 cu ft (cft)   |   1 cft = 0.0283168 m³
  1 m³ = 61,023.7 in³                           |   1 litre = 0.001 m³
Mass:
  1 tonne (metric ton) = 1000 kg = 1 Mg
  1 kg = 2.2046 lb                               |   1 bag cement = 50 kg
Length:
  1 m = 3.2808 ft = 39.3701 in   |   1 mm = 0.03937 in
Density / bulk:
  Cement loose bulk density ≈ 1440 kg/m³; so 1 bag = 50/1440 = 0.03472 m³ ≈ 34.7 L
  Fresh normal-weight concrete ≈ 2400 kg/m³ (2350–2450 for typical mixes)
  Sand (dry) bulk density ≈ 1500–1650 kg/m³
  Stone aggregate bulk density ≈ 1450–1600 kg/m³
Strength:
  1 N/mm² = 1 MPa = 10.197 kgf/cm²
  1 ksi (kip/in²) = 6.895 MPa
Transit mixer capacity:
  Common sizes: 6 m³, 7 m³, 8 m³ (maximum per trip per IS 4926 = 7.5 m³ or drum rated capacity).

=== CORE CONCRETE CALCULATIONS ===
──────────────────────────────────────────────────────────────────────────
1. DRY VOLUME FACTOR
   Wet concrete shrinks when mixed; dry ingredients fill more volume.
   Dry volume factor = 1.54 (use 1.52–1.57; 1.54 is the standard default).
   Always multiply the required WET m³ by 1.54 before splitting by ratio.

2. NOMINAL-MIX TAKE-OFF (per 1 m³ wet concrete, ratio a:b:c, sum S = a+b+c):
   dry_volume = 1.54 m³
   cement_volume  = 1.54 × a/S   →   bags = cement_volume / 0.03472
   sand_volume    = 1.54 × b/S   (m³)
   aggregate_vol  = 1.54 × c/S   (m³)
   water (litres) = cement_mass_kg × w/c_ratio

3. WORKED EXAMPLES:

   M15 (1:2:4, S=7) per 1 m³:
     cement = 1.54 × 1/7 = 0.22 m³ → bags = 0.22/0.03472 ≈ 6.34 bags ≈ 317 kg
     sand   = 1.54 × 2/7 = 0.44 m³
     aggregate = 1.54 × 4/7 = 0.88 m³
     water (w/c 0.55) = 317 × 0.55 ≈ 174 litres

   M20 (1:1.5:3, S=5.5) per 1 m³:
     cement = 1.54 × 1/5.5 = 0.28 m³ → 0.28/0.03472 ≈ 8.07 bags ≈ 403 kg
     sand   = 1.54 × 1.5/5.5 = 0.42 m³ (≈ 672 kg at 1600 kg/m³)
     aggregate = 1.54 × 3/5.5 = 0.84 m³ (≈ 1302 kg at 1550 kg/m³)
     water (w/c 0.50) = 403 × 0.50 ≈ 202 litres

   M25 (1:1:2, S=4) per 1 m³:
     cement = 1.54 × 1/4 = 0.385 m³ → 0.385/0.03472 ≈ 11.09 bags ≈ 554 kg
     sand   = 1.54 × 1/4 = 0.385 m³
     aggregate = 1.54 × 2/4 = 0.77 m³
     water (w/c 0.45) = 554 × 0.45 ≈ 249 litres
     [Note: M25 should use a design mix in practice; the above is the nominal guide.]

4. RULE-OF-THUMB CEMENT BAGS per m³ (nominal mix, indicative):
   M10 ≈ 4.4 bags | M15 ≈ 6.3 bags | M20 ≈ 8 bags | M25 ≈ 11 bags
   Design mixes can differ significantly with admixtures.

5. WATER–CEMENT (w/c) RATIO = mass of water ÷ mass of cement.
   Lower w/c → higher strength AND better durability (less permeable).
   Typical range: 0.35–0.55. IS 456 sets maximum free w/c by exposure class.

6. TARGET STRENGTH (IS 10262 design mix):
   f'ck = fck + 1.65 × s
   where fck = characteristic strength (grade), s = standard deviation
   (IS 10262 Table 1: 4 MPa for M25 unless site data available).
   So M25: target = 25 + 1.65 × 4 = 31.6 MPa ≈ 31.6 N/mm².

7. CONCRETE VOLUME CALCULATIONS:
   Slab: volume = L × B × D (metres → m³)
   Column: volume = (π/4) × d² × H  or  (a × b) × H  for rectangular
   Beam: volume = (width × depth × length)
   Add 2–5% wastage for site conditions and formwork imperfections.

8. SLUMP LOSS IN TRANSIT:
   Concrete loses workability during agitation. IS 4926 allows max 90 min from
   leaving plant to discharge (or 300 drum-revolutions, whichever first).
   Superplasticiser dosage is often tuned to deliver target slump at the pour point.

9. CURING:
   Minimum curing period (IS 456): OPC/PPC 7 days (moderate), Blended cements 10 days.
   Methods: water curing (ponding, spraying), curing compounds, wet hessian.
   Temperature must stay above 5 °C during curing.

──────────────────────────────────────────────────────────────────────────

=== DESIGN MIX PROCEDURE (IS 10262:2019, simplified) ===
1. Stipulate target strength: f'ck = fck + 1.65σ
2. Select w/c ratio from Table 2 of IS 10262 or IS 456 durability requirements.
3. Select water content from Table 4 (based on max aggregate size, slump needed).
4. Calculate cement content = water / w/c.
5. Check against IS 456 minimum cement for exposure class; use higher.
6. Calculate aggregate volumes using absolute volume method (Vc+Vw+Vca+Vfa+Vadm = 1 m³).
7. Estimate fine-to-total aggregate ratio from zone and grading.
8. Trial mixes: check workability, density, cube strength → adjust.
9. Establish approved mix proportion for production (report to IS 4926 batch ticket).

=== FRESH CONCRETE ACCEPTANCE (IS 4926) ===
• Batch ticket must accompany every truck: plant ID, mix ID, grade, W/C, quantity,
  truck no., time of batching, destination.
• Slump test at site within 15 min of truck arrival.
• Cube samples: min 1 set (3 cubes) per 50 m³ or per structure/pour event.
• Reject if: slump outside tolerance, grade not to spec, elapsed time > 90 min,
  temperature > 35 °C, water added at site without engineer approval.

=== MATHEMATICS HELP ===
The assistant can perform:
• Arithmetic (add, subtract, multiply, divide, powers, roots)
• Percentages, ratios, proportions
• Area (rectangle, circle, triangle) and volume calculations
• Unit conversions (m³↔cft, kg↔bags, MPa↔kgf/cm², etc.)
• Mix-design calculations with full working shown
• Strength calculations (load/area)
Always state assumptions (densities, w/c, dry-volume factor, wastage) in the answer.
`.trim();
