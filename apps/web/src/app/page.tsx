import Link from "next/link";
import { APP_NAME, AppMark } from "@/components/brand";

export default function Home() {
  return (
    <main className="min-h-dvh">
      {/* Pita biru: tanda aplikasi dan janji utamanya. */}
      <section className="bg-accent px-4 pb-16 pt-12 text-on-accent">
        <div className="mx-auto flex max-w-kasir flex-col gap-4">
          <AppMark size="lg" inverse />
          <div>
            <p className="text-sm text-on-accent-muted">Nama aplikasi masih sementara</p>
            <h1 className="text-xl">{APP_NAME}</h1>
            <p className="mt-2 text-base text-on-accent-muted">
              Catat cucian masuk, kirim nota ke WhatsApp pelanggan, dan pantau uang masuk setiap hari.
            </p>
          </div>
        </div>
      </section>
      <div className="-mt-10 px-4 pb-10">
        <div className="mx-auto flex max-w-kasir flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5 shadow-card">
          <Link href="/daftar" className="inline-flex h-14 items-center justify-center rounded-md bg-accent font-semibold text-on-accent active:bg-accent-pressed">
            Daftarkan usaha laundry
          </Link>
          <Link href="/masuk" className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface-raised font-semibold text-accent active:bg-accent-soft">
            Masuk sebagai pemilik
          </Link>
          <a href="/kasir" className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface-raised font-semibold text-accent active:bg-accent-soft">
            Buka aplikasi kasir
          </a>
        </div>
        <p className="mx-auto mt-6 max-w-kasir text-sm text-muted">
          <Link href="/privasi" className="underline">Privasi</Link> · <Link href="/ketentuan" className="underline">Ketentuan</Link>
        </p>
      </div>
    </main>
  );
}
