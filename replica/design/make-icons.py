"""Ikon sementara laundry-kasir: mesin cuci putih di kotak biru (accent dari tokens.json).
Bukan logo resmi; diganti saat logo dibuat (lihat replica-brand). Jalankan dari root repo:
    python3 replica/design/make-icons.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
tokens = json.loads((ROOT / "replica/design/tokens.json").read_text())
BLUE = tokens["color"]["accent"]
WHITE = "#ffffff"
SS = 4  # supersampling


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def glyph(draw, box, color, scale):
    """Mesin cuci dalam kotak `box` (x0,y0,x1,y1); scale = porsi kotak yang dipakai glyph."""
    x0, y0, x1, y1 = box
    size = (x1 - x0) * scale
    ox, oy = x0 + (x1 - x0 - size) / 2, y0 + (y1 - y0 - size) / 2
    u = size / 100
    P = lambda x, y: (ox + x * u, oy + y * u)
    w = max(1, round(7 * u))
    draw.rounded_rectangle([*P(20, 10), *P(80, 90)], radius=10 * u, outline=color, width=w)
    draw.line([P(20, 27), P(80, 27)], fill=color, width=w)
    for cx in (34, 46):
        r = 3.2 * u
        draw.ellipse([P(cx, 18.5)[0] - r, P(cx, 18.5)[1] - r, P(cx, 18.5)[0] + r, P(cx, 18.5)[1] + r], fill=color)
    c = P(50, 58)
    r = 19 * u
    draw.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], outline=color, width=w)
    # gelombang air "~" di dalam pintu
    ww, rr = max(1, round(5 * u)), 5 * u
    for dx, start, end in ((-5, 180, 360), (5, 0, 180)):
        cx, cy = c[0] + dx * u, c[1] + 1 * u
        draw.arc([cx - rr, cy - rr, cx + rr, cy + rr], start=start, end=end, fill=color, width=ww)


def make(size, *, bg="full", glyph_color=WHITE, scale=0.62, mode="RGBA"):
    S = size * SS
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg == "full":
        d.rectangle([0, 0, S, S], fill=rgb(BLUE))
    elif bg == "rounded":
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=rgb(BLUE))
    if scale > 0:
        glyph(d, (0, 0, S, S), rgb(glyph_color), scale)
    im = im.resize((size, size), Image.LANCZOS)
    return im.convert(mode) if mode != "RGBA" else im


k = ROOT / "apps/kasir"
out = {
    k / "public/icons/icon-192.png": make(192, bg="rounded"),
    k / "public/icons/icon-512.png": make(512, bg="rounded"),
    k / "public/icons/maskable-512.png": make(512, bg="full", scale=0.5),
    k / "public/icons/apple-touch-icon.png": make(180, bg="full", mode="RGB"),
    k / "assets/icon.png": make(1024, bg="full", mode="RGB"),
    k / "assets/favicon.png": make(48, bg="rounded"),
    k / "assets/android-icon-foreground.png": make(512, bg="none", scale=0.42),
    k / "assets/android-icon-background.png": make(512, bg="full", scale=0),
    k / "assets/android-icon-monochrome.png": make(432, bg="none", scale=0.42),
    k / "assets/splash-icon.png": make(1024, bg="none", glyph_color=BLUE, scale=0.5),
    ROOT / "apps/web/src/app/apple-icon.png": make(180, bg="full", mode="RGB"),
}
for path, im in out.items():
    im.save(path)
fav = make(256, bg="rounded")
fav.save(ROOT / "apps/web/src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("ikon dibuat:", len(out) + 1, "file, warna", BLUE)
