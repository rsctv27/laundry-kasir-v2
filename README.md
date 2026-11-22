# laundry-kasir (nama sementara)

Aplikasi kasir laundry: aplikasi Android untuk kasir, web untuk pemilik, satu API dan satu database.
Fitur dan alurnya dibangun ulang dari pengamatan publik atas Smartlink (lihat `replica/`). Kode, teks, dan desainnya ditulis sendiri.

```
apps/web/         Next.js 16: web pemilik, halaman lacak /t/:token, API /api/v1, login /api/auth
apps/kasir/       Expo SDK 58 (React Native): aplikasi kasir Android + versi web untuk HP & desktop (PWA)
packages/shared/  hitung uang & berat, zona waktu, status order, nota (teks, ESC/POS, WhatsApp), skema input
packages/db/      skema Drizzle + migrasi SQL
replica/          recon, arsitektur, desain, daftar fitur, log build, screenshot
```

## Menjalankan di komputer

Butuh Node 22, pnpm 10, PostgreSQL 15+.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local      # isi DATABASE_URL dan BETTER_AUTH_SECRET
DATABASE_URL=postgres://... pnpm --filter @lk/db migrate
pnpm --filter @lk/web seed                        # data contoh (opsional)
npx tsx apps/web/scripts/seed-history.ts          # riwayat 14 hari untuk demo dashboard (opsional, bukan production)
pnpm --filter @lk/web dev                         # http://localhost:3000
cd apps/kasir && npx expo start --web             # aplikasi kasir versi web, http://localhost:8081
```

Data contoh: pemilik `owner@contoh.id` / `rahasia123` · kasir: kode usaha `contoh`, username `dewi`, password `kasir123`.

## Tes

```bash
pnpm --filter @lk/shared test     # 20 tes unit
pnpm --filter @lk/web test        # 28 tes API (butuh Postgres; TEST_DATABASE_URL)
python3 apps/kasir/e2e/kasir_flow.py   # 19 pemeriksaan alur inti di browser (API :3000 + kasir web :8081)
python3 apps/kasir/e2e/m2_flow.py      # 28 pemeriksaan keuangan, PWA, HP 390 px & desktop 1440 px
```

## Milestone 0: uji printer di HP Android

Cetak ke printer Bluetooth butuh *development build* (tidak bisa lewat Expo Go).

1. Buat akun gratis di expo.dev, lalu di folder `apps/kasir`: `npx eas-cli@latest login`.
2. Isi `EXPO_PUBLIC_API_URL` di `apps/kasir/eas.json` dengan alamat server (atau alamat IP komputer di jaringan yang sama).
3. `npx eas-cli@latest build --profile development --platform android`, lalu pasang APK yang dihasilkan di HP kasir.
4. Pasangkan printer di pengaturan Bluetooth HP, buka aplikasi > **Lainnya > Printer**, pilih ukuran kertas, **Cari printer**, pilih, lalu **Uji cetak**.
5. Periksa: garis lurus sampai tepi, angka rata kanan, QR bisa di-scan. Kalau gagal, hanya `apps/kasir/src/printer/driver.native.ts` yang perlu diganti.

## Versi web (HP & komputer kasir)

```bash
cd apps/kasir
EXPO_PUBLIC_API_URL=https://alamat-server-anda npx expo export --platform web   # hasil di dist/
```

Unggah isi `dist/` ke hosting statis apa pun (Vercel, Netlify, Cloudflare Pages) dengan aturan semua alamat diarahkan ke `index.html`, lalu tambahkan alamatnya ke `CORS_ORIGINS` di server.

- Di HP: buka alamatnya di Chrome, menu ⋮ > **Tambahkan ke layar utama**.
- Di komputer: buka di Chrome/Edge, klik ikon **Instal** di bilah alamat. Aplikasi terbuka di jendela sendiri seperti aplikasi desktop.
- Cetak nota: tombol **Cetak** membuka dialog cetak browser. Pasang driver printer thermal di komputer, pilih printer itu, dan samakan ukuran kertas (58/80 mm) dengan pengaturan di **Lainnya > Printer**.
