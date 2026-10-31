"""Generate HALISIA cost-intel import CSVs (material prices, BoQ templates, BoQ labour).

Every quantity is an assumption derived from the existing 3BR masonry-stone
template (110 m2, already in the database) or from stated rules below, and is
labelled "assumption — QS review needed". Prices come only from dated public
sources quoted in each row's note.
"""
import csv
import math
from pathlib import Path

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
RETRIEVED = "2026-10-31"
QS = "assumption — QS review needed"

# ---------------------------------------------------------------- prices
FSD = "https://www.fsdkenya.org/wp-content/uploads/2025/04/Typology-2-Self-Contained-Materials-and-Labor-Schedule.pdf"
FSD_NOTE = "FSD Kenya social housing Typology 2 materials & labour schedule, REV.1 July 2024, QS Getso Consultants, Nairobi"
prices = [
    # The six items the existing three BoQs are missing (same item codes and units).
    dict(item_code="DPC-ROLL", name="DPC damp-proof course roll", unit="roll", category="waterproofing",
         price_kes=800, price_kes_low="", price_kes_high="", supplier="", county="Nairobi",
         source_type="published_guide", source_url=FSD, observed_date="2024-07-01", use_in_totals="yes",
         note=f"{FSD_NOTE}: item 2.8 DPC to superstructure walling, KES 800 per roll."),
    dict(item_code="DOOR-STD", name="Flush door, standard (frame priced separately)", unit="unit", category="joinery",
         price_kes=6500, price_kes_low=6500, price_kes_high=12285, supplier="", county="Nairobi",
         source_type="published_guide", source_url=FSD, observed_date="2024-07-01", use_in_totals="yes",
         note=f"{FSD_NOTE}: flush door 800x2050 KES 6,500; supply of door 900x2100 KES 12,285. Door frame 100x50 listed separately at KES 100/ft (about 16 ft per door), not included here."),
    dict(item_code="WIN-STD", name="Window, standard, per m2 of opening", unit="m2", category="joinery",
         price_kes=5500, price_kes_low=5500, price_kes_high=7440, supplier="", county="Nairobi",
         source_type="published_guide", source_url=FSD, observed_date="2024-07-01", use_in_totals="yes",
         note=f"{FSD_NOTE}: 900x1800 window KES 8,910 and 600x900 KES 2,970, both KES 5,500 per m2 of opening. 5 mm clear glass listed separately at KES 180/sq ft (about KES 1,940/m2); the high figure includes it."),
    dict(item_code="SANIT-SET", name="Sanitary set: WC, wash hand basin with taps, shower", unit="set", category="plumbing",
         price_kes=21500, price_kes_low="", price_kes_high="", supplier="", county="Nairobi",
         source_type="published_guide", source_url=FSD, observed_date="2024-07-01", use_in_totals="yes",
         note=f"{FSD_NOTE}: water closet KES 13,000 + wash hand basin with taps KES 4,000 + shower KES 4,500 (sum of the three listed rates)."),
    dict(item_code="ELEC-PT", name="Electrical point installation (labour)", unit="point", category="electrical",
         price_kes=500, price_kes_low=500, price_kes_high=1000, supplier="", county="Nairobi",
         source_type="published_guide", source_url="https://jengahub.co.ke/blog/contractor-rates-kenya", observed_date="2026-03-01", use_in_totals="yes",
         note="JengaHub contractor rates, updated March 2026: electricians often charge per point, KSh 500–1,000/point. Labour only: cable, switches, sockets and consumer unit are not included."),
    dict(item_code="CRANE-DELIV", name="Crane offload at site", unit="trip", category="logistics",
         price_kes=8000, price_kes_low=8000, price_kes_high=28000, supplier="", county="Nairobi",
         source_type="published_guide", source_url="https://www.beyondforest.org/post/best-crane-rental-services-in-nairobi-roysambu-thika-road-beyond", observed_date="2025-09-12", use_in_totals="yes",
         note="BeyondForest crane rental guide (Aug 2025, updated 12 Sep 2025): mobile crane KSh 8,000 per service; 25-ton mobile crane about KSh 28,000 per day. Road transport of the container is not included."),
    # New building systems.
    dict(item_code="BLOCK-HOL-6", name="Hollow concrete block, 6 inch", unit="piece", category="walling",
         price_kes=50, price_kes_low=50, price_kes_high=80, supplier="", county="",
         source_type="published_guide", source_url="https://acl.co.ke/guide-concrete-blocks-kenya/", observed_date="2025-11-15", use_in_totals="yes",
         note="ACL concrete blocks guide (15 Nov 2025): 'KSh 50-80 for standard 6-inch hollow blocks'; 9-inch hollow KSh 70-100. National range; about 10 blocks per m2 of wall."),
    dict(item_code="EPS-WALL-M2", name="EPS wall panel, per m2 of wall", unit="m2", category="eps",
         price_kes=1800, price_kes_low="", price_kes_high="", supplier="National Housing Corporation (Mavoko factory)", county="Machakos",
         source_type="published_guide", source_url="https://www.constructionkenya.com/3479/kenya-eps-technology/", observed_date="2025-06-29", use_in_totals="yes",
         note="Construction Kenya (29 Jun 2025) quoting NHC: 'a wall using EPS panels for Sh1,800 per square metre'. Shotcrete/plaster to both faces costed separately (cement, sand)."),
    dict(item_code="EPS-SLAB-M2", name="EPS slab panel, per m2", unit="m2", category="eps",
         price_kes=2350, price_kes_low="", price_kes_high="", supplier="National Housing Corporation (Mavoko factory)", county="Machakos",
         source_type="published_guide", source_url="https://www.constructionkenya.com/3479/kenya-eps-technology/", observed_date="2025-06-29", use_in_totals="yes",
         note="Construction Kenya (29 Jun 2025) quoting NHC: 'a slab for Sh2,350 per square metre'. Not used in single-storey BoQs."),
    dict(item_code="PRECAST-SHELL-M2", name="Precast bungalow shell incl. labour, per m2 floor area", unit="m2", category="precast",
         price_kes=12400, price_kes_low=12400, price_kes_high=20000, supplier="Precast manufacturer (Amos Kibaru, per article)", county="",
         source_type="published_guide", source_url="https://www.money254.co.ke/post/all-you-need-to-know-about-precast-construction-in-kenya-info", observed_date="2024-08-05", use_in_totals="yes",
         note="Money254 (5 Aug 2024): '121 square-metre precast bungalow shell, including labour, costs approximately Ksh1.5 million' (KES 12,400/m2) and the article's own 'roughly Ksh20,000 per square metre'. Interior finishes about Ksh1 million extra. What the shell includes (foundation, roof) is not itemised: QS review."),
]

