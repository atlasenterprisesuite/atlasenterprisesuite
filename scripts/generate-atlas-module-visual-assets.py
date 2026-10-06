#!/usr/bin/env python3
"""Generate the ATLAS module visual collection from deterministic art direction.

The output is intentionally text-free: module names, readiness and state remain
accessible UI copy. Covers are high-resolution editorial/technical scenes built
from a shared ATLAS visual grammar and module-specific motifs.
"""

from __future__ import annotations

import hashlib
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps, features

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "public" / "atlas" / "visuals" / "modules"
MASTER = (2048, 1152)
WIDTHS = (640, 1280, 1920)

MODULES = {
    "cloud": ("Platform", "cloud"),
    "work": ("Platform", "workspace"),
    "automations": ("Platform", "flow"),
    "assistant": ("Intelligence", "neural"),
    "knowledge": ("Intelligence", "library"),
    "bible-os": ("Intelligence", "codex"),
    "business": ("Business", "command"),
    "revenue": ("Business", "growth"),
    "advisory": ("Business", "strategy"),
    "finance": ("Finance", "capital"),
    "accounting": ("Finance", "ledger"),
    "pay": ("Finance", "payments"),
    "tax": ("Finance", "documents"),
    "crm": ("Business", "relationships"),
    "commerce": ("Business", "market"),
    "inventory": ("Operations", "warehouse"),
    "analytics": ("Business", "analytics"),
    "connect": ("Communications", "network"),
    "telecom": ("Communications", "signal"),
    "people": ("People", "people"),
    "payroll": ("People", "payroll"),
    "learning": ("People", "learning"),
    "health": ("Health", "dna"),
    "insurance": ("Protection", "shield"),
    "studio": ("Creative", "studio"),
    "site-review": ("Creative", "review"),
    "voice": ("Creative", "voice"),
    "events": ("Entertainment", "stage"),
    "frontier": ("Entertainment", "frontier"),
    "hospitality": ("Hospitality", "hospitality"),
    "ride": ("Mobility", "road"),
    "gps": ("Mobility", "map"),
    "city": ("Spatial", "city"),
    "aviation": ("Mobility", "aviation"),
    "galaxy": ("Spatial", "galaxy"),
    "device-os": ("Platform", "device"),
    "release-control": ("Platform", "release"),
    "execution": ("Platform", "execution"),
    "suite": ("Platform", "suite"),
}

PALETTES = {
    "Platform": ((4, 12, 24), (8, 33, 54), (48, 209, 255), (120, 235, 255)),
    "Intelligence": ((5, 8, 24), (20, 24, 58), (126, 104, 255), (93, 224, 255)),
    "Business": ((5, 14, 24), (12, 42, 54), (51, 220, 196), (135, 242, 220)),
    "Finance": ((7, 15, 19), (18, 44, 39), (86, 226, 164), (222, 198, 99)),
    "Operations": ((10, 15, 22), (38, 38, 45), (239, 176, 75), (111, 215, 255)),
    "Communications": ((4, 9, 22), (12, 33, 64), (55, 183, 255), (120, 113, 255)),
    "People": ((13, 10, 22), (47, 27, 48), (244, 137, 190), (109, 220, 255)),
    "Health": ((5, 16, 19), (9, 45, 46), (62, 229, 190), (125, 228, 255)),
    "Protection": ((5, 11, 24), (20, 38, 59), (74, 173, 255), (125, 230, 215)),
    "Creative": ((15, 7, 25), (54, 20, 59), (235, 89, 216), (93, 207, 255)),
    "Entertainment": ((17, 8, 24), (58, 24, 42), (255, 116, 159), (255, 194, 92)),
    "Hospitality": ((13, 12, 17), (49, 39, 34), (228, 182, 116), (113, 209, 207)),
    "Mobility": ((4, 11, 18), (12, 36, 48), (68, 213, 255), (107, 238, 183)),
    "Spatial": ((3, 8, 19), (10, 27, 55), (73, 157, 255), (117, 226, 255)),
}


def seed_for(name: str) -> int:
    return int(hashlib.sha256(f"ATLAS::VISUAL::{name}".encode()).hexdigest()[:16], 16)


def mix(a, b, t: float):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def rgba(c, alpha=255):
    return (*c, alpha)


def gradient_background(size, top, bottom):
    w, h = size
    strip = Image.new("RGB", (1, 256))
    px = strip.load()
    for y in range(256):
        t = y / 255
        px[0, y] = mix(top, bottom, t)
    return strip.resize((w, h), Image.Resampling.BICUBIC).convert("RGBA")


