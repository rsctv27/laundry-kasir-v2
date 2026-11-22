import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kebijakan privasi" };

const PROSESOR = [
  ["Vercel Inc.", "Menjalankan aplikasi dan API (server di Singapura)."],
  ["Neon Inc. (atau Supabase Inc., sesuai yang dipakai)", "Menyimpan database: akun, pelanggan, transaksi, pengeluaran, gambar QRIS."],
];

export default function Privasi() {
  return (
    <main className="mx-auto max-w-kasir px-4 py-10 text-base">
      <p className="text-sm text-muted">Versi uji coba. Nama aplikasi dan pengelola masih sementara.</p>
      <h1 className="mt-1 text-xl">Kebijakan privasi</h1>

      <h2 className="mt-8 text-lg">Data yang kami simpan</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Akun pemilik usaha: nama, email, dan kata sandi (disimpan dalam bentuk acak/hash, tidak bisa dibaca).</li>
        <li>Akun karyawan: nama, username, peran, dan outlet.</li>
        <li>Data usaha: nama outlet, alamat, nomor WhatsApp, layanan dan harga, gambar QRIS.</li>
        <li>Pelanggan laundry yang dicatat usaha: nama, nomor WhatsApp, alamat, catatan, tanggal lahir (bila diisi).</li>
        <li>Transaksi: nota, cucian, pembayaran, status, pengeluaran.</li>
      </ul>

      <h2 className="mt-8 text-lg">Untuk apa</h2>
      <p className="mt-2">
        Hanya untuk menjalankan aplikasi: mencatat cucian, membuat nota, menampilkan laporan, dan halaman lacak cucian untuk
        pelanggan. Data tidak dijual dan tidak dipakai untuk iklan.
      </p>

      <h2 className="mt-8 text-lg">Cookie</h2>
      <p className="mt-2">
        Hanya cookie login yang wajib agar Anda tetap masuk. Tidak ada cookie analitik atau iklan.
      </p>

      <h2 className="mt-8 text-lg">Pesan WhatsApp</h2>
      <p className="mt-2">
        Nota dikirim lewat aplikasi WhatsApp di perangkat kasir sendiri. Aplikasi ini tidak mengirim pesan atas nama Anda.
      </p>

      <h2 className="mt-8 text-lg">Pihak yang memproses data</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {PROSESOR.map(([n, d]) => (
          <li key={n}><span className="font-semibold">{n}</span>: {d}</li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg">Hapus data</h2>
      <p className="mt-2">
        Pemilik usaha dapat meminta penghapusan akun dan seluruh data usahanya kepada pengelola aplikasi. Data pelanggan
        dapat dihapus atas permintaan pelanggan melalui usaha laundry yang mencatatnya.
      </p>

      <p className="mt-10 text-sm text-muted">
        <Link href="/ketentuan" className="underline">Ketentuan layanan</Link> · <Link href="/" className="underline">Beranda</Link>
      </p>
    </main>
  );
}
