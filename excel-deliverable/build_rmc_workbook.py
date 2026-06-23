#!/usr/bin/env python3
"""Generate an advanced, connected RMC plant daily-operations workbook."""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.chart import BarChart, Reference

# ---------- palette (CONCRETE KING theme) ----------
NAVY = "08111F"
NAVY2 = "12203A"
GOLD = "F7C948"
GREEN = "22C55E"
BLUE = "38BDF8"
LIGHT = "F4F6FB"
GREY = "E7ECF5"
INPUT_BG = "FFFDF3"   # pale gold -> "type here"
CALC_BG = "EEF6FF"    # pale blue -> "auto / do not type"
WHITE = "FFFFFF"

thin = Side(style="thin", color="C7D0E0")
border_all = Border(left=thin, right=thin, top=thin, bottom=thin)

H_FONT = Font(bold=True, color=WHITE, size=11, name="Calibri")
TITLE_FONT = Font(bold=True, color=GOLD, size=20, name="Calibri")
SUB_FONT = Font(color="9AA7BD", size=10, italic=True)
LABEL_FONT = Font(bold=True, color=NAVY, size=11)
CALC_FONT = Font(color="1F3D6B", size=11)

wb = Workbook()

ROWS = 300  # entry capacity per sheet


def style_header(ws, row, ncols, fill=NAVY):
    f = PatternFill("solid", fgColor=fill)
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = H_FONT
        cell.fill = f
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border_all
    ws.row_dimensions[row].height = 30


def title_block(ws, title, subtitle, span):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=span)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=span)
    t = ws.cell(row=1, column=1, value=title)
    t.font = TITLE_FONT
    t.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    s = ws.cell(row=2, column=1, value=subtitle)
    s.font = SUB_FONT
    s.alignment = Alignment(horizontal="left", vertical="center", indent=1)
    for r in (1, 2):
        for c in range(1, span + 1):
            ws.cell(row=r, column=c).fill = PatternFill("solid", fgColor=NAVY)
    ws.row_dimensions[1].height = 34
    ws.row_dimensions[2].height = 18


