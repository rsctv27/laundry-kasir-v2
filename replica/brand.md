# Brand laundry-kasir (sementara)

Status: **palet saja**. Nama, logo resmi, dan suara (voice) belum dikerjakan; "laundry-kasir" dan ikon mesin cuci masih sementara.

## Palet biru-putih (2026-11-22)

Permintaan Rico: warna biru-putih seperti aplikasi asli. Dibuat biru-putih sendiri, sengaja **tidak** menyamai warna merek
aplikasi asli (kobalt #1548aa, latar #eef4ff, dari halaman publiknya) karena warna khas + tampilan yang mirip bisa dianggap
meniru identitas produk (trade dress) dan membingungkan pelanggan. Warna aslinya dicatat di `brand.json` agar tertangkap sweep.

| peran | nilai | catatan |
| --- | --- | --- |
| accent | #0b6fa4 | biru laut, hue ±201° (asli ±219°) |
| accent-pressed | #085a87 | |
| accent-soft | #e1f0f8 | item menu aktif, chip terpilih |
| on-accent / on-accent-muted | #ffffff / #d9ecf7 | teks di header biru |
| surface | #f2f7fa | latar halaman, abu kebiruan |
| bg / surface-raised | #ffffff | kartu dan form |
| text / text-muted | #13212b / #4f5f6b | |

Kontras: `contrast.py` 27 pasangan, 0 gagal AA (terendah: on-accent-muted di accent 4,52:1).

Dipakai: header biru teks putih di aplikasi kasir dan web pemilik versi HP, pita biru di layar masuk/daftar dan beranda situs,
tombol utama biru, menu aktif biru muda, tanda aplikasi (kotak biru + mesin cuci putih), ikon PWA/favicon baru
(`replica/design/make-icons.py`, menggantikan ikon bawaan template Expo).

## Belum

- Nama (20 kandidat, cek merek dan domain), logo resmi dan brief-nya, voice guide.
