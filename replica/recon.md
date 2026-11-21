# Recon map: Smartlink (Android kasir + web owner)

Scope: inti kasir laundry. Order masuk, pembayaran (tunai / QRIS / bayar nanti), nota WhatsApp, status cucian, pengambilan dan pelunasan, laporan keuangan sederhana. Ditambah pengaturan owner yang dibutuhkan agar kasir bisa jalan (outlet, layanan dan harga, akun kasir).
For: aplikasi laundry baru milik Rico, terpisah dari Mola, dengan nama dan brand sendiri (ditentukan di replica-brand).
Date: 2026-11-21
Nama kerja proyek: `laundry-kasir` (sementara, bukan nama produk).

## Catatan sumber dan batasan

- **Hanya sumber publik.** Syarat dan ketentuan Smartlink menyebut semua penggunaan layanan harus untuk kepentingan Smartlink. Jadi recon ini tidak memakai akun Smartlink, dan sebaiknya tetap begitu.
- S&K Smartlink juga melarang mendaftarkan nama, logo, merek, atau domain yang mirip dengan milik Smartlink. Nama clone wajib jauh berbeda dari "Smartlink" (dicek di replica-brand).
- **Belum ada screenshot referensi.** Screenshot Play Store tidak punya keterangan dan belum disimpan, dan video YouTube tidak bisa dibaca otomatis. Layar di bawah **disimpulkan dari deskripsi tertulis** (terutama jurnal Kalesco dan SS Laundry), bukan dari melihat UI aslinya. Tata letak persisnya belum terverifikasi. `replica/screens/` masih kosong.
- Detail aplikasi owner (Smartlink Bos) tipis. Yang diketahui: berbasis web, dipakai di ponsel, dan pengaturan data layanannya dinilai rumit karena terpisah di halaman lain.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://smartlink.id/ | positioning, daftar fitur umum |
| 2 | halaman fitur | https://smartlink.id/fitur | 8 fitur unggulan + 5 fitur manajemen |
| 3 | pricing | https://smartlink.id/biaya | aktivasi Rp1.250.000/outlet, 100 koin per nota, add-on berbayar |
| 4 | syarat & ketentuan | https://smartlink.id/syarat-dan-ketentuan-layanan | lisensi terbatas, larangan merek mirip |
| 5 | Play Store (Kasir) | https://play.google.com/store/apps/details?id=com.sinadme.kasirsinadme&hl=id | rating ~2.9, 100rb+ unduhan, update terakhir 17 Sep 2025 |
| 6 | jurnal Laundry Kalesco | https://bajangjournal.com/index.php/JCI/article/download/5658/4237/10896 | **sumber paling rinci**: alur transaksi langkah demi langkah, nota 2 rangkap, status, statistik, owner |
| 7 | jurnal SS Laundry | https://journal.fkpt.org/index.php/JAMEK/article/download/2255/1005 | field pelanggan, absensi radius, link lacak di nota WA, jadwal antar-jemput |
| 8 | jurnal Gea Laundry | https://journal.ummat.ac.id/index.php/jmm/article/download/38981/pdf | QR di mesin (IoT), QRIS, butuh internet stabil |
| 9 | studi usability Smartlink Bos | https://garuda.kemdiktisaintek.go.id/documents/detail/1717503 | 3 modul (Bos, Kasir, Produksi), pengaturan layanan rumit |
| 10 | DailySocial | https://en.dailysocial.id/post/smartlink-wants-to-modernize-the-laundry-business-with-digital-governance | Bos = web untuk owner, Kasir = aplikasi kasir |
| 11 | dashboard owner | https://dashboard.smartlink.id/ | hanya layar loading "Menghubungi Server", tidak ada detail |

Tidak terbaca: daftar video YouTube (@AplikasiLaundrySmartlink), daftar artikel smartlink.id/article, help center (s.id/smartcare).

## Struktur produk aslinya

Smartlink terdiri dari beberapa aplikasi terpisah yang berbagi data:

