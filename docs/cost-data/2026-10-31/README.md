# Cost data import, 31 Oct 2026

Import through **Admin → Cost data CSV import**, in this order, **once**. The importer only inserts rows, so importing a file twice duplicates its rows.

1. `7_material_prices_2026-10-31.csv` → `material_price` (10 rows)
2. `8_boq_template_all_typologies.csv` → `boq_template` (726 rows, 39 combinations)
3. `9_boq_labour_all_typologies.csv` → `boq_labour` (204 rows)

## What the files contain

**Prices.** File 7 adds the six prices the three existing BoQs were missing, using the same item codes and units: `DPC-ROLL`, `DOOR-STD`, `WIN-STD`, `SANIT-SET`, `ELEC-PT` and `CRANE-DELIV`. It also adds prices for the new building systems: `BLOCK-HOL-6`, `EPS-WALL-M2`, `EPS-SLAB-M2` and `PRECAST-SHELL-M2`. Every row carries its source URL, date and a verbatim note. Rows from 2024 show in the calculator as older than 12 months.

**Bills of quantities.** Files 8 and 9 add basic-finish BoQs for every typology × system combination that had none. The existing three (container bedsitters and the 3BR masonry stone) are not repeated. Every quantity is an assumption marked "QS review needed":

- **Masonry stone and hollow block:** scaled from the existing 110 m² 3BR template by floor area.
- **EPS:** wall area derived from the same template.
- **Precast:** the shell is priced per m² of floor area.
- **Containers:** unit counts are `ceil(floor area ÷ unit area)`.
- **Floor areas assumed:** bedsitter 25, 1BR 40, 2BR 70, 3BR 110, 4BR 150, 5BR 200, 6BR 250 m².

**Expected totals.** `expected-totals-after-import.csv` lists the totals the calculator should show, at national fallback prices, once all three files are imported. `generate.py` regenerates the CSVs.

## Known limits

- Basic templates leave out plastering, ceilings, floor finishes, electrical cable and fittings, external works, approvals and contractor margin. The calculator says so. Published Nairobi figures for finished conventional houses are much higher; Money254 (Aug 2024) gives KES 40,000–50,000 per m².
- Material prices are mostly Nairobi or national. Other counties fall back to them, and each line is labelled.
- Standard and premium finishes still have no BoQs.
