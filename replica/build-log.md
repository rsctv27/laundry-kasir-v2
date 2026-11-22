# Build log: laundry-kasir

Milestone 0 (uji printer), Milestone 1 (alur inti kasir), dan Milestone 2 (keuangan + versi web HP & desktop). Terakhir diperbarui: 2026-11-22.

## Per layar

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S01 | Login kasir | done | lupa password (owner reset dari web, menyusul) | — |
| S03 | Beranda kasir | done | banner offline otomatis (sekarang: pesan error per aksi) | — |
| S04 | Pilih / tambah pelanggan | partial | isian tanggal lahir | — |
| S05 | Layanan & berat | done | rincian jenis barang (should, M3) | input berat melebar di versi web; diperbaiki dengan lebar tetap |
| S06 | Pembayaran | done | deposit (M3), gambar QRIS outlet | — |
| S07 | Nota | partial | cetak di printer fisik belum diuji (lihat M0) | — |
| S08 | Daftar cucian | done | — | — |
| S09 | Detail order | done | batalkan nota (endpoint & UI, M2) | — |
| S10 | Ambil & pelunasan | done | ambil tanpa pelunasan + persetujuan owner (M3) | — |
| S11/S12 | Kas & statistik | stub | seluruhnya (M2) | — |
| S16 | Halaman lacak publik | done | rate limit | — |
| S17 | Daftar & setup owner | done | — | — |
| S18 | Layanan & harga | partial | ubah / nonaktifkan layanan | — |
| S19 | Karyawan & akun | partial | ubah peran, reset password, nonaktifkan | — |
| S20/S21 | Dashboard & laporan owner | no | seluruhnya (M2) | — |
| M0 | Uji printer | partial | **belum diuji di printer fisik**: butuh development build Android dan printer outlet | ekosistem library printer React Native terpecah; dipilih react-native-thermal-printer-driver (Bluetooth Classic + BLE, kirim byte mentah) |

## Pengujian yang sudah jalan (semua lulus)

- `packages/shared`: 20 tes unit (uang, berat, pembulatan, zona waktu, nomor nota, status, nota 32/48 kolom, ESC/POS, pesan WA).
- `apps/web`: 18 tes integrasi API terhadap Postgres sungguhan: hak akses, idempotency (kirim ulang dan 5 permintaan paralel dengan id sama = 1 order), 10 order paralel = nomor nota unik tanpa lompatan, alur bayar/status/ambil, isolasi antar usaha, halaman lacak tanpa data pribadi.
- `apps/kasir/e2e/kasir_flow.py`: 19 pemeriksaan alur lengkap di Chrome (versi web aplikasi kasir + web owner), 0 console error. Termasuk tekan simpan dua kali = tetap 1 order.

## Bug yang tertangkap tes dan sudah diperbaiki

1. Nama pelanggan sangat panjang melebihi lebar kertas nota.
2. Drizzle mengubah parser tanggal pada koneksi bersama: Drizzle (Better Auth) kini memakai koneksi sendiri.
3. Urutan layanan di nota bisa tertukar (semua baris dibuat di transaksi yang sama): kolom `order_lines.position`, migrasi `0001`.
4. Validasi isian jalan sebelum cek hak akses: sekarang hak akses dicek dulu.
5. Menutup nota membuka beranda baru di atas tumpukan: sekarang kembali ke beranda yang ada (`dismissTo`).
6. Nomor WA outlet di nota belum diformat.

## Keputusan yang berbeda dari architecture.md

- **Styling aplikasi kasir**: StyleSheet + `theme.gen.ts` (dibuat dari tokens.json), bukan NativeWind. Lebih sedikit konfigurasi build; token tetap satu sumber.
- **Login aplikasi kasir**: plugin `bearer` Better Auth (token disimpan di SecureStore), bukan plugin Expo berbasis cookie. Sama untuk Android dan web, tanpa masalah cookie lintas origin.
- **Query data**: SQL langsung lewat postgres.js untuk data usaha (terlihat jelas, mudah diaudit); Drizzle hanya untuk Better Auth.
- **Skema**: migrasi di `packages/db/migrations` sekarang sumber kebenaran (`replica/schema.sql` = rancangan awal).

## Catatan lingkungan

- `npx expo install` butuh akses ke server Expo yang tidak tersedia di lingkungan build ini; dipakai mode offline (`EXPO_OFFLINE=1`) yang memakai daftar versi bawaan SDK 58. Di komputer biasa, perintah normal bisa dipakai.
- Nama aplikasi, ikon, dan `android.package` (`com.example.laundrykasir`) masih sementara sampai replica-brand.

