// Satu sumber isi nota, dirender ke: teks (pratinjau layar), ESC/POS (printer thermal), dan pesan WhatsApp.
import { formatAngka, formatQty, formatRupiah, paymentStatus, type Unit } from "./money";
import { formatDateTime, formatNotaDateTime, type OutletTimezone } from "./time";

export interface NotaData {
  outlet: { name: string; address?: string | null; phoneWa?: string | null; footer?: string | null };
  notaNumber: string;
  receivedAt: string | Date;
  dueAt?: string | Date | null;
  tz: OutletTimezone;
  cashierName: string;
  customerName: string;
  lines: Array<{
    serviceName: string;
    qty: string | number;
    unit: Unit;
    unitPrice: number;
    lineTotal: number;
    items?: Array<{ name: string; count: number }>;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  paidTotal: number;
  paymentMethodLabel?: string | null;
  trackingUrl?: string | null;
  notes?: string | null;
}

export type NotaLine =
  | { type: "text"; text: string; align?: "left" | "center" | "right"; bold?: boolean; double?: boolean }
  | { type: "row"; left: string; right: string; bold?: boolean }
  | { type: "rule" }
  | { type: "qr"; data: string }
  | { type: "feed"; lines: number };

export type NotaKind = "pelanggan" | "produksi";
export const NOTA_COLUMNS = { "58mm": 32, "80mm": 48 } as const;
export type PaperWidth = keyof typeof NOTA_COLUMNS;

const STATUS_BAYAR = { lunas: "LUNAS", sebagian: "BAYAR SEBAGIAN", belum_bayar: "BELUM BAYAR" } as const;

/** Printer murah sering tidak punya karakter khusus: ganti ke ASCII. */
export function toAscii(s: string): string {
  return s
    .replace(/[×✕]/g, "x")
    .replace(/[·•]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

export function buildNota(d: NotaData, kind: NotaKind = "pelanggan"): NotaLine[] {
  const out: NotaLine[] = [];
  if (kind === "produksi") {
    out.push({ type: "text", text: "LABEL PRODUKSI", align: "center" });
    out.push({ type: "text", text: d.notaNumber, align: "center", bold: true, double: true });
    out.push({ type: "text", text: d.customerName, align: "center", bold: true });
    out.push({ type: "rule" });
    for (const l of d.lines) {
      out.push({ type: "row", left: l.serviceName, right: formatQty(l.qty, l.unit), bold: true });
      for (const it of l.items ?? []) if (it.count > 0) out.push({ type: "row", left: `  ${it.name}`, right: `${it.count} pcs` });
    }
    out.push({ type: "rule" });
    out.push({ type: "row", left: "Masuk", right: formatNotaDateTime(d.receivedAt, d.tz) });
    if (d.dueAt) out.push({ type: "row", left: "Selesai", right: formatNotaDateTime(d.dueAt, d.tz), bold: true });
    if (d.notes) out.push({ type: "text", text: `Catatan: ${d.notes}` });
    out.push({ type: "feed", lines: 3 });
    return out;
  }

  out.push({ type: "text", text: d.outlet.name.toUpperCase(), align: "center", bold: true });
  if (d.outlet.address) out.push({ type: "text", text: d.outlet.address, align: "center" });
  if (d.outlet.phoneWa) out.push({ type: "text", text: `WA ${d.outlet.phoneWa}`, align: "center" });
  out.push({ type: "rule" });
  out.push({ type: "row", left: "No. nota", right: d.notaNumber });
  out.push({ type: "row", left: "Masuk", right: formatNotaDateTime(d.receivedAt, d.tz) });
  out.push({ type: "row", left: "Kasir", right: d.cashierName });
  out.push({ type: "row", left: "Pelanggan", right: d.customerName });
  out.push({ type: "rule" });
  for (const l of d.lines) {
    out.push({ type: "text", text: l.serviceName });
    out.push({ type: "row", left: `${formatQty(l.qty, l.unit)} x ${formatAngka(l.unitPrice)}`, right: formatAngka(l.lineTotal) });
  }
  out.push({ type: "rule" });
  out.push({ type: "row", left: "Subtotal", right: formatAngka(d.subtotal) });
  if (d.discount > 0) out.push({ type: "row", left: "Diskon", right: `-${formatAngka(d.discount)}` });
  out.push({ type: "row", left: "TOTAL", right: formatRupiah(d.total), bold: true });
  const paidLabel = d.paymentMethodLabel ? `Dibayar (${d.paymentMethodLabel})` : "Dibayar";
  out.push({ type: "row", left: paidLabel, right: formatAngka(d.paidTotal) });
  out.push({ type: "row", left: "Sisa", right: formatAngka(d.total - d.paidTotal) });
  out.push({ type: "row", left: "Status", right: STATUS_BAYAR[paymentStatus(d.total, d.paidTotal)], bold: true });
  if (d.dueAt) out.push({ type: "row", left: "Estimasi selesai", right: formatNotaDateTime(d.dueAt, d.tz) });
  if (d.trackingUrl) {
    out.push({ type: "qr", data: d.trackingUrl });
    out.push({ type: "text", text: "Scan untuk cek status cucian", align: "center" });
  }
  out.push({ type: "rule" });
  out.push({ type: "text", text: d.outlet.footer || "Terima kasih!", align: "center" });
  out.push({ type: "feed", lines: 3 });
  return out;
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > width) {
      if (cur) { lines.push(cur); cur = ""; }
      for (let i = 0; i < w.length; i += width) lines.push(w.slice(i, i + width));
      continue;
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function align(s: string, width: number, a: "left" | "center" | "right" = "left"): string {
  if (a === "center") return " ".repeat(Math.max(0, Math.floor((width - s.length) / 2))) + s;
  if (a === "right") return " ".repeat(Math.max(0, width - s.length)) + s;
  return s;
}

/** Baris kiri-kanan; kalau tidak muat, kiri di baris sendiri dan kanan rata kanan di bawahnya. */
function rowLines(left: string, right: string, width: number): string[] {
  if (left.length + 1 + right.length <= width) return [left + " ".repeat(width - left.length - right.length) + right];
  return [...wrap(left, width), ...wrap(right, width).map((r) => align(r, width, "right"))];
}

/** Teks polos, persis seperti hasil cetak (untuk pratinjau di layar). */
export function renderText(lines: NotaLine[], width: number): string {
  const out: string[] = [];
  for (const l of lines) {
    if (l.type === "rule") out.push("-".repeat(width));
    else if (l.type === "feed") continue;
    else if (l.type === "qr") out.push(align("[QR]", width, "center"));
    else if (l.type === "row") out.push(...rowLines(toAscii(l.left), toAscii(l.right), width));
    else {
      const w = l.double ? Math.floor(width / 2) : width;
      for (const part of wrap(toAscii(l.text), w)) out.push(align(part, width, l.double ? "center" : l.align));
    }
  }
  return out.join("\n");
}

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

/** Perintah ESC/POS standar (didukung hampir semua printer thermal 58/80 mm). */
export function renderEscPos(lines: NotaLine[], width: number, opts: { qrModule?: number } = {}): Uint8Array {
  const bytes: number[] = [ESC, 0x40]; // init
  const text = (s: string) => { for (const ch of toAscii(s)) bytes.push(ch.charCodeAt(0)); };
  const setAlign = (a: "left" | "center" | "right" = "left") => bytes.push(ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0);
  const setBold = (on: boolean) => bytes.push(ESC, 0x45, on ? 1 : 0);
  const setDouble = (on: boolean) => bytes.push(GS, 0x21, on ? 0x11 : 0x00);

  for (const l of lines) {
    if (l.type === "rule") { setAlign("left"); text("-".repeat(width)); bytes.push(LF); }
    else if (l.type === "feed") bytes.push(ESC, 0x64, l.lines);
    else if (l.type === "row") {
      setAlign("left"); setBold(!!l.bold);
      for (const r of rowLines(toAscii(l.left), toAscii(l.right), width)) { text(r); bytes.push(LF); }
      setBold(false);
    } else if (l.type === "text") {
      setAlign(l.double ? "center" : l.align); setBold(!!l.bold); setDouble(!!l.double);
      for (const part of wrap(toAscii(l.text), l.double ? Math.floor(width / 2) : width)) { text(part); bytes.push(LF); }
      setDouble(false); setBold(false);
    } else if (l.type === "qr") {
      const data = toAscii(l.data);
      const len = data.length + 3;
      setAlign("center");
      bytes.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00); // model 2
      bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, opts.qrModule ?? 6); // ukuran modul
      bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31); // koreksi error M
      bytes.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30); // simpan data
      text(data);
      bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30); // cetak
      bytes.push(LF);
      setAlign("left");
    }
  }
  return Uint8Array.from(bytes);
}

