// Android/iOS: tidak dipakai (cetak lewat Bluetooth). Versi web ada di browser.web.ts.
import type { NotaData, PaperWidth } from "@lk/shared";
import { PrinterError } from "./types";

export async function printInBrowser(_notas: Array<{ nota: NotaData; kind: "pelanggan" | "produksi" }>, _paper: PaperWidth): Promise<void> {
  throw new PrinterError("unavailable", "Cetak lewat browser hanya ada di versi web.");
}