## Berikutnya

1. **Milestone 0 di HP sungguhan**: build APK development, sambungkan printer outlet, uji cetak. Kalau gagal, ganti driver di `apps/kasir/src/printer/driver.native.ts` saja.
2. **Milestone 2**: kas & pengeluaran (S11), statistik harian (S12), dashboard & laporan owner (S20/S21), ubah/nonaktifkan layanan, batalkan nota.

---

# Milestone 2 (2026-11-22): keuangan + versi web HP & desktop

## Per layar

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S11 | Kas: pengeluaran | done | — | — |
| S12 | Kas: statistik harian | done | — | `sum()` bigint di Postgres jadi numeric (terkirim sebagai teks); semua penjumlahan di-cast ke bigint |
| S04 | Pelanggan baru | done | — | — |
| S06/S10 | QRIS | done | QRIS dinamis (M3) | — |
| S09 | Batalkan nota | done | pembatalan nota yang sudah dibayar (butuh pengembalian dana) | — |
| S18 | Layanan & harga | done | urutan tampilan manual | — |
| S19 | Karyawan | partial | ubah peran, reset password, nonaktifkan | — |
| S20 | Dashboard pemilik | done | — | — |
| S21 | Laporan keuangan | done | akuntansi berpasangan (could) | tanggal per zona waktu outlet di SQL (`at time zone`) |
| S22 | Pengaturan outlet | partial | template WA, persetujuan bayar-nanti | — |
| Web | Kasir versi web HP & desktop | done | mode offline | lebar menu samping bawaan React Navigation (360 px) harus dikunci ke token |

## Versi web HP & desktop (permintaan baru)

- Aplikasi kasir yang sama berjalan di browser HP dan komputer. Di layar < 1024 px: bilah menu bawah. Di layar ≥ 1024 px: menu samping, konten terpusat (maks. 760 px; daftar 1040 px), dan grid layanan 4 kolom.
- PWA: manifest, ikon 192/512/maskable, `lang="id"`. Bisa dipasang ke layar utama HP atau sebagai aplikasi di Windows/Mac lewat menu browser. Belum ada service worker (belum bisa offline).
- Cetak di versi web: nota dirender selebar 58/80 mm (font menyesuaikan 32/48 karakter) lalu dibuka di dialog cetak browser, termasuk label produksi di halaman terpisah. Diuji sampai dialog terbuka; hasil di printer fisik belum diuji.
- Web pemilik juga responsif: menu samping di desktop, bilah atas + laci di HP.

## Pengujian (semua lulus)

- `packages/shared`: 20 tes unit.
- `apps/web`: 28 tes API (18 lama + 10 keuangan: pengeluaran idempotent & aturan tanggal/hapus, statistik harian dicocokkan angka per angka, laporan periode, batalkan nota, ubah/nonaktifkan layanan, catatan kaki nota, gambar QRIS dicek isinya & batas 512 KB, isolasi antar usaha).
- `apps/kasir/e2e/kasir_flow.py`: 19/19 (alur inti, diperbarui untuk halaman pemilik baru dan cetak lewat browser).
- `apps/kasir/e2e/m2_flow.py`: 28/28 di HP 390 px dan desktop 1440 px, 0 console error, lulus dua kali berturut-turut.

## Keputusan

- Gambar QRIS disimpan di database (`outlet_files`, maks. 512 KB, migrasi `0002`), bukan Supabase Storage: satu layanan lebih sedikit, cukup untuk satu gambar per outlet.
- "Laba kas" = uang masuk − pengeluaran (basis kas), diberi keterangan di layar. Omzet = nilai nota masuk (nota batal tidak dihitung).
- Warna grafik: dua seri dari palet kategori panduan dataviz, divalidasi `validate_palette.js` (ΔE CVD 24,7) dan masuk tokens.json sebagai `series-1`/`series-2`.
- `scripts/seed-history.ts`: riwayat 14 hari khusus demo pengembangan (menulis langsung ke database, menolak berjalan di production).

## Berikutnya

1. Uji cetak di printer fisik (Android Bluetooth dan/atau komputer lewat browser).
2. Milestone 3: deposit pelanggan, ambil tanpa pelunasan + persetujuan, absensi, rincian jenis barang, promo, tambah outlet lewat UI, QRIS dinamis, WhatsApp otomatis.
