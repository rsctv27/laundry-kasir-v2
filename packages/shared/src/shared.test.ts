import { describe, expect, it } from "vitest";
import {
  buildNota, cashSuggestions, checkPickup, checkStatusChange, createOrderInput, formatQty, formatRupiah, formatWa,
  lineTotal, localDate, localDayRange, normalizeWa, notaNumber, paymentStatus, renderEscPos, renderText,
  renderWhatsApp, toHundredths, type NotaData,
} from "./index";

describe("uang dan berat", () => {
  it("format rupiah", () => {
    expect(formatRupiah(24375)).toBe("Rp 24.375");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(1045000)).toBe("Rp 1.045.000");
  });
  it("berat desimal dengan koma atau titik", () => {
    expect(toHundredths("3,25")).toBe(325);
    expect(toHundredths("3.5")).toBe(350);
    expect(toHundredths(2)).toBe(200);
    expect(() => toHundredths("3,255")).toThrow();
    expect(() => toHundredths("-1")).toThrow();
  });
  it("total baris dibulatkan ke rupiah terdekat", () => {
    expect(lineTotal("3,25", 7500)).toBe(24375);
    expect(lineTotal("1,33", 7500)).toBe(9975);
    expect(lineTotal("0,01", 7550)).toBe(76); // 75,5 -> 76
    expect(lineTotal("1", 25000)).toBe(25000);
  });
  it("format jumlah", () => {
    expect(formatQty("3.25", "kg")).toBe("3,25 kg");
    expect(formatQty("3.50", "kg")).toBe("3,5 kg");
    expect(formatQty("1.00", "pcs")).toBe("1 pcs");
  });
  it("status bayar sama dengan constraint database", () => {
    expect(paymentStatus(49375, 0)).toBe("belum_bayar");
    expect(paymentStatus(49375, 10000)).toBe("sebagian");
    expect(paymentStatus(49375, 49375)).toBe("lunas");
    expect(paymentStatus(0, 0)).toBe("lunas");
  });
  it("saran uang tunai", () => {
    expect(cashSuggestions(49375)).toEqual([49375, 50000, 60000, 100000]);
  });
});

describe("waktu outlet", () => {
  it("tanggal lokal WIB berbeda dari UTC setelah jam 17.00 UTC", () => {
    expect(localDate("2026-11-21T17:30:00Z", "Asia/Jakarta")).toBe("2026-11-22");
    expect(localDate("2026-11-21T16:30:00Z", "Asia/Jakarta")).toBe("2026-11-21");
  });
  it("rentang hari lokal", () => {
    const r = localDayRange("2026-11-21", "Asia/Makassar");
    expect(r.start.toISOString()).toBe("2026-11-20T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-21T16:00:00.000Z");
  });
  it("nomor nota", () => {
    expect(notaNumber("MLG1", "2026-11-21T07:05:00Z", 7)).toBe("MLG1-261121-007");
  });
});

describe("status order", () => {
  it("maju satu langkah boleh untuk kasir", () => {
    expect(checkStatusChange("baru", "diproses", "kasir").ok).toBe(true);
    expect(checkStatusChange("diproses", "selesai", "kasir").ok).toBe(true);
  });
  it("lompat atau mundur ditolak untuk kasir", () => {
    expect(checkStatusChange("baru", "selesai", "kasir").ok).toBe(false);
    expect(checkStatusChange("selesai", "diproses", "kasir").ok).toBe(false);
    expect(checkStatusChange("selesai", "diproses", "supervisor").ok).toBe(false); // tanpa alasan
    expect(checkStatusChange("selesai", "diproses", "supervisor", "salah tekan").ok).toBe(true);
  });
  it("pengambilan harus selesai dan lunas", () => {
    expect(checkPickup("diproses", 100, 100).ok).toBe(false);
    expect(checkPickup("selesai", 100, 50).ok).toBe(false);
    expect(checkPickup("selesai", 100, 100).ok).toBe(true);
  });
});

describe("nomor WhatsApp", () => {
  it("normalisasi", () => {
    expect(normalizeWa("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWa("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeWa("812 3456 7890")).toBe("6281234567890");
    expect(normalizeWa("12345")).toBeNull();
    expect(formatWa("6281234567890")).toBe("0812-3456-7890");
  });
});

const sample: NotaData = {
  outlet: { name: "Outlet Contoh", address: "Jl. Contoh No. 1, Malang", phoneWa: "0812-0000-0000" },
  notaNumber: "MLG1-261121-007",
  receivedAt: "2026-11-21T07:05:00Z",
  dueAt: "2026-11-24T07:05:00Z",
  tz: "Asia/Jakarta",
  cashierName: "Dewi",
  customerName: "Bu Sari",
  lines: [
    { serviceName: "Cuci Setrika Reguler", qty: "3.25", unit: "kg", unitPrice: 7500, lineTotal: 24375, items: [{ name: "Kemeja", count: 5 }] },
    { serviceName: "Bedcover", qty: "1", unit: "pcs", unitPrice: 25000, lineTotal: 25000 },
  ],
  subtotal: 49375,
  discount: 0,
  total: 49375,
  paidTotal: 49375,
  paymentMethodLabel: "tunai",
  trackingUrl: "https://contoh.app/t/abc",
};

describe("nota", () => {
  it("teks 58 mm tidak pernah lebih dari 32 karakter", () => {
    const t = renderText(buildNota(sample), 32);
    for (const line of t.split("\n")) expect(line.length).toBeLessThanOrEqual(32);
    expect(t).toContain("3,25 kg x 7.500");
    expect(t).toContain("LUNAS");
  });
  it("teks 80 mm tidak pernah lebih dari 48 karakter, termasuk nama panjang", () => {
    const long = { ...sample, customerName: "Ibu Sari Wulandari Kusumaningrum Hadiningrat Pratiwi" };
    for (const line of renderText(buildNota(long), 48).split("\n")) expect(line.length).toBeLessThanOrEqual(48);
    for (const line of renderText(buildNota(long), 32).split("\n")) expect(line.length).toBeLessThanOrEqual(32);
  });
  it("label produksi tanpa harga", () => {
    const t = renderText(buildNota(sample, "produksi"), 32);
    expect(t).toContain("MLG1-261121-007");
    expect(t).toContain("Kemeja");
    expect(t).not.toContain("24.375");
    expect(t).not.toContain("Rp");
  });
  it("ESC/POS: diawali init, berisi perintah QR, hanya byte 8-bit", () => {
    const b = renderEscPos(buildNota(sample), 32);
    expect([b[0], b[1]]).toEqual([0x1b, 0x40]);
    const hex = Buffer.from(b).toString("hex");
    expect(hex).toContain("1d286b0300315130"); // cetak QR
    expect(b.every((x) => x <= 0xff)).toBe(true);
  });
  it("karakter non-ASCII diganti", () => {
    const t = renderText(buildNota({ ...sample, customerName: "Bu Sárí · “VIP”" }), 32);
    expect(t).toContain('Bu Sari - "VIP"');
  });
  it("pesan WhatsApp", () => {
    const w = renderWhatsApp({ ...sample, paidTotal: 0 });
    expect(w).toContain("Nota: MLG1-261121-007");
    expect(w).toContain("Dibayar saat pengambilan");
    expect(w).toContain("https://contoh.app/t/abc");
  });
});

describe("skema input", () => {
  it("order butuh minimal satu layanan", () => {
    const r = createOrderInput.safeParse({ id: crypto.randomUUID(), customerId: crypto.randomUUID(), lines: [] });
    expect(r.success).toBe(false);
  });
});
