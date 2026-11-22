// Versi web (HP atau komputer): nota dirender selebar kertas thermal lalu dikirim ke dialog cetak browser.
// Pilih printer thermal di dialog itu (di komputer: driver printer; di Android: layanan cetak printer).
import { buildNota, NOTA_COLUMNS, renderText, type NotaData, type PaperWidth } from "@lk/shared";
import QRCode from "qrcode";
import { PrinterError } from "./types";

const PRINTABLE_MM: Record<PaperWidth, number> = { "58mm": 48, "80mm": 72 };
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

async function copyHtml(nota: NotaData, kind: "pelanggan" | "produksi", cols: number) {
  const text = renderText(buildNota(nota, kind), cols);
  const parts = text.split(/\n? *\[QR\] *\n?/);
  let qr = "";
  if (parts.length > 1 && nota.trackingUrl) {
    qr = await QRCode.toString(nota.trackingUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  }
  return `<section class="copy"><pre>${esc(parts[0] ?? "")}</pre>${qr ? `<div class="qr">${qr}</div>` : ""}${parts[1] !== undefined ? `<pre>${esc(parts[1])}</pre>` : ""}</section>`;
}

export async function printInBrowser(notas: Array<{ nota: NotaData; kind: "pelanggan" | "produksi" }>, paper: PaperWidth): Promise<void> {
  if (typeof document === "undefined") throw new PrinterError("unavailable", "Browser tidak mendukung pencetakan.");
  const cols = NOTA_COLUMNS[paper];
  const width = PRINTABLE_MM[paper];
  const fontMm = (width / (cols * 0.6)).toFixed(2); // lebar karakter monospace ~0,6 em
  const copies = await Promise.all(notas.map((n) => copyHtml(n.nota, n.kind, cols)));
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(notas[0]?.nota.notaNumber ?? "Nota")}</title>
<style>
@page { size: ${paper.replace("mm", "")}mm auto; margin: 3mm 5mm; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${width}mm; }
pre { font-family: "Courier New", ui-monospace, monospace; font-size: ${fontMm}mm; line-height: 1.25; margin: 0; white-space: pre; }
.qr { width: 28mm; margin: 2mm auto; } .qr svg { width: 100%; height: auto; display: block; }
.copy + .copy { break-before: page; page-break-before: always; }
</style></head><body>${copies.join("")}</body></html>`;

  document.querySelectorAll("iframe[data-nota-print]").forEach((f) => f.remove());
  const frame = document.createElement("iframe");
  frame.setAttribute("data-nota-print", notas[0]?.nota.notaNumber ?? "");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  await new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}