def glow_layer(size, centers):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for x, y, radius, color, strength in centers:
        d.ellipse((x-radius, y-radius, x+radius, y+radius), fill=rgba(color, strength))
    return layer.filter(ImageFilter.GaussianBlur(140))


def perspective_grid(img, color, horizon=0.56):
    w, h = img.size
    d = ImageDraw.Draw(img, "RGBA")
    hy = int(h * horizon)
    for i in range(-10, 11):
        x0 = w // 2 + i * 68
        x1 = w // 2 + i * 410
        d.line((x0, hy, x1, h + 30), fill=rgba(color, 45), width=2)
    for n in range(1, 15):
        t = n / 15
        y = hy + int((t ** 1.8) * (h - hy))
        d.line((0, y, w, y), fill=rgba(color, max(8, 50 - n * 2)), width=2)


def floating_panels(img, rng, accent, secondary, count=11):
    w, h = img.size
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(count):
        pw = rng.randint(120, 340)
        ph = rng.randint(70, 190)
        x = rng.randint(int(w * .43), int(w * .90))
        y = rng.randint(int(h * .12), int(h * .77))
        c = accent if i % 2 == 0 else secondary
        d.rounded_rectangle((x, y, x+pw, y+ph), radius=24, fill=(8, 18, 29, 115), outline=rgba(c, 90), width=2)
        d.line((x+20, y+28, x+pw-20, y+28), fill=rgba(c, 70), width=2)
        for k in range(rng.randint(2, 5)):
            yy = y + 52 + k * 22
            d.rounded_rectangle((x+22, yy, x+22+rng.randint(38, max(42, pw-52)), yy+6), 3, fill=rgba(c, 70))


def draw_nodes(img, rng, center, accent, secondary, n=22, radius=330):
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = center
    pts = []
    for _ in range(n):
        a = rng.random() * math.tau
        r = radius * math.sqrt(rng.random())
        pts.append((cx + math.cos(a)*r, cy + math.sin(a)*r))
    for i, p in enumerate(pts):
        nearest = sorted(pts, key=lambda q: (p[0]-q[0])**2 + (p[1]-q[1])**2)[1:4]
        for q in nearest:
            d.line((*p, *q), fill=rgba(accent if i % 2 else secondary, 40), width=2)
    for i, (x, y) in enumerate(pts):
        c = accent if i % 3 else secondary
        r = 7 if i % 4 else 12
        d.ellipse((x-r, y-r, x+r, y+r), fill=rgba(c, 210), outline=(255,255,255,90), width=1)


def draw_ring_system(img, center, accent, secondary, rng, rings=5):
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = center
    glow = Image.new("RGBA", img.size, (0,0,0,0))
    gd = ImageDraw.Draw(glow, "RGBA")
    for i in range(rings):
        r = 86 + i * 62
        box = (cx-r, cy-r*.66, cx+r, cy+r*.66)
        start = rng.randint(0, 120)
        gd.arc(box, start=start, end=start+235, fill=rgba(accent if i%2==0 else secondary, 160), width=6)
        gd.arc(box, start=start+250, end=start+330, fill=(255,255,255,70), width=2)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(rings):
        r = 86 + i * 62
        box = (cx-r, cy-r*.66, cx+r, cy+r*.66)
        d.arc(box, start=20+i*21, end=250+i*7, fill=rgba(accent if i%2==0 else secondary, 210), width=4)


def draw_architecture(img, rng, accent, secondary, columns=8):
    w, h = img.size
    d = ImageDraw.Draw(img, "RGBA")
    base_y = int(h*.80)
    start_x = int(w*.46)
    gap = int(w*.48/columns)
    for i in range(columns):
        x = start_x + i*gap + rng.randint(-12, 12)
        bh = rng.randint(150, 460)
        bw = rng.randint(55, max(60, gap-8))
        top = base_y-bh
        c = accent if i%3 else secondary
        d.polygon([(x,base_y),(x+bw,base_y),(x+bw-8,top),(x+9,top)], fill=(8,18,26,210), outline=rgba(c,95))
        for yy in range(top+28, base_y-16, 34):
            d.line((x+12,yy,x+bw-14,yy), fill=rgba(c,45), width=2)
        d.line((x+8,top+6,x+bw-10,top+6), fill=rgba(c,170), width=3)


