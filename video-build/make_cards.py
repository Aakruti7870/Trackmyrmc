import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1920, 1080
OUT = "video-build/cards"
os.makedirs(OUT, exist_ok=True)

FD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(sz, bold=True):
    return ImageFont.truetype(FD if bold else FR, sz)

GOLD = (240, 185, 45)
EMER = (37, 190, 150)
WHITE = (240, 248, 246)
MUTE = (150, 178, 172)
CHIP_BG = (37, 190, 150, 40)

def bg():
    # diagonal navy->teal gradient via small image upscaled
    sw, sh = 64, 36
    g = Image.new("RGB", (sw, sh))
    tl = (12, 40, 56); br = (7, 30, 30)
    px = g.load()
    for y in range(sh):
        for x in range(sw):
            t = (x/sw + y/sh)/2
            px[x, y] = tuple(int(tl[i] + (br[i]-tl[i])*t) for i in range(3))
    img = g.resize((W, H), Image.BILINEAR).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    # soft radial glow top-right (emerald)
    glow = Image.new("RGBA", (W, H), (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W-900, -400, W+300, 700], fill=(37,190,150,60))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    # dot grid
    for y in range(90, H, 60):
        for x in range(90, W, 60):
            d.ellipse([x-1, y-1, x+1, y+1], fill=(255,255,255,12))
    return img

def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def glass(img, box, r, fill, outline=None, width=2):
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)
    img.alpha_composite(layer)

