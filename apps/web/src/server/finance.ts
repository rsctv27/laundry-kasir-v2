// Kas, pengeluaran, statistik harian (kasir) dan laporan periode (pemilik).
import { getSql } from "@lk/db";
import {
  type CreateExpenseInput, type DailyStatsDto, type ExpenseDto, type ReportDto, formatQty,
  localDate, localDayRange, type OrderSummaryDto,
} from "@lk/shared";
import type { Ctx } from "./context";
import { requireOutlet, requireRole } from "./context";
import { badRequest, conflict, forbidden, notFound } from "./http";

const SUPERVISOR_UP = ["owner", "supervisor"] as const;
const isSup = (ctx: Ctx) => (SUPERVISOR_UP as readonly string[]).includes(ctx.staff.role);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------- pengeluaran ----------

type ExpRow = { id: string; category: string; amount: number; note: string | null; spent_on: string; staff_id: string | null; staff_name: string | null; created_at: Date };
function toExpense(ctx: Ctx, r: ExpRow, today: string): ExpenseDto {
  return {
    id: r.id, category: r.category, amount: r.amount, note: r.note, spentOn: r.spent_on, staffName: r.staff_name,
    createdAt: r.created_at.toISOString(),
    canDelete: isSup(ctx) || (r.staff_id === ctx.staff.id && r.spent_on === today),
  };
}

export async function listExpenses(ctx: Ctx, day?: string): Promise<{ date: string; expenses: ExpenseDto[]; total: number }> {
  const outlet = requireOutlet(ctx);
  const today = localDate(new Date(), outlet.timezone);
  const d = day ?? today;
  const sql = getSql();
  const rows = await sql<ExpRow[]>`
    select e.id, e.category, e.amount, e.note, e.spent_on::text, e.staff_id, s.name as staff_name, e.created_at
    from expenses e left join staff s on s.id = e.staff_id
    where e.business_id = ${ctx.business.id} and e.outlet_id = ${outlet.id} and e.spent_on = ${d}
    order by e.created_at desc`;
  return { date: d, expenses: rows.map((r) => toExpense(ctx, r, today)), total: rows.reduce((a, r) => a + r.amount, 0) };
}

export async function createExpense(ctx: Ctx, input: CreateExpenseInput): Promise<ExpenseDto> {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const today = localDate(new Date(), outlet.timezone);
  const day = input.spentOn ?? today;
  if (day > today) throw badRequest("Tanggal pengeluaran tidak boleh di masa depan.", { spentOn: "Tidak boleh di masa depan" });
  if (!isSup(ctx) && day < addDays(today, -1)) throw badRequest("Kasir hanya bisa mencatat pengeluaran hari ini atau kemarin.", { spentOn: "Maksimal kemarin" });

  const [dup] = await sql<Array<{ business_id: string }>>`select business_id from expenses where id = ${input.id}`;
  if (dup && dup.business_id !== ctx.business.id) throw conflict("ID pengeluaran bentrok.");
  if (!dup) {
    await sql`
      insert into expenses (id, business_id, outlet_id, category, amount, note, spent_on, staff_id)
      values (${input.id}, ${ctx.business.id}, ${outlet.id}, ${input.category}, ${input.amount}, ${input.note ?? null}, ${day}, ${ctx.staff.id})
      on conflict (id) do nothing`;
  }
  const [r] = await sql<ExpRow[]>`
    select e.id, e.category, e.amount, e.note, e.spent_on::text, e.staff_id, s.name as staff_name, e.created_at
    from expenses e left join staff s on s.id = e.staff_id where e.id = ${input.id} and e.business_id = ${ctx.business.id}`;
  return toExpense(ctx, r!, today);
}

export async function deleteExpense(ctx: Ctx, id: string) {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const [r] = await sql<Array<{ staff_id: string | null; spent_on: string }>>`
    select staff_id, spent_on::text from expenses where id = ${id} and business_id = ${ctx.business.id}`;
  if (!r) throw notFound("Pengeluaran");
  const today = localDate(new Date(), outlet.timezone);
  if (!isSup(ctx) && !(r.staff_id === ctx.staff.id && r.spent_on === today)) {
    throw forbidden("Kasir hanya bisa menghapus catatan sendiri di hari yang sama.");
  }
  await sql`delete from expenses where id = ${id} and business_id = ${ctx.business.id}`;
  return { ok: true };
}

// ---------- statistik harian (outlet aktif) ----------