/** Pesan WhatsApp untuk pelanggan (dikirim manual lewat wa.me di Milestone 1). */
export function renderWhatsApp(d: NotaData): string {
  const status = paymentStatus(d.total, d.paidTotal);
  const bayar =
    status === "lunas" ? "Lunas" : status === "sebagian" ? `Sudah dibayar ${formatRupiah(d.paidTotal)}, sisa ${formatRupiah(d.total - d.paidTotal)}` : "Dibayar saat pengambilan";
  const lines = [
    `Halo ${d.customerName}, cucian Anda sudah kami terima di ${d.outlet.name}.`,
    ``,
    `Nota: ${d.notaNumber}`,
    ...d.lines.map((l) => `- ${l.serviceName} ${formatQty(l.qty, l.unit)}: ${formatRupiah(l.lineTotal)}`),
    d.discount > 0 ? `Diskon: -${formatRupiah(d.discount)}` : null,
    `Total: ${formatRupiah(d.total)} (${bayar})`,
    d.dueAt ? `Perkiraan selesai: ${formatDateTime(d.dueAt, d.tz)}` : null,
    d.trackingUrl ? `` : null,
    d.trackingUrl ? `Pantau status cucian di sini: ${d.trackingUrl}` : null,
  ];
  return lines.filter((x): x is string => x !== null).join("\n");
}