# ---------------------------------------------------------------- BoQ rules
AREA = {"bedsitter": 25, "1br": 40, "2br": 70, "3br": 110, "4br": 150, "5br": 200, "6br": 250}
BATHS = {"bedsitter": 1, "1br": 1, "2br": 1, "3br": 2, "4br": 3, "5br": 3, "6br": 4}
DOORS = {"bedsitter": 2, "1br": 3, "2br": 4, "3br": 6, "4br": 8, "5br": 9, "6br": 11}
CONTAINER_M2 = {"container_20ft": 14.6, "container_40ft": 29.7}
CONTAINER_ITEM = {"container_20ft": "CONT-20-FAB", "container_40ft": "CONT-40-FAB"}
EXISTING = {("bedsitter", "container_20ft"), ("bedsitter", "container_40ft"), ("3br", "masonry_stone")}

# Bulk lines of the existing 3BR masonry-stone template (110 m2), scaled by floor area.
BASE_3BR = [
    ("STONE-69-D", 2700), ("CEM-325", 160), ("CEM-425", 40), ("BALLAST-LORRY", 2), ("SAND-RIVER-LORRY", 3),
    ("REB-D12", 60), ("REB-D10", 30), ("REB-D8", 40), ("BRC-MESH", 10), ("WIRE-BIND", 1), ("HOOP-IRON", 1),
    ("DPC-ROLL", 2), ("TIM-CYP-4X2", 1200), ("TIM-CYP-3X2", 600), ("TIM-CYP-2X2", 1500), ("MAB-G30-BOX", 150),
    ("MAB-RIDGE", 8), ("NAIL-50KG", 1), ("PAINT-UC-20L", 2), ("PAINT-SILK-20L", 4), ("WPF-LW-20L", 1),
    ("PPR-20-4M", 25), ("PVC-DRAIN-M", 40),
]
BASE_LABOUR_3BR = {"mason": 60, "helper": 120, "carpenter": 20, "plumber": 8, "electrician": 8, "painter": 10, "foreman": 60}
WALL_M2_PER_STONE = 0.1  # ~10 stones (or 9x9/6-inch blocks) per m2 of wall


def q(x: float) -> int:
    return max(1, round(x))


def scaled_basis(r: float) -> str:
    return f"3BR 110 m2 masonry template scaled x{r:.2f} by floor area ({QS})"


def fit_out(typ: str):
    """Doors, windows, sanitary, electrical, water storage: counts by typology."""
    a = AREA[typ]
    return [
        ("DOOR-STD", DOORS[typ], f"{DOORS[typ]} doors for a {typ} ({QS})"),
        ("WIN-STD", q(0.11 * a), f"windows about 11% of floor area, as in the 3BR template ({QS})"),
        ("SANIT-SET", BATHS[typ], f"{BATHS[typ]} bathroom(s) ({QS})"),
        ("ELEC-PT", q(0.23 * a), f"about 0.23 points per m2, as in the 3BR template ({QS})"),
        ("TANK-5000" if a >= 70 else "TANK-1000", 1, f"water storage ({QS})"),
    ]