def set_widths(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def paint_input(ws, col_letter, start, end, bg=INPUT_BG, fmt=None):
    fill = PatternFill("solid", fgColor=bg)
    for r in range(start, end + 1):
        cell = ws[f"{col_letter}{r}"]
        cell.fill = fill
        cell.border = border_all
        cell.font = CALC_FONT if bg == CALC_BG else Font(color=NAVY, size=11)
        if fmt:
            cell.number_format = fmt


def add_list_validation(ws, named_range, target_range):
    dv = DataValidation(type="list", formula1=f"={named_range}", allow_blank=True)
    dv.error = "Pick a value from the list."
    dv.promptTitle = "Select"
    dv.prompt = "Choose from the dropdown."
    ws.add_data_validation(dv)
    dv.add(target_range)


def defname(name, ref):
    wb.defined_names.add(DefinedName(name, attr_text=ref))


HDR_ROW = 4  # data headers start here (rows 1-2 title, 3 blank)
DATA_START = 5

# ============================================================
# 1. INSTRUCTIONS
# ============================================================
ws = wb.active
ws.title = "Instructions"
ws.sheet_view.showGridLines = False
set_widths(ws, [3, 34, 70])
title_block(ws, "CONCRETE KING  •  RMC Plant Daily Workbook",
            "One connected workbook for daily ready-mix concrete plant operations", 3)

intro = [
    ("", ""),
    ("HOW THIS WORKBOOK WORKS", ""),
    ("Fill the Setup tabs once",
     "Enter your Clients, Mix Designs (grades), Vehicles, Drivers and Materials on the 'Setup - *' tabs. Everything else pulls from these."),
    ("Enter daily work",
     "Use Orders, Dispatch (Challan), Batch Production, Material Receipt and Fuel Log every day. Pick clients/grades/vehicles from dropdowns - no retyping."),
    ("Numbers calculate themselves",
     "Rates, amounts, mix quantities, material consumption and stock are auto-filled by formulas. You enter less, the sheet connects the rest."),
    ("Read the Dashboard",
     "The Dashboard tab totals everything live: production, dispatch, sales value, material consumption and closing stock."),
    ("", ""),
    ("COLOUR GUIDE", ""),
    ("Gold cells  =  you type here", "These are your entry cells (clients, quantities, dates, etc.)."),
    ("Blue cells  =  auto-calculated", "Do NOT type in blue cells - they fill in automatically from your entries."),
    ("", ""),
    ("TABS IN ORDER", ""),
    ("Setup - Clients", "Customer master: name, contact, phone, GST, address."),
    ("Setup - Mix Design", "Concrete grades and material per m3 (cement/sand/aggregate/water/admixture) + selling rate."),
    ("Setup - Vehicles", "Transit mixer fleet: number, capacity, default driver."),
    ("Setup - Drivers", "Driver master: name, phone, licence."),
    ("Setup - Materials", "Raw material master + opening stock + purchase rate (cement, sand, aggregate, admixture, diesel)."),
    ("Orders", "Daily order book. Pick client + grade; rate and amount auto-fill."),
    ("Dispatch (Challan)", "Daily delivery challans. Pick client + grade + vehicle; driver auto-fills."),
    ("Batch Production", "Each batch produced. Enter grade + m3; material consumed auto-computes from Mix Design."),
    ("Material Receipt", "Incoming raw material purchases."),
    ("Fuel Log", "Diesel issued per vehicle."),
    ("Stock Register", "Opening + received - consumed = closing, per material. Fully automatic."),
    ("Dashboard", "Live KPIs and charts for the whole plant."),
]
r = HDR_ROW
for a, b in intro:
    ca = ws.cell(row=r, column=2, value=a)
    cb = ws.cell(row=r, column=3, value=b)
    if a and not b and a.isupper():
        ca.font = Font(bold=True, color=GOLD, size=12)
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        ca.fill = PatternFill("solid", fgColor=NAVY2)
        cb.fill = PatternFill("solid", fgColor=NAVY2)
        ws.row_dimensions[r].height = 22
    else:
        ca.font = LABEL_FONT
        cb.font = Font(color="33425C", size=10)
        cb.alignment = Alignment(wrap_text=True, vertical="top")
        ca.alignment = Alignment(vertical="top")
        if a:
            ws.row_dimensions[r].height = 30
    r += 1

# legend swatches
ws["B6"].fill = PatternFill("solid", fgColor=INPUT_BG)  # placeholder, overwritten below


# ============================================================
# helper to build a standard data sheet
# ============================================================
def build_sheet(name, title, subtitle, columns, examples=None, accent=NAVY):
    """columns: list of dicts {h, w, type('input'|'calc'|'date'|'num'|'money'), formula(optional, uses {r})}"""
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    ncols = len(columns)
    set_widths(ws, [c["w"] for c in columns])
    title_block(ws, title, subtitle, ncols)
    # headers
    for i, c in enumerate(columns, start=1):
        ws.cell(row=HDR_ROW, column=i, value=c["h"])
    style_header(ws, HDR_ROW, ncols, fill=accent)
    ws.freeze_panes = f"A{DATA_START}"
    # examples
    if examples:
        for ri, row in enumerate(examples, start=DATA_START):
            for ci, val in enumerate(row, start=1):
                if val is not None:
                    ws.cell(row=ri, column=ci, value=val)
    # formatting / formulas per column
    for i, c in enumerate(columns, start=1):
        L = get_column_letter(i)
        t = c.get("type", "input")
        fmt = None
        bg = INPUT_BG
        if t == "calc":
            bg = CALC_BG
        if t == "date":
            fmt = "dd-mmm-yyyy"
        elif t == "num":
            fmt = "#,##0.00"
        elif t == "money":
            fmt = '\u20b9#,##0.00'
        elif t == "int":
            fmt = "#,##0"
        paint_input(ws, L, DATA_START, DATA_START + ROWS - 1, bg=bg, fmt=fmt)
        # write formulas
        if c.get("formula"):
            for rr in range(DATA_START, DATA_START + ROWS):
                ws[f"{L}{rr}"] = c["formula"].format(r=rr)
    return ws


# ============================================================
# 2. SETUP - CLIENTS
# ============================================================
clients_cols = [
    {"h": "Client / Company Name", "w": 30, "type": "input"},
    {"h": "Contact Person", "w": 22, "type": "input"},
    {"h": "Phone", "w": 16, "type": "input"},
    {"h": "GST No.", "w": 20, "type": "input"},
    {"h": "Billing Address", "w": 40, "type": "input"},
]
clients_ex = []  # ready-to-use: enter your own clients
build_sheet("Setup - Clients", "Setup  -  Clients",
            "Customer master. Add every client once; orders & challans pick from here.",
            clients_cols, clients_ex, accent=NAVY2)
defname("ClientList", "'Setup - Clients'!$A$5:$A$304")

# ============================================================
# 3. SETUP - MIX DESIGN
# ============================================================
mix_cols = [
    {"h": "Grade", "w": 12, "type": "input"},
    {"h": "Cement (kg/m3)", "w": 14, "type": "num"},
    {"h": "Sand (kg/m3)", "w": 13, "type": "num"},
    {"h": "Aggregate 20mm (kg/m3)", "w": 16, "type": "num"},
    {"h": "Aggregate 10mm (kg/m3)", "w": 16, "type": "num"},
    {"h": "Water (ltr/m3)", "w": 12, "type": "num"},
    {"h": "Admixture (kg/m3)", "w": 14, "type": "num"},
    {"h": "W/C Ratio", "w": 11, "type": "calc", "formula": "=IF(B{r}=\"\",\"\",ROUND(F{r}/B{r},2))"},
    {"h": "Selling Rate (\u20b9/m3)", "w": 15, "type": "money"},
]
mix_ex = [
    ("M15", 320, 750, 700, 480, 160, 1.6, None, 4200),
    ("M20", 360, 720, 720, 480, 170, 2.0, None, 4600),
    ("M25", 400, 690, 730, 490, 175, 2.4, None, 5000),
    ("M30", 440, 660, 740, 500, 180, 3.1, None, 5400),
    ("M35", 480, 630, 750, 510, 185, 3.8, None, 5900),
    ("M40", 520, 600, 760, 520, 190, 4.7, None, 6400),
]
ws_mix = build_sheet("Setup - Mix Design", "Setup  -  Mix Design",
            "Concrete grades & material consumption per m3. Drives production consumption + selling rate.",
            mix_cols, mix_ex, accent=NAVY2)
defname("GradeList", "'Setup - Mix Design'!$A$5:$A$304")
# mix lookup table range A:I
MIX_TBL = "'Setup - Mix Design'!$A$5:$I$304"

# ============================================================
# 4. SETUP - VEHICLES
# ============================================================
veh_cols = [
    {"h": "Vehicle No.", "w": 16, "type": "input"},
    {"h": "Type", "w": 16, "type": "input"},
    {"h": "Capacity (m3)", "w": 13, "type": "num"},
    {"h": "Default Driver", "w": 22, "type": "input"},
    {"h": "Status", "w": 14, "type": "input"},
]
veh_ex = []  # ready-to-use: enter your own vehicles
ws_veh = build_sheet("Setup - Vehicles", "Setup  -  Vehicles",
            "Transit mixer / pump fleet. Dispatch picks the vehicle; driver auto-fills.",
            veh_cols, veh_ex, accent=NAVY2)
defname("VehicleList", "'Setup - Vehicles'!$A$5:$A$304")
VEH_TBL = "'Setup - Vehicles'!$A$5:$D$304"
# status dropdown
add_list_validation(ws_veh, "VehStatusList", f"E{DATA_START}:E{DATA_START+ROWS-1}")
defname("VehStatusList", "'Lists'!$A$2:$A$4")

# ============================================================
# 5. SETUP - DRIVERS
# ============================================================
drv_cols = [
    {"h": "Driver Name", "w": 24, "type": "input"},
    {"h": "Phone", "w": 16, "type": "input"},
    {"h": "Licence No.", "w": 20, "type": "input"},
    {"h": "Notes", "w": 30, "type": "input"},
]
drv_ex = []  # ready-to-use: enter your own drivers
build_sheet("Setup - Drivers", "Setup  -  Drivers",
            "Driver master.", drv_cols, drv_ex, accent=NAVY2)
defname("DriverList", "'Setup - Drivers'!$A$5:$A$304")

# ============================================================
# 6. SETUP - MATERIALS
# ============================================================
mat_cols = [
    {"h": "Material", "w": 22, "type": "input"},
    {"h": "Unit", "w": 10, "type": "input"},
    {"h": "Opening Stock", "w": 14, "type": "num"},
    {"h": "Purchase Rate (\u20b9/unit)", "w": 16, "type": "money"},
]
mat_ex = [
    ("Cement", "kg", 0, 7.5),
    ("Sand", "kg", 0, 1.2),
    ("Aggregate 20mm", "kg", 0, 1.0),
    ("Aggregate 10mm", "kg", 0, 1.1),
    ("Admixture", "kg", 0, 95),
    ("Diesel", "ltr", 0, 92),
]
build_sheet("Setup - Materials", "Setup  -  Materials",
            "Raw material master with opening stock & purchase rate. Drives the Stock Register.",
            mat_cols, mat_ex, accent=NAVY2)
defname("MaterialList", "'Setup - Materials'!$A$5:$A$304")
MAT_TBL = "'Setup - Materials'!$A$5:$D$304"

# ============================================================
# 7. ORDERS
# ============================================================
ord_cols = [
    {"h": "Date", "w": 14, "type": "date"},
    {"h": "Order No.", "w": 14, "type": "input"},
    {"h": "Client", "w": 28, "type": "input"},
    {"h": "Site / Location", "w": 24, "type": "input"},
    {"h": "Grade", "w": 10, "type": "input"},
    {"h": "Qty (m3)", "w": 11, "type": "num"},
    {"h": "Rate (\u20b9/m3)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(E{r}=\"\",\"\",VLOOKUP(E{r},{mix},9,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Order Value (\u20b9)", "w": 15, "type": "calc",
     "formula": "=IF(OR(F{r}=\"\",G{r}=\"\"),\"\",F{r}*G{r})"},
    {"h": "Delivered (m3)", "w": 13, "type": "calc",
     "formula": "=IF(B{r}=\"\",\"\",SUMIF('Dispatch (Challan)'!$C$5:$C$304,B{r},'Dispatch (Challan)'!$F$5:$F$304))"},
    {"h": "Balance (m3)", "w": 12, "type": "calc",
     "formula": "=IF(F{r}=\"\",\"\",F{r}-I{r})"},
    {"h": "Status", "w": 13, "type": "calc",
     "formula": "=IF(F{r}=\"\",\"\",IF(I{r}=0,\"Pending\",IF(I{r}>=F{r},\"Completed\",\"Partial\")))"},
]
ord_ex = []  # ready-to-use: empty order book
ws_ord = build_sheet("Orders", "Orders  -  Daily Order Book",
            "Pick client & grade from dropdowns. Rate, value, delivered qty, balance & status auto-calculate.",
            ord_cols, ord_ex, accent=NAVY)
add_list_validation(ws_ord, "ClientList", f"C{DATA_START}:C{DATA_START+ROWS-1}")
add_list_validation(ws_ord, "GradeList", f"E{DATA_START}:E{DATA_START+ROWS-1}")

# ============================================================
# 8. DISPATCH (CHALLAN)
# ============================================================
dis_cols = [
    {"h": "Date", "w": 14, "type": "date"},
    {"h": "Challan No.", "w": 14, "type": "input"},
    {"h": "Order No.", "w": 14, "type": "input"},
    {"h": "Client", "w": 28, "type": "input"},
    {"h": "Grade", "w": 10, "type": "input"},
    {"h": "Qty (m3)", "w": 11, "type": "num"},
    {"h": "Vehicle No.", "w": 16, "type": "input"},
    {"h": "Driver", "w": 22, "type": "calc",
     "formula": "=IFERROR(IF(G{r}=\"\",\"\",VLOOKUP(G{r},{veh},4,0)),\"\")".replace("{veh}", VEH_TBL)},
    {"h": "Rate (\u20b9/m3)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(E{r}=\"\",\"\",VLOOKUP(E{r},{mix},9,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Amount (\u20b9)", "w": 15, "type": "calc",
     "formula": "=IF(OR(F{r}=\"\",I{r}=\"\"),\"\",F{r}*I{r})"},
    {"h": "Status", "w": 14, "type": "input"},
]
dis_ex = []  # ready-to-use: empty challan log
ws_dis = build_sheet("Dispatch (Challan)", "Dispatch  -  Challans",
            "Each delivery challan. Pick client / grade / vehicle; driver, rate & amount auto-fill. Delivered qty rolls up to Orders.",
            dis_cols, dis_ex, accent=GREEN if False else NAVY)
add_list_validation(ws_dis, "ClientList", f"D{DATA_START}:D{DATA_START+ROWS-1}")
add_list_validation(ws_dis, "GradeList", f"E{DATA_START}:E{DATA_START+ROWS-1}")
add_list_validation(ws_dis, "VehicleList", f"G{DATA_START}:G{DATA_START+ROWS-1}")
add_list_validation(ws_dis, "DispStatusList", f"K{DATA_START}:K{DATA_START+ROWS-1}")
defname("DispStatusList", "'Lists'!$B$2:$B$5")

# ============================================================
# 9. BATCH PRODUCTION (auto material consumption)
# ============================================================
prod_cols = [
    {"h": "Date", "w": 14, "type": "date"},
    {"h": "Batch No.", "w": 12, "type": "input"},
    {"h": "Grade", "w": 10, "type": "input"},
    {"h": "Qty (m3)", "w": 11, "type": "num"},
    {"h": "Operator", "w": 18, "type": "input"},
    {"h": "Cement (kg)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r},{mix},2,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Sand (kg)", "w": 12, "type": "calc",
     "formula": "=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r},{mix},3,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Agg 20mm (kg)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r},{mix},4,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Agg 10mm (kg)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r},{mix},5,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Water (ltr)", "w": 12, "type": "calc",
     "formula": "=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r},{mix},6,0)),\"\")".replace("{mix}", MIX_TBL)},
    {"h": "Admixture (kg)", "w": 13, "type": "calc",
     "formula": "=IFERROR(IF(OR(C{r}=\"\",D{r}=\"\"),\"\",D{r}*VLOOKUP(C{r},{mix},7,0)),\"\")".replace("{mix}", MIX_TBL)},
]
prod_ex = []  # ready-to-use: empty production log
ws_prod = build_sheet("Batch Production", "Batch Production  -  Material Consumption",
            "Enter grade + m3 only. Cement / sand / aggregate / water / admixture consumed are computed from Mix Design.",
            prod_cols, prod_ex, accent=NAVY)
add_list_validation(ws_prod, "GradeList", f"C{DATA_START}:C{DATA_START+ROWS-1}")

# ============================================================
# 10. MATERIAL RECEIPT
# ============================================================
rec_cols = [
    {"h": "Date", "w": 14, "type": "date"},
    {"h": "Material", "w": 22, "type": "input"},
    {"h": "Qty Received", "w": 14, "type": "num"},
    {"h": "Unit", "w": 10, "type": "calc",
     "formula": "=IFERROR(IF(B{r}=\"\",\"\",VLOOKUP(B{r},{mat},2,0)),\"\")".replace("{mat}", MAT_TBL)},
    {"h": "Rate (\u20b9/unit)", "w": 14, "type": "num"},
    {"h": "Amount (\u20b9)", "w": 15, "type": "calc",
     "formula": "=IF(OR(C{r}=\"\",E{r}=\"\"),\"\",C{r}*E{r})"},
    {"h": "Supplier", "w": 24, "type": "input"},
    {"h": "Invoice No.", "w": 16, "type": "input"},
]
rec_ex = []  # ready-to-use: empty receipt log
ws_rec = build_sheet("Material Receipt", "Material Receipt  -  Purchases",
            "Incoming raw material. Unit auto-fills; amount auto-calculates. Feeds 'Received' in the Stock Register.",
            rec_cols, rec_ex, accent=NAVY)
add_list_validation(ws_rec, "MaterialList", f"B{DATA_START}:B{DATA_START+ROWS-1}")

# ============================================================
# 11. FUEL LOG
# ============================================================
fuel_cols = [
    {"h": "Date", "w": 14, "type": "date"},
    {"h": "Vehicle No.", "w": 16, "type": "input"},
    {"h": "Diesel (ltr)", "w": 12, "type": "num"},
    {"h": "Odometer (km)", "w": 14, "type": "num"},
    {"h": "Rate (\u20b9/ltr)", "w": 12, "type": "num"},
    {"h": "Amount (\u20b9)", "w": 15, "type": "calc",
     "formula": "=IF(OR(C{r}=\"\",E{r}=\"\"),\"\",C{r}*E{r})"},
    {"h": "Filled By", "w": 18, "type": "input"},
]
fuel_ex = []  # ready-to-use: empty fuel log
ws_fuel = build_sheet("Fuel Log", "Fuel Log  -  Diesel Issued",
            "Diesel issued per vehicle. Amount auto-calculates; total diesel feeds the Stock Register.",
            fuel_cols, fuel_ex, accent=NAVY)
add_list_validation(ws_fuel, "VehicleList", f"B{DATA_START}:B{DATA_START+ROWS-1}")

# ============================================================
# 12. STOCK REGISTER (fully automatic)
# ============================================================
ws = wb.create_sheet("Stock Register")
ws.sheet_view.showGridLines = False
stock_cols = [
    ("Material", 22), ("Unit", 10), ("Opening Stock", 14), ("Received", 14),
    ("Consumed", 14), ("Closing Stock", 15), ("Value @ Rate (\u20b9)", 18),
]
set_widths(ws, [w for _, w in stock_cols])
title_block(ws, "Stock Register  -  Live Balances",
            "Opening + Received - Consumed = Closing. 100% automatic from Setup, Production, Receipt & Fuel.", len(stock_cols))
for i, (h, _) in enumerate(stock_cols, start=1):
    ws.cell(row=HDR_ROW, column=i, value=h)
style_header(ws, HDR_ROW, len(stock_cols), fill=NAVY2)
ws.freeze_panes = f"A{DATA_START}"

# consumption mapping: material name -> consumed formula
prod_rng = "'Batch Production'!"
consumed = {
    "Cement": f"=SUM({prod_rng}$F$5:$F$304)",
    "Sand": f"=SUM({prod_rng}$G$5:$G$304)",
    "Aggregate 20mm": f"=SUM({prod_rng}$H$5:$H$304)",
    "Aggregate 10mm": f"=SUM({prod_rng}$I$5:$I$304)",
    "Admixture": f"=SUM({prod_rng}$K$5:$K$304)",
    "Diesel": "=SUM('Fuel Log'!$C$5:$C$304)",
}
stock_materials = ["Cement", "Sand", "Aggregate 20mm", "Aggregate 10mm", "Admixture", "Diesel"]
for idx, mat in enumerate(stock_materials):
    rr = DATA_START + idx
    ws.cell(row=rr, column=1, value=mat)
    ws.cell(row=rr, column=2, value=f"=IFERROR(VLOOKUP(A{rr},{MAT_TBL},2,0),\"\")")
    ws.cell(row=rr, column=3, value=f"=IFERROR(VLOOKUP(A{rr},{MAT_TBL},3,0),0)")
    ws.cell(row=rr, column=4, value=f"=SUMIF('Material Receipt'!$B$5:$B$304,A{rr},'Material Receipt'!$C$5:$C$304)")
    ws.cell(row=rr, column=5, value=consumed.get(mat, 0))
    ws.cell(row=rr, column=6, value=f"=C{rr}+D{rr}-E{rr}")
    ws.cell(row=rr, column=7, value=f"=IFERROR(F{rr}*VLOOKUP(A{rr},{MAT_TBL},4,0),\"\")")
    for ci in range(1, 8):
        cell = ws.cell(row=rr, column=ci)
        cell.border = border_all
        cell.fill = PatternFill("solid", fgColor=CALC_BG if ci > 2 else WHITE)
        cell.font = CALC_FONT if ci > 2 else Font(bold=True, color=NAVY)
        if ci in (3, 4, 5, 6):
            cell.number_format = "#,##0.00"
        if ci == 7:
            cell.number_format = '\u20b9#,##0.00'
# total row
tr = DATA_START + len(stock_materials)
ws.cell(row=tr, column=1, value="TOTAL")
ws.cell(row=tr, column=7, value=f"=SUM(G{DATA_START}:G{tr-1})")
for ci in range(1, 8):
    cell = ws.cell(row=tr, column=ci)
    cell.fill = PatternFill("solid", fgColor=GOLD)
    cell.font = Font(bold=True, color=NAVY)
    cell.border = border_all
    if ci == 7:
        cell.number_format = '\u20b9#,##0.00'

# ============================================================
# 13. DASHBOARD
# ============================================================
ws = wb.create_sheet("Dashboard")
ws.sheet_view.showGridLines = False
set_widths(ws, [3, 30, 20, 6, 16, 14, 14])
title_block(ws, "Dashboard  -  Plant Overview", "Live totals across the whole workbook.", 7)

def kpi(row, col, label, formula, fmt="#,##0.00", color=GOLD):
    lc = ws.cell(row=row, column=col, value=label)
    lc.font = Font(bold=True, color="9AA7BD", size=10)
    lc.fill = PatternFill("solid", fgColor=NAVY2)
    lc.alignment = Alignment(indent=1, vertical="center")
    vc = ws.cell(row=row + 1, column=col, value=formula)
    vc.font = Font(bold=True, color=color, size=18)
    vc.fill = PatternFill("solid", fgColor=NAVY2)
    vc.number_format = fmt
    vc.alignment = Alignment(indent=1, vertical="center")
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + 1)
    ws.merge_cells(start_row=row + 1, start_column=col, end_row=row + 1, end_column=col + 1)
    ws.row_dimensions[row].height = 18
    ws.row_dimensions[row + 1].height = 30

