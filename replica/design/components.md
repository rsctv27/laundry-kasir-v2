# Komponen: laundry-kasir

Sumber: daftar komponen di `replica/recon.md`, token di `tokens.json`. UI Smartlink belum pernah dilihat, jadi tata letak di sini disusun dari pola umum aplikasi kasir, bukan dijiplak.

Aturan untuk semua komponen:

- **Ikon**: Lucide (lisensi ISC), `lucide-react` di web dan `lucide-react-native` di kasir. Ikon yang berdiri sendiri wajib punya label untuk pembaca layar.
- **Font**: Inter (lisensi OFL). Angka uang, berat, dan nomor nota memakai `tabular-nums`.
- **Target sentuh** di aplikasi kasir minimal 48 × 48 px, walau ikonnya kecil.
- **Fokus**: cincin 2 px warna `focus`, jarak 2 px dari tepi, hanya saat navigasi keyboard (`:focus-visible`).
- **Gerak**: animasi pakai `motion.base`; jika pengguna mematikan animasi di HP (reduce motion), animasi dimatikan.
- **Ukuran teks Android**: tata letak tetap utuh sampai skala font 130%. Teks panjang terpotong dengan elipsis, angka tidak pernah terpotong.
- **Teks**: semua label, pesan kosong, dan pesan error ditulis baru dengan bahasa sendiri.
- **Format**: uang `Rp 24.375` (tanpa desimal), berat `3,25 kg`, waktu `Sab, 21 Nov · 14.05`, semua dengan locale `id-ID` dan zona waktu outlet.

---

## Dasar

```
Button
  variants  primary (bg accent, text on-accent)
            secondary (bg surface-raised, border, text fg)
            ghost (transparan, text fg)
            danger (bg danger, text on-danger)
  sizes     sm 36px (hanya web owner), md 48px, lg 56px (aksi utama di bilah bawah)
  states    default, pressed (accent-pressed), focus-visible, disabled (bg surface, text muted),
            loading (spinner di kiri, label tetap terlihat, tombol tidak bisa ditekan lagi)
  tokens    radius md, font base/600, padding x 16 (lg: 20)
  a11y      elemen <button> asli; saat loading: aria-busy="true", tidak menerima tekan kedua
            (mencegah order ganda bersama id idempotency dari aplikasi)
  used on   semua layar
```

```
IconButton
  variants  ghost, secondary
  sizes     area tekan 48px, ikon 20–24px
  states    default, pressed, focus-visible, disabled
  a11y      aria-label wajib (contoh: "Kembali", "Cetak nota")
  used on   AppHeader, OrderRow, QtyStepper
```

```
TextField
  variants  teks; telepon WA (awalan "+62" tampil, disimpan sebagai 62xxx);
            uang (awalan "Rp", pemisah ribuan otomatis, keyboard angka);
            berat (akhiran "kg", desimal pakai koma, keyboard angka dengan desimal);
            area teks (catatan)
  sizes     md 48px; area teks minimal 96px
  states    default (border input), focus (border focus 2px), error (border danger + pesan di bawah
            dengan ikon), disabled, read-only
  tokens    bg bg, radius md, label sm/500 text fg, bantuan xs text muted, error xs text danger
  a11y      label selalu terlihat di atas field (placeholder bukan pengganti label);
            pesan error terhubung lewat aria-describedby; aria-invalid saat error
  used on   S01, S04, S06, S10, S11, S14, S17, S18, S19, S22
```

```
SearchField + daftar hasil (autocomplete)
  variants  pelanggan (nama atau nomor WA), nota (nomor atau nama)
  states    kosong, mengetik, memuat (3 baris skeleton), ada hasil, tidak ditemukan, error (+ tombol coba lagi)
  perilaku  cari setelah 2 huruf, jeda 200 ms; hasil menampilkan nama + nomor WA + jumlah order;
            baris terakhir selalu "Tambah pelanggan baru: <ketikan>"
  tokens    seperti TextField; hasil di kartu surface-raised dengan shadow pop
  a11y      role combobox + listbox; di web: panah atas/bawah dan Enter
  used on   S04, S08
```

## Transaksi

```
ServiceCard (kartu layanan yang bisa dipilih)
  isi       nama layanan, harga per unit ("Rp 7.500 / kg"), durasi ("3 hari" / "3 jam")
  states    default (border), terpilih (border accent 2px, bg accent-soft, ikon centang),
            nonaktif (text muted, tidak bisa dipilih)
  layout    grid 2 kolom di kasir, tinggi minimal 88px
  a11y      checkbox (bisa memilih lebih dari satu layanan); status terpilih dibacakan
  used on   S05, S18 (pratinjau)
```