def draw_road(img, accent, secondary, aviation=False):
    w, h = img.size
    d = ImageDraw.Draw(img, "RGBA")
    horizon = int(h*.48)
    d.polygon([(w*.56,horizon),(w*.72,horizon),(w*.96,h),(w*.16,h)], fill=(7,14,20,225))
    d.line((w*.56,horizon,w*.16,h), fill=rgba(accent,130), width=5)
    d.line((w*.72,horizon,w*.96,h), fill=rgba(secondary,130), width=5)
    for n in range(9):
        y0 = horizon + n*n*8
        y1 = min(h, y0+18+n*6)
        x = w*.64 + (n-4)*5
        d.polygon([(x-4,y0),(x+4,y0),(x+18,y1),(x-18,y1)], fill=(235,247,255,140))
    if aviation:
        cx, cy = int(w*.69), int(h*.35)
        d.polygon([(cx-150,cy+15),(cx+145,cy+15),(cx+220,cy+55),(cx+85,cy+45),(cx+18,cy+115),(cx-15,cy+115),(cx-45,cy+45),(cx-200,cy+58)], fill=(210,233,240,110), outline=rgba(accent,180))


def draw_dna(img, accent, secondary):
    w, h = img.size
    d = ImageDraw.Draw(img, "RGBA")
    x0 = w*.69
    top, bottom = h*.16, h*.84
    prev1 = prev2 = None
    for i in range(80):
        t = i/79
        y = top + (bottom-top)*t
        a = t*math.tau*3.0
        x1 = x0 + math.sin(a)*150
        x2 = x0 - math.sin(a)*150
        if prev1:
            d.line((*prev1,x1,y), fill=rgba(accent,190), width=7)
            d.line((*prev2,x2,y), fill=rgba(secondary,190), width=7)
        if i%5==0:
            d.line((x1,y,x2,y), fill=(190,235,232,75), width=3)
        prev1, prev2 = (x1,y), (x2,y)


def draw_voice(img, accent, secondary):
    w, h = img.size
    d = ImageDraw.Draw(img, "RGBA")
    mid = h*.52
    pts=[]
    for i in range(520):
        x = w*.43 + i*(w*.48/519)
        envelope = math.sin(i/519*math.pi)
        y = mid + math.sin(i*.17)*120*envelope + math.sin(i*.047)*55
        pts.append((x,y))
    d.line(pts, fill=rgba(accent,215), width=6)
    d.line([(x,mid+(y-mid)*.48) for x,y in pts], fill=rgba(secondary,100), width=3)


def draw_map(img, accent, secondary):
    w,h=img.size
    d=ImageDraw.Draw(img,"RGBA")
    ox,oy=w*.47,h*.17
    for i in range(13):
        x=ox+i*75
        d.line((x,oy,x-220,h*.88), fill=rgba(accent,35), width=2)
    for j in range(12):
        y=oy+j*65
        d.line((w*.40,y,w*.93,y+130), fill=rgba(secondary,35), width=2)
    route=[]
    for i in range(9):
        x=w*.48+i*100
        y=h*.72-math.sin(i*.9)*130-i*27
        route.append((x,y))
    d.line(route, fill=rgba(accent,220), width=12, joint="curve")
    for x,y in route[::2]:
        d.ellipse((x-12,y-12,x+12,y+12), fill=rgba(secondary,220), outline=(255,255,255,120), width=2)


def draw_shield(img, accent, secondary):
    w,h=img.size
    d=ImageDraw.Draw(img,"RGBA")
    cx,cy=w*.70,h*.50
    pts=[(cx,cy-300),(cx+220,cy-205),(cx+190,cy+80),(cx,cy+315),(cx-190,cy+80),(cx-220,cy-205)]
    d.polygon(pts, fill=(9,25,39,175), outline=rgba(accent,220))
    d.line([(cx,cy-230),(cx,cy+205)], fill=rgba(secondary,100), width=5)
    d.arc((cx-115,cy-90,cx+115,cy+140),25,315,fill=rgba(accent,190),width=8)


def draw_warehouse(img, rng, accent, secondary):
    w,h=img.size
    d=ImageDraw.Draw(img,"RGBA")
    x0,y0=w*.47,h*.24
    for row in range(4):
        for col in range(7):
            x=x0+col*115+(row%2)*18
            y=y0+row*140
            bw=80; bh=92
            c=accent if (row+col)%3 else secondary
            d.polygon([(x,y),(x+bw,y-20),(x+bw+22,y+bh),(x+18,y+bh+20)], fill=(18,25,29,210), outline=rgba(c,80))
            d.line((x+16,y+24,x+bw-4,y+9), fill=rgba(c,100), width=3)


