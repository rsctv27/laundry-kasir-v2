"use client";
// Grafik kolom berpasangan: uang masuk vs pengeluaran per hari (satu sumbu rupiah).
// Mengikuti panduan dataviz: kolom <= 24px, ujung data membulat 4px, celah 2px antar kolom,
// legenda selalu ada, tooltip saat hover/fokus, tabel tersembunyi untuk pembaca layar.
import { formatRupiah, type ReportDayRow } from "@lk/shared";
import { useEffect, useRef, useState } from "react";
import { rupiahRingkas } from "./owner";

const SERIES = [
  { key: "kasMasuk", label: "Uang masuk", color: "var(--lk-series-1)" },
  { key: "pengeluaran", label: "Pengeluaran", color: "var(--lk-series-2)" },
] as const;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const dayLabel = (d: string) => `${Number(d.slice(8))} ${BULAN[Number(d.slice(5, 7)) - 1]}`;

function niceMax(v: number) {
  if (v <= 0) return 100_000;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Ujung atas membulat 4px, dasar persegi. */
function colPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function KasChart({ days }: { days: ReportDayRow[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const H = 240, padL = 64, padR = 8, padT = 24, padB = 28;
  const plotW = width - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(0, ...days.flatMap((d) => [d.kasMasuk, d.pengeluaran])));
  const band = plotW / Math.max(days.length, 1);
  const bar = Math.max(2, Math.min(24, (band - 2 - 8) / 2));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(days.length / Math.max(1, Math.floor(plotW / 64)));
  const last = days.length - 1;
  const hv = hover !== null ? days[hover] : null;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-4 text-sm text-muted" aria-label="Keterangan grafik">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <svg width="12" height="12" aria-hidden><rect width="12" height="12" rx="2" fill={s.color} /></svg>
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={H} role="img" aria-label={`Grafik uang masuk dan pengeluaran per hari, ${days.length} hari. Rincian ada di tabel.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--lk-border)" strokeWidth={1} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--lk-text-muted)">{rupiahRingkas(t)}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = padL + band * i + band / 2;
            const x1 = cx - bar - 1, x2 = cx + 1; // celah 2px antar kolom
            const showLabel = i % labelEvery === 0 || i === last;
            return (
              <g key={d.date}>
                {hover === i && <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="var(--lk-accent-soft)" />}
                <path d={colPath(x1, y(d.kasMasuk), bar, padT + plotH - y(d.kasMasuk))} fill={SERIES[0].color} />
                <path d={colPath(x2, y(d.pengeluaran), bar, padT + plotH - y(d.pengeluaran))} fill={SERIES[1].color} />
                {i === last && days.length <= 14 && d.kasMasuk > 0 && (
                  <text x={x1 + bar / 2} y={y(d.kasMasuk) - 6} textAnchor="middle" fontSize="11" fill="var(--lk-text)">{rupiahRingkas(d.kasMasuk)}</text>
                )}
                {showLabel && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--lk-text-muted)">{dayLabel(d.date)}</text>
                )}
                {/* area sentuh selebar pita, lebih besar dari kolomnya */}
                <rect
                  x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" tabIndex={0}
                  aria-label={`${dayLabel(d.date)}: uang masuk ${formatRupiah(d.kasMasuk)}, pengeluaran ${formatRupiah(d.pengeluaran)}`}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  style={{ outline: "none" }}
                />
              </g>
            );
          })}
          <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke="var(--lk-border-input)" strokeWidth={1} />
        </svg>
        {hv && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-44 rounded-md border border-border bg-surface-raised p-3 text-sm shadow-pop"
            style={{ left: Math.min(Math.max(padL + band * hover + band / 2 - 88, 0), width - 184) }}
          >
            <p className="mb-1 text-xs text-muted">{dayLabel(hv.date)} · {hv.nota} nota</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted"><svg width="12" height="2" aria-hidden><rect width="12" height="2" fill={s.color} /></svg>{s.label}</span>
                <strong className="tabular-nums text-fg">{formatRupiah(hv[s.key])}</strong>
              </p>
            ))}
            <p className="mt-1 flex justify-between gap-3 border-t border-border pt-1">
              <span className="text-muted">Laba kas</span>
              <strong className={`tabular-nums ${hv.labaKas < 0 ? "text-danger" : "text-fg"}`}>{formatRupiah(hv.labaKas)}</strong>
            </p>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Uang masuk dan pengeluaran per hari</caption>
        <thead><tr><th>Tanggal</th><th>Uang masuk</th><th>Pengeluaran</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.date}><td>{dayLabel(d.date)}</td><td>{formatRupiah(d.kasMasuk)}</td><td>{formatRupiah(d.pengeluaran)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