kpi(4, 2, "TOTAL PRODUCTION (m3)", "=SUM('Batch Production'!D5:D304)", "#,##0.0", GOLD)
kpi(4, 5, "TOTAL DISPATCHED (m3)", "=SUM('Dispatch (Challan)'!F5:F304)", "#,##0.0", GREEN)
kpi(7, 2, "ORDER BOOK VALUE (\u20b9)", "=SUM(Orders!H5:H304)", '\u20b9#,##0', GOLD)
kpi(7, 5, "DISPATCHED VALUE (\u20b9)", "=SUM('Dispatch (Challan)'!J5:J304)", '\u20b9#,##0', GREEN)
kpi(10, 2, "MATERIAL PURCHASE (\u20b9)", "=SUM('Material Receipt'!F5:F304)", '\u20b9#,##0', BLUE)
kpi(10, 5, "DIESEL USED (ltr)", "=SUM('Fuel Log'!C5:C304)", "#,##0", BLUE)

# production by grade table (for chart)
gr_row = 14
ws.cell(row=gr_row, column=2, value="PRODUCTION BY GRADE").font = Font(bold=True, color=GOLD, size=12)
hdr = gr_row + 1
ws.cell(row=hdr, column=2, value="Grade")
ws.cell(row=hdr, column=3, value="Produced (m3)")
style_header(ws, hdr, 3, fill=NAVY2)
ws.cell(row=hdr, column=1).fill = PatternFill("solid", fgColor=WHITE)
grades = ["M15", "M20", "M25", "M30", "M35", "M40"]
for i, g in enumerate(grades):
    rr = hdr + 1 + i
    ws.cell(row=rr, column=2, value=g).font = Font(bold=True, color=NAVY)
    c = ws.cell(row=rr, column=3, value=f"=SUMIF('Batch Production'!$C$5:$C$304,B{rr},'Batch Production'!$D$5:$D$304)")
    c.number_format = "#,##0.0"
    c.font = CALC_FONT
    for ci in (2, 3):
        ws.cell(row=rr, column=ci).border = border_all
        ws.cell(row=rr, column=ci).fill = PatternFill("solid", fgColor=CALC_BG if ci == 3 else WHITE)

