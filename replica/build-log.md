# Build log: laundry-kasir

Milestone 0 (uji printer) dan Milestone 1 (alur inti kasir) dari `architecture.md`. Tanggal: 2026-11-22.

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
