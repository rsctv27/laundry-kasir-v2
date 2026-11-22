// Usaha, layanan, dan akun staf (sisi owner).
import { getSql } from "@lk/db";
import type { CreateBusinessInput, CreateServiceInput, CreateStaffInput, OutletDto, ServiceDto, UpdateOutletInput, UpdateServiceInput } from "@lk/shared";
import { auth } from "@/lib/auth";
import type { Ctx } from "./context";
import { requireOutlet, requireRole } from "./context";
import { ApiError, badRequest, conflict, isUniqueViolation, notFound } from "./http";

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
  const rows = await sql<Array<{ id: string; name: string; pricing_unit: "kg" | "pcs"; price: number; duration_hours: number; active: boolean }>>`
    select id, name, pricing_unit, price, duration_hours, active from services
    where business_id = ${ctx.business.id} and outlet_id = ${outlet.id} ${includeInactive ? sql`` : sql`and active`}
    order by active desc, sort_order, name`;
  return rows.map((r) => ({ id: r.id, name: r.name, pricingUnit: r.pricing_unit, price: r.price, durationHours: r.duration_hours, active: r.active }));
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

/** Ubah nama/harga/durasi atau nonaktifkan layanan. Nota lama tidak berubah (nama & harga disalin saat transaksi). */
export async function updateService(ctx: Ctx, id: string, input: UpdateServiceInput): Promise<ServiceDto> {
  requireRole(ctx, ["owner", "supervisor"]);
  const sql = getSql();
  const [r] = await sql<Array<{ id: string; name: string; pricing_unit: "kg" | "pcs"; price: number; duration_hours: number; active: boolean }>>`
    update services set
      name = coalesce(${input.name ?? null}, name),
      price = coalesce(${input.price ?? null}::bigint, price),
      duration_hours = coalesce(${input.durationHours ?? null}::int, duration_hours),
      active = coalesce(${input.active ?? null}::boolean, active),
      updated_at = now()
    where id = ${id} and business_id = ${ctx.business.id}
    returning id, name, pricing_unit, price, duration_hours, active`;
  if (!r) throw notFound("Layanan");
  return { id: r.id, name: r.name, pricingUnit: r.pricing_unit, price: r.price, durationHours: r.duration_hours, active: r.active };
}

type OutletRow = { id: string; name: string; code: string; address: string | null; phone_wa: string | null; nota_footer: string | null; timezone: OutletDto["timezone"]; has_qris: boolean };
const toOutlet = (o: OutletRow): OutletDto => ({ id: o.id, name: o.name, code: o.code, address: o.address, phoneWa: o.phone_wa, notaFooter: o.nota_footer, timezone: o.timezone, hasQris: o.has_qris });

export async function listOutlets(ctx: Ctx): Promise<OutletDto[]> {
  const sql = getSql();
  const rows = await sql<OutletRow[]>`
    select o.id, o.name, o.code, o.address, o.phone_wa, o.nota_footer, o.timezone,
           exists (select 1 from outlet_files f where f.outlet_id = o.id and f.kind = 'qris') as has_qris
    from outlets o where o.business_id = ${ctx.business.id} and o.active
      ${ctx.staff.outletId ? sql`and o.id = ${ctx.staff.outletId}` : sql``}
    order by o.created_at`;
  return rows.map(toOutlet);
}

export async function updateOutlet(ctx: Ctx, id: string, input: UpdateOutletInput): Promise<OutletDto> {
  requireRole(ctx, ["owner"]);
  const sql = getSql();
  const set = (k: keyof UpdateOutletInput) => k in input;
  const [o] = await sql<OutletRow[]>`
    update outlets set
      name = ${set("name") ? input.name! : sql`name`},
      address = ${set("address") ? input.address ?? null : sql`address`},
      phone_wa = ${set("phoneWa") ? input.phoneWa ?? null : sql`phone_wa`},
      nota_footer = ${set("notaFooter") ? input.notaFooter ?? null : sql`nota_footer`},
      updated_at = now()
    where id = ${id} and business_id = ${ctx.business.id}
    returning id, name, code, address, phone_wa, nota_footer, timezone,
      exists (select 1 from outlet_files f where f.outlet_id = outlets.id and f.kind = 'qris') as has_qris`;
  if (!o) throw notFound("Outlet");
  return toOutlet(o);
}

async function outletInBusiness(ctx: Ctx, id: string) {
  const sql = getSql();
  const [o] = await sql`select 1 from outlets where id = ${id} and business_id = ${ctx.business.id}
    ${ctx.staff.outletId ? sql`and id = ${ctx.staff.outletId}` : sql``}`;
  if (!o) throw notFound("Outlet");
}

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
};

/** Gambar QRIS statis outlet (dicek isinya benar-benar gambar sesuai tipe, maksimal 512 KB). */
export async function setQris(ctx: Ctx, outletId: string, mime: string, dataBase64: string) {
  requireRole(ctx, ["owner"]);
  await outletInBusiness(ctx, outletId);
  const buf = Buffer.from(dataBase64.replace(/^data:[^,]+,/, ""), "base64");
  if (buf.length === 0 || buf.length > 524_288) throw badRequest("Gambar maksimal 512 KB.", { dataBase64: "Maksimal 512 KB" });
  if (!MAGIC[mime]?.(buf)) throw badRequest("File bukan gambar PNG, JPG, atau WEBP yang valid.", { dataBase64: "Bukan gambar yang valid" });
  const sql = getSql();
  await sql`
    insert into outlet_files (outlet_id, kind, mime, data, updated_by) values (${outletId}, 'qris', ${mime}, ${buf}, ${ctx.staff.id})
    on conflict (outlet_id, kind) do update set mime = excluded.mime, data = excluded.data, updated_by = excluded.updated_by, updated_at = now()`;
  return { ok: true, size: buf.length };
}

export async function getQris(ctx: Ctx, outletId: string) {
  await outletInBusiness(ctx, outletId);
  const sql = getSql();
  const [f] = await sql<Array<{ mime: string; data: Buffer; updated_at: Date }>>`
    select mime, data, updated_at from outlet_files where outlet_id = ${outletId} and kind = 'qris'`;
  if (!f) throw notFound("Gambar QRIS");
  return { mime: f.mime, dataUrl: `data:${f.mime};base64,${Buffer.from(f.data).toString("base64")}`, updatedAt: f.updated_at.toISOString() };
}

export async function deleteQris(ctx: Ctx, outletId: string) {
  requireRole(ctx, ["owner"]);
  await outletInBusiness(ctx, outletId);
  const sql = getSql();
  await sql`delete from outlet_files where outlet_id = ${outletId} and kind = 'qris'`;
  return { ok: true };
}
