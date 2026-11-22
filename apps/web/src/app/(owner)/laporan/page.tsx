"use client";
// S21: laporan keuangan per periode (tabel harian, rincian, unduh CSV, cetak).
import { EXPENSE_LABEL, formatRupiah, type OutletDto, type ReportDto } from "@lk/shared";
import { Download, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageTitle, presetRange, PresetPicker, useMe, type PresetKey } from "@/components/owner";
import { Alert, Button, Card, Field, Select } from "@/components/ui";
import { api } from "@/lib/client";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const fmtDay = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return `${HARI[dt.getUTCDay()]}, ${dt.getUTCDate()} ${BULAN[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
};
const METHOD: Record<string, string> = { tunai: "Tunai", qris: "QRIS", debit: "Debit / EDC", ewallet: "E-wallet" };

export default function Laporan() {
  const me = useMe();
  const tz = me.outlet?.timezone ?? "Asia/Jakarta";
  const [preset, setPreset] = useState<PresetKey | null>("bulan-ini");
  const [range, setRange] = useState(presetRange("bulan-ini", tz));
  const [outlet, setOutlet] = useState("all");
  const [outlets, setOutlets] = useState<OutletDto[]>([]);
  const [r, setR] = useState<ReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ outlets: OutletDto[] }>("outlets").then((x) => setOutlets(x.outlets)).catch(() => {}); }, []);
  const load = useCallback(() => {
    setError(null);
    api<ReportDto>(`reports/summary?from=${range.from}&to=${range.to}&outlet=${outlet}`).then(setR).catch((e) => { setR(null); setError(e.message); });
  }, [range, outlet]);
  useEffect(load, [load]);

  function downloadCsv() {
    if (!r) return;
    const rows = [["Tanggal", "Nota", "Omzet", "Uang masuk", "Pengeluaran", "Laba kas"], ...r.days.map((d) => [d.date, d.nota, d.omzet, d.kasMasuk, d.pengeluaran, d.labaKas]),
      ["Total", r.totals.nota, r.totals.omzet, r.totals.kasMasuk, r.totals.pengeluaran, r.totals.labaKas]];
    const csv = rows.map((x) => x.join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `laporan-${me.business.code}-${r.from}-sd-${r.to}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageTitle title="Laporan keuangan">
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={!r}><Download aria-hidden className="size-4" /> Unduh CSV</Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={!r}><Printer aria-hidden className="size-4" /> Cetak</Button>
        </div>
      </PageTitle>
      <div className="flex flex-col gap-4 print:hidden">
        <PresetPicker value={preset} onChange={(k) => { setPreset(k); setRange(presetRange(k, tz)); }} />
        <div className="grid grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-3">
          <Field label="Dari" type="date" value={range.from} max={range.to} onChange={(e) => { setPreset(null); setRange((x) => ({ ...x, from: e.target.value })); }} />
          <Field label="Sampai" type="date" value={range.to} min={range.from} onChange={(e) => { setPreset(null); setRange((x) => ({ ...x, to: e.target.value })); }} />
          {outlets.length > 1 && (
            <Select label="Outlet" value={outlet} onChange={(e) => setOutlet(e.target.value)}>
              <option value="all">Semua outlet</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
        </div>
      </div>
      <p className="hidden text-sm print:block">{me.business.name} · {r ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : ""}</p>
      {error && <Alert>{error}</Alert>}
      {r && (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Laporan harian {fmtDay(r.from)} sampai {fmtDay(r.to)}</caption>
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">Tanggal</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Nota</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Omzet</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Uang masuk</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Pengeluaran</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Laba kas</th>
                </tr>
              </thead>
              <tbody>
                {r.days.map((d) => (
                  <tr key={d.date} className={`border-b border-border ${d.nota === 0 && d.kasMasuk === 0 && d.pengeluaran === 0 ? "text-muted" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-2.5">{fmtDay(d.date)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{d.nota}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatRupiah(d.omzet)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatRupiah(d.kasMasuk)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatRupiah(d.pengeluaran)}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${d.labaKas < 0 ? "text-danger" : ""}`}>{formatRupiah(d.labaKas)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.totals.nota}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRupiah(r.totals.omzet)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRupiah(r.totals.kasMasuk)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatRupiah(r.totals.pengeluaran)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${r.totals.labaKas < 0 ? "text-danger" : ""}`}>{formatRupiah(r.totals.labaKas)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
          <p className="text-xs text-muted">
            Omzet = nilai nota yang masuk (nota batal tidak dihitung). Uang masuk = pembayaran yang diterima. Laba kas = uang masuk − pengeluaran.
            Belum lunas saat ini: {r.piutang.count} nota, {formatRupiah(r.piutang.amount)}.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            <Mini title="Per cara bayar" rows={Object.entries(r.kasPerMetode).map(([k, v]) => [METHOD[k] ?? k, v])} />
            <Mini title="Pengeluaran per jenis" rows={Object.entries(r.pengeluaranPerKategori).map(([k, v]) => [EXPENSE_LABEL[k as keyof typeof EXPENSE_LABEL] ?? k, v])} />
            <Mini title="Per outlet (uang masuk)" rows={r.perOutlet.map((o) => [o.name, o.kasMasuk])} />
          </div>
        </>
      )}
    </>
  );
}

function Mini({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Tidak ada data.</p> : rows.sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <p key={k} className="flex justify-between gap-3 text-sm"><span>{k}</span><span className="tabular-nums">{formatRupiah(v)}</span></p>
      ))}
    </Card>
  );
}