```
QtyStepper
  variants  kg (tombol −/+ selangkah 0,5 kg, bisa diketik bebas sampai 2 desimal)
            pcs (tombol −/+ selangkah 1, bilangan bulat)
  states    default, minimum (tombol − nonaktif), focus, error (0 atau kosong)
  tokens    tombol IconButton secondary 48px, angka lg/600 tabular di tengah
  a11y      role spinbutton dengan aria-valuenow dan satuan dibacakan ("3,25 kilogram")
  used on   S05
```

```
ItemCounter (rincian jenis barang)
  isi       daftar jenis barang (handuk, selimut, seprai, bedcover, …), masing-masing dengan stepper pcs kecil;
            total pcs di bawah
  states    kosong (semua 0), terisi, jenis barang belum diatur owner (tautan ke pengaturan)
  used on   S05
```

```
OrderSummary (ringkasan tagihan)
  isi       per baris: nama layanan, "3,25 kg × Rp 7.500", total baris rata kanan;
            lalu subtotal, diskon (jika ada, text success dengan tanda minus), garis, TOTAL
  tokens    baris sm, total display/700 tabular
  used on   S06, S09, S10
```

```
PaymentMethodPicker
  opsi      Tunai · Bayar nanti · QRIS · Debit · Deposit (menampilkan saldo; nonaktif jika saldo 0)
  states    default, terpilih (border accent 2px + bg accent-soft), tidak tersedia (text muted + alasan singkat)
  layout    daftar kartu satu kolom, tinggi 56px, ikon di kiri
  a11y      radiogroup; tiap opsi radio dengan label lengkap
  used on   S06, S10, S14
```

```
CashInput (bayar tunai + kembalian)
  isi       TextField uang "Uang diterima"; chip cepat: "Uang pas", 50.000, 100.000 (dibulatkan ke atas dari total);
            KEMBALIAN besar (xl/700) di bawah
  states    kurang (pesan danger "Uang kurang Rp …", tombol simpan nonaktif), pas, lebih (kembalian tampil)
  used on   S06, S10
```

```
QrisSheet (QRIS statis)
  isi       gambar QRIS outlet besar (minimal 240px), total tagihan, tombol "Pembayaran sudah masuk"
  states    gambar belum diatur (pesan + tautan ke pengaturan outlet), siap
  catatan   kasir mengonfirmasi manual setelah melihat notifikasi masuk; QRIS dinamis menyusul
  used on   S06, S10
```

## Status dan daftar

```
StatusBadge / PaymentBadge
  variants  baru, diproses, selesai, diambil, batal · lunas, sebagian, belum_bayar
            (warna dari tokens.json > status)
  tokens    pill, xs/600, padding 4 × 10
  a11y      teks status selalu ada; warna bukan satu-satunya penanda
  used on   S08, S09, S13, S16
```

```
StatusTabs
  isi       Semua · Baru · Diproses · Selesai · Belum diambil, masing-masing dengan angka
  states    aktif (text fg, garis bawah accent 2px), tidak aktif (text muted), angka 0 tetap tampil
  layout    bisa digeser horizontal, tinggi 48px
  a11y      role tablist / tab, aria-selected
  used on   S08
```

```
OrderRow
  isi       nomor nota (mono, tabular), nama pelanggan, ringkas layanan ("Reguler 3,25 kg · Bedcover 1"),
            waktu masuk / estimasi selesai, StatusBadge, sisa tagihan jika belum lunas
  states    default, ditekan, terlambat (estimasi sudah lewat dan belum selesai: waktu tampil text danger
            dengan label "Terlambat"), batal (teks dicoret tipis, badge batal)
  layout    tinggi minimal 72px, seluruh baris bisa ditekan
  a11y      satu elemen tautan/tombol dengan label lengkap: "Nota MLG1-261121-007, Bu Sari, diproses, sisa Rp 10.000"
  used on   S08, S13
```

```
StatCard
  isi       label xs text muted, angka xl/700 tabular, keterangan kecil opsional
  states    memuat (skeleton), nol (tetap tampil "0" atau "Rp 0"), terisi
  used on   S03, S12, S20
```

```
DataTable (laporan owner)
  isi       header lengket, kolom angka rata kanan tabular, baris total di bawah
  states    memuat, kosong ("Belum ada transaksi di periode ini"), terisi, banyak data (paginasi)
  used on   S21
```

## Nota