def draw_codex(img, accent, secondary):
    w,h=img.size
    d=ImageDraw.Draw(img,"RGBA")
    cx,cy=w*.69,h*.51
    d.polygon([(cx-300,cy-220),(cx-25,cy-155),(cx-20,cy+265),(cx-315,cy+205)], fill=(20,24,34,210), outline=rgba(accent,120))
    d.polygon([(cx+25,cy-155),(cx+300,cy-220),(cx+315,cy+205),(cx+20,cy+265)], fill=(20,24,34,210), outline=rgba(secondary,120))
    for side in (-1,1):
        for n in range(8):
            y=cy-120+n*42
            if side<0:
                d.line((cx-255,y,cx-55,y+24), fill=(210,230,235,55), width=3)
            else:
                d.line((cx+55,y+24,cx+255,y), fill=(210,230,235,55), width=3)


def module_motif(img, module_id, motif, rng, accent, secondary):
    w,h=img.size
    center=(w*.69,h*.48)
    if motif in {"neural","relationships","people","flow","execution"}:
        draw_nodes(img,rng,center,accent,secondary,n=30 if motif=="neural" else 22,radius=350)
        if motif in {"neural","execution"}: draw_ring_system(img,center,accent,secondary,rng,4)
    elif motif in {"capital","payments","ledger","growth","analytics","payroll"}:
        draw_ring_system(img,center,accent,secondary,rng,6)
        floating_panels(img,rng,accent,secondary,7)
    elif motif in {"cloud","workspace","device","release","suite","command","strategy","market","review","documents"}:
        draw_architecture(img,rng,accent,secondary,8 if motif!="suite" else 11)
        floating_panels(img,rng,accent,secondary,9 if motif!="suite" else 14)
        if motif in {"cloud","suite","release"}: draw_ring_system(img,(w*.69,h*.38),accent,secondary,rng,4)
    elif motif in {"library","learning"}:
        draw_architecture(img,rng,accent,secondary,10)
        draw_nodes(img,rng,center,accent,secondary,n=16,radius=300)
    elif motif=="codex":
        draw_codex(img,accent,secondary)
    elif motif in {"network","signal"}:
        draw_nodes(img,rng,center,accent,secondary,n=26,radius=380)
        for dx in (-230,0,230):
            x=center[0]+dx; y=h*.72
            d=ImageDraw.Draw(img,"RGBA")
            d.line((x,y,x,y-255),fill=rgba(accent,160),width=5)
            for r in (55,100,145): d.arc((x-r,y-350-r*.15,x+r,y-350+r*.15),205,335,fill=rgba(secondary,100),width=4)
    elif motif=="warehouse":
        draw_warehouse(img,rng,accent,secondary)
    elif motif=="dna":
        draw_dna(img,accent,secondary)
        draw_nodes(img,rng,(w*.66,h*.50),accent,secondary,n=14,radius=390)
    elif motif=="shield":
        draw_shield(img,accent,secondary)
        draw_nodes(img,rng,center,accent,secondary,n=12,radius=390)
    elif motif=="voice":
        draw_voice(img,accent,secondary)
        draw_ring_system(img,center,accent,secondary,rng,3)
    elif motif=="studio":
        draw_voice(img,accent,secondary)
        floating_panels(img,rng,accent,secondary,10)
    elif motif=="stage":
        draw_architecture(img,rng,accent,secondary,7)
        d=ImageDraw.Draw(img,"RGBA")
        for x in (w*.52,w*.68,w*.84): d.polygon([(x-35,h*.15),(x+35,h*.15),(x+150,h*.72),(x-150,h*.72)],fill=rgba(accent,20))
    elif motif=="frontier":
        d=ImageDraw.Draw(img,"RGBA")
        for i in range(9):
            x=i*w/8
            y=h*.71-rng.randint(70,310)
            d.polygon([(x-180,h*.82),(x,y),(x+180,h*.82)],fill=(10,24,29,200),outline=rgba(accent if i%2 else secondary,70))
        draw_ring_system(img,(w*.73,h*.37),accent,secondary,rng,3)
    elif motif=="hospitality":
        draw_architecture(img,rng,accent,secondary,9)
        d=ImageDraw.Draw(img,"RGBA")
        d.ellipse((w*.56,h*.64,w*.86,h*.89),fill=(204,171,117,24),outline=rgba(accent,100),width=4)
    elif motif=="road":
        draw_road(img,accent,secondary)
        draw_nodes(img,rng,(w*.72,h*.34),accent,secondary,n=10,radius=270)
    elif motif=="aviation":
        draw_road(img,accent,secondary,aviation=True)
    elif motif=="map":
        draw_map(img,accent,secondary)
    elif motif=="city":
        draw_architecture(img,rng,accent,secondary,11)
        draw_map(img,accent,secondary)
    elif motif=="galaxy":
        draw_architecture(img,rng,accent,secondary,8)
        draw_ring_system(img,(w*.72,h*.37),accent,secondary,rng,7)
    else:
        draw_ring_system(img,center,accent,secondary,rng,5)
        floating_panels(img,rng,accent,secondary,8)