export async function dailyStats(ctx: Ctx, day?: string): Promise<DailyStatsDto> {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const d = day ?? localDate(new Date(), outlet.timezone);
  const { start, end } = localDayRange(d, outlet.timezone);
  const s = start.toISOString(), e = end.toISOString();
  const B = ctx.business.id, O = outlet.id;

  const [o] = await sql<Array<{ nota_masuk: number; omzet: number; batal: number }>>`
    select count(*) filter (where status <> 'batal') as nota_masuk,
           coalesce(sum(total) filter (where status <> 'batal'), 0)::bigint as omzet,
           count(*) filter (where status = 'batal') as batal
    from orders where business_id = ${B} and outlet_id = ${O} and received_at >= ${s} and received_at < ${e}`;
  const [q] = await sql<Array<{ kg: string; pcs: string }>>`
    select coalesce(sum(l.qty) filter (where l.unit = 'kg'), 0)::text as kg, coalesce(sum(l.qty) filter (where l.unit = 'pcs'), 0)::text as pcs
    from order_lines l join orders o on o.id = l.order_id
    where o.business_id = ${B} and o.outlet_id = ${O} and o.received_at >= ${s} and o.received_at < ${e} and o.status <> 'batal'`;
  const [t] = await sql<Array<{ n: number }>>`
    select count(*) as n from orders where business_id = ${B} and outlet_id = ${O} and taken_at >= ${s} and taken_at < ${e}`;
  const pays = await sql<Array<{ method: string; amount: number }>>`
    select method, coalesce(sum(amount), 0)::bigint as amount from payments
    where business_id = ${B} and outlet_id = ${O} and paid_at >= ${s} and paid_at < ${e} and kind in ('order', 'pelunasan')
    group by method`;
  const [x] = await sql<Array<{ amount: number }>>`
    select coalesce(sum(amount), 0)::bigint as amount from expenses where business_id = ${B} and outlet_id = ${O} and spent_on = ${d}`;
  const [p] = await sql<Array<{ count: number; amount: number }>>`
    select count(*) as count, coalesce(sum(total - paid_total), 0)::bigint as amount
    from orders where business_id = ${B} and outlet_id = ${O} and payment_status <> 'lunas' and status <> 'batal'`;
  const unpaid = await sql<Array<OrderSummaryRow>>`
    select o.id, o.nota_number, c.name as customer_name, o.status, o.payment_status, o.total, o.paid_total, o.received_at, o.due_at,
      coalesce((select json_agg(json_build_object('n', l.service_name, 'q', l.qty, 'u', l.unit) order by l.position, l.id)
                from order_lines l where l.order_id = o.id), '[]'::json) as lines
    from orders o join customers c on c.id = o.customer_id
    where o.business_id = ${B} and o.outlet_id = ${O} and o.payment_status <> 'lunas' and o.status <> 'batal'
    order by o.received_at asc limit 20`;

  const perMetode = { tunai: 0, qris: 0, debit: 0, ewallet: 0, deposit: 0 } as DailyStatsDto["kasPerMetode"];
  for (const r of pays) perMetode[r.method as keyof typeof perMetode] = r.amount;
  const kasMasuk = pays.reduce((a, r) => a + r.amount, 0);
  return {
    date: d,
    notaMasuk: o!.nota_masuk,
    omzet: o!.omzet,
    batal: o!.batal,
    totalKg: q!.kg,
    totalPcs: Math.round(Number(q!.pcs)),
    notaDiambil: t!.n,
    kasMasuk,
    kasPerMetode: perMetode,
    pengeluaran: x!.amount,
    tunaiDiLaci: perMetode.tunai - x!.amount,
    piutang: { count: p!.count, amount: p!.amount, orders: unpaid.map(toSummary) },
  };
}

type OrderSummaryRow = {
  id: string; nota_number: string; customer_name: string; status: OrderSummaryDto["status"]; payment_status: OrderSummaryDto["paymentStatus"];
  total: number; paid_total: number; received_at: Date; due_at: Date | null; lines: Array<{ n: string; q: number; u: "kg" | "pcs" }>;
};
const toSummary = (r: OrderSummaryRow): OrderSummaryDto => ({
  id: r.id, notaNumber: r.nota_number, customerName: r.customer_name, status: r.status, paymentStatus: r.payment_status,
  total: r.total, paidTotal: r.paid_total, receivedAt: r.received_at.toISOString(), dueAt: r.due_at ? r.due_at.toISOString() : null,
  linesSummary: r.lines.map((l) => `${l.n} ${formatQty(l.q, l.u)}`).join(" · "),
});

// ---------- laporan periode (pemilik / supervisor) ----------

