#!/usr/bin/env python3
"""Generate an advanced, connected RMC plant daily-operations workbook.

Env overrides (used for fast validation builds):
  RMC_TXN_ROWS     rows per transaction sheet   (default 6000)
  RMC_MASTER_ROWS  rows per setup/master sheet  (default 500)
  RMC_OUT          output path
"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.formatting.rule import DataBarRule, CellIsRule, FormulaRule

TXN_ROWS = int(os.environ.get("RMC_TXN_ROWS", "6000"))
MASTER_ROWS = int(os.environ.get("RMC_MASTER_ROWS", "500"))
OUT = os.environ.get("RMC_OUT", "excel-deliverable/RMC-Plant-Daily-Workbook.xlsx")

# ---------- palette (CONCRETE KING theme) ----------
NAVY = "08111F"; NAVY2 = "12203A"; GOLD = "F7C948"; GREEN = "22C55E"
BLUE = "38BDF8"; RED = "EF4444"; AMBER = "F59E0B"; WHITE = "FFFFFF"
INPUT_BG = "FFFDF3"; CALC_BG = "EEF6FF"

DATA_START = 5
HDR_ROW = 4
def end_row(rows): return DATA_START + rows - 1
MEND = end_row(MASTER_ROWS)   # master end
TEND = end_row(TXN_ROWS)      # transaction end

# shared style objects (reused -> small file, fast write)
thin = Side(style="thin", color="C7D0E0")
B = Border(left=thin, right=thin, top=thin, bottom=thin)
F_INPUT = Font(color=NAVY, size=11)
F_CALC = Font(color="1F3D6B", size=11)
FILL_INPUT = PatternFill("solid", fgColor=INPUT_BG)
FILL_CALC = PatternFill("solid", fgColor=CALC_BG)
FILL_NAVY = PatternFill("solid", fgColor=NAVY)
FILL_NAVY2 = PatternFill("solid", fgColor=NAVY2)
FILL_GOLD = PatternFill("solid", fgColor=GOLD)
H_FONT = Font(bold=True, color=WHITE, size=11)
TITLE_FONT = Font(bold=True, color=GOLD, size=20)
SUB_FONT = Font(color="9AA7BD", size=10, italic=True)
LABEL_FONT = Font(bold=True, color=NAVY, size=11)

wb = Workbook()


def style_header(ws, row, ncols, fill=FILL_NAVY):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = H_FONT; cell.fill = fill; cell.border = B
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


def title_block(ws, title, subtitle, span):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=span)
    t = ws.cell(row=1, column=1, value=title); t.font = TITLE_FONT
    t.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    s = ws.cell(row=2, column=1, value=subtitle); s.font = SUB_FONT
    s.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    for r in (1, 2):
        for c in range(1, span + 1):
            ws.cell(row=r, column=c).fill = FILL_NAVY
    ws.row_dimensions[1].height = 34; ws.row_dimensions[2].height = 18


def set_widths(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def add_list_validation(ws, named_range, target_range):
    dv = DataValidation(type="list", formula1=f"={named_range}", allow_blank=True)
    dv.error = "Pick a value from the list."; dv.prompt = "Choose from the dropdown."
    ws.add_data_validation(dv); dv.add(target_range)


def defname(name, ref):
    wb.defined_names.add(DefinedName(name, attr_text=ref))


def build_sheet(name, title, subtitle, columns, rows, examples=None, accent=FILL_NAVY):
    """columns: list of {h, w, type, formula(optional with {r})}"""
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    ncols = len(columns)
    set_widths(ws, [c["w"] for c in columns])
    title_block(ws, title, subtitle, ncols)
    for i, c in enumerate(columns, start=1):
        ws.cell(row=HDR_ROW, column=i, value=c["h"])
    style_header(ws, HDR_ROW, ncols, fill=accent)
    ws.freeze_panes = f"A{DATA_START}"
    if examples:
        for ri, row in enumerate(examples, start=DATA_START):
            for ci, val in enumerate(row, start=1):
                if val is not None:
                    ws.cell(row=ri, column=ci, value=val)
    end = end_row(rows)
    fmtmap = {"date": "dd-mmm-yyyy", "num": "#,##0.00", "money": '\u20b9#,##0.00',
              "int": "#,##0", "pct": "0.00"}
    for i, c in enumerate(columns, start=1):
        L = get_column_letter(i)
        t = c.get("type", "input")
        is_calc = t == "calc"
        fill = FILL_CALC if is_calc else FILL_INPUT
        font = F_CALC if is_calc else F_INPUT
        fmt = fmtmap.get(c.get("numfmt", t))
        for rr in range(DATA_START, end + 1):
            cell = ws.cell(row=rr, column=i)
            cell.fill = fill; cell.font = font; cell.border = B
            if fmt:
                cell.number_format = fmt
        if c.get("formula"):
            f = c["formula"]
            for rr in range(DATA_START, end + 1):
                ws.cell(row=rr, column=i, value=f.format(r=rr))
    return ws


# table-array refs (whole logical block, master-sized)
def msheet(n): return f"'{n}'"
MIX_TBL = f"'Setup - Mix Design'!$A$5:$I${MEND}"
VEH_TBL = f"'Setup - Vehicles'!$A$5:$D${MEND}"
MAT_TBL = f"'Setup - Materials'!$A$5:$E${MEND}"

# ============================================================
# INSTRUCTIONS
# ============================================================
ws = wb.active; ws.title = "Instructions"; ws.sheet_view.showGridLines = False
set_widths(ws, [3, 34, 74])
title_block(ws, "CONCRETE KING  \u2022  RMC Plant Daily Workbook",
            "One connected, automated workbook for ready-mix concrete plant operations", 3)
intro = [
    ("", ""),
    ("HOW IT WORKS", ""),
    ("1. Fill the Setup tabs once", "Enter Clients, Mix Designs (grades), Vehicles, Drivers and Materials. Everything else pulls from these via dropdowns."),
    ("2. Record daily work", "Use Orders, Dispatch, Batch Production, Material Receipt, Fuel Log, Payments and Cube Tests every day. Pick values from dropdowns - no retyping."),
    ("3. Numbers self-calculate", "Rates, amounts, mix consumption, stock, outstanding and test results auto-fill. Less entry, more connectivity."),
    ("4. Read Dashboard & Monthly Summary", "Live KPIs, charts and month-wise totals across the whole plant."),
    ("", ""),
    ("CAPACITY", ""),
    (f"{TXN_ROWS:,} rows per daily sheet", f"Each transaction sheet holds {TXN_ROWS:,} entries - well over 700/month for a full year. To add even more, click the last filled cell and drag the small handle down."),
    ("", ""),
    ("COLOUR GUIDE", ""),
    ("Gold cells  =  you type here", "Your entry cells (clients, quantities, dates...)."),
    ("Blue cells  =  auto-calculated", "Do NOT type in blue cells - they fill automatically."),
    ("Red highlight  =  attention", "Low stock (below reorder level) and Failed cube tests turn red automatically."),
    ("", ""),
    ("WHAT'S INSIDE", ""),
    ("Dashboard", "Live KPIs + charts: production, dispatch, sales, collection, outstanding, stock levels."),
    ("Monthly Summary", "Auto month-wise production, dispatch, sales, collection & purchases for the year you choose."),
    ("Setup - Clients / Mix Design / Vehicles / Drivers / Materials", "Master data. Mix Design also sets material per m3 + selling rate; Materials sets opening stock, rate & reorder level."),
    ("Orders", "Order book - rate, value, delivered qty, balance & status auto-calculate."),
    ("Dispatch (Challan)", "Delivery challans - driver, rate & amount auto-fill; delivered qty rolls up to Orders."),
    ("Batch Production", "Enter grade + m3; cement/sand/aggregate/water/admixture consumed auto-compute."),
    ("Material Receipt", "Raw material purchases - feeds stock."),
    ("Fuel Log", "Diesel issued per vehicle."),
    ("Payments", "Customer collections - drives outstanding on the Dashboard."),
    ("Cube Test Register", "7 / 28-day cube strength with automatic Pass/Fail vs grade requirement."),
    ("Stock Register", "Opening + Received - Consumed = Closing, per material, with low-stock alerts."),
]
r = HDR_ROW
for a, b in intro:
    ca = ws.cell(row=r, column=2, value=a); cb = ws.cell(row=r, column=3, value=b)
    if a and not b and a.isupper():
        ca.font = Font(bold=True, color=GOLD, size=12)
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        ca.fill = FILL_NAVY2; cb.fill = FILL_NAVY2; ws.row_dimensions[r].height = 22
    else:
        ca.font = LABEL_FONT; cb.font = Font(color="33425C", size=10)
        cb.alignment = Alignment(wrap_text=True, vertical="top")
        ca.alignment = Alignment(vertical="top", wrap_text=True)
        if a: ws.row_dimensions[r].height = 30
    r += 1

# ============================================================
# SETUP SHEETS
# ============================================================
build_sheet("Setup - Clients", "Setup  -  Clients",
            "Customer master. Add each client once; orders, challans & payments pick from here.",
            [{"h": "Client / Company Name", "w": 30}, {"h": "Contact Person", "w": 22},
             {"h": "Phone", "w": 16}, {"h": "GST No.", "w": 20}, {"h": "Billing Address", "w": 40}],
            MASTER_ROWS, None, FILL_NAVY2)
defname("ClientList", f"'Setup - Clients'!$A$5:$A${MEND}")

mix_cols = [
    {"h": "Grade", "w": 12}, {"h": "Cement (kg/m3)", "w": 14, "type": "num"},
    {"h": "Sand (kg/m3)", "w": 13, "type": "num"}, {"h": "Aggregate 20mm (kg/m3)", "w": 16, "type": "num"},
    {"h": "Aggregate 10mm (kg/m3)", "w": 16, "type": "num"}, {"h": "Water (ltr/m3)", "w": 12, "type": "num"},
    {"h": "Admixture (kg/m3)", "w": 14, "type": "num"},
    {"h": "W/C Ratio", "w": 11, "type": "calc", "formula": "=IF(B{r}=\"\",\"\",ROUND(F{r}/B{r},2))"},
    {"h": "Selling Rate (\u20b9/m3)", "w": 15, "type": "money"},
]
mix_ex = [
    ("M15", 320, 750, 700, 480, 160, 1.6, None, 4200), ("M20", 360, 720, 720, 480, 170, 2.0, None, 4600),
    ("M25", 400, 690, 730, 490, 175, 2.4, None, 5000), ("M30", 440, 660, 740, 500, 180, 3.1, None, 5400),
    ("M35", 480, 630, 750, 510, 185, 3.8, None, 5900), ("M40", 520, 600, 760, 520, 190, 4.7, None, 6400),
]
build_sheet("Setup - Mix Design", "Setup  -  Mix Design",
            "Concrete grades & material per m3. Drives production consumption + selling rate. Edit to your design.",
            mix_cols, MASTER_ROWS, mix_ex, FILL_NAVY2)
defname("GradeList", f"'Setup - Mix Design'!$A$5:$A${MEND}")

ws_veh = build_sheet("Setup - Vehicles", "Setup  -  Vehicles",
            "Transit mixer / pump fleet. Dispatch picks the vehicle; driver auto-fills.",
            [{"h": "Vehicle No.", "w": 16}, {"h": "Type", "w": 16}, {"h": "Capacity (m3)", "w": 13, "type": "num"},
             {"h": "Default Driver", "w": 22}, {"h": "Status", "w": 14}], MASTER_ROWS, None, FILL_NAVY2)
defname("VehicleList", f"'Setup - Vehicles'!$A$5:$A${MEND}")
defname("VehStatusList", "'Lists'!$A$2:$A$4")
add_list_validation(ws_veh, "VehStatusList", f"E{DATA_START}:E{MEND}")

build_sheet("Setup - Drivers", "Setup  -  Drivers", "Driver master.",
            [{"h": "Driver Name", "w": 24}, {"h": "Phone", "w": 16}, {"h": "Licence No.", "w": 20}, {"h": "Notes", "w": 30}],
            MASTER_ROWS, None, FILL_NAVY2)
defname("DriverList", f"'Setup - Drivers'!$A$5:$A${MEND}")

mat_cols = [
    {"h": "Material", "w": 22}, {"h": "Unit", "w": 10}, {"h": "Opening Stock", "w": 14, "type": "num"},
    {"h": "Purchase Rate (\u20b9/unit)", "w": 16, "type": "money"}, {"h": "Reorder Level", "w": 14, "type": "num"},
]
mat_ex = [
    ("Cement", "kg", 0, 7.5, 20000), ("Sand", "kg", 0, 1.2, 40000),
    ("Aggregate 20mm", "kg", 0, 1.0, 40000), ("Aggregate 10mm", "kg", 0, 1.1, 25000),
    ("Admixture", "kg", 0, 95, 200), ("Diesel", "ltr", 0, 92, 500),
]
build_sheet("Setup - Materials", "Setup  -  Materials",
            "Raw material master: opening stock, rate & reorder level. Drives the Stock Register + low-stock alerts.",
            mat_cols, MASTER_ROWS, mat_ex, FILL_NAVY2)
defname("MaterialList", f"'Setup - Materials'!$A$5:$A${MEND}")

# ============================================================
# ORDERS
# ============================================================
ord_cols = [
    {"h": "Date", "w": 14, "type": "date"}, {"h": "Order No.", "w": 14}, {"h": "Client", "w": 28},
    {"h": "Site / Location", "w": 24}, {"h": "Grade", "w": 10}, {"h": "Qty (m3)", "w": 11, "type": "num"},
    {"h": "Rate (\u20b9/m3)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(E{r}=\"\",\"\",VLOOKUP(E{r}," + MIX_TBL + ",9,0)),\"\")"},
    {"h": "Order Value (\u20b9)", "w": 15, "type": "calc", "numfmt": "money",
     "formula": "=IF(OR(F{r}=\"\",G{r}=\"\"),\"\",F{r}*G{r})"},
    {"h": "Delivered (m3)", "w": 13, "type": "calc", "numfmt": "num",
     "formula": "=IF(B{r}=\"\",\"\",SUMIF('Dispatch (Challan)'!$C$5:$C$" + str(TEND) + ",B{r},'Dispatch (Challan)'!$F$5:$F$" + str(TEND) + "))"},
    {"h": "Balance (m3)", "w": 12, "type": "calc", "numfmt": "num", "formula": "=IF(F{r}=\"\",\"\",F{r}-I{r})"},
    {"h": "Status", "w": 13, "type": "calc",
     "formula": "=IF(F{r}=\"\",\"\",IF(I{r}=0,\"Pending\",IF(I{r}>=F{r},\"Completed\",\"Partial\")))"},
]
ws_ord = build_sheet("Orders", "Orders  -  Daily Order Book",
            "Pick client & grade. Rate, value, delivered qty, balance & status auto-calculate.",
            ord_cols, TXN_ROWS, None, FILL_NAVY)
add_list_validation(ws_ord, "ClientList", f"C{DATA_START}:C{TEND}")
add_list_validation(ws_ord, "GradeList", f"E{DATA_START}:E{TEND}")

# ============================================================
# DISPATCH (CHALLAN)
# ============================================================
dis_cols = [
    {"h": "Date", "w": 14, "type": "date"}, {"h": "Challan No.", "w": 14}, {"h": "Order No.", "w": 14},
    {"h": "Client", "w": 28}, {"h": "Grade", "w": 10}, {"h": "Qty (m3)", "w": 11, "type": "num"},
    {"h": "Vehicle No.", "w": 16},
    {"h": "Driver", "w": 22, "type": "calc",
     "formula": "=IFERROR(IF(G{r}=\"\",\"\",VLOOKUP(G{r}," + VEH_TBL + ",4,0)),\"\")"},
    {"h": "Rate (\u20b9/m3)", "w": 13, "type": "calc", "numfmt": "money",
     "formula": "=IFERROR(IF(E{r}=\"\",\"\",VLOOKUP(E{r}," + MIX_TBL + ",9,0)),\"\")"},
    {"h": "Amount (\u20b9)", "w": 15, "type": "calc", "numfmt": "money",
     "formula": "=IF(OR(F{r}=\"\",I{r}=\"\"),\"\",F{r}*I{r})"},
    {"h": "Status", "w": 14},
]
ws_dis = build_sheet("Dispatch (Challan)", "Dispatch  -  Challans",
            "Pick client / grade / vehicle; driver, rate & amount auto-fill. Delivered qty rolls up to Orders.",
            dis_cols, TXN_ROWS, None, FILL_NAVY)
defname("DispStatusList", "'Lists'!$B$2:$B$5")
add_list_validation(ws_dis, "ClientList", f"D{DATA_START}:D{TEND}")
add_list_validation(ws_dis, "GradeList", f"E{DATA_START}:E{TEND}")
add_list_validation(ws_dis, "VehicleList", f"G{DATA_START}:G{TEND}")
add_list_validation(ws_dis, "DispStatusList", f"K{DATA_START}:K{TEND}")

# ============================================================
# BATCH PRODUCTION
# ============================================================
def cons(col): return ("=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r}," + MIX_TBL + f",{col},0)),\"\")")
prod_cols = [
    {"h": "Date", "w": 14, "type": "date"}, {"h": "Batch No.", "w": 12}, {"h": "Grade", "w": 10},
    {"h": "Qty (m3)", "w": 11, "type": "num"}, {"h": "Operator", "w": 18},
    {"h": "Cement (kg)", "w": 13, "type": "calc", "numfmt": "num", "formula": cons(2)},
    {"h": "Sand (kg)", "w": 12, "type": "calc", "numfmt": "num", "formula": cons(3)},
    {"h": "Agg 20mm (kg)", "w": 13, "type": "calc", "numfmt": "num", "formula": cons(4)},
    {"h": "Agg 10mm (kg)", "w": 13, "type": "calc", "numfmt": "num", "formula": cons(5)},
    {"h": "Water (ltr)", "w": 12, "type": "calc", "numfmt": "num", "formula": cons(6)},
    {"h": "Admixture (kg)", "w": 13, "type": "calc", "numfmt": "num", "formula": cons(7)},
]
ws_prod = build_sheet("Batch Production", "Batch Production  -  Material Consumption",
            "Enter grade + m3 only. Material consumed auto-computes from Mix Design and feeds Stock.",
            prod_cols, TXN_ROWS, None, FILL_NAVY)
add_list_validation(ws_prod, "GradeList", f"C{DATA_START}:C{TEND}")

# ============================================================
# MATERIAL RECEIPT
# ============================================================
rec_cols = [
    {"h": "Date", "w": 14, "type": "date"}, {"h": "Material", "w": 22}, {"h": "Qty Received", "w": 14, "type": "num"},
    {"h": "Unit", "w": 10, "type": "calc", "formula": "=IFERROR(IF(B{r}=\"\",\"\",VLOOKUP(B{r}," + MAT_TBL + ",2,0)),\"\")"},
    {"h": "Rate (\u20b9/unit)", "w": 14, "type": "num"},
    {"h": "Amount (\u20b9)", "w": 15, "type": "calc", "numfmt": "money", "formula": "=IF(OR(C{r}=\"\",E{r}=\"\"),\"\",C{r}*E{r})"},
    {"h": "Supplier", "w": 24}, {"h": "Invoice No.", "w": 16},
]
ws_rec = build_sheet("Material Receipt", "Material Receipt  -  Purchases",
            "Incoming raw material. Unit auto-fills; amount auto-calculates. Feeds 'Received' in Stock.",
            rec_cols, TXN_ROWS, None, FILL_NAVY)
add_list_validation(ws_rec, "MaterialList", f"B{DATA_START}:B{TEND}")

# ============================================================
# FUEL LOG
# ============================================================
fuel_cols = [
    {"h": "Date", "w": 14, "type": "date"}, {"h": "Vehicle No.", "w": 16}, {"h": "Diesel (ltr)", "w": 12, "type": "num"},
    {"h": "Odometer (km)", "w": 14, "type": "num"}, {"h": "Rate (\u20b9/ltr)", "w": 12, "type": "num"},
    {"h": "Amount (\u20b9)", "w": 15, "type": "calc", "numfmt": "money", "formula": "=IF(OR(C{r}=\"\",E{r}=\"\"),\"\",C{r}*E{r})"},
    {"h": "Filled By", "w": 18},
]
ws_fuel = build_sheet("Fuel Log", "Fuel Log  -  Diesel Issued",
            "Diesel issued per vehicle. Amount auto-calculates; total diesel feeds Stock.",
            fuel_cols, TXN_ROWS, None, FILL_NAVY)
add_list_validation(ws_fuel, "VehicleList", f"B{DATA_START}:B{TEND}")

# ============================================================
# PAYMENTS
# ============================================================
pay_cols = [
    {"h": "Date", "w": 14, "type": "date"}, {"h": "Receipt No.", "w": 14}, {"h": "Client", "w": 28},
    {"h": "Amount Received (\u20b9)", "w": 18, "type": "money"}, {"h": "Mode", "w": 14},
    {"h": "Reference / Notes", "w": 30},
]
ws_pay = build_sheet("Payments", "Payments  -  Customer Collections",
            "Money received from clients. Drives 'Collection' and 'Outstanding' on the Dashboard.",
            pay_cols, TXN_ROWS, None, FILL_NAVY)
defname("PayModeList", "'Lists'!$C$2:$C$6")
add_list_validation(ws_pay, "ClientList", f"C{DATA_START}:C{TEND}")
add_list_validation(ws_pay, "PayModeList", f"E{DATA_START}:E{TEND}")

# ============================================================
# CUBE TEST REGISTER
# ============================================================
cube_cols = [
    {"h": "Casting Date", "w": 14, "type": "date"}, {"h": "Cube ID", "w": 12}, {"h": "Challan / Ref", "w": 14},
    {"h": "Grade", "w": 10}, {"h": "Testing Date", "w": 14, "type": "date"},
    {"h": "Age (days)", "w": 11, "type": "calc", "numfmt": "int",
     "formula": "=IF(OR(A{r}=\"\",E{r}=\"\"),\"\",E{r}-A{r})"},
    {"h": "Load (kN)", "w": 11, "type": "num"},
    {"h": "Strength (N/mm2)", "w": 14, "type": "calc", "numfmt": "num",
     "formula": "=IF(G{r}=\"\",\"\",ROUND(G{r}*1000/22500,2))"},
    {"h": "Required (N/mm2)", "w": 14, "type": "calc", "numfmt": "num",
     "formula": "=IFERROR(IF(D{r}=\"\",\"\",VALUE(MID(D{r},2,5))),\"\")"},
    {"h": "Result", "w": 12, "type": "calc",
     "formula": "=IF(OR(H{r}=\"\",I{r}=\"\"),\"\",IF(H{r}>=I{r},\"Pass\",\"Fail\"))"},
]
ws_cube = build_sheet("Cube Test Register", "Cube Test Register  -  Quality Control",
            "Strength = Load(kN)x1000 / 22500mm2 (150mm cube). Pass/Fail auto-checks vs the grade's required N/mm2.",
            cube_cols, TXN_ROWS, None, FILL_NAVY)
add_list_validation(ws_cube, "GradeList", f"D{DATA_START}:D{TEND}")

# ============================================================
# STOCK REGISTER
# ============================================================
ws = wb.create_sheet("Stock Register"); ws.sheet_view.showGridLines = False
stock_cols = [("Material", 22), ("Unit", 10), ("Opening", 13), ("Received", 13),
              ("Consumed", 13), ("Closing Stock", 15), ("Reorder Level", 13), ("Value (\u20b9)", 16)]
set_widths(ws, [w for _, w in stock_cols])
title_block(ws, "Stock Register  -  Live Balances",
            "Opening + Received - Consumed = Closing. Closing turns RED when it drops below the reorder level.", len(stock_cols))
for i, (h, _) in enumerate(stock_cols, start=1):
    ws.cell(row=HDR_ROW, column=i, value=h)
style_header(ws, HDR_ROW, len(stock_cols), fill=FILL_NAVY2)
ws.freeze_panes = f"A{DATA_START}"
prod = "'Batch Production'!"
consumed = {
    "Cement": f"=SUM({prod}$F$5:$F${TEND})", "Sand": f"=SUM({prod}$G$5:$G${TEND})",
    "Aggregate 20mm": f"=SUM({prod}$H$5:$H${TEND})", "Aggregate 10mm": f"=SUM({prod}$I$5:$I${TEND})",
    "Admixture": f"=SUM({prod}$K$5:$K${TEND})", "Diesel": f"=SUM('Fuel Log'!$C$5:$C${TEND})",
}
materials = ["Cement", "Sand", "Aggregate 20mm", "Aggregate 10mm", "Admixture", "Diesel"]
for idx, mat in enumerate(materials):
    rr = DATA_START + idx
    ws.cell(row=rr, column=1, value=mat)
    ws.cell(row=rr, column=2, value=f"=IFERROR(VLOOKUP(A{rr},{MAT_TBL},2,0),\"\")")
    ws.cell(row=rr, column=3, value=f"=IFERROR(VLOOKUP(A{rr},{MAT_TBL},3,0),0)")
    ws.cell(row=rr, column=4, value=f"=SUMIF('Material Receipt'!$B$5:$B${TEND},A{rr},'Material Receipt'!$C$5:$C${TEND})")
    ws.cell(row=rr, column=5, value=consumed[mat])
    ws.cell(row=rr, column=6, value=f"=C{rr}+D{rr}-E{rr}")
    ws.cell(row=rr, column=7, value=f"=IFERROR(VLOOKUP(A{rr},{MAT_TBL},5,0),0)")
    ws.cell(row=rr, column=8, value=f"=IFERROR(F{rr}*VLOOKUP(A{rr},{MAT_TBL},4,0),\"\")")
    for ci in range(1, 9):
        cell = ws.cell(row=rr, column=ci); cell.border = B
        cell.fill = FILL_CALC if ci > 2 else PatternFill("solid", fgColor=WHITE)
        cell.font = F_CALC if ci > 2 else Font(bold=True, color=NAVY)
        if ci in (3, 4, 5, 6, 7): cell.number_format = "#,##0.00"
        if ci == 8: cell.number_format = '\u20b9#,##0.00'
tr = DATA_START + len(materials)
ws.cell(row=tr, column=1, value="TOTAL"); ws.cell(row=tr, column=8, value=f"=SUM(H{DATA_START}:H{tr-1})")
for ci in range(1, 9):
    cell = ws.cell(row=tr, column=ci); cell.fill = FILL_GOLD; cell.font = Font(bold=True, color=NAVY); cell.border = B
    if ci == 8: cell.number_format = '\u20b9#,##0.00'
# low-stock visual: closing (F) red when below reorder (G)
ws.conditional_formatting.add(f"F{DATA_START}:F{tr-1}",
    FormulaRule(formula=[f"AND($F{DATA_START}<>\"\",$F{DATA_START}<$G{DATA_START})"],
                fill=PatternFill("solid", fgColor="FFE0E0"), font=Font(bold=True, color=RED)))
ws.conditional_formatting.add(f"F{DATA_START}:F{tr-1}",
    DataBarRule(start_type="num", start_value=0, end_type="max", color=BLUE))

# ============================================================
# MONTHLY SUMMARY
# ============================================================
wm = wb.create_sheet("Monthly Summary"); wm.sheet_view.showGridLines = False
set_widths(wm, [3, 14, 16, 16, 18, 16, 18])
title_block(wm, "Monthly Summary  -  Year View", "Set the year; every month total fills automatically.", 7)
wm.cell(row=HDR_ROW - 0.0 if False else 3, column=6)  # noop
yc = wm.cell(row=4, column=2, value="Year:"); yc.font = Font(bold=True, color=GOLD, size=12)
yv = wm.cell(row=4, column=3, value=2026); yv.font = Font(bold=True, color=NAVY, size=12)
yv.fill = FILL_INPUT; yv.border = B; yv.alignment = Alignment(horizontal="center")
YCELL = "$C$4"
mhead = 6
mcols = ["Month", "Production (m3)", "Dispatched (m3)", "Sales Value (\u20b9)", "Collection (\u20b9)", "Purchases (\u20b9)"]
for i, h in enumerate(mcols, start=2):
    wm.cell(row=mhead, column=i, value=h)
style_header(wm, mhead, len(mcols) + 1, fill=FILL_NAVY2)
wm.cell(row=mhead, column=1).fill = PatternFill("solid", fgColor=WHITE)
months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
def sumifs_month(col_rng, date_rng, m):
    return (f"=SUMIFS({col_rng},{date_rng},\">=\"&DATE({YCELL},{m},1),{date_rng},\"<\"&DATE({YCELL},{m}+1,1))")
for mi, mname in enumerate(months, start=1):
    rr = mhead + mi
    wm.cell(row=rr, column=2, value=mname).font = Font(bold=True, color=NAVY)
    wm.cell(row=rr, column=3, value=sumifs_month(f"'Batch Production'!$D$5:$D${TEND}", f"'Batch Production'!$A$5:$A${TEND}", mi))
    wm.cell(row=rr, column=4, value=sumifs_month(f"'Dispatch (Challan)'!$F$5:$F${TEND}", f"'Dispatch (Challan)'!$A$5:$A${TEND}", mi))
    wm.cell(row=rr, column=5, value=sumifs_month(f"'Dispatch (Challan)'!$J$5:$J${TEND}", f"'Dispatch (Challan)'!$A$5:$A${TEND}", mi))
    wm.cell(row=rr, column=6, value=sumifs_month(f"'Payments'!$D$5:$D${TEND}", f"'Payments'!$A$5:$A${TEND}", mi))
    wm.cell(row=rr, column=7, value=sumifs_month(f"'Material Receipt'!$F$5:$F${TEND}", f"'Material Receipt'!$A$5:$A${TEND}", mi))
    for ci in range(2, 8):
        cell = wm.cell(row=rr, column=ci); cell.border = B
        cell.fill = FILL_CALC if ci > 2 else PatternFill("solid", fgColor=WHITE)
        cell.font = F_CALC if ci > 2 else Font(bold=True, color=NAVY)
        if ci in (3, 4): cell.number_format = "#,##0.0"
        if ci in (5, 6, 7): cell.number_format = '\u20b9#,##0'
mtot = mhead + 13
wm.cell(row=mtot, column=2, value="TOTAL")
for ci in range(3, 8):
    L = get_column_letter(ci)
    cell = wm.cell(row=mtot, column=ci, value=f"=SUM({L}{mhead+1}:{L}{mhead+12})")
    cell.number_format = "#,##0.0" if ci in (3, 4) else '\u20b9#,##0'
for ci in range(2, 8):
    cell = wm.cell(row=mtot, column=ci); cell.fill = FILL_GOLD; cell.font = Font(bold=True, color=NAVY); cell.border = B
# monthly production trend line chart
lc = LineChart(); lc.title = "Monthly Production Trend (m3)"; lc.height = 7; lc.width = 16
ld = Reference(wm, min_col=3, min_row=mhead, max_row=mhead + 12)
lcats = Reference(wm, min_col=2, min_row=mhead + 1, max_row=mhead + 12)
lc.add_data(ld, titles_from_data=True); lc.set_categories(lcats); lc.legend = None
wm.add_chart(lc, "I6")
# monthly sales vs collection
bc = BarChart(); bc.type = "col"; bc.title = "Sales vs Collection (\u20b9)"; bc.height = 7; bc.width = 16
bd = Reference(wm, min_col=5, min_row=mhead, max_col=6, max_row=mhead + 12)
bc.add_data(bd, titles_from_data=True); bc.set_categories(lcats)
wm.add_chart(bc, "I22")

# ============================================================
# DASHBOARD
# ============================================================
wd = wb.create_sheet("Dashboard"); wd.sheet_view.showGridLines = False
set_widths(wd, [3, 26, 16, 4, 26, 16, 6])
title_block(wd, "Dashboard  -  Plant Overview", "Live totals across the whole workbook.", 7)
def kpi(row, col, label, formula, fmt, color):
    lc_ = wd.cell(row=row, column=col, value=label)
    lc_.font = Font(bold=True, color="9AA7BD", size=10); lc_.fill = FILL_NAVY2
    lc_.alignment = Alignment(indent=1, vertical="center")
    vc = wd.cell(row=row + 1, column=col, value=formula)
    vc.font = Font(bold=True, color=color, size=18); vc.fill = FILL_NAVY2
    vc.number_format = fmt; vc.alignment = Alignment(indent=1, vertical="center")
    wd.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + 1)
    wd.merge_cells(start_row=row + 1, start_column=col, end_row=row + 1, end_column=col + 1)
    wd.row_dimensions[row].height = 18; wd.row_dimensions[row + 1].height = 30
disp_amt = f"'Dispatch (Challan)'!$J$5:$J${TEND}"
kpi(4, 2, "TOTAL PRODUCTION (m3)", f"=SUM('Batch Production'!$D$5:$D${TEND})", "#,##0.0", GOLD)
kpi(4, 5, "TOTAL DISPATCHED (m3)", f"=SUM('Dispatch (Challan)'!$F$5:$F${TEND})", "#,##0.0", GREEN)
kpi(7, 2, "DISPATCHED VALUE (\u20b9)", f"=SUM({disp_amt})", '\u20b9#,##0', GOLD)
kpi(7, 5, "COLLECTION (\u20b9)", f"=SUM('Payments'!$D$5:$D${TEND})", '\u20b9#,##0', GREEN)
kpi(10, 2, "OUTSTANDING (\u20b9)", f"=SUM({disp_amt})-SUM('Payments'!$D$5:$D${TEND})", '\u20b9#,##0', RED)
kpi(10, 5, "MATERIAL PURCHASE (\u20b9)", f"=SUM('Material Receipt'!$F$5:$F${TEND})", '\u20b9#,##0', BLUE)
# production by grade table + chart
gr = 14
wd.cell(row=gr, column=2, value="PRODUCTION BY GRADE").font = Font(bold=True, color=GOLD, size=12)
hdr = gr + 1
wd.cell(row=hdr, column=2, value="Grade"); wd.cell(row=hdr, column=3, value="Produced (m3)")
style_header(wd, hdr, 3, fill=FILL_NAVY2); wd.cell(row=hdr, column=1).fill = PatternFill("solid", fgColor=WHITE)
grades = ["M15", "M20", "M25", "M30", "M35", "M40"]
for i, g in enumerate(grades):
    rr = hdr + 1 + i
    wd.cell(row=rr, column=2, value=g).font = Font(bold=True, color=NAVY)
    c = wd.cell(row=rr, column=3, value=f"=SUMIF('Batch Production'!$C$5:$C${TEND},B{rr},'Batch Production'!$D$5:$D${TEND})")
    c.number_format = "#,##0.0"; c.font = F_CALC
    for ci in (2, 3):
        wd.cell(row=rr, column=ci).border = B
        wd.cell(row=rr, column=ci).fill = FILL_CALC if ci == 3 else PatternFill("solid", fgColor=WHITE)
chart = BarChart(); chart.type = "col"; chart.title = "Production by Grade (m3)"; chart.height = 7.5; chart.width = 12
data = Reference(wd, min_col=3, min_row=hdr, max_row=hdr + len(grades))
cats = Reference(wd, min_col=2, min_row=hdr + 1, max_row=hdr + len(grades))
chart.add_data(data, titles_from_data=True); chart.set_categories(cats); chart.legend = None
wd.add_chart(chart, "E15")
# stock levels chart (from Stock Register)
sc = BarChart(); sc.type = "bar"; sc.title = "Closing Stock by Material"; sc.height = 7.5; sc.width = 12
sd = Reference(wb["Stock Register"], min_col=6, min_row=HDR_ROW, max_row=HDR_ROW + len(materials))
scats = Reference(wb["Stock Register"], min_col=1, min_row=DATA_START, max_row=DATA_START + len(materials) - 1)
sc.add_data(sd, titles_from_data=True); sc.set_categories(scats); sc.legend = None
wd.add_chart(sc, "E32")

# conditional formatting visuals on transaction sheets
def status_colors(ws, rng):
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Completed"'], fill=PatternFill("solid", fgColor="DCFCE7"), font=Font(bold=True, color="166534")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Delivered"'], fill=PatternFill("solid", fgColor="DCFCE7"), font=Font(bold=True, color="166534")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Partial"'], fill=PatternFill("solid", fgColor="DBEAFE"), font=Font(bold=True, color="1E40AF")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Dispatched"'], fill=PatternFill("solid", fgColor="DBEAFE"), font=Font(bold=True, color="1E40AF")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Pending"'], fill=PatternFill("solid", fgColor="FEF3C7"), font=Font(bold=True, color="92400E")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Scheduled"'], fill=PatternFill("solid", fgColor="FEF3C7"), font=Font(bold=True, color="92400E")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Cancelled"'], fill=PatternFill("solid", fgColor="FEE2E2"), font=Font(bold=True, color="991B1B")))
status_colors(ws_ord, f"K{DATA_START}:K{TEND}")
status_colors(ws_dis, f"K{DATA_START}:K{TEND}")
ws_ord.conditional_formatting.add(f"F{DATA_START}:F{TEND}", DataBarRule(start_type="num", start_value=0, end_type="max", color=GOLD))
ws_dis.conditional_formatting.add(f"F{DATA_START}:F{TEND}", DataBarRule(start_type="num", start_value=0, end_type="max", color=GREEN))
ws_prod.conditional_formatting.add(f"D{DATA_START}:D{TEND}", DataBarRule(start_type="num", start_value=0, end_type="max", color=GOLD))
ws_pay.conditional_formatting.add(f"D{DATA_START}:D{TEND}", DataBarRule(start_type="num", start_value=0, end_type="max", color=GREEN))
# cube test pass/fail colours
ws_cube.conditional_formatting.add(f"J{DATA_START}:J{TEND}", CellIsRule(operator="equal", formula=['"Pass"'], fill=PatternFill("solid", fgColor="DCFCE7"), font=Font(bold=True, color="166534")))
ws_cube.conditional_formatting.add(f"J{DATA_START}:J{TEND}", CellIsRule(operator="equal", formula=['"Fail"'], fill=PatternFill("solid", fgColor="FEE2E2"), font=Font(bold=True, color="991B1B")))

# ============================================================
# LISTS (hidden)
# ============================================================
wl = wb.create_sheet("Lists")
wl["A1"] = "Vehicle Status"
for i, v in enumerate(["Active", "Maintenance", "Inactive"], start=2): wl[f"A{i}"] = v
wl["B1"] = "Dispatch Status"
for i, v in enumerate(["Scheduled", "Dispatched", "Delivered", "Cancelled"], start=2): wl[f"B{i}"] = v
wl["C1"] = "Payment Mode"
for i, v in enumerate(["Cash", "UPI", "Cheque", "NEFT", "RTGS"], start=2): wl[f"C{i}"] = v
wl.sheet_state = "hidden"

# ---- tab order & colours ----
order = ["Instructions", "Dashboard", "Monthly Summary",
         "Setup - Clients", "Setup - Mix Design", "Setup - Vehicles", "Setup - Drivers", "Setup - Materials",
         "Orders", "Dispatch (Challan)", "Batch Production", "Material Receipt", "Fuel Log",
         "Payments", "Cube Test Register", "Stock Register", "Lists"]
wb._sheets.sort(key=lambda s: order.index(s.title) if s.title in order else 99)
cmap = {"Instructions": GOLD, "Dashboard": GOLD, "Monthly Summary": GOLD,
        "Setup - Clients": "5B6B86", "Setup - Mix Design": "5B6B86", "Setup - Vehicles": "5B6B86",
        "Setup - Drivers": "5B6B86", "Setup - Materials": "5B6B86",
        "Orders": NAVY2, "Dispatch (Challan)": "1E7F4F", "Batch Production": NAVY2,
        "Material Receipt": NAVY2, "Fuel Log": NAVY2, "Payments": "1E7F4F",
        "Cube Test Register": "1E5F8F", "Stock Register": "1E5F8F"}
for s in wb._sheets:
    if s.title in cmap: s.sheet_properties.tabColor = cmap[s.title]

wb.save(OUT)
print("Saved", OUT, "| TXN_ROWS", TXN_ROWS, "MASTER_ROWS", MASTER_ROWS)
print("Sheets:", [s.title for s in wb._sheets])