def make_cover(module_id, family, motif):
    rng=random.Random(seed_for(module_id))
    dark,mid,accent,secondary=PALETTES[family]
    img=gradient_background(MASTER,dark,mid)
    img.alpha_composite(glow_layer(MASTER,[
        (int(MASTER[0]*.73),int(MASTER[1]*.34),440,accent,70),
        (int(MASTER[0]*.54),int(MASTER[1]*.72),330,secondary,35),
    ]))
    perspective_grid(img,accent,0.59 if family not in {"Creative","Entertainment"} else 0.64)
    module_motif(img,module_id,motif,rng,accent,secondary)

    # Shared editorial atmosphere: edge falloff + subtle grain + precise light rails.
    overlay=Image.new("RGBA",MASTER,(0,0,0,0))
    od=ImageDraw.Draw(overlay,"RGBA")
    od.rectangle((0,0,MASTER[0]*.38,MASTER[1]),fill=(2,7,14,105))
    for i in range(5):
        x=MASTER[0]*(.43+i*.115)
        od.line((x,MASTER[1]*.08,x+120,MASTER[1]*.92),fill=rgba(accent,16),width=2)
    img=Image.alpha_composite(img,overlay)

    noise=Image.effect_noise(MASTER,7).convert("L")
    grain=Image.new("RGBA",MASTER,(255,255,255,0))
    grain.putalpha(noise.point(lambda p: max(0,min(18,(p-128)//5+9))))
    img=Image.alpha_composite(img,grain)

    return ImageOps.exif_transpose(img.convert("RGB"))


def save_variants(module_id: str, image: Image.Image):
    directory=OUT/module_id
    directory.mkdir(parents=True,exist_ok=True)
    image.save(directory/"master.webp","WEBP",quality=94,method=5)
    for width in WIDTHS:
        height=round(image.height*width/image.width)
        resized=image.resize((width,height),Image.Resampling.LANCZOS)
        resized.save(directory/f"cover-{width}.webp","WEBP",quality=90,method=5)
        resized.save(directory/f"cover-{width}.avif","AVIF",quality=78,speed=7)


def make_contact_sheet():
    ids=list(MODULES)
    thumb=(360,203)
    cols=4
    rows=math.ceil(len(ids)/cols)
    sheet=Image.new("RGB",(cols*thumb[0],rows*thumb[1]),(4,9,16))
    for idx,module_id in enumerate(ids):
        im=Image.open(OUT/module_id/"master.webp").convert("RGB")
        im.thumbnail(thumb,Image.Resampling.LANCZOS)
        x=(idx%cols)*thumb[0]
        y=(idx//cols)*thumb[1]
        sheet.paste(im,(x,y))
    qa=ROOT/"artifacts"/"visual-qa"
    qa.mkdir(parents=True,exist_ok=True)
    sheet.save(qa/"atlas-module-visual-contact-sheet.jpg","JPEG",quality=92,subsampling=0)


def main():
    if not features.check("webp"):
        raise SystemExit("Pillow WebP support is required")
    if not features.check("avif"):
        raise SystemExit("Pillow AVIF support is required")

    target=sys.argv[1] if len(sys.argv)>1 else None
    selected={target: MODULES[target]} if target else MODULES
    for module_id,(family,motif) in selected.items():
        print(f"Generating {module_id} [{family}/{motif}]",flush=True)
        save_variants(module_id,make_cover(module_id,family,motif))
    if target is None:
        make_contact_sheet()
        print(f"Generated {len(MODULES)} ATLAS visual masters and responsive derivatives.")


if __name__=="__main__":
    main()