- **Kasir** (Android): transaksi di meja penerimaan.
- **Bos / Owner** (web, dipakai di ponsel): pengaturan usaha dan laporan.
- **Produksi**: staf cuci, setrika, dan packing mencatat tahapan proses.
- **Investor**: melihat transaksi dan laporan (disebut jurnal SS Laundry).

Clone ini memulai dari **Kasir + bagian Owner yang minimum**. Produksi dan Investor menyusul.

## Core loop

Kasir menerima cucian, mencatat pelanggan, layanan, dan berat, menerima pembayaran (sekarang atau nanti), lalu mengirim nota. Pelanggan kembali mengambil cucian dan melunasi. Owner melihat uangnya tanpa harus menghitung manual.

## Screens

Kolom "states seen" berisi state yang disebut sumber. Karena UI asli belum terlihat, sebagian besar state wajib dirancang sendiri (ditandai *perlu*).

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Login kasir | buka app kasir | kasir masuk dengan akun staf | input, password, tombol | filled; *perlu: error, lupa password* |
| S02 | Absensi | setelah login, awal shift | check-in harian dalam radius lokasi outlet | tombol check-in, status lokasi | *perlu: di luar radius, izin lokasi ditolak, sudah absen* |
| S03 | Beranda kasir | setelah login | titik mulai transaksi + ringkasan hari ini | tombol "Buat Transaksi", 3 kartu: baru masuk, masih diproses, selesai hari ini | filled; *perlu: kosong (hari baru)* |
| S04 | Pilih / tambah pelanggan | S03 → Buat Transaksi | cari pelanggan lama (muncul otomatis) atau buat baru | pencarian autocomplete, form pelanggan baru | filled; *perlu: tidak ditemukan, nomor WA duplikat* |
| S05 | Pilih layanan & item | lanjut dari S04 | pilih layanan, isi kg / pcs, rincian jenis barang | daftar layanan, stepper berat desimal, penghitung pcs per jenis (handuk, selimut, seprai, bedcover), catatan | filled; *perlu: layanan kosong (owner belum isi), berat 0* |
| S06 | Ringkasan & pembayaran | lanjut dari S05 | konfirmasi rincian, total, pilih cara bayar | ringkasan item, total, pilihan: tunai sekarang / nanti / QR / debit / deposit, input uang diterima + kembalian | filled; *perlu: deposit kurang, QR gagal* |
| S07 | Nota | setelah bayar / simpan | nota dengan QR, cetak atau kirim | preview nota, QR, tombol cetak (2 rangkap: pelanggan + label produksi), kirim WhatsApp / SMS | filled; *perlu: printer tidak terhubung, WA gagal* |
| S08 | Daftar cucian | tab / menu dari S03 | semua order per status | tab status, pencarian nomor nota / nama, daftar order | filled; *perlu: kosong per tab, hasil cari kosong* |
| S09 | Detail order | ketuk order di S08 | lihat isi order, ubah status, aksi lanjut | rincian, status, riwayat status, status bayar, tombol aksi | filled; *perlu: order batal* |
| S10 | Ambil & pelunasan | S09 → Ambil | serahkan cucian, lunasi sisa tagihan | sisa tagihan, pilihan bayar (tunai / debit / e-money / QRIS), opsi ambil tanpa pelunasan (butuh persetujuan owner) | filled; *perlu: menunggu persetujuan, ditolak* |
| S11 | Kas & pengeluaran | menu kasir | catat pengeluaran harian (gas, parfum, sabun, dll.) | form pengeluaran (kategori, nominal, catatan), daftar hari ini | filled; *perlu: kosong* |
| S12 | Statistik harian | menu kasir | omzet, kas diterima, nota terambil, total kg cucian | kartu angka, rekap: nota reguler, top up deposit; daftar belum lunas | filled; *perlu: hari tanpa transaksi* |
| S13 | Riwayat pelanggan | dari S04 / detail pelanggan | transaksi lama satu pelanggan | daftar order, saldo deposit, utang | *perlu: pelanggan baru tanpa riwayat* |
| S14 | Top up deposit | detail pelanggan | pelanggan isi saldo di muka | nominal, cara bayar, saldo baru | *perlu: semua state* |
| S15 | Jadwal antar-jemput | menu kasir | pengingat pelanggan yang perlu dijemput / diantar | daftar per tanggal | *perlu: semua state* |
| S16 | Halaman lacak (publik) | link di nota WhatsApp | pelanggan cek status cucian tanpa login | status, rincian, total, sisa tagihan, info outlet | *perlu: link tidak valid, order selesai / diambil* |
| S17 | Daftar & setup owner | web owner pertama kali | buat akun, isi profil usaha dan outlet (nama, alamat, jumlah karyawan) | form bertahap | *perlu: semua state* |
| S18 | Layanan & harga | menu owner | atur layanan (kiloan / satuan, harga, durasi seperti kilat 3 jam atau reguler 3 hari) dan jenis barang | daftar layanan, form layanan | *diketahui: pengguna asli merasa rumit karena terpisah di halaman lain* |
| S19 | Karyawan & akun | menu owner | buat akun kasir, atur peran, atur radius absensi | daftar staf, form staf, peta / radius | *perlu: semua state* |
| S20 | Dashboard owner | beranda owner | omzet, kas, transaksi per periode, per outlet | kartu angka, grafik, filter tanggal / outlet | *perlu: kosong, banyak outlet* |
| S21 | Laporan keuangan | menu owner | pemasukan, pengeluaran, laba per periode; aslinya: jurnal, buku besar, laba rugi, perubahan modal, neraca | tabel, filter periode, cetak / unduh | *perlu: periode tanpa data* |
| S22 | Pengaturan nota & pesan | menu owner | kepala nota, catatan kaki, template pesan WhatsApp, persetujuan bayar-nanti | form, preview nota | *perlu: semua state* |

