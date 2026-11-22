"use client";
// S20: dashboard pemilik.
import { formatRupiah, type OutletDto, type ReportDto } from "@lk/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KasChart } from "@/components/kas-chart";
import { PageTitle, presetRange, PresetPicker, StatCard, useMe, type PresetKey } from "@/components/owner";
import { Alert, Card, Select } from "@/components/ui";
import { api } from "@/lib/client";

export default function Dashboard() {
  const me = useMe();
  const tz = me.outlet?.timezone ?? "Asia/Jakarta";
  const [preset, setPreset] = useState<PresetKey>("7-hari");
  const [outlet, setOutlet] = useState("all");
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [r, setR] = useState<ReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ outlets: OutletDto[] }>("outlets").then((x) => setOutlets(x.outlets)).catch(() => {}); }, []);
  useEffect(() => {
    const { from, to } = presetRange(preset, tz);
    setR(null);
    api<ReportDto>(`reports/summary?from=${from}&to=${to}&outlet=${outlet}`).then(setR).catch((e) => setError(e.message));
  }, [preset, outlet, tz]);

  const t = r?.totals;
  return (
    <>
      <PageTitle title="Dashboard">
        {outlets.length > 1 && (
          <div className="w-56">
            <Select label="Outlet" value={outlet} onChange={(e) => setOutlet(e.target.value)}>
              <option value="all">Semua outlet</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
        )}
      </PageTitle>
      <PresetPicker value={preset} onChange={setPreset} />
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-busy={!r}>
        <StatCard label="Uang masuk" value={t ? formatRupiah(t.kasMasuk) : "…"} />
        <StatCard label="Pengeluaran" value={t ? formatRupiah(t.pengeluaran) : "…"} />
        <StatCard label="Laba kas" value={t ? formatRupiah(t.labaKas) : "…"} tone={t && t.labaKas < 0 ? "danger" : undefined} sub="uang masuk − pengeluaran" />
        <StatCard label="Omzet" value={t ? formatRupiah(t.omzet) : "…"} sub="nilai nota masuk" />
        <StatCard label="Nota masuk" value={t ? String(t.nota) : "…"} />
        <StatCard label="Belum lunas" value={r ? formatRupiah(r.piutang.amount) : "…"} sub={r ? `${r.piutang.count} nota` : undefined} />
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg">Uang masuk &amp; pengeluaran per hari</h2>
          <Link href="/laporan" className="text-sm font-semibold underline">Lihat laporan lengkap</Link>
        </div>
        {r ? (
          r.days.length > 1 ? <KasChart days={r.days} /> : <p className="py-6 text-center text-sm text-muted">Pilih periode lebih dari satu hari untuk melihat grafik.</p>
        ) : (
          <div className="h-60 animate-pulse rounded-md bg-surface" />
        )}
      </Card>
      {r && (
        <div className="grid gap-6 md:grid-cols-2">
          <Breakdown title="Uang masuk per cara bayar" data={r.kasPerMetode} labels={{ tunai: "Tunai", qris: "QRIS", debit: "Debit / EDC", ewallet: "E-wallet" }} empty="Belum ada pembayaran di periode ini." />
          <Breakdown title="Pengeluaran per jenis" data={r.pengeluaranPerKategori} labels={{ bahan: "Sabun & bahan", gas: "Gas", listrik_air: "Listrik & air", gaji: "Gaji", sewa: "Sewa", perawatan: "Perawatan mesin", lainnya: "Lainnya" }} empty="Belum ada pengeluaran di periode ini." />
        </div>
      )}
    </>
  );
}

function Breakdown({ title, data, labels, empty }: { title: string; data: Record<string, number>; labels: Record<string, string>; empty: string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(([k, v]) => (
            <li key={k} className="flex items-center justify-between gap-3 text-sm">
              <span>{labels[k] ?? k}</span>
              <span className="tabular-nums"><span className="mr-2 text-muted">{Math.round((v / total) * 100)}%</span>{formatRupiah(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