export async function reportSummary(ctx: Ctx, from: string, to: string, outletParam: string): Promise<ReportDto> {
  requireRole(ctx, ["owner", "supervisor"]);
  if (from > to) throw badRequest("Tanggal awal harus sebelum tanggal akhir.");
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (span > 366) throw badRequest("Periode laporan maksimal satu tahun.");
  const sql = getSql();
  const B = ctx.business.id;

  let outlet: { id: string; name: string } | null = null;
  if (outletParam !== "all") {
    const [o] = await sql<Array<{ id: string; name: string }>>`select id, name from outlets where id = ${outletParam} and business_id = ${B}`;
    if (!o) throw notFound("Outlet");
    outlet = o;
  }
  const O = outlet?.id ?? null;
  const outletFilter = (alias: string) => (O ? sql`and ${sql(alias)}.outlet_id = ${O}` : sql``);

  // Tanggal dihitung menurut zona waktu masing-masing outlet.
  const days = await sql<Array<{ day: string; nota: number; omzet: number; kas: number; keluar: number }>>`
    with d as (select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day),
    o as (
      select (x.received_at at time zone ou.timezone)::date as day, count(*) as nota, sum(x.total) as omzet
      from orders x join outlets ou on ou.id = x.outlet_id
      where x.business_id = ${B} ${outletFilter("x")} and x.status <> 'batal'
        and (x.received_at at time zone ou.timezone)::date between ${from}::date and ${to}::date
      group by 1),
    p as (
      select (y.paid_at at time zone ou.timezone)::date as day, sum(y.amount) as kas
      from payments y join outlets ou on ou.id = y.outlet_id
      where y.business_id = ${B} ${outletFilter("y")} and y.kind in ('order', 'pelunasan')
        and (y.paid_at at time zone ou.timezone)::date between ${from}::date and ${to}::date
      group by 1),
    e as (
      select z.spent_on as day, sum(z.amount) as keluar from expenses z
      where z.business_id = ${B} ${outletFilter("z")} and z.spent_on between ${from}::date and ${to}::date
      group by 1)
    select d.day::text as day, coalesce(o.nota, 0)::int as nota, coalesce(o.omzet, 0)::bigint as omzet,
           coalesce(p.kas, 0)::bigint as kas, coalesce(e.keluar, 0)::bigint as keluar
    from d left join o using (day) left join p using (day) left join e using (day)
    order by d.day`;

  const methods = await sql<Array<{ method: string; amount: number }>>`
    select y.method, sum(y.amount)::bigint as amount from payments y join outlets ou on ou.id = y.outlet_id
    where y.business_id = ${B} ${outletFilter("y")} and y.kind in ('order', 'pelunasan')
      and (y.paid_at at time zone ou.timezone)::date between ${from}::date and ${to}::date
    group by 1`;
  const cats = await sql<Array<{ category: string; amount: number }>>`
    select z.category, sum(z.amount)::bigint as amount from expenses z
    where z.business_id = ${B} ${outletFilter("z")} and z.spent_on between ${from}::date and ${to}::date group by 1`;
  const perOutlet = await sql<Array<{ id: string; name: string; omzet: number; kas: number; keluar: number }>>`
    select ou.id, ou.name,
      coalesce((select sum(x.total) from orders x where x.outlet_id = ou.id and x.status <> 'batal'
                and (x.received_at at time zone ou.timezone)::date between ${from}::date and ${to}::date), 0)::bigint as omzet,
      coalesce((select sum(y.amount) from payments y where y.outlet_id = ou.id and y.kind in ('order', 'pelunasan')
                and (y.paid_at at time zone ou.timezone)::date between ${from}::date and ${to}::date), 0)::bigint as kas,
      coalesce((select sum(z.amount) from expenses z where z.outlet_id = ou.id and z.spent_on between ${from}::date and ${to}::date), 0)::bigint as keluar
    from outlets ou where ou.business_id = ${B} ${O ? sql`and ou.id = ${O}` : sql``} order by ou.created_at`;
  const [piutang] = await sql<Array<{ count: number; amount: number }>>`
    select count(*) as count, coalesce(sum(x.total - x.paid_total), 0)::bigint as amount from orders x
    where x.business_id = ${B} ${outletFilter("x")} and x.payment_status <> 'lunas' and x.status <> 'batal'`;

  const rows = days.map((r) => ({ date: r.day, nota: r.nota, omzet: r.omzet, kasMasuk: r.kas, pengeluaran: r.keluar, labaKas: r.kas - r.keluar }));
  const sum = (k: "nota" | "omzet" | "kasMasuk" | "pengeluaran" | "labaKas") => rows.reduce((a, r) => a + r[k], 0);
  return {
    from, to, outlet,
    days: rows,
    totals: { nota: sum("nota"), omzet: sum("omzet"), kasMasuk: sum("kasMasuk"), pengeluaran: sum("pengeluaran"), labaKas: sum("labaKas") },
    kasPerMetode: Object.fromEntries(methods.map((m) => [m.method, m.amount])),
    pengeluaranPerKategori: Object.fromEntries(cats.map((c) => [c.category, c.amount])),
    perOutlet: perOutlet.map((p) => ({ id: p.id, name: p.name, omzet: p.omzet, kasMasuk: p.kas, pengeluaran: p.keluar })),
    piutang: piutang!,
  };
}