chart = BarChart()
chart.type = "col"
chart.title = "Production by Grade (m3)"
chart.height = 7.5
chart.width = 14
data = Reference(ws, min_col=3, min_row=hdr, max_row=hdr + len(grades))
cats = Reference(ws, min_col=2, min_row=hdr + 1, max_row=hdr + len(grades))
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
chart.legend = None
ws.add_chart(chart, "E15")

# top clients by dispatched volume
tc_row = hdr + len(grades) + 3
ws.cell(row=tc_row, column=2, value="DISPATCH VOLUME BY CLIENT").font = Font(bold=True, color=GOLD, size=12)
th = tc_row + 1
ws.cell(row=th, column=2, value="Client")
ws.cell(row=th, column=3, value="Dispatched (m3)")
style_header(ws, th, 3, fill=NAVY2)
for i in range(8):
    rr = th + 1 + i
    cli = ws.cell(row=rr, column=2, value=f"=IFERROR(INDEX('Setup - Clients'!$A$5:$A$304,{i+1}),\"\")")
    cli.font = Font(color=NAVY)
    c = ws.cell(row=rr, column=3, value=f"=IF(B{rr}=\"\",\"\",SUMIF('Dispatch (Challan)'!$D$5:$D$304,B{rr},'Dispatch (Challan)'!$F$5:$F$304))")
    c.number_format = "#,##0.0"
    c.font = CALC_FONT
    for ci in (2, 3):
        ws.cell(row=rr, column=ci).border = border_all
        ws.cell(row=rr, column=ci).fill = PatternFill("solid", fgColor=CALC_BG if ci == 3 else WHITE)

