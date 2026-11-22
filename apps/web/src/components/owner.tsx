"use client";
// Kerangka web pemilik: data akun (me), pemilih periode, kartu angka, format rupiah ringkas.
import { localDate, type MeDto, type OutletTimezone } from "@lk/shared";
import { createContext, useContext } from "react";

export const MeContext = createContext<MeDto | null>(null);
export function useMe(): MeDto {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe di luar OwnerShell");
  return me;
}

/** 1.250.000 -> "Rp 1,25 jt"; 45.000 -> "Rp 45 rb". Untuk sumbu grafik, bukan untuk angka utama. */
export function rupiahRingkas(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1_000_000_000) return `${sign}Rp ${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",")} M`;
  if (a >= 1_000_000) return `${sign}Rp ${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",").replace(",0", "")} jt`;
  if (a >= 1_000) return `${sign}Rp ${Math.round(a / 1e3)} rb`;
  return `${sign}Rp ${a}`;
}

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type PresetKey = "hari-ini" | "7-hari" | "30-hari" | "bulan-ini" | "bulan-lalu";
export const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: "hari-ini", label: "Hari ini" },
  { key: "7-hari", label: "7 hari" },
  { key: "30-hari", label: "30 hari" },
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
];

export function presetRange(key: PresetKey, tz: OutletTimezone = "Asia/Jakarta"): { from: string; to: string } {
  const today = localDate(new Date(), tz);
  const first = `${today.slice(0, 8)}01`;
  switch (key) {
    case "hari-ini": return { from: today, to: today };
    case "7-hari": return { from: shift(today, -6), to: today };
    case "30-hari": return { from: shift(today, -29), to: today };
    case "bulan-ini": return { from: first, to: today };
    case "bulan-lalu": {
      const lastPrev = shift(first, -1);
      return { from: `${lastPrev.slice(0, 8)}01`, to: lastPrev };
    }
  }
}

export function PresetPicker({ value, onChange }: { value: PresetKey | null; onChange: (k: PresetKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Periode" className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={value === p.key}
          onClick={() => onChange(p.key)}
          className={`h-10 rounded-pill border px-4 text-sm font-medium ${value === p.key ? "border-accent bg-accent-soft font-semibold" : "border-border bg-surface-raised"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-lg tabular-nums sm:text-xl ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-fg"}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-xl">{title}</h1>
      {children}
    </div>
  );
}
