"""Uji ujung ke ujung alur kasir (versi web) + halaman lacak + web owner, sekaligus screenshot untuk replica-diff.

Butuh: API di :3000 (data contoh dari `pnpm --filter @lk/web seed`), build web kasir di :8081.
    python3 apps/kasir/e2e/kasir_flow.py
"""
import os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright, expect

KASIR = "http://localhost:8081"
WEB = "http://localhost:3000"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "replica", "clone-screens")
os.makedirs(OUT, exist_ok=True)
DB = ["psql", "-h", "127.0.0.1", "-p", "5433", "-U", "postgres", "-d", "lk_dev", "-Atc"]
errors = []
results = []

def db(q):
    return subprocess.check_output(DB + [q], text=True).strip()

def shot(page, name):
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(OUT, f"{name}.png"))

def check(label, cond):
    results.append((label, bool(cond)))
    print(("  OK  " if cond else "  GAGAL ") + label)

def watch(page, tag):
    page.on("console", lambda m: errors.append(f"[{tag}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[{tag}] pageerror {e}"))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    # ---------------- aplikasi kasir ----------------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="id-ID")
    page = ctx.new_page(); watch(page, "kasir")
    page.goto(KASIR + "/")
    expect(page.get_by_text("Masuk kasir")).to_be_visible(timeout=20000)
    shot(page, "S01-login")
    page.get_by_label("Kode usaha").fill("contoh")
    page.get_by_label("Username").fill("dewi")
    page.get_by_label("Password").fill("salah123")
    page.get_by_role("button", name="Masuk").click()
    expect(page.get_by_text("Kode usaha, username, atau password salah.")).to_be_visible(timeout=10000)
    check("S01 password salah menampilkan pesan", True)
    page.get_by_label("Password").fill("kasir123")
    page.get_by_role("button", name="Masuk").click()
    expect(page.get_by_role("button", name="Buat transaksi").first).to_be_visible(timeout=15000)
    page.wait_for_timeout(800)
    shot(page, "S03-beranda")
    check("S03 beranda tampil setelah login", page.get_by_text("Transaksi terakhir").is_visible())

    before = int(db("select count(*) from orders"))
    page.get_by_role("button", name="Buat transaksi").first.click()
    page.get_by_label("Cari nama atau nomor WhatsApp").fill("sari")
    expect(page.get_by_role("button", name=re.compile(r"^Bu Sari"))).to_be_visible(timeout=10000)
    shot(page, "S04-pelanggan")
    check("S04 pencarian menemukan Bu Sari dan Sarah Putri", page.get_by_role("button", name=re.compile(r"^Sarah Putri")).is_visible())
    page.get_by_role("button", name=re.compile(r"^Bu Sari")).click()

    expect(page.get_by_role("checkbox", name=re.compile(r"^Cuci Setrika Reguler"))).to_be_visible(timeout=10000)
    page.get_by_role("checkbox", name=re.compile(r"^Cuci Setrika Reguler")).click()
    page.get_by_role("checkbox", name=re.compile(r"^Bedcover")).click()
    lanjut = page.get_by_role("button", name="Lanjut")
    w = page.get_by_label("Berat Cuci Setrika Reguler dalam kilogram")
    w.fill("3,25")
    page.wait_for_timeout(300)
    shot(page, "S05-layanan")
    check("S05 total sementara Rp 49.375", page.get_by_text("Rp 49.375").first.is_visible())
    w.fill("0")
    page.wait_for_timeout(200)
    check("S05 berat 0 menonaktifkan Lanjut", lanjut.is_disabled())
    w.fill("3,25")
    page.get_by_role("button", name="Tambah 1").click()  # bedcover jadi 2
    page.get_by_role("button", name="Kurangi 1").click()  # kembali 1
    lanjut.click()

    expect(page.get_by_text("Pembayaran", exact=True)).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Rp 50.000").click()
    expect(page.get_by_label("Kembalian Rp 625")).to_be_visible()
    shot(page, "S06-bayar")
    check("S06 kembalian Rp 625 dari Rp 50.000", True)
    page.get_by_label("Uang diterima").fill("40000")
    page.wait_for_timeout(200)
    check("S06 uang kurang menonaktifkan simpan", page.get_by_role("button", name="Simpan & lihat nota").is_disabled())
    page.get_by_role("button", name="Rp 50.000").click()
    save = page.get_by_role("button", name="Simpan & lihat nota")
    save.dblclick()  # tekan ganda: tetap satu order
    expect(page.get_by_text("Transaksi tersimpan")).to_be_visible(timeout=15000)
    page.wait_for_timeout(800)
    shot(page, "S07-nota")
    after = int(db("select count(*) from orders"))
    check("S06 tekan simpan dua kali tetap membuat 1 order", after - before == 1)
    nota = db("select nota_number from orders order by created_at desc limit 1")
    check(f"S07 nomor nota {nota} tampil", page.get_by_text(nota).first.is_visible())
    page.get_by_role("button", name="Cetak").click()
    expect(page.get_by_text(re.compile("Dialog cetak dibuka"))).to_be_visible()
    check("S07 versi web mencetak lewat dialog cetak browser", page.locator(f'iframe[data-nota-print="{nota}"]').count() == 1)
    paid = db("select paid_total || '/' || payment_status from orders order by created_at desc limit 1")
    check("S07 order tersimpan lunas Rp 49.375", paid == "49375/lunas")

    page.get_by_role("button", name="Tutup").click()
    expect(page.get_by_role("button", name="Buat transaksi").first).to_be_visible(timeout=10000)
    page.locator('text="Cucian" >> visible=true').first.click()
    expect(page.get_by_label("Cari nota atau nama pelanggan")).to_be_visible(timeout=10000)
    page.wait_for_timeout(800)
    shot(page, "S08-cucian")
    page.locator(f'[aria-label^="Nota {nota}"]').last.click()  # tab tidak aktif tetap ada di DOM, di bawah
    expect(page.get_by_role("button", name="Mulai proses")).to_be_visible(timeout=10000)
    page.wait_for_timeout(500)
    shot(page, "S09-detail")
    page.get_by_role("button", name="Mulai proses").click()
    expect(page.get_by_role("button", name="Tandai selesai")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Tandai selesai").click()
    expect(page.get_by_role("button", name="Serahkan cucian")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Serahkan cucian").click()
    expect(page.get_by_text("Ambil cucian")).to_be_visible(timeout=10000)
    page.wait_for_timeout(500)
    shot(page, "S10-ambil")
    page.get_by_role("button", name="Serahkan cucian").click()
    page.wait_for_timeout(1500)
    status = db(f"select status from orders where nota_number = '{nota}'")
    check("S09/S10 baru -> diproses -> selesai -> diambil", status == "diambil")

    # bayar saat ambil + pelunasan di S10
    page.goto(KASIR + "/beranda")
    expect(page.get_by_role("button", name="Buat transaksi").first).to_be_visible(timeout=15000)
    page.get_by_role("button", name="Buat transaksi").first.click()
    page.get_by_label("Cari nama atau nomor WhatsApp").fill("hendra")
    page.get_by_role("button", name=re.compile(r"^Pak Hendra")).click()
    page.get_by_role("checkbox", name=re.compile(r"^Cuci Kilat")).click()
    page.get_by_label("Berat Cuci Kilat dalam kilogram").fill("2")
    page.get_by_role("button", name="Lanjut").click()
    page.get_by_role("radio", name="Bayar saat ambil").click()
    page.get_by_role("button", name="Simpan & lihat nota").click()
    expect(page.get_by_text("Transaksi tersimpan")).to_be_visible(timeout=15000)
    oid = db("select id from orders order by created_at desc limit 1")
    check("bayar saat ambil: tersimpan belum bayar", db(f"select payment_status from orders where id='{oid}'") == "belum_bayar")
    page.goto(f"{KASIR}/order/{oid}")
    page.get_by_role("button", name="Mulai proses").click()
    page.get_by_role("button", name="Tandai selesai").click()
    page.get_by_role("button", name="Lunasi & serahkan").click()
    expect(page.get_by_text("Sisa tagihan")).to_be_visible(timeout=10000)
    page.get_by_role("button", name="Uang pas").click()
    page.wait_for_timeout(300)
    shot(page, "S10-pelunasan")
    page.get_by_role("button", name="Terima pembayaran & serahkan").click()
    page.wait_for_timeout(1500)
    check("S10 pelunasan lalu diambil", db(f"select status || '/' || payment_status from orders where id='{oid}'") == "diambil/lunas")

    page.goto(KASIR + "/printer")
    expect(page.get_by_text("Ukuran kertas")).to_be_visible(timeout=10000)
    page.wait_for_timeout(500)
    shot(page, "M0-printer")
    ctx.close()

    # ---------------- halaman lacak ----------------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page(); watch(page, "lacak")
    tok = db("select tracking_token from orders o join customers c on c.id=o.customer_id where c.name='Mbak Rina' limit 1")
    page.goto(f"{WEB}/t/{tok}")
    expect(page.get_by_text("Cucian Anda siap diambil")).to_be_visible(timeout=10000)
    shot(page, "S16-lacak")
    html = page.content()
    check("S16 tidak menampilkan nomor WA pelanggan", "6285711112222" not in html and "0857-1111-2222" not in html)
    check("S16 punya meta noindex", 'name="robots" content="noindex' in html)
    page.goto(f"{WEB}/t/{'0' * 32}")
    check("S16 token salah: halaman tidak ditemukan", page.get_by_text("Link tidak ditemukan").is_visible())
    ctx.close()

    # ---------------- web owner (daftar baru dari nol) ----------------
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = ctx.new_page(); watch(page, "owner")
    tag = str(int(time.time()))[-6:]
    page.goto(f"{WEB}/daftar")
    page.get_by_label("Nama Anda").fill("Pemilik Uji")
    page.get_by_label("Email").fill(f"uji{tag}@contoh.id")
    page.get_by_label("Password").fill("rahasia123")
    page.get_by_role("button", name="Daftar").click()
    expect(page.get_by_role("heading", name="Siapkan usaha Anda")).to_be_visible(timeout=15000)
    page.get_by_label("Nama usaha").fill("Laundry Uji")
    page.get_by_label("Kode usaha").fill(f"uji{tag}")
    page.get_by_label("Nama outlet").fill("Cabang Satu")
    page.get_by_label("Kode outlet").fill("CB1")
    page.get_by_label("Nomor WhatsApp outlet (opsional)").fill("81299998888")
    shot(page, "S17-setup")
    page.get_by_role("button", name="Simpan dan lanjut").click()
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=15000)
    page.get_by_role("link", name="Layanan & harga").click()
    expect(page.get_by_text("Belum ada layanan.")).to_be_visible(timeout=15000)
    page.get_by_label("Nama layanan").fill("Cuci Setrika")
    page.get_by_label("Harga").fill("8000")
    page.get_by_role("button", name="Tambah layanan").click()
    expect(page.get_by_text("Rp 8.000 / kg")).to_be_visible(timeout=10000)
    page.get_by_role("link", name="Karyawan").click()
    expect(page.get_by_role("heading", name="Karyawan")).to_be_visible(timeout=10000)
    page.get_by_label("Nama", exact=True).fill("Budi")
    page.get_by_label("Username").fill("budi")
    page.locator('input[name="password"]').fill("kasir123")
    page.get_by_role("button", name="Buat akun").click()
    expect(page.get_by_text(re.compile("Akun Budi siap"))).to_be_visible(timeout=10000)
    shot(page, "S19-karyawan-desktop")
    check("S17-S19 owner daftar, buat usaha, layanan, dan akun kasir dari web", True)
    ctx.close()

    # kasir baru langsung bisa login di aplikasi kasir
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page(); watch(page, "kasir2")
    page.goto(KASIR + "/masuk")
    page.get_by_label("Kode usaha").fill(f"uji{tag}")
    page.get_by_label("Username").fill("budi")
    page.get_by_label("Password").fill("kasir123")
    page.get_by_role("button", name="Masuk").click()
    expect(page.get_by_text("Belum ada cucian hari ini")).to_be_visible(timeout=15000)
    check("kasir baru bisa login dan melihat beranda kosong (state kosong)", True)
    shot(page, "S03-beranda-kosong")
    ctx.close()
    b.close()

print()
# 401 (password salah) dan 404 (token lacak palsu) memang disengaja oleh tes negatif di atas.
real_errors = [e for e in errors if "favicon" not in e and not re.search(r"Failed to load resource: .*status of (401|404)", e)]
print("console error:", len(real_errors))
for e in real_errors[:10]:
    print("  ", e[:200])
failed = [r for r in results if not r[1]]
print(f"{len(results) - len(failed)}/{len(results)} pemeriksaan lolos")
sys.exit(1 if failed or real_errors else 0)
