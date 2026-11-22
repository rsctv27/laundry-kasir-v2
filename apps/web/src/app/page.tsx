import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-kasir flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted">Nama aplikasi masih sementara</p>
        <h1 className="text-xl">laundry-kasir</h1>
        <p className="mt-2 text-base text-muted">
          Catat cucian masuk, kirim nota ke WhatsApp pelanggan, dan pantau uang masuk setiap hari.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/daftar" className="inline-flex h-14 items-center justify-center rounded-md bg-accent font-semibold text-on-accent">
          Daftarkan usaha laundry
        </Link>
        <Link href="/masuk" className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface-raised font-semibold">
          Masuk sebagai pemilik
        </Link>
        <a href="/kasir" className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface-raised font-semibold">
          Buka aplikasi kasir
        </a>
      </div>
      <p className="text-sm text-muted">
        <Link href="/privasi" className="underline">Privasi</Link> · <Link href="/ketentuan" className="underline">Ketentuan</Link>
      </p>
    </main>
  );
}
