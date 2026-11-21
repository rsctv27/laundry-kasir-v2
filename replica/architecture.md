# Architecture: laundry-kasir (membangun ulang fitur inti Smartlink)

Nama kerja `laundry-kasir`. Nama produk ditentukan di replica-brand.
Dibaca dari: `replica/recon.md`, `replica/features.csv`. Tanggal: 2026-11-21.

## Bentuk aplikasinya

Seperti aslinya, ada dua sisi yang memakai satu backend dan satu database:

- **Aplikasi Kasir** (Android, untuk HP di meja kasir + printer thermal Bluetooth): layar S01–S15.
- **Web Owner** (dibuka di HP atau laptop): layar S17–S22, ditambah halaman lacak publik S16 untuk pelanggan.

```
laundry-kasir/                 monorepo (pnpm workspaces + Turborepo)
  apps/web/                    Next.js: web owner, halaman lacak /t/:token, API /api/v1, login /api/auth
  apps/kasir/                  Expo (React Native), Android, development build lewat EAS
  packages/shared/             skema zod, tipe, hitung uang dan berat, mesin status, penyusun nota
  packages/db/                 skema Drizzle + migrasi (dari replica/schema.sql)
```

## Stack

Stack ini sengaja memakai teknologi yang sudah Anda kuasai (React Native, Next.js, Node.js, PostgreSQL), supaya waktu habis untuk fitur, bukan belajar alat baru.

| layer | choice | why |
| --- | --- | --- |
| aplikasi kasir | Expo (React Native) + Expo Router, Android dulu | cetak nota ke printer Bluetooth butuh kode native; web tidak bisa ke printer Bluetooth Classic yang umum dipakai |
| web owner + API | Next.js (App Router) + TypeScript | satu deploy untuk dashboard owner, halaman lacak, dan API yang dipakai aplikasi kasir |
| styling | Tailwind (web), NativeWind (kasir), token dari replica-design | satu sistem token untuk dua aplikasi |
| database | Postgres di Supabase, region Singapura | managed, backup harian, paling dekat ke Indonesia; klien tidak pernah akses langsung |
| ORM | Drizzle | SQL-nya tetap terlihat jelas, tipe ikut ke TypeScript |
| auth | Better Auth (email + password untuk owner, plugin username untuk staf, plugin Expo) | satu sistem login untuk owner dan kasir, data tersimpan di Postgres sendiri |
| pembayaran pelanggan | QRIS statis milik outlet dulu; QRIS dinamis lewat payment gateway Indonesia (Xendit atau Midtrans) menyusul | QRIS statis bisa langsung dipakai tanpa pendaftaran merchant; QRIS dinamis butuh onboarding |
| WhatsApp | link wa.me dulu (kasir tinggal tekan kirim); WhatsApp Business Platform resmi menyusul | gratis dan langsung jalan; versi otomatis butuh verifikasi bisnis Meta |
| cetak nota | library ESC/POS Bluetooth untuk React Native, dipilih lewat uji coba dengan printer asli | ekosistemnya terpecah, jadi diuji dulu sebelum dipakai (lihat Milestone 0) |
| email | Resend | hanya untuk verifikasi akun owner dan reset password |
| jobs | Vercel Cron | ringkasan harian ke owner; belum perlu antrean |
| files | Supabase Storage | gambar QRIS outlet, logo nota |
| hosting | Vercel (region Singapura) untuk web; EAS Build untuk APK Android | managed; APK dibagikan internal dulu, Play Store belakangan |

Satu database. Tanpa microservices. Langganan aplikasi untuk owner laundry (cara Anda menagih) diputuskan di replica-launch, bukan sekarang.

## Login staf