## Flows

Jumlah klik aslinya **tidak teramati** karena UI belum terlihat. Angka "target" di bawah adalah sasaran clone, bukan hitungan dari aslinya.

```
F01 Owner menyiapkan usaha
    S17 daftar & outlet -> S18 layanan & harga -> S19 akun kasir -> S22 nota & pesan
    target: siap transaksi pertama < 10 menit
    edge: owner belum isi layanan saat kasir mulai, outlet kedua, nomor WA outlet belum ada

F02 Kasir menerima cucian (CORE LOOP)
    S03 -> S04 pelanggan -> S05 layanan & berat -> S06 bayar -> S07 nota (cetak / WA)
    target: pelanggan lama, 1 layanan kiloan, bayar nanti, kirim WA <= 8 tap
    edge: pelanggan baru tanpa WA, berat desimal (3,25 kg), beberapa layanan dalam satu nota,
          campuran kiloan + satuan, ketuk simpan dua kali, internet putus saat simpan,
          printer tidak terhubung, harga layanan diubah owner di tengah transaksi

F03 Pelanggan melacak cucian
    pesan WA -> S16 halaman lacak
    edge: link lama setelah diambil, link ditebak / diubah (harus tidak bocor order lain)

F04 Update status cucian
    S08 -> S09 -> ubah status (baru -> diproses -> selesai) -> WA "siap diambil" ke pelanggan
    edge: mundur status karena salah ketuk, dua kasir ubah status bersamaan

F05 Pengambilan & pelunasan
    S03 / S08 cari nota (nomor / nama / scan QR) -> S09 -> S10 bayar sisa -> status "diambil"
    edge: sudah lunas di awal, bayar sebagian, salah orang mengambil, nota hilang

F06 Ambil tanpa pelunasan
    S10 -> minta persetujuan owner -> owner setujui -> diambil; utang terbawa ke transaksi berikutnya pelanggan itu
    edge: owner tidak merespons, owner menolak, pelanggan punya utang lama

F07 Kas harian & tutup hari
    S11 catat pengeluaran -> S12 statistik harian -> laporan ke owner
    edge: pengeluaran salah input, tutup hari lewat tengah malam
    catatan: di aslinya, kasir masih mengirim screenshot statistik ke owner secara manual (jurnal Kalesco)

F08 Owner melihat laporan
    S20 dashboard -> S21 laporan keuangan (filter periode / outlet)
    edge: periode panjang (performa), data lebih dari 2 tahun
    catatan: di aslinya, data lebih dari dua tahun dilaporkan tidak bisa diakses (jurnal Kalesco)

F09 Deposit pelanggan
    S13 -> S14 top up -> transaksi berikutnya dibayar dari deposit di S06
    edge: saldo kurang (sisa dibayar cara lain), refund deposit

F10 Absensi kasir
    S01 -> S02 check-in dalam radius
    edge: GPS tidak akurat, izin lokasi ditolak, lupa check-out
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger, tombol besar aksi utama | default, pressed, focus, disabled, loading | semua |
| Input teks / angka | teks, telepon (WA), uang (Rp), berat desimal (kg) | default, focus, error, disabled | S01, S04, S06, S10, S11, S14, S17–S19, S22 |
| Pencarian autocomplete | pelanggan, nomor nota | kosong, mengetik, hasil, tidak ditemukan | S04, S08 |
| Kartu layanan | kiloan, satuan, kilat | default, terpilih, nonaktif | S05, S18 |
| Stepper jumlah | kg desimal, pcs bulat | default, min, max | S05 |
| Pemilih cara bayar | tunai, nanti, QRIS, debit, deposit, e-money | default, terpilih, tidak tersedia | S06, S10, S14 |
| Badge status | baru, diproses, selesai, diambil, batal; lunas / belum lunas | — | S08, S09, S13, S16 |
| Tab status | dengan angka hitungan | aktif, kosong | S08 |
| Preview nota | thermal 58 mm / 80 mm, rangkap pelanggan, label produksi | — | S07, S22 |
| QR code | nota, pembayaran | — | S06, S07, S16 |
| Kartu statistik | angka + perubahan | loading, kosong | S03, S12, S20 |
| Daftar order (row) | ringkas, dengan sisa tagihan | default, ditekan | S08, S13 |
| Modal konfirmasi | biasa, berbahaya (batal order) | — | S09, S10 |
| Toast | sukses, gagal, info | — | semua |
| Navigasi bawah (mobile) | kasir, owner | aktif | aplikasi kasir, owner |
| Pemilih tanggal / periode | hari, rentang | — | S12, S15, S20, S21 |
| Permintaan persetujuan | menunggu, disetujui, ditolak | — | S10, owner |
| Empty state | per layar | — | semua daftar |

## Inferred data model

```
Business   id, name, owner_user_id, created_at
           evidence: S17 (jurnal Kalesco: owner isi nama usaha), multi-outlet di halaman fitur
           confidence: high

