import type { MeDto, ServiceDto } from "@lk/shared";
import { expect } from "vitest";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { dispatch } from "@/server/router";

const BASE = "http://localhost:3000";
const H = { "content-type": "application/json", origin: BASE };

export async function authCall(path: string, body: unknown) {
  const res = await authPost(new Request(`${BASE}/api/auth/${path}`, { method: "POST", headers: H, body: JSON.stringify(body) }));
  return { res, token: res.headers.get("set-auth-token"), data: await res.json().catch(() => null) };
}

export async function call<T = any>(token: string | null, method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const [p, qs] = path.split("?");
  const req = new Request(`${BASE}/api/v1/${path}`, {
    method,
    headers: { ...H, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  void qs;
  const res = await dispatch(req, p!.split("/"));
  return { status: res.status, data: (await res.json()) as T };
}

export async function setupBusiness(tag: string) {
  const owner = await authCall("sign-up/email", { name: `Owner ${tag}`, email: `owner-${tag}@contoh.id`, password: "rahasia123" });
  expect(owner.res.status).toBe(200);
  const b = await call(owner.token, "POST", "businesses", {
    businessName: `Laundry ${tag}`, businessCode: `laundry${tag}`, outletName: "Pusat", outletCode: `OT${tag.toUpperCase()}`,
    outletAddress: "Jl. Contoh 1", outletPhoneWa: "0812-0000-0000",
  });
  expect(b.status).toBe(201);
  const s1 = await call<ServiceDto>(owner.token, "POST", "services", { name: "Cuci Setrika Reguler", pricingUnit: "kg", price: 7500, durationHours: 72 });
  const s2 = await call<ServiceDto>(owner.token, "POST", "services", { name: "Bedcover", pricingUnit: "pcs", price: 25000, durationHours: 72 });
  expect(s1.status).toBe(201);
  const me = await call<MeDto>(owner.token, "GET", "me");
  const k = await call(owner.token, "POST", "staff", { name: "Dewi", username: "dewi", password: "kasir123", role: "kasir", outletId: me.data.outlet!.id });
  expect(k.status).toBe(201);
  const kasir = await authCall("sign-in/username", { username: `laundry${tag}_dewi`, password: "kasir123" });
  expect(kasir.res.status).toBe(200);
  expect(kasir.token).toBeTruthy();
  return { ownerToken: owner.token!, kasirToken: kasir.token!, reguler: s1.data, bedcover: s2.data, outletCode: `OT${tag.toUpperCase()}` };
}