boq, labour = [], []
for typ, area in AREA.items():
    r = area / 110
    for structure in ["container_20ft", "container_40ft", "masonry_stone", "masonry_block", "precast", "eps"]:
        if (typ, structure) in EXISTING:
            continue
        rows = []
        if structure in CONTAINER_M2:
            unit = CONTAINER_M2[structure]
            n = math.ceil(area / unit)
            floor = round(n * unit, 1)
            rows += [
                (CONTAINER_ITEM[structure], n, f"{n} fabricated units for about {area} m2 ({QS})"),
                ("CEM-325", 15 * n, f"pad/strip footings, 15 bags per unit as in the bedsitter template ({QS})"),
                ("BALLAST-TON", 4 * n, f"4 t per unit as in the bedsitter template ({QS})"),
                ("CRANE-DELIV", math.ceil(n / 3), f"one crane visit per 3 units ({QS})"),
                ("PPR-20-4M", 5 * BATHS[typ] + n, f"supply pipework ({QS})"),
                ("PVC-DRAIN-M", 10 * BATHS[typ] + 2 * n, f"drainage ({QS})"),
                ("SANIT-SET", BATHS[typ], f"{BATHS[typ]} bathroom(s) ({QS})"),
                ("TANK-5000" if area >= 70 else "TANK-1000", 1, f"water storage ({QS})"),
            ]
            lab = {"mason": 2 * n + 1, "helper": 4 * n + 2, "plumber": 2 * BATHS[typ]}
        elif structure in ("masonry_stone", "masonry_block"):
            floor = area
            for code, base in BASE_3BR:
                if structure == "masonry_block" and code == "STONE-69-D":
                    rows.append(("BLOCK-HOL-6", q(base * r), f"6-inch hollow blocks in place of 6x9 stones, same count per m2 of wall; {scaled_basis(r)}"))
                else:
                    rows.append((code, q(base * r), scaled_basis(r)))
            rows += fit_out(typ)
            lab = {t: q(d * r) for t, d in BASE_LABOUR_3BR.items()}
        elif structure == "eps":
            floor = area
            wall_m2 = q(2700 * r * WALL_M2_PER_STONE)
            for code, base in BASE_3BR:
                if code == "STONE-69-D":
                    rows.append(("EPS-WALL-M2", wall_m2, f"wall area from the 3BR template's 2,700 stones at ~10 per m2, scaled x{r:.2f} ({QS})"))
                elif code in ("CEM-325", "SAND-RIVER-LORRY"):
                    rows.append((code, q(base * r), f"slab plus shotcrete/plaster to both panel faces; {scaled_basis(r)}"))
                elif code in ("REB-D12", "REB-D10", "REB-D8", "HOOP-IRON"):
                    rows.append((code, q(base * r * 0.4), f"panels carry their own mesh; 40% of masonry steel kept for foundation and ring beam ({QS})"))
                else:
                    rows.append((code, q(base * r), scaled_basis(r)))
            rows += fit_out(typ)
            lab = {"mason": q(60 * r * 0.5), "helper": q(120 * r * 0.6), "carpenter": q(20 * r), "plumber": q(8 * r),
                   "electrician": q(8 * r), "painter": q(10 * r), "foreman": q(60 * r * 0.5)}
        else:  # precast
            floor = area
            rows += [
                ("PRECAST-SHELL-M2", area, f"shell price per m2 of floor area, labour included per source ({QS})"),
                ("PAINT-UC-20L", q(2 * r), scaled_basis(r)),
                ("PAINT-SILK-20L", q(4 * r), scaled_basis(r)),
                ("PPR-20-4M", q(25 * r), scaled_basis(r)),
                ("PVC-DRAIN-M", q(40 * r), scaled_basis(r)),
            ]
            rows += fit_out(typ)
            lab = {"helper": q(20 * r), "plumber": q(8 * r), "electrician": q(8 * r), "painter": q(10 * r)}
        for code, qty, basis in rows:
            boq.append(dict(typology=typ, structure=structure, finish="basic", floor_area_m2=floor,
                            item_code=code, quantity=qty, quantity_basis=basis))
        for trade, days in lab.items():
            labour.append(dict(typology=typ, structure=structure, finish="basic", trade=trade, days=days))


def write(name, rows):
    path = OUT / name
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


write("7_material_prices_2026-10-31.csv", prices)
write("8_boq_template_all_typologies.csv", boq)
write("9_boq_labour_all_typologies.csv", labour)
combos = sorted({(r["typology"], r["structure"]) for r in boq})
print("new combinations:", len(combos))
