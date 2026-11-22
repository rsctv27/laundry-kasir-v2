import { getSql } from "@lk/db";
import { localDate, type DailyStatsDto, type MeDto, type OrderDetailDto, type ReportDto, type ServiceDto } from "@lk/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, setupBusiness } from "./helpers";

const today = localDate(new Date(), "Asia/Jakarta");
const daysAgo = (n: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
// PNG 1x1 piksel yang valid.
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let C: Awaited<ReturnType<typeof setupBusiness>>;
let D: Awaited<ReturnType<typeof setupBusiness>>;
let outletC: string;
let cust: string;
const o: Record<string, OrderDetailDto> = {};

const order = async (lines: Array<[ServiceDto, string]>, payment?: { method: string; amount: number; cashReceived?: number }) =>
  (await call<OrderDetailDto>(C.kasirToken, "POST", "orders", {
    id: crypto.randomUUID(),
    customerId: cust,
    lines: lines.map(([s, q]) => ({ serviceId: s.id, qty: q })),
    payment: payment ? { id: crypto.randomUUID(), ...payment } : undefined,
  })).data;

beforeAll(async () => {
  C = await setupBusiness("fx");
  D = await setupBusiness("fy");
  outletC = (await call<MeDto>(C.ownerToken, "GET", "me")).data.outlet!.id;
  const c = await call(C.kasirToken, "POST", "customers", { name: "Ibu Wati", phoneWa: "0811-1111-2222", birthDate: "1985-04-17" });
  expect(c.status).toBe(201);
  expect(c.data.birthDate).toBe("1985-04-17");
  cust = c.data.id;
  o.lunas = await order([[C.reguler, "3,25"], [C.bedcover, "1"]], { method: "tunai", amount: 49375, cashReceived: 50000 });
  o.sebagian = await order([[C.reguler, "2"]], { method: "qris", amount: 5000 });
  o.nanti = await order([[C.bedcover, "2"]]);
  o.dibayar = await order([[C.reguler, "1"]], { method: "tunai", amount: 7500 });
});
afterAll(async () => { await getSql().end(); globalThis.__lkSql = undefined; });

describe("batalkan nota", () => {
  it("kasir tidak boleh, owner boleh dengan alasan, nota yang sudah dibayar ditolak", async () => {
    expect((await call(C.kasirToken, "POST", `orders/${o.nanti!.id}/cancel`, { reason: "salah input" })).status).toBe(400);
    expect((await call(C.ownerToken, "POST", `orders/${o.nanti!.id}/cancel`, { reason: "" })).status).toBe(400);
    const ok = await call<OrderDetailDto>(C.ownerToken, "POST", `orders/${o.nanti!.id}/cancel`, { reason: "Pelanggan batal mencuci" });
    expect(ok.data.status).toBe("batal");
    expect(ok.data.events.at(-1)?.note).toBe("Pelanggan batal mencuci");
    const paid = await call(C.ownerToken, "POST", `orders/${o.dibayar!.id}/cancel`, { reason: "coba batal" });
    expect(paid.status).toBe(400);
    expect(paid.data.error.message).toContain("pembayaran");
    expect((await call(D.ownerToken, "POST", `orders/${o.sebagian!.id}/cancel`, { reason: "bukan milik saya" })).status).toBe(404);
  });
});

describe("pengeluaran", () => {
  const e1 = crypto.randomUUID();
  let e3 = "";
  it("dicatat sekali walau dikirim ulang, aturan tanggal ditegakkan", async () => {
    const a = await call(C.kasirToken, "POST", "expenses", { id: e1, category: "gas", amount: 25000, note: "Gas 3 kg" });
    expect(a.status).toBe(201);
    await call(C.kasirToken, "POST", "expenses", { id: e1, category: "gas", amount: 25000, note: "Gas 3 kg" });
    const [{ n }] = await getSql()<{ n: number }[]>`select count(*) as n from expenses where id = ${e1}`;
    expect(n).toBe(1);
    expect((await call(C.kasirToken, "POST", "expenses", { id: crypto.randomUUID(), category: "gas", amount: 1, spentOn: daysAgo(3) })).status).toBe(400);
    expect((await call(C.kasirToken, "POST", "expenses", { id: crypto.randomUUID(), category: "gas", amount: 1, spentOn: daysAgo(-1) })).status).toBe(400);
    expect((await call(C.kasirToken, "POST", "expenses", { id: crypto.randomUUID(), category: "gas", amount: 0 })).status).toBe(400);
    const owner = await call(C.ownerToken, "POST", "expenses", { id: crypto.randomUUID(), category: "sewa", amount: 100000, spentOn: daysAgo(5) });
    expect(owner.status).toBe(201);
    e3 = owner.data.id;
  });
  it("hapus: kasir hanya catatan sendiri di hari yang sama", async () => {
    const e2 = (await call(C.kasirToken, "POST", "expenses", { id: crypto.randomUUID(), category: "bahan", amount: 10000 })).data.id;
    expect((await call(C.kasirToken, "DELETE", `expenses/${e2}`)).status).toBe(200);
    expect((await call(C.kasirToken, "DELETE", `expenses/${e3}`)).status).toBe(403);
    expect((await call(D.kasirToken, "DELETE", `expenses/${e1}`)).status).toBe(404);
    const list = await call(C.kasirToken, "GET", "expenses");
    expect(list.data.total).toBe(25000);
    expect(list.data.expenses[0].canDelete).toBe(true);
  });
});

describe("statistik harian", () => {
  it("angka sesuai transaksi hari ini", async () => {
    const s = (await call<DailyStatsDto>(C.kasirToken, "GET", "stats/daily")).data;
    expect(s.date).toBe(today);
    expect(s.notaMasuk).toBe(3); // nota batal tidak dihitung
    expect(s.batal).toBe(1);
    expect(s.omzet).toBe(49375 + 15000 + 7500);
    expect(s.totalKg).toBe("6.25");
    expect(s.totalPcs).toBe(1);
    expect(s.kasMasuk).toBe(49375 + 5000 + 7500);
    expect(s.kasPerMetode.tunai).toBe(56875);
    expect(s.kasPerMetode.qris).toBe(5000);
    expect(s.pengeluaran).toBe(25000);
    expect(s.tunaiDiLaci).toBe(56875 - 25000);
    expect(s.piutang.count).toBe(1);
    expect(s.piutang.amount).toBe(10000);
    expect(s.piutang.orders[0]?.notaNumber).toBe(o.sebagian!.notaNumber);
  });
  it("usaha lain melihat nol", async () => {
    const s = (await call<DailyStatsDto>(D.kasirToken, "GET", "stats/daily")).data;
    expect([s.notaMasuk, s.omzet, s.kasMasuk, s.pengeluaran, s.piutang.count]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("laporan periode", () => {
  it("total, per hari, per metode, per kategori", async () => {
    const r = (await call<ReportDto>(C.ownerToken, "GET", `reports/summary?from=${daysAgo(6)}&to=${today}`)).data;
    expect(r.days).toHaveLength(7);
    expect(r.totals.omzet).toBe(71875);
    expect(r.totals.kasMasuk).toBe(61875);
    expect(r.totals.pengeluaran).toBe(125000);
    expect(r.totals.labaKas).toBe(61875 - 125000);
    expect(r.days.find((d) => d.date === daysAgo(5))?.pengeluaran).toBe(100000);
    expect(r.kasPerMetode).toEqual({ tunai: 56875, qris: 5000 });
    expect(r.pengeluaranPerKategori).toEqual({ gas: 25000, sewa: 100000 });
    expect(r.piutang).toEqual({ count: 1, amount: 10000 });
    expect(r.perOutlet[0]?.omzet).toBe(71875);
    const one = (await call<ReportDto>(C.ownerToken, "GET", `reports/summary?from=${daysAgo(6)}&to=${today}&outlet=${outletC}`)).data;
    expect(one.totals).toEqual(r.totals);
  });
  it("hak akses dan batas periode", async () => {
    expect((await call(C.kasirToken, "GET", `reports/summary?from=${today}&to=${today}`)).status).toBe(403);
    expect((await call(C.ownerToken, "GET", `reports/summary?from=${today}&to=${daysAgo(1)}`)).status).toBe(400);
    expect((await call(C.ownerToken, "GET", `reports/summary?from=${daysAgo(400)}&to=${today}`)).status).toBe(400);
    expect((await call(D.ownerToken, "GET", `reports/summary?from=${today}&to=${today}&outlet=${outletC}`)).status).toBe(404);
    const d = (await call<ReportDto>(D.ownerToken, "GET", `reports/summary?from=${daysAgo(6)}&to=${today}`)).data;
    expect(d.totals.omzet).toBe(0);
  });
});

describe("layanan, outlet, QRIS", () => {
  it("ubah harga & nonaktifkan: kasir tidak melihatnya, nota lama tidak berubah", async () => {
    expect((await call(C.kasirToken, "PATCH", `services/${C.bedcover.id}`, { active: false })).status).toBe(403);
    expect((await call(D.ownerToken, "PATCH", `services/${C.bedcover.id}`, { active: false })).status).toBe(404);
    const r = await call<ServiceDto>(C.ownerToken, "PATCH", `services/${C.bedcover.id}`, { active: false, price: 30000 });
    expect(r.data.active).toBe(false);
    const list = (await call<{ services: ServiceDto[] }>(C.kasirToken, "GET", "services")).data.services;
    expect(list.map((s) => s.id)).not.toContain(C.bedcover.id);
    expect((await call(C.kasirToken, "POST", "orders", { id: crypto.randomUUID(), customerId: cust, lines: [{ serviceId: C.bedcover.id, qty: "1" }] })).status).toBe(400);
    const old = (await call<OrderDetailDto>(C.kasirToken, "GET", `orders/${o.lunas!.id}`)).data;
    expect(old.lines.find((l) => l.serviceName === "Bedcover")?.unitPrice).toBe(25000);
    const all = (await call<{ services: ServiceDto[] }>(C.ownerToken, "GET", "services?all=1")).data.services;
    expect(all.find((s) => s.id === C.bedcover.id)?.active).toBe(false);
  });
  it("catatan kaki nota diatur owner", async () => {
    expect((await call(C.kasirToken, "PATCH", `outlets/${outletC}`, { notaFooter: "x" })).status).toBe(403);
    const r = await call(C.ownerToken, "PATCH", `outlets/${outletC}`, { notaFooter: "Terima kasih, sampai jumpa lagi!" });
    expect(r.data.notaFooter).toBe("Terima kasih, sampai jumpa lagi!");
    const n = await call(C.kasirToken, "GET", `orders/${o.lunas!.id}/nota`);
    expect(n.data.nota.outlet.footer).toBe("Terima kasih, sampai jumpa lagi!");
  });
  it("gambar QRIS: hanya gambar asli, maksimal 512 KB, per usaha", async () => {
    expect((await call(C.kasirToken, "PUT", `outlets/${outletC}/qris`, { mime: "image/png", dataBase64: PNG_1PX })).status).toBe(403);
    const fake = Buffer.from("ini bukan gambar sama sekali").toString("base64");
    expect((await call(C.ownerToken, "PUT", `outlets/${outletC}/qris`, { mime: "image/png", dataBase64: fake })).status).toBe(400);
    const big = Buffer.alloc(530_000, 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await call(C.ownerToken, "PUT", `outlets/${outletC}/qris`, { mime: "image/png", dataBase64: big.toString("base64") })).status).toBe(400);
    expect((await call(C.ownerToken, "PUT", `outlets/${outletC}/qris`, { mime: "image/png", dataBase64: PNG_1PX })).status).toBe(200);
    const g = await call(C.kasirToken, "GET", `outlets/${outletC}/qris`);
    expect(g.data.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect((await call(D.kasirToken, "GET", `outlets/${outletC}/qris`)).status).toBe(404);
    const outs = (await call(C.kasirToken, "GET", "outlets")).data.outlets;
    expect(outs[0].hasQris).toBe(true);
  });
});
