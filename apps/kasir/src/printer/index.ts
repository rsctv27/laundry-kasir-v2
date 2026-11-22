import { buildNota, NOTA_COLUMNS, renderEscPos, type NotaData, type PaperWidth } from "@lk/shared";
import { getItem, setItem } from "@/lib/storage";
import { printInBrowser } from "./browser";
import { driver } from "./driver";
import { PrinterError } from "./types";

export { driver } from "./driver";
export * from "./types";

const KEY = "lk.printer";
export interface PrinterSettings { address: string | null; name: string | null; paper: PaperWidth; productionCopy: boolean }
const DEFAULTS: PrinterSettings = { address: null, name: null, paper: "58mm", productionCopy: true };

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  try { return { ...DEFAULTS, ...JSON.parse((await getItem(KEY)) ?? "{}") }; } catch { return DEFAULTS; }
}
export async function savePrinterSettings(s: PrinterSettings) {
  await setItem(KEY, JSON.stringify(s));
}

/** Cara cetak di perangkat ini: Bluetooth (aplikasi Android) atau dialog cetak browser (versi web). */
export const printMode: "bluetooth" | "browser" = driver.available ? "bluetooth" : "browser";

/** Cetak nota pelanggan, lalu label produksi (tanpa harga) kalau diaktifkan. */
export async function printNota(nota: NotaData, s: PrinterSettings) {
  if (printMode === "browser") {
    return printInBrowser([{ nota, kind: "pelanggan" }, ...(s.productionCopy ? [{ nota, kind: "produksi" as const }] : [])], s.paper);
  }
  if (!s.address) throw new PrinterError("connect", "Pilih printer dulu di menu Lainnya > Printer.");
  const cols = NOTA_COLUMNS[s.paper];
  await driver.printRaw(s.address, renderEscPos(buildNota(nota, "pelanggan"), cols));
  if (s.productionCopy) await driver.printRaw(s.address, renderEscPos(buildNota(nota, "produksi"), cols));
}

/** Nota contoh untuk uji printer (Milestone 0). */
export const SAMPLE_NOTA: NotaData = {
  outlet: { name: "Uji Printer", address: "Jika teks ini rapi, printer siap", phoneWa: null },
  notaNumber: "UJI-000000-001",
  receivedAt: new Date().toISOString(),
  dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  tz: "Asia/Jakarta",
  cashierName: "Kasir",
  customerName: "Pelanggan Contoh",
  lines: [
    { serviceName: "Cuci Setrika Reguler", qty: "3.25", unit: "kg", unitPrice: 7500, lineTotal: 24375 },
    { serviceName: "Bedcover", qty: "1", unit: "pcs", unitPrice: 25000, lineTotal: 25000 },
  ],
  subtotal: 49375,
  discount: 0,
  total: 49375,
  paidTotal: 49375,
  paymentMethodLabel: "tunai",
  trackingUrl: "https://contoh.app/t/uji",
};
