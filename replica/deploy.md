# Deploy checklist: laundry-kasir (nama sementara), versi uji coba

Tanggal: 2026-11-22  Commit: faec8e8  Izin dari Rico untuk go live: **belum**

Jenis deploy: **uji coba (staging)**, bukan peluncuran publik. Situs memakai `noindex` (tidak muncul di Google),
nama dan ikon masih sementara. Peluncuran publik menunggu replica-brand dan daftar "Sebelum peluncuran" di bawah.

## Satu alamat untuk semuanya

```
https://<proyek>.vercel.app/            beranda + daftar/masuk pemilik
https://<proyek>.vercel.app/dashboard   web pemilik (desktop & HP)
https://<proyek>.vercel.app/kasir       aplikasi kasir versi web (HP & desktop, bisa dipasang sebagai aplikasi/PWA)
https://<proyek>.vercel.app/t/<token>   halaman lacak cucian untuk pelanggan
https://<proyek>.vercel.app/api/...     API (dipakai kasir web, nanti juga aplikasi Android)
```

Kasir web dan web pemilik satu origin, jadi tidak perlu CORS dan login kasir memakai token yang sama dengan Android.

## Preflight

| cek | hasil |
| --- | --- |
| Uji unit `packages/shared` | 20/20 lolos |
| Uji API `apps/web` (database uji) | 28/28 lolos |
| e2e alur kasir `kasir_flow.py` di build produksi, satu origin (`:3000/kasir`) | 19/19 lolos, 0 console error |
| e2e M2 + HP 390 px + desktop 1440 px `m2_flow.py`, satu origin | 28/28 lolos, 0 console error |
| e2e pertama kali pakai `first_run.py` pada database kosong (migrasi dari nol lewat `vercel-build.mjs`) | 11/11 lolos, 0 console error |
| Parity (`parity.py`) | 70.2 / 100, must-have 23 dari 24 |
| Must-have yang belum: cetak ke printer thermal fisik | Android Bluetooth belum diuji di perangkat; versi web mencetak lewat dialog cetak browser (lolos e2e). **Tidak menghalangi uji coba web.** |
| Brand sweep (`sweep.py --config replica/brand.json`) | **bersih, exit 0** (tidak ada nama, domain, atau warna aplikasi asli) |
| Build produksi (`node scripts/vercel-build.mjs`) | lolos: migrasi 3 file, ekspor kasir web, `next build` |
| Bug S1/S2 terbuka | tidak ada |
| Kebijakan privasi & ketentuan | ada: `/privasi`, `/ketentuan`, pemroses data disebut (Vercel, Neon) |
| Cookie | hanya cookie login (wajib), tanpa analitik, jadi tidak perlu banner |
| Hapus akun | **belum ada tombol**; lewat permintaan ke pengelola (tertulis di /privasi). Wajib sebelum peluncuran publik. |
| Favicon, judul, ikon | ikon dan nama masih sementara (bukan milik aplikasi asli). Diganti di replica-brand. |
| Stripe, OAuth, email | tidak dipakai (login email + password; nota lewat WhatsApp kasir) |

## Layanan produksi

- **Hosting**: Vercel, region `sin1` (Singapura, terdekat ke Indonesia). `apps/web/vercel.json`.
- **Database**: Neon Postgres lewat Vercel Marketplace, region Singapura, project terpisah dari database pengembangan.
  Integrasi mengisi `DATABASE_URL` (pooled) dan `DATABASE_URL_UNPOOLED` (langsung) otomatis.
- **Migrasi**: dijalankan oleh build (`scripts/vercel-build.mjs`) lewat `DATABASE_URL_UNPOOLED`, tidak pernah manual.
  Tabel `_migrations` mencatat yang sudah jalan.
- **Biaya uji coba**: Vercel Hobby (gratis) dan Neon Free (gratis, 1 GB per project, database tidur saat tidak dipakai).
  Hobby hanya untuk pemakaian pribadi non-komersial: begitu dipakai untuk operasional laundry sungguhan,
  pindah ke Vercel Pro (sekitar $20 per pengguna per bulan).

### Environment variables di Vercel (Settings, Environment Variables)

