// Zona waktu Indonesia tidak memakai daylight saving, jadi offset tetap. Format dibuat manual agar hasilnya
// sama di Node, browser, dan Hermes (React Native) tanpa bergantung pada data Intl.

export const OUTLET_TIMEZONES = {
  "Asia/Jakarta": { offsetMin: 7 * 60, label: "WIB" },
  "Asia/Makassar": { offsetMin: 8 * 60, label: "WITA" },
  "Asia/Jayapura": { offsetMin: 9 * 60, label: "WIT" },
} as const;
export type OutletTimezone = keyof typeof OUTLET_TIMEZONES;

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const pad = (n: number) => String(n).padStart(2, "0");

export interface LocalParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

export function localParts(date: Date | string, tz: OutletTimezone = "Asia/Jakarta"): LocalParts {
  const d = new Date(typeof date === "string" ? date : date.getTime());
  const shifted = new Date(d.getTime() + OUTLET_TIMEZONES[tz].offsetMin * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** "2026-11-21" menurut zona waktu outlet. */
export function localDate(date: Date | string, tz: OutletTimezone = "Asia/Jakarta"): string {
  const p = localParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Awal dan akhir hari lokal dalam UTC, untuk query "hari ini". */
export function localDayRange(day: string, tz: OutletTimezone = "Asia/Jakarta"): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const startUtc = Date.UTC(y, m - 1, d) - OUTLET_TIMEZONES[tz].offsetMin * 60_000;
  return { start: new Date(startUtc), end: new Date(startUtc + 86_400_000) };
}

/** "Sab, 21 Nov · 14.05" */
export function formatDateTime(date: Date | string, tz: OutletTimezone = "Asia/Jakarta"): string {
  const p = localParts(date, tz);
  return `${HARI[p.weekday]}, ${p.day} ${BULAN[p.month - 1]} · ${pad(p.hour)}.${pad(p.minute)}`;
}

/** "Sab, 21 Nov" */
export function formatDay(date: Date | string, tz: OutletTimezone = "Asia/Jakarta"): string {
  const p = localParts(date, tz);
  return `${HARI[p.weekday]}, ${p.day} ${BULAN[p.month - 1]}`;
}

/** "21/11/26 14.05" (untuk nota cetak, ASCII). */
export function formatNotaDateTime(date: Date | string, tz: OutletTimezone = "Asia/Jakarta"): string {
  const p = localParts(date, tz);
  return `${pad(p.day)}/${pad(p.month)}/${String(p.year).slice(2)} ${pad(p.hour)}.${pad(p.minute)}`;
}

/** Nomor nota: OUTLET-YYMMDD-NNN, mis. MLG1-261121-007. */
export function notaNumber(outletCode: string, date: Date | string, seq: number, tz: OutletTimezone = "Asia/Jakarta"): string {
  const p = localParts(date, tz);
  return `${outletCode}-${String(p.year).slice(2)}${pad(p.month)}${pad(p.day)}-${String(seq).padStart(3, "0")}`;
}