Outlet     id, business_id, name, address, phone, lat, lng, attendance_radius_m,
           nota_header, nota_footer, wa_template
           evidence: S17, S19 (absensi dalam radius dari owner), S22
           confidence: high (field nota & template: guess)

Staff      id, outlet_id, name, phone, role (owner | supervisor | kasir | produksi | kurir),
           password_hash, active
           evidence: S01, S19, fitur "Level Akses", Play Store (kasir, kurir, produksi)
           confidence: high

Customer   id, business_id, name, phone_wa, address, birth_date,
           deposit_balance, debt_balance
           evidence: S04 (jurnal SS Laundry: nama, alamat, telepon, tanggal lahir), F06, F09
           confidence: high (saldo sebagai kolom vs dihitung: guess)

Service    id, outlet_id, name, pricing_unit (kg | pcs), price, duration_hours, active
           evidence: S05, S18; jurnal Kalesco: kilat 3 jam Rp19.000/kg, reguler 3 hari Rp7.500/kg
           confidence: high

ItemType   id, business_id, name (handuk, selimut, seprai, bedcover, ...)
           evidence: S05 (rincian jenis barang dikonfirmasi ke pelanggan)
           confidence: medium

Order      id, outlet_id, nota_number, customer_id, cashier_id,
           status (baru | diproses | selesai | diambil | batal),
           received_at, due_at, finished_at, taken_at,
           subtotal, discount, total, paid_total,
           payment_status (belum_bayar | sebagian | lunas),
           tracking_token, notes
           evidence: S03 ringkasan (baru masuk, diproses, selesai hari ini), S10, S16
           confidence: high (nama status persis: medium)

