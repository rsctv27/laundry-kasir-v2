// Data contoh untuk pengembangan dan situs uji coba, dimasukkan lewat API yang sama dengan aplikasi (bukan SQL langsung).
//   pnpm --filter @lk/web seed
// Di Vercel: jalan saat build bila SEED_DEMO=1 (lihat scripts/vercel-build.mjs). Usaha "contoh" terpisah dari usaha lain.
// Owner: owner@contoh.id / rahasia123 · Kasir: kode usaha "contoh", username "dewi", password "kasir123"
import { getSql } from "@lk/db";
import type { MeDto, OrderDetailDto, ServiceDto } from "@lk/shared";
import { POST as authPost } from "../src/app/api/auth/[...all]/route";
import { siteUrl } from "../src/server/env";
import { dispatch } from "../src/server/router";

const BASE = process.env.BETTER_AUTH_URL || siteUrl();
const H = { "content-type": "application/json", origin: BASE };

async function auth(path: string, body: unknown) {
  const res = await authPost(new Request(`${BASE}/api/auth/${path}`, { method: "POST", headers: H, body: JSON.stringify(body) }));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.headers.get("set-auth-token")!;
}
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await dispatch(
    new Request(`${BASE}/api/v1/${path}`, { method, headers: { ...H, authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined }),
    path.split("?")[0]!.split("/"),
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data as T;
}

async function main() {
  const sql = getSql();
  const [exists] = await sql`select 1 from businesses where code = 'contoh'`;
  if (exists) { console.log("Data contoh sudah ada."); return; }

  const owner = await auth("sign-up/email", { name: "Rina Pemilik", email: "owner@contoh.id", password: "rahasia123" });
  await call(owner, "POST", "businesses", {
    businessName: "Outlet Contoh", businessCode: "contoh", outletName: "Outlet Contoh", outletCode: "MLG1",
    outletAddress: "Jl. Contoh No. 1, Malang", outletPhoneWa: "0812-0000-0000",
  });
  const svc: Record<string, ServiceDto> = {};
  for (const s of [
    { name: "Cuci Setrika Reguler", pricingUnit: "kg", price: 7500, durationHours: 72 },
    { name: "Cuci Kilat", pricingUnit: "kg", price: 19000, durationHours: 3 },
    { name: "Cuci Lipat", pricingUnit: "kg", price: 6000, durationHours: 48 },
    { name: "Bedcover", pricingUnit: "pcs", price: 25000, durationHours: 72 },
    { name: "Sepatu", pricingUnit: "pcs", price: 35000, durationHours: 72 },
  ]) svc[s.name] = await call<ServiceDto>(owner, "POST", "services", s);
  const me = await call<MeDto>(owner, "GET", "me");
  await call(owner, "POST", "staff", { name: "Dewi", username: "dewi", password: "kasir123", role: "kasir", outletId: me.outlet!.id });
  const kasir = await auth("sign-in/username", { username: "contoh_dewi", password: "kasir123" });

  const cust: Record<string, string> = {};
  for (const c of [
    { name: "Bu Sari", phoneWa: "0812-3456-7890" },
    { name: "Pak Hendra", phoneWa: "0813-2222-3333" },
    { name: "Mbak Rina", phoneWa: "0857-1111-2222" },
    { name: "Dimas", phoneWa: "0821-5555-6666" },
    { name: "Sarah Putri", phoneWa: "0857-1111-9999" },
  ]) cust[c.name] = (await call<{ id: string }>(kasir, "POST", "customers", c)).id;

  const order = (customer: string, lines: Array<[string, string]>, pay?: { method: string; amount: number; cash?: number }) =>
    call<OrderDetailDto>(kasir, "POST", "orders", {
      id: crypto.randomUUID(),
      customerId: cust[customer],
      lines: lines.map(([s, q]) => ({ serviceId: svc[s]!.id, qty: q })),
      payment: pay ? { id: crypto.randomUUID(), method: pay.method, amount: pay.amount, cashReceived: pay.cash } : undefined,
    });
  const step = (o: OrderDetailDto, to: string) => call<OrderDetailDto>(kasir, "POST", `orders/${o.id}/status`, { to });

  const a = await order("Mbak Rina", [["Cuci Setrika Reguler", "5,5"]]);
  await step(a, "diproses"); await step(a, "selesai");
  const b = await order("Pak Hendra", [["Cuci Kilat", "2"]], { method: "tunai", amount: 38000, cash: 50000 });
  await step(b, "diproses");
  const c = await order("Dimas", [["Cuci Lipat", "4"]], { method: "qris", amount: 24000 });
  await step(c, "diproses"); await step(c, "selesai");
  await call(kasir, "POST", `orders/${c.id}/pickup`);
  await order("Sarah Putri", [["Sepatu", "2"]]);
  await order("Bu Sari", [["Cuci Setrika Reguler", "3,25"], ["Bedcover", "1"]], { method: "tunai", amount: 49375, cash: 50000 });
  console.log("Data contoh siap. Owner: owner@contoh.id / rahasia123 · Kasir: contoh / dewi / kasir123");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
