import { getSql } from "@lk/db";
import type { CreateCustomerInput, CustomerDto } from "@lk/shared";
import type { Ctx } from "./context";
import { conflict, isUniqueViolation, notFound } from "./http";

type Row = { id: string; name: string; phone_wa: string | null; address: string | null; order_count: number };
const toDto = (r: Row): CustomerDto => ({ id: r.id, name: r.name, phoneWa: r.phone_wa, address: r.address, orderCount: r.order_count });

/** Cari berdasarkan nama (toleran salah ketik) atau nomor WA. */
export async function searchCustomers(ctx: Ctx, q: string): Promise<CustomerDto[]> {
  const sql = getSql();
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const phoneLike = digits.length >= 4 ? `%${digits.replace(/^0/, "")}%` : null;
  const rows = await sql<Row[]>`
    select c.id, c.name, c.phone_wa, c.address,
           (select count(*) from orders o where o.customer_id = c.id) as order_count
    from customers c
    where c.business_id = ${ctx.business.id}
      and (c.name ilike ${"%" + term + "%"} or c.name % ${term} ${phoneLike ? sql`or c.phone_wa like ${phoneLike}` : sql``})
    order by (c.name ilike ${term + "%"}) desc, similarity(c.name, ${term}) desc, c.name
    limit 10`;
  return rows.map(toDto);
}

export async function createCustomer(ctx: Ctx, input: CreateCustomerInput): Promise<CustomerDto> {
  const sql = getSql();
  try {
    const [r] = await sql<Row[]>`
      insert into customers (business_id, name, phone_wa, address)
      values (${ctx.business.id}, ${input.name}, ${input.phoneWa}, ${input.address ?? null})
      returning id, name, phone_wa, address, 0::int as order_count`;
    return toDto(r!);
  } catch (e) {
    if (isUniqueViolation(e, "customers_phone_per_business")) {
      const [ex] = await sql<Array<{ name: string }>>`select name from customers where business_id = ${ctx.business.id} and phone_wa = ${input.phoneWa}`;
      throw conflict(`Nomor ini sudah terdaftar atas nama ${ex?.name ?? "pelanggan lain"}.`, { phoneWa: "Nomor sudah terdaftar" });
    }
    throw e;
  }
}

export async function getCustomer(ctx: Ctx, id: string): Promise<CustomerDto> {
  const sql = getSql();
  const [r] = await sql<Row[]>`
    select c.id, c.name, c.phone_wa, c.address, (select count(*) from orders o where o.customer_id = c.id) as order_count
    from customers c where c.id = ${id} and c.business_id = ${ctx.business.id}`;
  if (!r) throw notFound("Pelanggan");
  return toDto(r);
}
