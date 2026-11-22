import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Ketentuan layanan" };

export default function Ketentuan() {
  return (
    <main className="mx-auto max-w-kasir px-4 py-10 text-base">
      <p className="text-sm text-muted">Versi uji coba. Nama aplikasi dan pengelola masih sementara.</p>
      <h1 className="mt-1 text-xl">Ketentuan layanan</h1>
      <ol className="mt-6 list-decimal space-y-3 pl-5">
        <li>Aplikasi ini masih tahap uji coba. Fitur, tampilan, dan data dapat berubah atau diatur ulang.</li>
        <li>Pemilik usaha bertanggung jawab atas data pelanggan yang dicatatnya dan atas izin untuk menghubungi pelanggan lewat WhatsApp.</li>
        <li>Jaga kerahasiaan kata sandi pemilik dan karyawan. Setiap tindakan dari akun dianggap dilakukan pemilik akun.</li>
        <li>Selama uji coba, simpan juga catatan penting di tempat lain. Pengelola berusaha menjaga data tetap aman, tetapi belum memberi jaminan ketersediaan.</li>
        <li>Pertanyaan dan permintaan hapus data: hubungi pengelola aplikasi.</li>
      </ol>
      <p className="mt-10 text-sm text-muted">
        <Link href="/privasi" className="underline">Kebijakan privasi</Link> · <Link href="/" className="underline">Beranda</Link>
      </p>
    </main>
  );
}