- Owner mendaftar dengan email. Saat membuat usaha, owner memilih **kode usaha** (misalnya `laundrya`).
- Owner membuat akun kasir (nama + username + PIN/password). Di belakang layar, username disimpan sebagai `<kode_usaha>_<username>` agar unik di seluruh sistem, dan email diisi alamat dummy `<uuid>@staff.invalid` yang tidak pernah dikirimi apa pun.
- Di aplikasi kasir, layar login meminta **kode usaha, username, password**.
- Sesi kasir disimpan di SecureStore HP dan dikirim sebagai token ke API.

## Schema

Tables: 21 (4 milik Better Auth + 17 tabel usaha). Access rules: **pengecekan di lapisan data**. Setiap query memakai `business_id` dari sesi, dan satu fungsi `can(staff, aksi, data)` menjawab boleh atau tidak. RLS tidak dipakai karena klien tidak pernah tersambung ke database.

File lengkap: `replica/schema.sql`. Sudah diuji di Postgres 16: skema termuat, dan aturan berikut terbukti menolak data salah:

- pelanggan atau outlet milik usaha lain tidak bisa dipakai di order (foreign key komposit dengan `business_id`)
- nomor nota tidak bisa dobel dalam satu outlet
- pembayaran tidak bisa melebihi tagihan, dan status bayar harus cocok dengan jumlahnya
- jumlah pcs tidak boleh desimal (kg boleh)
- status "diambil" wajib punya waktu ambil; "batal" wajib punya waktu batal
- nomor WA pelanggan tidak bisa dobel dalam satu usaha
- top up deposit tidak bisa dibayar pakai deposit
- hanya boleh ada satu permintaan bayar-nanti yang menunggu per order

Keputusan penting di skema:

- **Uang**: rupiah utuh (`bigint`), mata uang di `businesses.currency` (default IDR). Tidak pakai sen karena rupiah tidak memakai pecahan.
- **Berat**: `numeric(8,2)` kg. `line_total = round(qty × harga)` dihitung di server, bukan dipercaya dari aplikasi.
- **Nomor nota**: `OUTLET-YYMMDD-NNN` (contoh `MLG1-261121-007`), dari tabel `nota_counters` dengan satu perintah `insert ... on conflict do update ... returning` di dalam transaksi yang sama dengan pembuatan order. Aman walau dua kasir menyimpan bersamaan.
- **Saldo deposit**: tidak disimpan sebagai angka di tabel pelanggan, tapi dijumlahkan dari `deposit_ledger`. Setiap perubahan saldo tercatat dan bisa ditelusuri.
- **Utang pelanggan**: dihitung dari order yang sudah diambil tapi belum lunas.
- **Token lacak**: 32 karakter acak per order, tidak bisa ditebak dari nomor nota.
- **Snapshot layanan**: nama dan harga layanan disalin ke `order_lines`, jadi perubahan harga oleh owner tidak mengubah nota lama.
- **Status order**: `baru → diproses → selesai → diambil`, plus `batal` dari `baru` atau `diproses`. Mundur satu langkah hanya oleh supervisor/owner, dengan catatan, dan tercatat di `status_events`.

## API

