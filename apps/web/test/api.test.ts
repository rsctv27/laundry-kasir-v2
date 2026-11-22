import { getSql } from "@lk/db";
import type { MeDto, OrderDetailDto } from "@lk/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { trackingData } from "@/server/orders";
import { authCall, call, setupBusiness } from "./helpers";

let A: Awaited<ReturnType<typeof setupBusiness>>;
let B: Awaited<ReturnType<typeof setupBusiness>>;
let custA: string;

beforeAll(async () => {
  A = await setupBusiness("a");
  B = await setupBusiness("b");
  const c = await call(A.kasirToken, "POST", "customers", { name: "Bu Sari", phoneWa: "0812-3456-7890" });
  expect(c.status).toBe(201);
  custA = c.data.id;
});
afterAll(async () => { await getSql().end(); globalThis.__lkSql = undefined; });

const newOrder = (overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  customerId: custA,
  lines: [{ serviceId: A.reguler.id, qty: "3,25" }, { serviceId: A.bedcover.id, qty: "1" }],
  ...overrides,
});

describe("akses", () => {
  it("tanpa login: 401", async () => {
    expect((await call(null, "GET", "me")).status).toBe(401);
  });
  it("kasir terhubung ke outlet", async () => {
    const me = await call<MeDto>(A.kasirToken, "GET", "me");
    expect(me.data.staff.role).toBe("kasir");
    expect(me.data.outlet?.code).toBe("OTA");
  });
  it("kasir tidak bisa mengatur layanan atau melihat daftar staf", async () => {
    expect((await call(A.kasirToken, "POST", "services", { name: "X", pricingUnit: "kg", price: 1, durationHours: 1 })).status).toBe(403);
    expect((await call(A.kasirToken, "GET", "staff")).status).toBe(403);
  });
  it("username kasir yang sama di usaha yang sama ditolak", async () => {
    const me = await call<MeDto>(A.ownerToken, "GET", "me");
    const r = await call(A.ownerToken, "POST", "staff", { name: "Dewi 2", username: "dewi", password: "kasir123", role: "kasir", outletId: me.data.outlet!.id });
    expect(r.status).toBe(409);
  });
  it("kode usaha yang sudah dipakai ditolak", async () => {
    const o = await authCall("sign-up/email", { name: "C", email: "owner-c@contoh.id", password: "rahasia123" });
    const r = await call(o.token, "POST", "businesses", { businessName: "Lain", businessCode: "laundrya", outletName: "Pusat", outletCode: "XX" });
    expect(r.status).toBe(409);
    expect(r.data.error.fields.businessCode).toBeTruthy();
  });
});

describe("pelanggan", () => {
  it("nomor WA yang sama ditolak dengan pesan yang jelas", async () => {
    const r = await call(A.kasirToken, "POST", "customers", { name: "Orang Lain", phoneWa: "+62 812 3456 7890" });
    expect(r.status).toBe(409);
    expect(r.data.error.message).toContain("Bu Sari");
  });
  it("pencarian nama toleran salah ketik dan nomor", async () => {
    expect((await call(A.kasirToken, "GET", "customers?q=sari")).data.customers[0].name).toBe("Bu Sari");
    expect((await call(A.kasirToken, "GET", "customers?q=bu sri")).data.customers.length).toBeGreaterThan(0);
    expect((await call(A.kasirToken, "GET", "customers?q=3456")).data.customers[0].name).toBe("Bu Sari");
  });
});