OrderLine  id, order_id, service_id, qty (decimal), unit, unit_price, line_total,
           item_counts (json: item_type_id -> pcs)
           evidence: S05, S06 (rincian satuan, kilo, total)
           confidence: high

Payment    id, order_id (nullable untuk top up), customer_id,
           method (tunai | qris | debit | deposit | ewallet),
           amount, kind (order | pelunasan | topup), paid_at, cashier_id
           evidence: S06, S10, S14; rekap "nota reguler, top up deposit, top up e-money"
           confidence: high

PayLaterApproval  id, order_id, requested_by, decided_by, status (menunggu | disetujui | ditolak), decided_at
           evidence: fitur "Ambil Tanpa Pelunasan" dengan persetujuan owner
           confidence: medium

StatusEvent  id, order_id, from_status, to_status, by_staff_id, at
           evidence: kebutuhan lacak (S16), jejak produksi
           confidence: guess

Expense    id, outlet_id, category, amount, note, spent_on, staff_id
           evidence: S11 (gas, parfum, sabun cuci, operasional)
           confidence: high

Attendance id, staff_id, check_in_at, check_out_at, lat, lng, within_radius
           evidence: S02, jurnal SS Laundry
           confidence: high

MessageLog id, order_id, channel (wa | sms), template, status, sent_at
           evidence: nota via WA / SMS, biaya per kirim di halaman biaya
           confidence: medium

PickupSchedule id, customer_id, order_id, type (jemput | antar), scheduled_at, address, status
           evidence: S15 (jurnal SS Laundry)
           confidence: medium

Promo      id, outlet_id, type (persen | nominal), scope (semua | per layanan), active_from, active_to
           evidence: fitur "Manajemen Promo"; ulasan Play Store minta diskon per layanan
           confidence: medium (di luar inti kasir)
```

Relationships: Business 1-n Outlet, Outlet 1-n Staff, Business 1-n Customer, Outlet 1-n Service, Outlet 1-n Order, Customer 1-n Order, Order 1-n OrderLine, OrderLine n-1 Service, Order 1-n Payment, Customer 1-n Payment (top up), Order 1-n StatusEvent, Order 0-1 PayLaterApproval, Outlet 1-n Expense, Staff 1-n Attendance.

Laporan keuangan di aslinya berbasis akuntansi berpasangan (jurnal umum otomatis, buku besar, neraca). Untuk inti kasir, laporan dihitung dari Payment dan Expense. Jurnal akuntansi penuh masuk tahap berikutnya.

## Feature matrix

See `features.csv`. Must: 24, should: 13, could: 11, skip: 2.

## Out of scope (cannot or should not be cloned)

- **Kontrol mesin IoT (Snapbridge):** butuh perangkat keras dan kemitraan mereka.
- **Sistem koin dan biaya aktivasi:** ini model bisnis, bukan fitur. Harga clone ditentukan di replica-launch.
- Basis pelanggan dan jaringan outlet mereka, data mereka, nama, logo, warna, dan teks mereka.
- Kerja sama penyedia QRIS dan WhatsApp milik mereka. Clone memakai akun dan API resmi milik sendiri.

## Size

Screens 22, flows 10, entities 16.

Hard parts:
1. **Cetak nota thermal** dari aplikasi (printer Bluetooth ESC/POS, 58/80 mm, dua rangkap). Di web terbatas, jadi kemungkinan perlu aplikasi Android atau pembungkus native.
2. **WhatsApp otomatis.** Kirim manual lewat link wa.me itu mudah. Kirim otomatis butuh WhatsApp Business Platform resmi (verifikasi bisnis Meta, template pesan disetujui, biaya per pesan).
3. **QRIS dinamis.** Butuh payment gateway (merchant onboarding dan KYB) plus webhook. QRIS statis milik outlet + konfirmasi manual bisa jadi langkah pertama.
4. Penomoran nota yang unik per outlet tanpa bentrok, berat desimal dan pembulatan rupiah, pemisahan data antar usaha (multi-tenant).

Size: **M** (beberapa minggu) untuk inti kasir. Seluruh suite Smartlink (produksi, payroll, akuntansi penuh, inventori, investor, IoT) masuk **L**.
