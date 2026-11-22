"""Uji Milestone 2 + versi mobile web & desktop.

Kasir (HP 390 px dan desktop 1440 px), web pemilik (desktop dan HP), PWA, cetak lewat browser.
Butuh: API :3000 dengan data contoh (seed.ts + seed-history.ts), build web kasir :8081.
    python3 apps/kasir/e2e/m2_flow.py
"""
import json, os, re, subprocess, sys, time, urllib.request
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright, expect

KASIR, WEB = "http://localhost:8081", "http://localhost:3000"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "replica", "clone-screens")
DB = ["psql", "-h", "127.0.0.1", "-p", "5433", "-U", "postgres", "-d", "lk_dev", "-Atc"]
errors, results = [], []
db = lambda q: subprocess.check_output(DB + [q], text=True).strip()

def check(label, cond):
    results.append((label, bool(cond))); print(("  OK  " if cond else "  GAGAL ") + label)

def shot(page, name):
    page.wait_for_timeout(400); page.screenshot(path=os.path.join(OUT, f"{name}.png"))

def watch(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror {e}"))

def kasir_login(page, user="dewi", pw="kasir123"):
    page.goto(KASIR + "/masuk")
    if "@" not in user:
        page.get_by_label("Kode usaha").fill("contoh")
    page.get_by_label("Username").fill(user)
    page.get_by_label("Password").fill(pw)
    page.get_by_role("button", name="Masuk").click()
    expect(page.get_by_role("button", name="Buat transaksi").first).to_be_visible(timeout=15000)

def visible_text(page, text):
    return page.locator(f'text="{text}" >> visible=true').first

# Gambar contoh untuk QRIS outlet (bukan QRIS sungguhan).
qris_png = "/tmp/qris-contoh.png"
img = Image.new("RGB", (300, 300), "white"); d = ImageDraw.Draw(img)
for i in range(0, 300, 30):
    for j in range(0, 300, 30):
        if (i * 7 + j * 3) % 60 < 30: d.rectangle([i, j, i + 26, j + 26], fill="black")
d.rectangle([90, 120, 210, 180], fill="white"); d.text((105, 142), "QRIS CONTOH", fill="black")
img.save(qris_png)

# ---------- PWA ----------
m = json.loads(urllib.request.urlopen(KASIR + "/manifest.webmanifest").read())
html = urllib.request.urlopen(KASIR + "/").read().decode()
check("PWA: manifest dengan nama, ikon 192 & 512, display standalone",
      m["short_name"] == "Kasir" and m["display"] == "standalone" and {i["sizes"] for i in m["icons"]} >= {"192x192", "512x512"})
check("PWA: index.html memuat manifest dan lang=id", 'rel="manifest"' in html and 'lang="id"' in html)
for icon in m["icons"]:
    check(f"PWA: ikon {icon['src']} bisa diunduh", urllib.request.urlopen(KASIR + icon["src"]).status == 200)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    # ---------- web pemilik (desktop): pengaturan QRIS, layanan, dashboard, laporan ----------
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = ctx.new_page(); watch(page, "owner-desktop")
    page.goto(WEB + "/masuk")
    page.get_by_label("Email").fill("owner@contoh.id"); page.get_by_label("Password").fill("rahasia123")
    page.get_by_role("button", name="Masuk").click()
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=15000)
    expect(page.locator('svg[role="img"]')).to_be_visible(timeout=10000)
    page.wait_for_timeout(600)
    shot(page, "S20-dashboard-desktop")
    check("S20 dashboard: grafik dan 6 kartu angka", page.locator('svg[role="img"] path').count() > 4 and page.get_by_text("Laba kas").first.is_visible())
    page.locator('svg[role="img"] rect[tabindex="0"]').nth(3).hover()
    check("S20 tooltip muncul saat hover kolom", page.get_by_role("status").filter(has_text="Uang masuk").is_visible())
    page.get_by_role("radio", name="30 hari").click(); page.wait_for_timeout(800)
    check("S20 ganti periode 30 hari", page.get_by_role("radio", name="30 hari").get_attribute("aria-checked") == "true")

    page.get_by_role("link", name="Laporan", exact=True).click()
    expect(page.get_by_role("heading", name="Laporan keuangan")).to_be_visible(timeout=10000)
    page.get_by_role("radio", name="7 hari").click()
    expect(page.locator("tfoot")).to_contain_text("Total", timeout=10000)
    shot(page, "S21-laporan-desktop")
    rows = page.locator("tbody tr").count()
    check("S21 laporan 7 hari = 7 baris + total", rows == 7)
    with page.expect_download() as dl:
        page.get_by_role("button", name="Unduh CSV").click()
    csv_path = dl.value.path(); csv = open(csv_path, encoding="utf-8-sig").read().splitlines()
    check("S21 unduh CSV: header + 7 hari + total", len(csv) == 9 and csv[0].startswith("Tanggal;Nota") and csv[-1].startswith("Total"))
    # total di tabel = jumlah baris
    tot = int(re.sub(r"\D", "", page.locator("tfoot td").nth(3).inner_text()))
    s = sum(int(re.sub(r"\D", "", page.locator("tbody tr").nth(i).locator("td").nth(3).inner_text())) for i in range(rows))
    check("S21 total uang masuk = jumlah per hari", tot == s and tot > 0)

    page.get_by_role("link", name="Layanan & harga").click()
    expect(page.get_by_role("heading", name="Layanan & harga")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Ubah Cuci Lipat").click()
    page.get_by_label("Harga / kg").fill("6500")
    page.get_by_role("button", name="Simpan").click()
    expect(page.get_by_text("Rp 6.500 / kg")).to_be_visible(timeout=10000)
    check("S18 ubah harga layanan", db("select price from services where name='Cuci Lipat' and outlet_id in (select id from outlets where code='MLG1')") == "6500")
    sepatu = page.locator("li", has_text="Sepatu")
    if sepatu.get_by_role("button", name="Aktifkan", exact=True).count():  # run sebelumnya: aktifkan dulu
        sepatu.get_by_role("button", name="Aktifkan", exact=True).click()
        expect(sepatu.get_by_role("button", name="Nonaktifkan", exact=True)).to_be_visible(timeout=10000)
    sepatu.get_by_role("button", name="Nonaktifkan", exact=True).click()
    expect(sepatu.get_by_role("button", name="Aktifkan", exact=True)).to_be_visible(timeout=10000)
    page.wait_for_timeout(500)
    shot(page, "S18-layanan-desktop")
    check("S18 nonaktifkan layanan Sepatu", db("select active from services where name='Sepatu' and outlet_id in (select id from outlets where code='MLG1')") == "f")

    page.get_by_role("link", name="Pengaturan").click()
    expect(page.get_by_role("heading", name="Pengaturan outlet")).to_be_visible(timeout=10000)
    page.locator("#qris-file").set_input_files(qris_png)
    expect(page.get_by_alt_text("QRIS outlet")).to_be_visible(timeout=10000)
    page.get_by_label("Catatan kaki nota").fill("Terima kasih! Cucian tidak diambil 30 hari bukan tanggung jawab kami.")
    page.get_by_role("button", name="Simpan").click()
    expect(page.get_by_text("Pengaturan outlet tersimpan.")).to_be_visible(timeout=10000)
    shot(page, "S22-pengaturan-desktop")
    check("S22 unggah QRIS dan catatan kaki nota", db("select count(*) from outlet_files") != "0")
    ctx.close()

    # ---------- web pemilik (HP): laci menu ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page(); watch(page, "owner-hp")
    page.goto(WEB + "/masuk")
    page.get_by_label("Email").fill("owner@contoh.id"); page.get_by_label("Password").fill("rahasia123")
    page.get_by_role("button", name="Masuk").click()
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=15000)
    page.wait_for_timeout(800)
    shot(page, "S20-dashboard-hp")
    check("HP: dashboard tidak melebar ke samping", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    page.get_by_role("button", name="Buka menu").click()
    shot(page, "S20-menu-hp")
    page.get_by_role("dialog", name="Menu").get_by_role("link", name="Laporan", exact=True).click()
    expect(page.get_by_role("heading", name="Laporan keuangan")).to_be_visible(timeout=10000)
    check("HP: menu laci membuka laporan", True)
    ctx.close()

    # ---------- kasir (HP): Kas, pengeluaran, QRIS, cetak browser, tanggal lahir ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page(); watch(page, "kasir-hp")
    kasir_login(page)
    visible_text(page, "Kas").click()
    expect(page.get_by_text("Uang masuk", exact=True).first).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Catat pengeluaran").click()
    page.get_by_role("radio", name="Gas").click()
    page.get_by_label("Nominal").fill("25000")
    page.get_by_label("Catatan (opsional)").fill("Gas 3 kg")
    page.get_by_role("button", name="Simpan", exact=True).click()
    expect(page.get_by_text("Gas 3 kg · Dewi").first).to_be_visible(timeout=10000)
    page.wait_for_timeout(600)
    shot(page, "S11-S12-kas-hp")
    check("S11 catat pengeluaran tampil di daftar", True)
    check("S12 ringkasan kirim ke pemilik tersedia", page.get_by_role("button", name="Kirim ringkasan ke pemilik").is_visible())
    page.get_by_role("button", name="Hari sebelumnya").click(); page.wait_for_timeout(800)
    check("S12 lihat hari kemarin", page.get_by_text("Kemarin", exact=True).is_visible())

    page.goto(KASIR + "/beranda")
    page.get_by_role("button", name="Buat transaksi").first.click()
    tag = str(int(time.time() * 1000))[-8:]
    page.get_by_label("Cari nama atau nomor WhatsApp").fill(f"Ani {tag}")
    page.get_by_role("button", name=re.compile("Tambah pelanggan baru")).click()
    page.get_by_label("Nomor WhatsApp").fill(f"0819{tag}")
    page.get_by_label("Tanggal lahir (opsional)").fill("17/04/1985")
    page.get_by_role("button", name="Simpan & lanjut").click()
    expect(page.get_by_role("checkbox", name=re.compile("^Cuci Kilat"))).to_be_visible(timeout=10000)
    check("S04 pelanggan baru dengan tanggal lahir", db(f"select birth_date from customers where name='Ani {tag}'") == "1985-04-17")
    check("S05 layanan nonaktif (Sepatu) tidak tampil", page.get_by_role("checkbox", name=re.compile("^Sepatu")).count() == 0)
    page.get_by_role("checkbox", name=re.compile("^Cuci Kilat")).click()
    page.get_by_label("Berat Cuci Kilat dalam kilogram").fill("1,5")
    page.get_by_role("button", name="Lanjut").click()
    page.get_by_role("radio", name="QRIS").click()
    expect(page.get_by_label("Kode QRIS outlet")).to_be_visible(timeout=10000)
    shot(page, "S06-qris-hp")
    check("S06 gambar QRIS outlet tampil saat memilih QRIS", True)
    page.get_by_role("checkbox", name=re.compile("sudah masuk lewat QRIS")).click()
    page.get_by_role("button", name="Simpan & lihat nota").click()
    expect(page.get_by_text("Transaksi tersimpan")).to_be_visible(timeout=15000)
    nota = db("select nota_number from orders order by created_at desc limit 1")
    check("S07 catatan kaki nota dari pengaturan tampil", page.get_by_text(re.compile(r"Cucian\s+tidak\s+diambil\s+30\s+hari")).first.is_visible())
    page.get_by_role("button", name="Cetak").click()
    page.wait_for_timeout(1500)
    frame = page.locator(f'iframe[data-nota-print="{nota}"]')
    srcdoc = frame.get_attribute("srcdoc") if frame.count() else ""
    check("S07 cetak lewat browser: nota 58 mm + label produksi dikirim ke dialog cetak",
          nota in (srcdoc or "") and "size: 58mm" in (srcdoc or "") and "LABEL PRODUKSI" in (srcdoc or "") and "<svg" in (srcdoc or ""))
    ctx.close()

    # ---------- pemilik di aplikasi kasir: batalkan nota ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page(); watch(page, "owner-kasir")
    kasir_login(page, "owner@contoh.id", "rahasia123")
    page.get_by_role("button", name="Buat transaksi").first.click()
    page.get_by_label("Cari nama atau nomor WhatsApp").fill("dimas")
    page.get_by_role("button", name=re.compile(r"^Dimas")).click()
    page.get_by_role("checkbox", name=re.compile("^Cuci Lipat")).click()
    page.get_by_role("button", name="Lanjut").click()
    page.get_by_role("radio", name="Bayar saat ambil").click()
    page.get_by_role("button", name="Simpan & lihat nota").click()
    expect(page.get_by_text("Transaksi tersimpan")).to_be_visible(timeout=15000)
    oid = db("select id from orders order by created_at desc limit 1")
    page.goto(f"{KASIR}/order/{oid}")
    page.get_by_role("button", name="Batalkan nota").click()
    page.get_by_label("Alasan (wajib)").fill("Pelanggan batal mencuci")
    shot(page, "S09-batal-hp")
    page.locator('[aria-label="Batalkan nota"] >> visible=true').last.click()
    page.wait_for_timeout(1500)
    check("S09 pemilik membatalkan nota dengan alasan", db(f"select status || '/' || cancel_reason from orders where id='{oid}'") == "batal/Pelanggan batal mencuci")
    ctx.close()

    # ---------- kasir (desktop 1440): menu samping, grid 4 kolom, Kas ----------
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page(); watch(page, "kasir-desktop")
    kasir_login(page)
    page.wait_for_timeout(800)
    shot(page, "S03-beranda-desktop")
    side = page.evaluate("""() => { const el = [...document.querySelectorAll('a,[role=tab],[role=link]')].find(e => e.textContent.trim() === 'Kas' && e.offsetParent);
      const r = el?.getBoundingClientRect(); return r ? { x: r.x, y: r.y } : null; }""")
    check("Desktop: menu Kas ada di samping kiri (bukan bilah bawah)", side is not None and side["x"] < 240 and side["y"] < 400)
    page.get_by_role("button", name="Buat transaksi").first.click()
    page.get_by_label("Cari nama atau nomor WhatsApp").fill("sari")
    page.get_by_role("button", name=re.compile(r"^Bu Sari")).click()
    expect(page.get_by_role("checkbox", name=re.compile("^Cuci Kilat"))).to_be_visible(timeout=10000)
    tops = page.evaluate("""() => [...document.querySelectorAll('[role=checkbox]')].slice(0, 4).map(e => Math.round(e.getBoundingClientRect().top))""")
    check("Desktop: layanan tampil 4 kolom sejajar", len(tops) == 4 and len(set(tops)) == 1)
    shot(page, "S05-layanan-desktop")
    page.goto(KASIR + "/kas")
    expect(page.get_by_text("Uang masuk", exact=True).first).to_be_visible(timeout=10000)
    page.wait_for_timeout(800)
    shot(page, "S11-S12-kas-desktop")
    check("Desktop: Kas tidak melebar ke samping", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"))
    ctx.close()
    b.close()

print()
real = [e for e in errors if not re.search(r"Failed to load resource: .*status of (401|404)", e)]
print("console error:", len(real))
for e in real[:10]: print("  ", e[:220])
failed = [r for r in results if not r[1]]
print(f"{len(results) - len(failed)}/{len(results)} pemeriksaan lolos")
sys.exit(1 if failed or real else 0)