| nama | isi | siapa yang mengisi |
| --- | --- | --- |
| `DATABASE_URL` | koneksi pooled Neon | otomatis oleh integrasi Neon |
| `DATABASE_URL_UNPOOLED` | koneksi langsung Neon, untuk migrasi | otomatis oleh integrasi Neon |
| `BETTER_AUTH_SECRET` | string acak minimal 32 karakter | **Rico**: tombol "Generate Secret" di better-auth.com/docs/installation atau `openssl rand -base64 32`. Jangan dikirim di chat. |
| `DATABASE_POOL_MAX` | `3` | Rico (disarankan untuk serverless) |
| `DATABASE_POOL_MAX_AUTH` | `2` | Rico (disarankan) |
| `BETTER_AUTH_URL`, `PUBLIC_BASE_URL` | kosongkan dulu; otomatis memakai alamat produksi Vercel. Isi `https://domain-anda` setelah pasang domain sendiri. | Rico, nanti |
| `CORS_ORIGINS` | kosongkan (hanya untuk kasir web di origin lain saat pengembangan) | - |
| `ALLOW_INDEXING` | jangan diisi selama uji coba (`1` = boleh muncul di Google) | Rico, saat peluncuran |

Build berhenti dengan pesan jelas bila `BETTER_AUTH_SECRET` atau `DATABASE_URL` belum ada.

## Langkah Rico (akun atas nama Rico, Claude tidak memasukkan password atau kunci)

1. **GitHub**: buat repo kosong privat (mis. `laundry-kasir`), lalu hubungkan GitHub di pengaturan claude.ai
   supaya Claude bisa push kode ke repo itu. (Alternatif tanpa GitHub: lihat bawah.)
2. **Vercel**: daftar di vercel.com dengan akun GitHub. Add New, Project, pilih repo `laundry-kasir`.
   - Root Directory: `apps/web`
   - Framework: Next.js (terdeteksi). Build & install command sudah diatur di `vercel.json`, biarkan.
3. **Database**: di proyek Vercel, tab Storage, tambah **Neon**, region **Singapore**, hubungkan ke proyek
   untuk Production dan Preview.
4. **Secret**: Settings, Environment Variables, tambah `BETTER_AUTH_SECRET`, `DATABASE_POOL_MAX=3`, `DATABASE_POOL_MAX_AUTH=2`.
5. **Deploy**: Deployments, Redeploy (atau push baru). Setelah hijau, kirim alamat `https://....vercel.app` ke Claude.
6. Claude menjalankan `first_run.py` ke alamat itu (membuat satu "Laundry Uji Otomatis" yang boleh dihapus),
   lalu Rico mencoba sendiri di HP: daftar, siapkan usaha, buat akun kasir, buka `/kasir`, pasang ke layar utama.

Alternatif tanpa GitHub: unduh zip kode, lalu di laptop yang punya Node.js jalankan `npx vercel` dari folder `apps/web`
(login lewat browser). Langkah 3 sampai 6 sama.

## Domain (nanti, setelah nama dipilih dan domain dibeli Rico)

| record | nama | isi |
| --- | --- | --- |
| A | @ | IP apex yang ditampilkan Vercel di Settings, Domains |
| CNAME | www | `cname.vercel-dns.com` |
| TXT | sesuai permintaan Vercel | nilai verifikasi, bila diminta |

Pilih satu alamat utama (apex atau www), yang lain dialihkan. HTTPS otomatis. Lalu isi `BETTER_AUTH_URL` dan
`PUBLIC_BASE_URL` dengan `https://domain-anda` dan redeploy (link lacak di nota ikut domain baru).
Belum ada email keluar, jadi SPF/DKIM/DMARC belum perlu.

## Pantau (minggu pertama)

- Vercel: tab Logs (error API) dan Observability; alert email dari Vercel bila build gagal.
- Neon: pemakaian storage dan compute (batas gratis 1 GB per project).
- Uptime: cek `/` dan `/api/v1/me` (harus 401) tiap 5 menit, mis. UptimeRobot gratis ke email/HP Rico.
- Alur inti di situs live: `WEB_URL=https://... python3 apps/kasir/e2e/first_run.py`, lalu Rico di HP.

## Sebelum peluncuran publik (bukan untuk uji coba)

- [ ] replica-brand: nama, logo, ikon, warna sendiri; cek merek dan domain; sweep tetap bersih
- [ ] tombol hapus akun dan seluruh data usaha
- [ ] Vercel Pro (pemakaian komersial), backup Neon/point-in-time restore sesuai plan
- [ ] `ALLOW_INDEXING=1`, halaman beranda/landing (replica-launch)
- [ ] printer thermal fisik diuji (Android) atau cukup cetak browser untuk versi web
- [ ] nama pengelola dan kontak di /privasi dan /ketentuan

URL live: belum (menunggu langkah Rico).