# ============================================================
# LISTS (hidden helper for static dropdowns)
# ============================================================
wl = wb.create_sheet("Lists")
wl["A1"] = "Vehicle Status"
for i, v in enumerate(["Active", "Maintenance", "Inactive"], start=2):
    wl[f"A{i}"] = v
wl["B1"] = "Dispatch Status"
for i, v in enumerate(["Scheduled", "Dispatched", "Delivered", "Cancelled"], start=2):
    wl[f"B{i}"] = v
wl.sheet_state = "hidden"

# order tabs nicely
order = ["Instructions", "Dashboard",
         "Setup - Clients", "Setup - Mix Design", "Setup - Vehicles", "Setup - Drivers", "Setup - Materials",
         "Orders", "Dispatch (Challan)", "Batch Production", "Material Receipt", "Fuel Log",
         "Stock Register", "Lists"]
wb._sheets.sort(key=lambda s: order.index(s.title) if s.title in order else 99)

# tab colours
colourmap = {
    "Instructions": GOLD, "Dashboard": GOLD,
    "Setup - Clients": "5B6B86", "Setup - Mix Design": "5B6B86", "Setup - Vehicles": "5B6B86",
    "Setup - Drivers": "5B6B86", "Setup - Materials": "5B6B86",
    "Orders": NAVY2, "Dispatch (Challan)": "1E7F4F", "Batch Production": NAVY2,
    "Material Receipt": NAVY2, "Fuel Log": NAVY2, "Stock Register": "1E5F8F",
}
for s in wb._sheets:
    if s.title in colourmap:
        s.sheet_properties.tabColor = colourmap[s.title]

out = "excel-deliverable/RMC-Plant-Daily-Workbook.xlsx"
wb.save(out)
print("Saved", out)
print("Sheets:", [s.title for s in wb._sheets])
