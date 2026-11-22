"""Uji pertama kali pakai, untuk server baru (database kosong) atau situs yang baru di-deploy.

Pemilik daftar -> siapkan usaha -> tambah layanan -> buat akun kasir -> kasir masuk di HP ->
transaksi dengan pelanggan baru -> nota -> halaman lacak -> dashboard pemilik. Tidak butuh akses database.

    WEB_URL=https://alamat-anda.vercel.app python3 apps/kasir/e2e/first_run.py

Membuat satu usaha uji bernama "Laundry Uji Otomatis <angka>" yang boleh dihapus sesudahnya.
"""
import os, re, sys, time, urllib.parse, urllib.request, json
from playwright.sync_api import sync_playwright, expect

WEB = os.environ.get("WEB_URL", "http://localhost:3000").rstrip("/")
KASIR = os.environ.get("KASIR_URL", WEB + "/kasir").rstrip("/")
results, errors = [], []


def check(label, cond):
    results.append((label, bool(cond)))
    print(("  OK  " if cond else "  GAGAL ") + label)


def watch(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror {e}"))


m = json.loads(urllib.request.urlopen(KASIR + "/manifest.webmanifest").read())
check("PWA: manifest kasir tersedia, start_url di /kasir", m.get("start_url", "").startswith(urllib.parse.urlparse(KASIR).path or "/"))
try:
    urllib.request.urlopen(WEB + "/api/v1/me", timeout=20)
    check("API menolak tanpa login", False)
except urllib.error.HTTPError as e:
    check("API menolak tanpa login (401)", e.code == 401)

tag = str(int(time.time()))[-6:]
code = f"uji{tag}"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    # pemilik, desktop
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, locale="id-ID")
    page = ctx.new_page(); watch(page, "owner")
    page.goto(WEB + "/")
    check("beranda situs punya tombol buka aplikasi kasir", page.get_by_role("link", name="Buka aplikasi kasir").is_visible())
    page.goto(WEB + "/daftar")
    page.get_by_label("Nama Anda").fill("Pemilik Uji Otomatis")
    page.get_by_label("Email").fill(f"uji{tag}@contoh.id")
    page.get_by_label("Password").fill("rahasia123")
    page.get_by_role("button", name="Daftar").click()
    expect(page.get_by_role("heading", name="Siapkan usaha Anda")).to_be_visible(timeout=30000)
    page.get_by_label("Nama usaha").fill(f"Laundry Uji Otomatis {tag}")
    page.get_by_label("Kode usaha").fill(code)
    page.get_by_label("Nama outlet").fill("Cabang Uji")
    page.get_by_label("Kode outlet").fill("UJ1")
    page.get_by_role("button", name="Simpan dan lanjut").click()
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=30000)
    check("pemilik daftar dan menyiapkan usaha", True)
    page.get_by_role("link", name="Layanan & harga").click()
    page.get_by_label("Nama layanan").fill("Cuci Setrika")
    page.get_by_label("Harga").fill("8000")
    page.get_by_role("button", name="Tambah layanan").click()
    expect(page.get_by_text("Rp 8.000 / kg")).to_be_visible(timeout=20000)
    page.get_by_role("link", name="Karyawan").click()
    page.get_by_label("Nama", exact=True).fill("Kasir Uji")
    page.get_by_label("Username").fill("kasir")
    page.locator('input[name="password"]').fill("kasir123")
    page.get_by_role("button", name="Buat akun").click()
    expect(page.get_by_text(re.compile("Akun Kasir Uji siap"))).to_be_visible(timeout=20000)
    check("layanan dan akun kasir dibuat dari web pemilik", True)

    # kasir, HP
    k = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="id-ID")
    kp = k.new_page(); watch(kp, "kasir")
    kp.goto(KASIR + "/masuk")
    kp.get_by_label("Kode usaha").fill(code)
    kp.get_by_label("Username").fill("kasir")
    kp.get_by_label("Password").fill("kasir123")
    kp.get_by_role("button", name="Masuk").click()
    expect(kp.get_by_text("Belum ada cucian hari ini")).to_be_visible(timeout=30000)
    check("kasir masuk di HP, beranda kosong", True)
    kp.get_by_role("button", name="Buat transaksi").first.click()
    kp.get_by_label("Cari nama atau nomor WhatsApp").fill(f"Pelanggan Uji {tag}")
    kp.get_by_role("button", name=re.compile("Tambah pelanggan baru")).click()
    kp.get_by_label("Nomor WhatsApp").fill(f"0812{tag}00")
    kp.get_by_role("button", name="Simpan & lanjut").click()
    expect(kp.get_by_role("checkbox", name=re.compile("^Cuci Setrika"))).to_be_visible(timeout=20000)
    kp.get_by_role("checkbox", name=re.compile("^Cuci Setrika")).click()
    kp.get_by_label("Berat Cuci Setrika dalam kilogram").fill("2")
    kp.get_by_role("button", name="Lanjut").click()
    expect(kp.get_by_text("Pembayaran", exact=True)).to_be_visible(timeout=20000)
    kp.get_by_label("Uang diterima").fill("20000")
    expect(kp.get_by_label("Kembalian Rp 4.000")).to_be_visible(timeout=5000)
    kp.get_by_role("button", name="Simpan & lihat nota").click()
    expect(kp.get_by_text("Transaksi tersimpan")).to_be_visible(timeout=30000)
    nota = re.search(r"UJ1-\d{6}-\d{3}", kp.content())
    check(f"transaksi tersimpan, nota {nota.group(0) if nota else '?'}", nota is not None)
    kp.get_by_role("button", name="Cetak").click()
    expect(kp.get_by_text(re.compile("Dialog cetak dibuka"))).to_be_visible(timeout=10000)
    check("cetak lewat browser membuka dialog cetak", True)
    order_id = urllib.parse.urlparse(kp.url).path.rstrip("/").split("/")[-1]
    data = kp.evaluate(
        """async (id) => {
            const r = await fetch(`/api/v1/orders/${id}/nota`, { headers: { authorization: `Bearer ${localStorage.getItem("lk.session")}` } });
            return r.json();
        }""",
        order_id,
    )
    track = (data.get("nota") or {}).get("trackingUrl") or ""
    check(f"link lacak di nota memakai alamat situs ({track[:40]}...)", track.startswith(WEB + "/t/"))
    if track:
        t = b.new_context().new_page()
        t.goto(track)
        check("halaman lacak cucian terbuka", t.get_by_text("Cabang Uji").first.is_visible())

    page.goto(WEB + "/dashboard")
    expect(page.get_by_text("Rp 16.000").first).to_be_visible(timeout=30000)
    check("dashboard pemilik menghitung uang masuk Rp 16.000", True)
    b.close()

real = [e for e in errors if "favicon" not in e]
print("\nconsole error:", len(real))
for e in real[:10]:
    print("  ", e[:200])
failed = [r for r in results if not r[1]]
print(f"{len(results) - len(failed)}/{len(results)} pemeriksaan lolos (usaha uji: {code})")
sys.exit(1 if failed or real else 0)