Semua endpoint `/api/v1` butuh sesi dan otomatis dibatasi ke usaha milik sesi itu. Kasir hanya bisa melihat outlet tempat ia ditugaskan.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| ALL /api/auth/* | daftar owner, login email / username, logout, sesi | publik / semua | sesuai Better Auth | sesi | F01, F10 |
| POST /api/v1/businesses | buat usaha + outlet pertama + baris staf owner | owner baru | nama usaha, kode usaha, outlet | usaha, outlet | F01 |
| GET /api/v1/outlets | daftar outlet | owner, supervisor | — | outlet[] | F08 |
| POST /api/v1/outlets | tambah outlet | owner | nama, kode, alamat | outlet | F01 |
| PATCH /api/v1/outlets/:id | pengaturan nota, template WA, radius absen, QRIS, persetujuan bayar-nanti | owner | field yang diubah | outlet | F01 |
| GET /api/v1/services | layanan aktif per outlet | semua staf | outlet_id | service[] | F02 |
| POST /api/v1/services | tambah layanan | owner | nama, kg/pcs, harga, durasi | service | F01 |
| PATCH /api/v1/services/:id | ubah / nonaktifkan layanan | owner | field yang diubah | service | F01 |
| GET /api/v1/item-types | jenis barang | semua staf | — | item_type[] | F02 |
| POST /api/v1/item-types | tambah jenis barang | owner | nama | item_type | F01 |
| GET /api/v1/staff | daftar staf | owner | — | staff[] | F01 |
| POST /api/v1/staff | buat akun staf (user Better Auth + baris staf) | owner | nama, username, password, peran, outlet | staff | F01 |
| PATCH /api/v1/staff/:id | ubah peran / outlet / aktif / reset password | owner | field yang diubah | staff | F01 |
| GET /api/v1/me | profil staf, outlet, hak akses | semua staf | — | me | semua |
| GET /api/v1/home | ringkasan hari ini (baru, diproses, selesai hari ini) | kasir+ | tanggal | angka | F02 |
| GET /api/v1/customers | cari pelanggan (nama mirip / nomor WA) | kasir+ | q | customer[] | F02 |
| POST /api/v1/customers | tambah pelanggan | kasir+ | nama, WA, alamat, tgl lahir | customer | F02 |
| GET /api/v1/customers/:id | detail, saldo deposit, utang, riwayat order | kasir+ | — | customer + order[] | F09 |
| PATCH /api/v1/customers/:id | ubah data pelanggan | kasir+ | field yang diubah | customer | F02 |
| POST /api/v1/orders | buat order + baris + pembayaran awal (opsional); idempotent dengan id dari aplikasi | kasir+ | id, customer_id, lines[], promo, payment? | order + nota | F02 |
| GET /api/v1/orders | daftar per status, cari nota / nama | kasir+ | status, q, cursor | order[] | F04, F05 |
| GET /api/v1/orders/:id | detail order + riwayat status + pembayaran | kasir+ | — | order | F04, F05 |
| POST /api/v1/orders/:id/status | ubah status | kasir+ (mundur: supervisor+) | to_status, note | order | F04 |
| POST /api/v1/orders/:id/payments | bayar / pelunasan; idempotent dengan id dari aplikasi | kasir+ | id, method, amount, cash_received | payment + order | F05, F09 |
| POST /api/v1/orders/:id/pickup | tandai diambil (harus lunas, atau bayar-nanti disetujui) | kasir+ | — | order | F05, F06 |
| POST /api/v1/orders/:id/cancel | batalkan order | supervisor+ | alasan | order | F04 |
| GET /api/v1/orders/:id/nota | isi nota (baris teks + QR) untuk dicetak dan teks WA | kasir+ | — | nota | F02 |
| POST /api/v1/orders/:id/messages | catat pesan WA yang dikirim (manual dulu, API nanti) | kasir+ | template, channel | message_log | F02, F04 |
| POST /api/v1/orders/:id/pay-later-requests | minta izin ambil tanpa pelunasan | kasir+ | catatan | approval | F06 |
| GET /api/v1/pay-later-requests | permintaan yang menunggu | owner, supervisor | status | approval[] | F06 |
| POST /api/v1/pay-later-requests/:id/decision | setujui / tolak | owner, supervisor | disetujui / ditolak | approval | F06 |
| POST /api/v1/customers/:id/topups | top up deposit | kasir+ | id, method, amount | payment + saldo | F09 |
| GET /api/v1/expenses | pengeluaran per tanggal | kasir+ | tanggal | expense[] | F07 |
| POST /api/v1/expenses | catat pengeluaran | kasir+ | kategori, nominal, catatan | expense | F07 |
| GET /api/v1/stats/daily | omzet, kas diterima, nota terambil, total kg, belum lunas | kasir+ | tanggal, outlet | statistik | F07 |
| GET /api/v1/reports/summary | pemasukan, pengeluaran, laba per periode / outlet | owner, supervisor | dari, sampai, outlet | laporan | F08 |
| POST /api/v1/attendance/check-in | absen masuk, cek radius di server | kasir+ | lat, lng | attendance | F10 |
| POST /api/v1/attendance/check-out | absen pulang | kasir+ | — | attendance | F10 |
| GET /t/:token | halaman lacak publik (tanpa login) | publik | token | halaman | F03 |

Webhooks in (menyusul, tahap should): `POST /api/webhooks/qris` dari payment gateway (verifikasi tanda tangan, dedup lewat `payments.external_ref`), `POST /api/webhooks/whatsapp` untuk status kirim (dedup lewat `message_logs.provider_message_id`).
Webhooks out: tidak ada.
Jobs: `ringkasan-harian` lewat Vercel Cron, tiga jadwal untuk WIB, WITA, WIT pukul 21.30 waktu lokal. Isinya mengirim statistik harian tiap outlet ke owner, menggantikan kebiasaan kasir mengirim screenshot. Ini masuk tahap should.

Halaman lacak `/t/:token` hanya menampilkan nama depan pelanggan, rincian layanan, status, total, sisa tagihan, dan info outlet. Nomor WA dan alamat tidak ditampilkan, halaman diberi `noindex`, dan permintaannya dibatasi (rate limit).

## The parts that bite

- **zona waktu**: outlet bisa di WIB, WITA, atau WIT. "Hari ini", nomor nota harian, dan tanggal pengeluaran selalu dihitung dengan zona waktu outlet, sementara database menyimpan UTC. Indonesia tidak memakai daylight saving, jadi selisihnya tetap.
- **idempotency**: aplikasi kasir membuat `id` order dan pembayaran sendiri (UUID) sebelum dikirim. Kalau kasir menekan simpan dua kali atau sinyal putus lalu dikirim ulang, server mengenali id yang sama dan tidak membuat order ganda. Webhook gateway dan WA nanti di-dedup lewat id dari penyedia.
- **race**: nomor nota lewat `nota_counters` di transaksi yang sama. Dua kasir melunasi order yang sama: baris order dikunci (`select ... for update`) dan constraint `paid_total <= total` menjadi pengaman terakhir.
- **pembulatan**: harga per kg × berat desimal dibulatkan ke rupiah terdekat di satu fungsi bersama (`packages/shared`), dipakai aplikasi untuk tampilan dan server untuk angka final.
- **printer**: Bluetooth Classic vs BLE, ukuran kertas 58/80 mm, izin Bluetooth Android 12+, printer mati di tengah cetak. Kode cetak dibungkus satu antarmuka `Printer` supaya library bisa diganti tanpa menyentuh layar.
- **satu sumber nota**: `packages/shared` menyusun isi nota sekali, lalu dirender ke tiga bentuk: perintah ESC/POS (printer), teks WhatsApp, dan HTML (halaman lacak). Nota di kertas, WA, dan web selalu sama.
- **WhatsApp**: link wa.me gratis tapi butuh satu tap kasir per pesan. API resmi bisa otomatis, tapi pesan yang dimulai bisnis wajib memakai template yang disetujui Meta dan ada biaya per percakapan.
- **multi-tenant**: `business_id` ada di setiap tabel usaha, foreign key komposit mencegah data tercampur di level database, dan setiap endpoint diuji dengan akun usaha kedua yang harus mendapat hasil kosong.
- **rate limit**: login staf (PIN mudah ditebak kalau tidak dibatasi), halaman lacak, dan pembuatan pelanggan.
- **offline**: versi pertama butuh internet, sama seperti aslinya. Tapi karena id dibuat di aplikasi dan endpoint idempotent, mode offline (antrean lokal) bisa ditambahkan nanti tanpa mengubah API.
- **data lama**: semua data disimpan tanpa batas waktu, daftar memakai paginasi cursor, dan indeks berdasarkan tanggal. Di aslinya, data lebih dari dua tahun dilaporkan tidak bisa diakses.
- **pencarian**: nama pelanggan dicari dengan indeks trigram (`pg_trgm`), jadi salah ketik kecil tetap ketemu.
- **data pribadi**: nomor WA, alamat, dan tanggal lahir pelanggan adalah data pribadi menurut UU PDP. Perlu kebijakan privasi, akses dibatasi per usaha, dan fitur hapus data pelanggan atas permintaan.

## Build order

**Milestone 0 — uji printer (1–2 hari).** Development build Expo yang hanya bisa: cari printer, sambung, cetak satu nota contoh berisi QR. Diuji dengan printer thermal yang benar-benar dipakai di outlet. Kalau gagal, ganti library sebelum membangun apa pun.

**Milestone 1 — vertical slice (alur inti, tampilan seadanya).** Owner daftar, bikin usaha, satu layanan, satu akun kasir. Kasir login, terima cucian, simpan, cetak nota dan kirim WA. Pelanggan membuka link lacak. Kasir menandai selesai, lalu diambil dan dibayar tunai.
- Layar: S17, S18, S19 (versi minimal), S01, S03, S04, S05, S06, S07, S08, S09, S10, S16
- Tabel: tabel Better Auth, businesses, outlets, staff, customers, services, nota_counters, orders, order_lines, status_events, payments
- Endpoint: /api/auth/*, POST /businesses, POST /services, POST /staff, GET /me, GET /services, GET+POST /customers, POST /orders, GET /orders, GET /orders/:id, POST /orders/:id/status, POST /orders/:id/payments, POST /orders/:id/pickup, GET /orders/:id/nota, GET /t/:token

**Milestone 2 — must-have lainnya (berdasarkan area).**
- transaksi: beberapa layanan per nota, kg + pcs campur
- pembayaran: bayar nanti, QRIS statis (tampilkan gambar QRIS outlet + konfirmasi kasir)
- nota: cetak dua rangkap (pelanggan + label produksi), `message_logs` untuk WA manual
- status: tab per status dan pencarian di S08
- keuangan: S11 pengeluaran, S12 statistik harian, rekap belum lunas
- owner: S20 dashboard, S21 laporan sederhana
- Layar: S08, S11, S12, S20, S21 (lengkap). Tabel: expenses, message_logs. Endpoint: GET /home, GET+POST /expenses, GET /stats/daily, GET /reports/summary, POST /orders/:id/messages, POST /orders/:id/cancel, PATCH /outlets/:id

**Milestone 3 — should-have.** Rincian jenis barang, debit/EDC, ambil tanpa pelunasan + persetujuan owner, deposit, riwayat pelanggan, scan QR nota, absensi radius, multi outlet, level akses, promo, pengaturan nota dan template WA, ringkasan harian otomatis ke owner, lalu QRIS dinamis dan WhatsApp otomatis (keduanya butuh akun dari penyedia, jadi mulai urus pendaftarannya sejak Milestone 1).
- Layar: S02, S13, S14, S22. Tabel: item_types, pay_later_approvals, deposit_ledger, attendance, promos. Endpoint: item-types, pay-later-requests, topups, attendance, outlets (GET/POST), webhooks.

**Milestone 4 — could-have.** Jadwal antar-jemput (S15), aplikasi produksi, kurir, akuntansi penuh, payroll, inventori, faktur massal, WA blast, SMS, aplikasi investor. Masing-masing butuh migrasi baru.

**Milestone 5 — perbaikan dari replica-entrepreneur.** Belum dijalankan. Kandidat yang sudah terlihat di ulasan Play Store dan jurnal: aplikasi lambat dan sering error, butuh internet terus, laporan harian masih lewat screenshot, data lama hilang.