describe("order", () => {
  it("total dihitung di server, nomor nota berurutan", async () => {
    const r1 = await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder());
    expect(r1.status).toBe(201);
    expect(r1.data.total).toBe(49375);
    expect(r1.data.lines.map((l) => l.lineTotal)).toEqual([24375, 25000]);
    expect(r1.data.notaNumber).toMatch(/^OTA-\d{6}-001$/);
    expect(r1.data.paymentStatus).toBe("belum_bayar");
    const r2 = await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder());
    expect(r2.data.notaNumber).toMatch(/-002$/);
  });

  it("dikirim ulang dengan id sama: tidak ada order ganda", async () => {
    const body = newOrder();
    const first = await call<OrderDetailDto>(A.kasirToken, "POST", "orders", body);
    const again = await call<OrderDetailDto>(A.kasirToken, "POST", "orders", body);
    expect(again.status).toBe(200);
    expect(again.data.notaNumber).toBe(first.data.notaNumber);
  });

  it("5 permintaan bersamaan dengan id sama: tetap satu order", async () => {
    const body = newOrder();
    const rs = await Promise.all(Array.from({ length: 5 }, () => call<OrderDetailDto>(A.kasirToken, "POST", "orders", body)));
    expect(rs.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(new Set(rs.map((r) => r.data.notaNumber)).size).toBe(1);
    const [{ n }] = await getSql()<{ n: number }[]>`select count(*) as n from orders where id = ${body.id}`;
    expect(n).toBe(1);
  });

  it("10 order berbeda bersamaan: nomor nota unik dan tanpa lompatan", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, () => call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder())));
    expect(rs.every((r) => r.status === 201)).toBe(true);
    const seqs = rs.map((r) => Number(r.data.notaNumber.slice(-3))).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(10);
    expect(seqs[9]! - seqs[0]!).toBe(9);
  });

  it("layanan dari usaha lain atau jumlah tidak valid ditolak", async () => {
    expect((await call(A.kasirToken, "POST", "orders", newOrder({ lines: [{ serviceId: B.reguler.id, qty: "1" }] }))).status).toBe(400);
    expect((await call(A.kasirToken, "POST", "orders", newOrder({ lines: [{ serviceId: A.bedcover.id, qty: "1,5" }] }))).status).toBe(400);
    expect((await call(A.kasirToken, "POST", "orders", newOrder({ lines: [{ serviceId: A.reguler.id, qty: "0" }] }))).status).toBe(400);
  });

  it("bayar tunai saat order: lunas", async () => {
    const r = await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder({ payment: { id: crypto.randomUUID(), method: "tunai", amount: 49375, cashReceived: 50000 } }));
    expect(r.data.paymentStatus).toBe("lunas");
    expect(r.data.paidTotal).toBe(49375);
  });
});

describe("pembayaran, status, pengambilan", () => {
  it("alur lengkap dengan aturan", async () => {
    const o = (await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder())).data;
    // lompat status ditolak
    expect((await call(A.kasirToken, "POST", `orders/${o.id}/status`, { to: "selesai" })).status).toBe(400);
    // bayar lebih dari tagihan ditolak
    expect((await call(A.kasirToken, "POST", `orders/${o.id}/payments`, { id: crypto.randomUUID(), method: "tunai", amount: 60000 })).status).toBe(400);
    // bayar sebagian, dikirim dua kali dengan id sama: tercatat sekali
    const pid = crypto.randomUUID();
    await call(A.kasirToken, "POST", `orders/${o.id}/payments`, { id: pid, method: "qris", amount: 20000 });
    const dup = await call<OrderDetailDto>(A.kasirToken, "POST", `orders/${o.id}/payments`, { id: pid, method: "qris", amount: 20000 });
    expect(dup.data.paidTotal).toBe(20000);
    expect(dup.data.paymentStatus).toBe("sebagian");
    // proses
    expect((await call<OrderDetailDto>(A.kasirToken, "POST", `orders/${o.id}/status`, { to: "diproses" })).data.status).toBe("diproses");
    expect((await call<OrderDetailDto>(A.kasirToken, "POST", `orders/${o.id}/status`, { to: "selesai" })).data.status).toBe("selesai");
    // kasir tidak boleh mundur
    expect((await call(A.kasirToken, "POST", `orders/${o.id}/status`, { to: "diproses", note: "salah" })).status).toBe(400);
    // ambil sebelum lunas ditolak
    const early = await call(A.kasirToken, "POST", `orders/${o.id}/pickup`);
    expect(early.status).toBe(400);
    expect(early.data.error.message).toContain("Lunasi");
    // lunasi lalu ambil
    await call(A.kasirToken, "POST", `orders/${o.id}/payments`, { id: crypto.randomUUID(), method: "tunai", amount: 29375, cashReceived: 30000 });
    const done = await call<OrderDetailDto>(A.kasirToken, "POST", `orders/${o.id}/pickup`);
    expect(done.data.status).toBe("diambil");
    expect(done.data.events.map((e) => e.to)).toEqual(["baru", "diproses", "selesai", "diambil"]);
    // setelah diambil tidak bisa dibayar lagi
    expect((await call(A.kasirToken, "POST", `orders/${o.id}/payments`, { id: crypto.randomUUID(), method: "tunai", amount: 1 })).status).toBe(400);
  });

  it("nota dan pesan WhatsApp", async () => {
    const o = (await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder())).data;
    const n = await call(A.kasirToken, "GET", `orders/${o.id}/nota`);
    expect(n.data.nota.notaNumber).toBe(o.notaNumber);
    expect(n.data.nota.cashierName).toBe("Dewi");
    expect(n.data.whatsappText).toContain(o.notaNumber);
    expect(n.data.whatsappText).toContain("https://contoh.app/t/");
    expect(n.data.customerPhoneWa).toBe("6281234567890");
    expect((await call(A.kasirToken, "POST", `orders/${o.id}/messages`, { template: "nota" })).status).toBe(200);
  });

  it("daftar, filter status, pencarian, dan beranda", async () => {
    const list = await call(A.kasirToken, "GET", "orders?status=diambil");
    expect(list.data.orders.every((o: any) => o.status === "diambil")).toBe(true);
    const search = await call(A.kasirToken, "GET", "orders?q=sari&limit=2");
    expect(search.data.orders.length).toBe(2);
    expect(search.data.nextCursor).toBeTruthy();
    const page2 = await call(A.kasirToken, "GET", `orders?q=sari&limit=2&cursor=${search.data.nextCursor}`);
    expect(page2.data.orders[0].id).not.toBe(search.data.orders[0].id);
    const h = await call(A.kasirToken, "GET", "home");
    expect(h.data.baru).toBeGreaterThan(0);
    expect(h.data.selesaiHariIni).toBeGreaterThanOrEqual(1);
    expect(h.data.recent.length).toBe(5);
  });
});

