// S16: halaman lacak publik. Tanpa login; hanya menampilkan data yang aman untuk pemegang link.
import { formatDateTime, formatRupiah } from "@lk/shared";
import { Check, Clock, MapPin, MessageCircle, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackingData } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status cucian", robots: { index: false, follow: false } };

const STEPS = [
  { key: "baru", label: "Diterima" },
  { key: "diproses", label: "Diproses" },
  { key: "selesai", label: "Siap diambil" },
  { key: "diambil", label: "Sudah diambil" },
] as const;

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await trackingData(token);
  if (!d) notFound();
  const current = STEPS.findIndex((s) => s.key === d.status);
  const headline =
    d.status === "batal" ? "Nota ini dibatalkan" :
    d.status === "selesai" ? "Cucian Anda siap diambil" :
    d.status === "diambil" ? "Cucian sudah diambil" :
    d.status === "diproses" ? "Cucian Anda sedang dikerjakan" : "Cucian Anda sudah kami terima";

  return (
    <main className="mx-auto flex max-w-kasir flex-col gap-4 px-4 py-6">
      <header>
        <p className="text-sm text-muted">{d.outlet.name}</p>
        <h1 className="text-xl text-fg">{headline}</h1>
        <p className="mt-1 text-sm text-muted">
          Halo {d.firstName} · Nota <span className="font-mono tabular-nums">{d.notaNumber}</span>
        </p>
      </header>

      {d.status === "batal" ? (
        <section className="flex items-center gap-3 rounded-lg bg-danger-soft p-4 text-danger">
          <XCircle aria-hidden className="size-5 shrink-0" />
          <p className="text-sm font-medium">Hubungi outlet jika ada pertanyaan tentang nota ini.</p>
        </section>
      ) : (
        <ol className="rounded-lg border border-border bg-surface-raised p-4" aria-label="Tahap cucian">
          {STEPS.map((s, i) => {
            const done = i < current || (i === current && s.key === "diambil");
            const active = i === current && !done;
            return (
              <li key={s.key} className="flex items-center gap-3 py-2" aria-current={active ? "step" : undefined}>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-pill border-2 ${
                    done ? "border-success bg-success text-on-accent" : active ? "border-accent bg-accent text-on-accent" : "border-input text-muted"
                  }`}
                >
                  {done ? <Check aria-hidden className="size-4" /> : <span className="text-xs">{i + 1}</span>}
                </span>
                <span className={`text-base ${active ? "font-semibold text-fg" : done ? "text-fg" : "text-muted"}`}>{s.label}</span>
                {s.key === "baru" && <span className="ml-auto text-sm tabular-nums text-muted">{formatDateTime(d.receivedAt, d.tz)}</span>}
                {s.key === "selesai" && d.finishedAt && <span className="ml-auto text-sm tabular-nums text-muted">{formatDateTime(d.finishedAt, d.tz)}</span>}
                {s.key === "diambil" && d.takenAt && <span className="ml-auto text-sm tabular-nums text-muted">{formatDateTime(d.takenAt, d.tz)}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {d.dueAt && (d.status === "baru" || d.status === "diproses") && (
        <p className="flex items-center gap-2 rounded-md bg-info-soft px-4 py-3 text-sm font-medium text-info">
          <Clock aria-hidden className="size-4" /> Perkiraan selesai {formatDateTime(d.dueAt, d.tz)}
        </p>
      )}

      <section className="rounded-lg border border-border bg-surface-raised p-4" aria-label="Rincian">
        <ul className="flex flex-col gap-2">
          {d.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 text-sm">
              <span>{l.name} <span className="text-muted">· {l.qty}</span></span>
              <span className="tabular-nums">{formatRupiah(l.total)}</span>
            </li>
          ))}
        </ul>
        <div className="my-3 h-px bg-border" />
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg tabular-nums">{formatRupiah(d.total)}</span>
        </div>
        {d.remaining > 0 && d.status !== "batal" ? (
          <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
            Sisa {formatRupiah(d.remaining)} dibayar saat pengambilan.
          </p>
        ) : d.status !== "batal" ? (
          <p className="mt-2 text-sm font-medium text-success">Sudah lunas</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4" aria-label="Outlet">
        <p className="font-semibold">{d.outlet.name}</p>
        {d.outlet.address && (
          <p className="flex items-start gap-2 text-sm text-muted"><MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />{d.outlet.address}</p>
        )}
        {d.outlet.wa && (
          <a
            href={`https://wa.me/${d.outlet.wa}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-4 font-semibold text-fg"
          >
            <MessageCircle aria-hidden className="size-5" /> Chat outlet di WhatsApp
          </a>
        )}
      </section>
    </main>
  );
}