def wrap(text, fnt, maxw, draw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= maxw:
            cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def header(img):
    d = ImageDraw.Draw(img, "RGBA")
    logo = Image.open("rmc-app/public/pwa-512.png").convert("RGBA").resize((64,64), Image.LANCZOS)
    img.paste(logo, (90, 60), logo)
    d.text((168, 68), "CONCRETE", font=font(26), fill=WHITE)
    d.text((168, 98), "KING", font=font(26), fill=GOLD)

def chip(img, x, y, text, color=EMER):
    f = font(24)
    d = ImageDraw.Draw(img, "RGBA")
    tw = d.textlength(text, font=f)
    glass(img, [x, y, x+tw+44, y+48], 24, (color[0],color[1],color[2],55), color, 2)
    d.text((x+22, y+11), text, font=f, fill=WHITE)

# ---------- ICON PANEL ----------
def icon_panel(img, kind):
    px0, py0, px1, py1 = 1080, 250, 1810, 900
    glass(img, [px0, py0, px1, py1], 40, (255,255,255,20), (37,190,150,130), 2)
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = (px0+px1)//2, (py0+py1)//2
    S = 150
    g = GOLD; e = EMER
    lw = 14
    if kind == "clipboard":
        d.rounded_rectangle([cx-110, cy-150, cx+110, cy+150], 20, outline=g, width=lw)
        d.rounded_rectangle([cx-45, cy-185, cx+45, cy-135], 14, fill=g)
        for i, yy in enumerate(range(cy-70, cy+120, 55)):
            d.line([cx-70, yy, cx+70, yy], fill=e, width=10)
    elif kind == "truck":
        d.rounded_rectangle([cx-190, cy-70, cx+20, cy+70], 16, outline=g, width=lw)
        d.polygon([(cx+20, cy-30),(cx+120, cy-30),(cx+180, cy+20),(cx+180, cy+70),(cx+20, cy+70)], outline=g, width=lw)
        for wx in (cx-120, cx+120):
            d.ellipse([wx-40, cy+50, wx+40, cy+130], fill=(7,30,30), outline=e, width=lw)
        d.ellipse([cx-150, cy-160, cx-70, cy-80], outline=e, width=10)  # mixer drum hint
    elif kind == "bell":
        d.arc([cx-120, cy-150, cx+120, cy+120], 180, 360, fill=g, width=lw)
        d.line([cx-120, cy+60, cx+120, cy+60], fill=g, width=lw)
        d.line([cx-120, cy+60, cx-120, cy+20], fill=g, width=lw)
        d.line([cx+120, cy+60, cx+120, cy+20], fill=g, width=lw)
        d.ellipse([cx-25, cy+60, cx+25, cy+110], outline=g, width=lw)
        d.ellipse([cx-18, cy-175, cx+18, cy-139], fill=g)
        d.arc([cx+70, cy-120, cx+180, cy-10], 300, 40, fill=e, width=8)
        d.arc([cx+100, cy-140, cx+230, cy+10], 300, 40, fill=e, width=8)
    elif kind == "docarrow":
        d.rounded_rectangle([cx-150, cy-150, cx+40, cy+150], 18, outline=g, width=lw)
        for yy in range(cy-90, cy+40, 45):
            d.line([cx-110, yy, cx-10, yy], fill=e, width=9)
        d.line([cx-30, cy+110, cx+170, cy+110], fill=g, width=lw)
        d.polygon([(cx+150, cy+80),(cx+210, cy+110),(cx+150, cy+140)], fill=g)
    elif kind == "chart":
        base = cy+150
        d.line([cx-170, base, cx+190, base], fill=g, width=lw)
        d.line([cx-170, cy-160, cx-170, base], fill=g, width=lw)
        bars = [(cx-120, 120, e),(cx-30, 200, g),(cx+60, 150, e),(cx+150, 260, g)]
        for bx, bh, col in bars:
            d.rounded_rectangle([bx-30, base-bh, bx+30, base-8], 8, fill=col)
    elif kind == "grid":
        for i,(ox,oy) in enumerate([(-160,-150),(20,-150),(-160,30),(20,30)]):
            col = g if i in (0,3) else e
            d.rounded_rectangle([cx+ox, cy+oy, cx+ox+140, cy+oy+120], 16, outline=col, width=lw)

# ---------- SCREENSHOT FRAME ----------
def screenshot_panel(img, path):
    d = ImageDraw.Draw(img, "RGBA")
    px0, py0, px1, py1 = 1060, 210, 1820, 930
    # shadow
    sh = Image.new("RGBA", (W, H), (0,0,0,0))
    ImageDraw.Draw(sh).rounded_rectangle([px0+18, py0+26, px1+18, py1+26], 28, fill=(0,0,0,120))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(img, "RGBA")
    rounded(d, [px0, py0, px1, py1], 28, fill=(10,26,30,255), outline=(37,190,150,120), width=2)
    # title bar dots
    d.ellipse([px0+28, py0+26, px0+44, py0+42], fill=(240,120,110))
    d.ellipse([px0+56, py0+26, px0+72, py0+42], fill=(240,185,45))
    d.ellipse([px0+84, py0+26, px0+100, py0+42], fill=(37,190,150))
    inner = (px0+20, py0+64, px1-20, py1-20)
    iw, ih = inner[2]-inner[0], inner[3]-inner[1]
    ss = Image.open(path).convert("RGB")
    # cover-fit
    sr = ss.width/ss.height; tr = iw/ih
    if sr > tr:
        nh = ih; nw = int(nh*sr)
    else:
        nw = iw; nh = int(nw/sr)
    ss = ss.resize((nw, nh), Image.LANCZOS)
    ss = ss.crop(((nw-iw)//2, 0, (nw-iw)//2+iw, ih))
    mask = Image.new("L", (iw, ih), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,iw,ih], 14, fill=255)
    img.paste(ss, (inner[0], inner[1]), mask)

def content(img, chip_text, chip_col, step, heading, bullets):
    d = ImageDraw.Draw(img, "RGBA")
    x = 90; y = 250
    if chip_text:
        chip(img, x, y, chip_text, chip_col); y += 90
    if step:
        d.text((x, y), step, font=font(120), fill=GOLD); y += 150
    for ln in wrap(heading, font(74), 900, d):
        d.text((x, y), ln, font=font(74), fill=WHITE); y += 88
    y += 24
    for b in bullets:
        d.ellipse([x+4, y+18, x+18, y+32], fill=EMER)
        for j, ln in enumerate(wrap(b, font(34, False), 850, d)):
            d.text((x+40, y), ln, font=font(34, False), fill=MUTE); y += 46
        y += 18

def save(img, name):
    img.convert("RGB").save(f"{OUT}/{name}.jpg", quality=92)
    print("card", name)

# ================= CARDS =================
# 01 intro
img = bg().convert("RGBA")
d = ImageDraw.Draw(img, "RGBA")
logo = Image.open("rmc-app/public/pwa-512.png").convert("RGBA").resize((260,260), Image.LANCZOS)
img.paste(logo, (W//2-130, 210), logo)
t = "CONCRETE KING"; f = font(96)
d.text(((W-d.textlength(t, font=f))//2, 500), t, font=f, fill=WHITE)
d.rounded_rectangle([W//2-60, 630, W//2+60, 638], 4, fill=GOLD)
s = "A quick guide to how it works"; f2 = font(40, False)
d.text(((W-d.textlength(s, font=f2))//2, 680), s, font=f2, fill=MUTE)
u = "trackmyrmc.com"; f3 = font(34)
d.text(((W-d.textlength(u, font=f3))//2, 760), u, font=f3, fill=EMER)
save(img, "01_intro")

# 02 paths (two columns)
img = bg().convert("RGBA"); header(img)
d = ImageDraw.Draw(img, "RGBA")
h = "One platform, two journeys"; f = font(72)
d.text(((W-d.textlength(h, font=f))//2, 220), h, font=f, fill=WHITE)
cols = [(360, "FOR CUSTOMERS", "grid", ["Discover plants","Order concrete","Track delivery"], EMER, "clipboard"),
        (1160, "FOR PLANT TEAMS", "grid", ["Manage orders","Dispatch fleet","Batch & report"], GOLD, "chart")]
for bx, title, _, items, col, icon in cols:
    glass(img, [bx, 380, bx+400, 900], 32, (255,255,255,20), (col[0],col[1],col[2],130), 2)
    d = ImageDraw.Draw(img, "RGBA")
    # simple icon circle
    cx = bx+200
    d.ellipse([cx-70, 430, cx+70, 570], outline=col, width=12)
    if icon == "clipboard":
        d.rounded_rectangle([cx-35, 470, cx+35, 545], 8, outline=col, width=8)
        d.rounded_rectangle([cx-15, 458, cx+15, 478], 5, fill=col)
    else:
        base=545
        for i,bh in enumerate([40,70,55]):
            d.rounded_rectangle([cx-45+i*35, base-bh, cx-15+i*35, base], 4, fill=col)
    tw = d.textlength(title, font=font(32))
    d.text((cx-tw/2, 610), title, font=font(32), fill=col)
    yy = 680
    for it in items:
        itw = d.textlength(it, font=font(30, False))
        d.text((cx-itw/2, yy), it, font=font(30, False), fill=WHITE); yy += 56
save(img, "02_paths")

# helper for standard feature card
def feature(name, chip_text, chip_col, step, heading, bullets, right):
    img = bg().convert("RGBA"); header(img)
    content(img, chip_text, chip_col, step, heading, bullets)
    if right[0] == "shot":
        screenshot_panel(img, right[1])
    else:
        icon_panel(img, right[1])
    save(img, name)

CUST = ("FOR CUSTOMERS", EMER)
STAFF = ("FOR PLANT TEAMS", GOLD)

# 03 find / sign in
feature("03_find", *CUST, "1", "Find plants near you",
        ["Sign in with your phone number","See approved RMC plants on a live map","Filter by distance and grade"],
        ("shot", "play-store-assets/screenshot-2-login.jpg"))
# 04 order
feature("04_order", *CUST, "2", "Place your order",
        ["Choose grade, quantity and date","Confirm in just a few taps","Reorder past deliveries instantly"],
        ("icon", "clipboard"))
# 05 track
feature("05_track", *CUST, "3", "Track every delivery",
        ["Live transit-mixer location","Digital delivery challans","Proof-of-delivery photos"],
        ("icon", "truck"))
# 06 notify
feature("06_notify", *CUST, "4", "Stay updated",
        ["WhatsApp and in-app alerts","From confirmation to the pour","Never miss a delivery step"],
        ("icon", "bell"))
# 07 staff dashboard -> home screenshot
feature("07_staff", *STAFF, "", "A dashboard for the whole plant",
        ["Sign in as staff","One view of the operation","Live orders, dispatch and fleet"],
        ("shot", "play-store-assets/screenshot-1-home.jpg"))
# 08 dispatch
feature("08_dispatch", *STAFF, "", "Orders & dispatch",
        ["Manage incoming orders","Generate dispatch challans","Assign transit mixers"],
        ("icon", "docarrow"))
# 09 fleet
feature("09_fleet", *STAFF, "", "Fleet, batching & mix",
        ["Track your transit mixers","Log batches by grade & quantity","Precise mix-design proportions"],
        ("icon", "truck"))
# 10 reports
feature("10_reports", *STAFF, "", "Live reports",
        ["Production & dispatch volume","Client activity insights","Everything in one place"],
        ("icon", "chart"))
# 11 onboard -> register screenshot
feature("11_onboard", "OWN A PLANT?", GOLD, "", "Register in minutes",
        ["List your plant on the map","Start receiving nearby orders","Grow your customer base"],
        ("shot", "play-store-assets/screenshot-3-verify.jpg"))

# 12 outro
img = bg().convert("RGBA")
d = ImageDraw.Draw(img, "RGBA")
logo = Image.open("rmc-app/public/pwa-512.png").convert("RGBA").resize((200,200), Image.LANCZOS)
img.paste(logo, (W//2-100, 300), logo)
t = "CONCRETE KING"; f = font(84)
d.text(((W-d.textlength(t, font=f))//2, 540), t, font=f, fill=WHITE)
s = "Concrete, delivered smarter."; f2 = font(42, False)
d.text(((W-d.textlength(s, font=f2))//2, 650), s, font=f2, fill=GOLD)
u = "trackmyrmc.com"; f3 = font(38)
d.text(((W-d.textlength(u, font=f3))//2, 730), u, font=f3, fill=EMER)
save(img, "12_outro")
print("ALL CARDS DONE")