describe("isolasi antar usaha", () => {
  it("kasir usaha B tidak bisa melihat atau memakai data usaha A", async () => {
    const o = (await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder())).data;
    expect((await call(B.kasirToken, "GET", `orders/${o.id}`)).status).toBe(404);
    expect((await call(B.kasirToken, "GET", `orders/${o.id}/nota`)).status).toBe(404);
    expect((await call(B.kasirToken, "POST", `orders/${o.id}/status`, { to: "diproses" })).status).toBe(404);
    expect((await call(B.kasirToken, "POST", `orders/${o.id}/payments`, { id: crypto.randomUUID(), method: "tunai", amount: 1 })).status).toBe(404);
    expect((await call(B.kasirToken, "GET", `customers/${custA}`)).status).toBe(404);
    expect((await call(B.kasirToken, "GET", "customers?q=sari")).data.customers).toEqual([]);
    expect((await call(B.kasirToken, "GET", "orders")).data.orders).toEqual([]);
    const steal = await call(B.kasirToken, "POST", "orders", { id: crypto.randomUUID(), customerId: custA, lines: [{ serviceId: B.reguler.id, qty: "1" }] });
    expect(steal.status).toBe(404);
    // id order usaha A dipakai ulang oleh usaha B
    const reuse = await call(B.kasirToken, "POST", "orders", { id: o.id, customerId: custA, lines: [{ serviceId: B.reguler.id, qty: "1" }] });
    expect(reuse.status).toBe(409);
  });
});

describe("halaman lacak", () => {
  it("hanya data aman, token salah = null", async () => {
    const o = (await call<OrderDetailDto>(A.kasirToken, "POST", "orders", newOrder())).data;
    const token = o.trackingUrl.split("/t/")[1]!;
    const d = await trackingData(token);
    expect(d?.notaNumber).toBe(o.notaNumber);
    expect(d?.firstName).toBe("Bu Sari");
    expect(JSON.stringify(d)).not.toContain("6281234567890");
    expect(await trackingData("0".repeat(32))).toBeNull();
    expect(await trackingData("../../etc")).toBeNull();
  });
});