```
NotaPreview (tampilan di layar) + tata letak cetak thermal
  lebar     58 mm = 32 karakter per baris, 80 mm = 48 karakter (dari tokens.json > nota)
  karakter  hanya ASCII (printer murah sering tidak punya huruf khusus); "Rp" tanpa simbol lain

  rangkap pelanggan:
    nama outlet (tengah, tebal), alamat, nomor WA outlet
    garis
    No. nota, tanggal & jam, kasir, pelanggan
    garis
    per layanan: nama di baris 1; "3,25 kg x 7.500" kiri + total kanan di baris 2
    garis
    Subtotal, Diskon, TOTAL (tebal), Dibayar, Sisa, status bayar
    Estimasi selesai
    QR (link lacak), teks "Scan untuk cek status cucian"
    catatan kaki dari pengaturan outlet

  rangkap label produksi (tanpa harga):
    nomor nota BESAR (ukuran ganda), nama pelanggan, layanan + kg/pcs, rincian jenis barang,
    estimasi selesai, catatan

  di layar  kartu putih selebar kertas, font mono, sama persis dengan hasil cetak
  states    printer tersambung / tidak (Banner), mencetak (tombol loading), gagal cetak (pesan + coba lagi)
  used on   S07, S22 (pratinjau pengaturan)
```

```
QRCode
  ukuran    minimal 160px di layar; saat dicetak, lebar modul 4–6 titik printer
  isi       URL halaman lacak (token acak), bukan data pelanggan
  used on   S07, S16, nota cetak
```

## Kerangka layar

```
AppHeader (kasir)
  isi       tombol kembali (jika bukan layar utama), judul lg/600, maksimal 2 aksi ikon di kanan
  tinggi    56px
  used on   semua layar kasir
```

```
BottomNav (kasir)
  isi       4 menu: Beranda · Cucian · Kas · Lainnya (ikon + label selalu tampil)
  states    aktif (ikon dan label accent, label tebal), tidak aktif (text muted)
  tinggi    64px + area aman bawah HP
  a11y      role navigation; menu aktif aria-current="page"
  used on   S03, S08, S11/S12, menu lainnya
```

```
ActionBar (bilah aksi menempel di bawah)
  isi       kiri: total sementara (lg/700 tabular) + jumlah item; kanan: Button lg primary ("Lanjut", "Simpan & cetak")
  tinggi    80px, border atas, bg surface-raised
  used on   S05, S06, S10
```

```
Sidebar + header (web owner)
  isi       nama usaha, pemilih outlet, menu: Dashboard · Laporan · Layanan · Karyawan · Pengaturan · Persetujuan (angka menunggu)
  lebar     240px; di bawah 1024px menjadi laci (drawer) dari tombol menu
  used on   S18–S22
```

## Umpan balik

```
Modal / BottomSheet
  variants  konfirmasi biasa, berbahaya (tombol danger; batal order wajib isi alasan)
  states    terbuka, memproses (tombol loading), error di dalam modal
  a11y      fokus terkunci di dalam, tombol kembali Android dan Esc menutup, judul jadi aria-labelledby
  used on   S09, S10, S19
```

```
Toast
  variants  sukses (3 detik), info (4 detik), gagal (tetap tampil sampai ditutup, dengan tombol coba lagi)
  posisi    di atas BottomNav / ActionBar
  a11y      aria-live polite; gagal = assertive
  used on   semua layar
```

```
Banner (pemberitahuan menetap di atas layar)
  variants  offline ("Tidak ada koneksi. Transaksi belum bisa disimpan."),
            printer ("Printer belum tersambung" + tombol Sambungkan),
            persetujuan menunggu (web owner)
  tokens    bg warning-soft / danger-soft / info-soft dengan teks peran yang sama
  used on   semua layar kasir, dashboard owner
```

```
ApprovalCard (persetujuan ambil tanpa pelunasan)
  isi       nama pelanggan, nomor nota, sisa tagihan, utang lama jika ada, diminta oleh siapa dan kapan
  aksi      Setujui (primary) · Tolak (secondary)
  states    menunggu, disetujui, ditolak, memproses
  used on   S10 (sisi kasir: status menunggu), web owner
```

```
EmptyState
  isi       ikon Lucide 40px text muted, judul base/600, satu kalimat, aksi opsional
  contoh    Cucian (tab Baru): "Belum ada cucian baru hari ini." + tombol "Buat transaksi"
            Pengeluaran: "Belum ada pengeluaran yang dicatat hari ini."
  used on   semua daftar
```

```
Skeleton
  bentuk    baris teks, kartu statistik, baris order
  gerak     kilau pelan; statis jika reduce motion aktif
  used on   semua daftar dan statistik saat memuat
```
