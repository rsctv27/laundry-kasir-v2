// Uang dalam rupiah utuh. Berat/jumlah disimpan sebagai numeric(8,2); di sini dihitung dalam perseratus
// supaya tidak ada galat floating point.

/** "24375" -> "24.375" (pemisah ribuan titik, tanpa desimal). */
export function formatAngka(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString();
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + grouped;
}

/** 24375 -> "Rp 24.375" */
export function formatRupiah(n: number): string {
  return (n < 0 ? "-Rp " : "Rp ") + formatAngka(Math.abs(n));
}

/** Terima "3,25", "3.25", 3.25 -> 325 (perseratus). Lempar error kalau tidak valid. */
export function toHundredths(qty: string | number): number {
  const raw = typeof qty === "number" ? qty.toFixed(2) : qty.trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) throw new Error(`Jumlah tidak valid: ${qty}`);
  const [whole, frac = ""] = raw.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

/** 325 -> "3.25" (untuk dikirim ke database numeric). */
export function hundredthsToDecimal(h: number): string {
  return `${Math.floor(h / 100)}.${String(h % 100).padStart(2, "0")}`;
}

/** Total baris: qty × harga, dibulatkan setengah ke atas ke rupiah terdekat. */
export function lineTotal(qty: string | number, unitPrice: number): number {
  if (!Number.isInteger(unitPrice) || unitPrice < 0) throw new Error("Harga harus rupiah utuh");
  const h = toHundredths(qty);
  return Math.floor((h * unitPrice + 50) / 100);
}

/** 3.25 / "3.25" -> "3,25"; 3.5 -> "3,5"; 3 -> "3". */
export function formatQtyNumber(qty: string | number): string {
  const h = toHundredths(qty);
  const whole = Math.floor(h / 100);
  const frac = h % 100;
  if (frac === 0) return String(whole);
  return `${whole},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

export type Unit = "kg" | "pcs";

/** "3,25 kg", "1 pcs" */
export function formatQty(qty: string | number, unit: Unit): string {
  return `${formatQtyNumber(qty)} ${unit}`;
}

export type PaymentStatus = "belum_bayar" | "sebagian" | "lunas";

/** Harus sama persis dengan constraint di tabel orders. */
export function paymentStatus(total: number, paid: number): PaymentStatus {
  if (paid === 0 && total > 0) return "belum_bayar";
  if (paid < total) return "sebagian";
  return "lunas";
}

/** Saran uang tunai cepat: uang pas, lalu pecahan umum di atas total. */
export function cashSuggestions(total: number): number[] {
  const out = new Set<number>([total]);
  for (const step of [10_000, 20_000, 50_000, 100_000]) {
    const up = Math.ceil(total / step) * step;
    if (up > total) out.add(up);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}
