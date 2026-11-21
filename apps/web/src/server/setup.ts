// Usaha, layanan, dan akun staf (sisi owner).
import { getSql } from "@lk/db";
import type { CreateBusinessInput, CreateServiceInput, CreateStaffInput, ServiceDto } from "@lk/shared";
import { auth } from "@/lib/auth";
import type { Ctx } from "./context";
import { requireOutlet, requireRole } from "./context";
import { ApiError, badRequest, conflict, isUniqueViolation } from "./http";

export async function createBusiness(userId: string, ownerName: string, input: CreateBusinessInput) {
  const sql = getSql();
  try {
    return await sql.begin(async (tx) => {
      const [existing] = await tx`select 1 from staff where user_id = ${userId}`;
      if (existing) throw conflict("Akun ini sudah punya usaha.");
      const [b] = await tx<{ id: string }[]>`
        insert into businesses (name, code, owner_user_id) values (${input.businessName}, ${input.businessCode}, ${userId}) returning id`;
      const [o] = await tx<{ id: string }[]>`
        insert into outlets (business_id, name, code, address, phone_wa)
        values (${b!.id}, ${input.outletName}, ${input.outletCode}, ${input.outletAddress ?? null}, ${input.outletPhoneWa})
        returning id`;
      await tx`insert into staff (business_id, outlet_id, user_id, name, role) values (${b!.id}, null, ${userId}, ${ownerName}, 'owner')`;
      return { businessId: b!.id, outletId: o!.id };
    });
  } catch (e) {
    if (isUniqueViolation(e, "businesses_code_key")) throw conflict("Kode usaha sudah dipakai. Pilih kode lain.", { businessCode: "Kode usaha sudah dipakai" });
    throw e;
  }
}

export async function listServices(ctx: Ctx, includeInactive = false): Promise<ServiceDto[]> {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const rows = await sql<Array<{ id: string; name: string; pricing_unit: "kg" | "pcs"; price: number; duration_hours: number }>>`
    select id, name, pricing_unit, price, duration_hours from services
    where business_id = ${ctx.business.id} and outlet_id = ${outlet.id} ${includeInactive ? sql`` : sql`and active`}
    order by sort_order, name`;
  return rows.map((r) => ({ id: r.id, name: r.name, pricingUnit: r.pricing_unit, price: r.price, durationHours: r.duration_hours }));
}

export async function createService(ctx: Ctx, input: CreateServiceInput): Promise<ServiceDto> {
  requireRole(ctx, ["owner", "supervisor"]);
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const [r] = await sql<Array<{ id: string }>>`
    insert into services (business_id, outlet_id, name, pricing_unit, price, duration_hours, sort_order)
    values (${ctx.business.id}, ${outlet.id}, ${input.name}, ${input.pricingUnit}, ${input.price}, ${input.durationHours},
            (select coalesce(max(sort_order), 0) + 1 from services where outlet_id = ${outlet.id}))
    returning id`;
  return { id: r!.id, name: input.name, pricingUnit: input.pricingUnit, price: input.price, durationHours: input.durationHours };
}

export async function listStaff(ctx: Ctx) {
  requireRole(ctx, ["owner"]);
  const sql = getSql();
  return sql<Array<{ id: string; name: string; role: string; username: string | null; outletName: string | null; active: boolean }>>`
    select s.id, s.name, s.role, u."displayUsername" as username, o.name as "outletName", s.active
    from staff s join "user" u on u.id = s.user_id left join outlets o on o.id = s.outlet_id
    where s.business_id = ${ctx.business.id}
    order by s.role = 'owner' desc, s.name`;
}

/** Akun staf dibuat langsung lewat adapter Better Auth agar sesi owner yang sedang login tidak tertimpa. */
export async function createStaff(ctx: Ctx, input: CreateStaffInput) {
  requireRole(ctx, ["owner"]);
  const sql = getSql();
  if (input.role === "kasir" || input.role === "produksi" || input.role === "kurir") {
    if (!input.outletId) throw badRequest("Pilih outlet untuk staf ini.", { outletId: "Wajib diisi" });
  }
  if (input.outletId) {
    const [o] = await sql`select 1 from outlets where id = ${input.outletId} and business_id = ${ctx.business.id}`;
    if (!o) throw badRequest("Outlet tidak ditemukan.", { outletId: "Outlet tidak ditemukan" });
  }
  const fullUsername = `${ctx.business.code}_${input.username}`;
  const [taken] = await sql`select 1 from "user" where username = ${fullUsername}`;
  if (taken) throw conflict("Username sudah dipakai di usaha ini.", { username: "Sudah dipakai" });

  const a = await auth.$context;
  const hash = await a.password.hash(input.password);
  const u = await a.internalAdapter.createUser({
    name: input.name,
    email: `${crypto.randomUUID()}@staff.invalid`,
    emailVerified: true,
    username: fullUsername,
    displayUsername: input.username,
  }, { method: "admin" }); // dibuat oleh owner, bukan pendaftaran mandiri
  try {
    await a.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: hash });
    const [s] = await sql<Array<{ id: string }>>`
      insert into staff (business_id, outlet_id, user_id, name, role)
      values (${ctx.business.id}, ${input.outletId}, ${u.id}, ${input.name}, ${input.role}) returning id`;
    return { id: s!.id, name: input.name, role: input.role, username: input.username, loginUsername: fullUsername };
  } catch (e) {
    await sql`delete from "user" where id = ${u.id}`; // jangan tinggalkan akun yatim
    if (e instanceof ApiError) throw e;
    throw e;
  }
}
