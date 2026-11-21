// Siapa yang memanggil API, usaha mana, outlet mana. Semua query usaha memakai nilai dari sini.
import { getSql } from "@lk/db";
import type { OutletTimezone, StaffRole } from "@lk/shared";
import { auth } from "@/lib/auth";
import { ApiError, forbidden } from "./http";

export interface Ctx {
  userId: string;
  staff: { id: string; name: string; role: StaffRole; outletId: string | null };
  business: { id: string; name: string; code: string };
  outlet: {
    id: string; name: string; code: string; timezone: OutletTimezone;
    address: string | null; phoneWa: string | null; notaFooter: string | null;
  } | null;
}

export async function getUserId(req: Request): Promise<string | null> {
  const s = await auth.api.getSession({ headers: req.headers });
  return s?.user?.id ?? null;
}

export async function requireUser(req: Request): Promise<{ id: string; name: string }> {
  const s = await auth.api.getSession({ headers: req.headers });
  if (!s?.user) throw new ApiError(401, "unauthenticated", "Silakan masuk dulu.");
  return { id: s.user.id, name: s.user.name };
}

export async function requireCtx(req: Request): Promise<Ctx> {
  const u = await requireUser(req);
  const sql = getSql();
  const [row] = await sql<Array<{
    staff_id: string; staff_name: string; role: StaffRole; outlet_id: string | null;
    business_id: string; business_name: string; business_code: string;
  }>>`
    select s.id as staff_id, s.name as staff_name, s.role, s.outlet_id,
           b.id as business_id, b.name as business_name, b.code as business_code
    from staff s join businesses b on b.id = s.business_id
    where s.user_id = ${u.id} and s.active`;
  if (!row) throw new ApiError(403, "no_business", "Akun ini belum terhubung ke usaha mana pun.");

  // Outlet: staf yang ditugaskan memakai outletnya; owner/supervisor boleh memilih lewat header, default outlet pertama.
  const wanted = row.outlet_id ?? req.headers.get("x-outlet-id");
  const outlets = await sql<Array<{
    id: string; name: string; code: string; timezone: OutletTimezone; address: string | null; phone_wa: string | null; nota_footer: string | null;
  }>>`
    select id, name, code, timezone, address, phone_wa, nota_footer from outlets
    where business_id = ${row.business_id} and active
      ${wanted ? sql`and id = ${wanted}` : sql``}
    order by created_at limit 1`;
  const o = outlets[0];
  if (wanted && !o) throw forbidden("Outlet tidak ditemukan di usaha Anda.");

  return {
    userId: u.id,
    staff: { id: row.staff_id, name: row.staff_name, role: row.role, outletId: row.outlet_id },
    business: { id: row.business_id, name: row.business_name, code: row.business_code },
    outlet: o ? { id: o.id, name: o.name, code: o.code, timezone: o.timezone, address: o.address, phoneWa: o.phone_wa, notaFooter: o.nota_footer } : null,
  };
}

export function requireRole(ctx: Ctx, roles: StaffRole[]) {
  if (!roles.includes(ctx.staff.role)) throw forbidden();
}

export function requireOutlet(ctx: Ctx): NonNullable<Ctx["outlet"]> {
  if (!ctx.outlet) throw new ApiError(409, "no_outlet", "Belum ada outlet aktif.");
  return ctx.outlet;
}
