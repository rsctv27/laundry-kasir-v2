import { getSql } from "@lk/db";
import {
  type AddPaymentInput, type CreateOrderInput, type HomeDto, type NotaDto, type OrderDetailDto, type OrderStatus,
  type OrderSummaryDto, type Unit, checkPickup, checkStatusChange, formatQty, formatWa, hundredthsToDecimal,
  lineTotal, localDate, localDayRange, notaNumber, paymentStatus, renderWhatsApp, toHundredths,
} from "@lk/shared";
import type postgres from "postgres";
import type { Ctx } from "./context";
import { requireOutlet } from "./context";
import { ApiError, badRequest, conflict, isUniqueViolation, notFound } from "./http";

type Tx = postgres.TransactionSql;
const METHOD_LABEL: Record<string, string> = { tunai: "tunai", qris: "QRIS", debit: "debit", ewallet: "e-wallet", deposit: "deposit" };

export function trackingUrl(token: string) {
  return `${(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/t/${token}`;
}

type SummaryRow = {
  id: string; nota_number: string; customer_name: string; status: OrderStatus; payment_status: OrderSummaryDto["paymentStatus"];
  total: number; paid_total: number; received_at: Date; due_at: Date | null; lines: Array<{ n: string; q: number; u: Unit }>;
};
const toSummary = (r: SummaryRow): OrderSummaryDto => ({
  id: r.id,
  notaNumber: r.nota_number,
  customerName: r.customer_name,
  status: r.status,
  paymentStatus: r.payment_status,
  total: r.total,
  paidTotal: r.paid_total,
  receivedAt: r.received_at.toISOString(),
  dueAt: r.due_at ? r.due_at.toISOString() : null,
  linesSummary: r.lines.map((l) => `${l.n} ${formatQty(l.q, l.u)}`).join(" · "),
});

function summarySelect(sql: postgres.Sql) {
  return sql`
    select o.id, o.nota_number, c.name as customer_name, o.status, o.payment_status, o.total, o.paid_total, o.received_at, o.due_at,
      coalesce((select json_agg(json_build_object('n', l.service_name, 'q', l.qty, 'u', l.unit) order by l.position, l.id)
                from order_lines l where l.order_id = o.id), '[]'::json) as lines
    from orders o join customers c on c.id = o.customer_id`;
}

// ---------- buat order ----------

export async function createOrder(ctx: Ctx, input: CreateOrderInput): Promise<{ order: OrderDetailDto; created: boolean }> {
  const outlet = requireOutlet(ctx);
  const sql = getSql();

  const existing = await sql<{ business_id: string }[]>`select business_id from orders where id = ${input.id}`;
  if (existing[0]) {
    if (existing[0].business_id !== ctx.business.id) throw conflict("ID order bentrok.");
    return { order: await getOrder(ctx, input.id), created: false }; // dikirim ulang: kembalikan yang sudah ada
  }

  try {
    await sql.begin(async (tx) => {
      const [cust] = await tx`select 1 from customers where id = ${input.customerId} and business_id = ${ctx.business.id}`;
      if (!cust) throw notFound("Pelanggan");

      const ids = [...new Set(input.lines.map((l) => l.serviceId))];
      const svcRows = await tx<Array<{ id: string; name: string; pricing_unit: Unit; price: number; duration_hours: number }>>`
        select id, name, pricing_unit, price, duration_hours from services
        where id in ${tx(ids)} and outlet_id = ${outlet.id} and business_id = ${ctx.business.id} and active`;
      const svc = new Map(svcRows.map((s) => [s.id, s]));

      const lines = input.lines.map((l, i) => {
        const s = svc.get(l.serviceId);
        if (!s) throw badRequest("Layanan tidak tersedia di outlet ini.", { [`lines.${i}.serviceId`]: "Layanan tidak tersedia" });
        const h = toHundredths(l.qty);
        if (h <= 0) throw badRequest("Jumlah harus lebih dari 0.", { [`lines.${i}.qty`]: "Harus lebih dari 0" });
        if (s.pricing_unit === "pcs" && h % 100 !== 0) throw badRequest("Jumlah pcs harus bilangan bulat.", { [`lines.${i}.qty`]: "Harus bilangan bulat" });
        return { s, qty: hundredthsToDecimal(h), total: lineTotal(l.qty, s.price) };
      });
      const subtotal = lines.reduce((a, l) => a + l.total, 0);
      const total = subtotal; // diskon/promo menyusul (Milestone 3)

      const now = new Date();
      const maxHours = Math.max(...lines.map((l) => l.s.duration_hours));
      const due = new Date(now.getTime() + maxHours * 3_600_000);
      const day = localDate(now, outlet.timezone);
      const [counter] = await tx<{ last_seq: number }[]>`
        insert into nota_counters (outlet_id, day, last_seq) values (${outlet.id}, ${day}, 1)
        on conflict (outlet_id, day) do update set last_seq = nota_counters.last_seq + 1
        returning last_seq`;
      const nota = notaNumber(outlet.code, now, counter!.last_seq, outlet.timezone);

      await tx`
        insert into orders (id, business_id, outlet_id, nota_number, customer_id, cashier_staff_id, received_at, due_at,
                            subtotal, discount, total, notes)
        values (${input.id}, ${ctx.business.id}, ${outlet.id}, ${nota}, ${input.customerId}, ${ctx.staff.id}, ${now.toISOString()}, ${due.toISOString()},
                ${subtotal}, 0, ${total}, ${input.notes ?? null})`;
      for (const [i, l] of lines.entries()) {
        await tx`
          insert into order_lines (order_id, service_id, service_name, unit, unit_price, qty, line_total, position)
          values (${input.id}, ${l.s.id}, ${l.s.name}, ${l.s.pricing_unit}, ${l.s.price}, ${l.qty}, ${l.total}, ${i})`;
      }
      await tx`insert into status_events (order_id, from_status, to_status, staff_id) values (${input.id}, null, 'baru', ${ctx.staff.id})`;

      if (input.payment) await applyPayment(tx, ctx, input.id, { ...input.payment }, "order");
    });
  } catch (e) {
    // Dua permintaan dengan id sama datang bersamaan: yang kalah mengembalikan order milik yang menang.
    if (isUniqueViolation(e, "orders_pkey")) return { order: await getOrder(ctx, input.id), created: false };
    throw e;
  }
  return { order: await getOrder(ctx, input.id), created: true };
}

// ---------- pembayaran ----------

async function applyPayment(tx: Tx, ctx: Ctx, orderId: string, p: AddPaymentInput, kind: "order" | "pelunasan") {
  const [o] = await tx<Array<{ total: number; paid_total: number; status: OrderStatus; outlet_id: string; customer_id: string }>>`
    select total, paid_total, status, outlet_id, customer_id from orders
    where id = ${orderId} and business_id = ${ctx.business.id} for update`;
  if (!o) throw notFound("Nota");

  const [dup] = await tx<Array<{ order_id: string | null }>>`select order_id from payments where id = ${p.id}`;
  if (dup) {
    if (dup.order_id !== orderId) throw conflict("ID pembayaran bentrok.");
    return; // sudah tercatat: jangan dobel
  }
  if (o.status === "batal") throw badRequest("Nota sudah dibatalkan.");
  if (p.method === "deposit") throw badRequest("Pembayaran dengan deposit belum tersedia.");
  const remaining = o.total - o.paid_total;
  if (remaining <= 0) throw badRequest("Nota ini sudah lunas.");
  if (p.amount > remaining) throw badRequest(`Jumlah melebihi sisa tagihan (${remaining}).`, { amount: "Melebihi sisa tagihan" });
  if (p.cashReceived !== undefined && p.cashReceived < p.amount) throw badRequest("Uang diterima kurang dari jumlah bayar.", { cashReceived: "Uang kurang" });

  await tx`
    insert into payments (id, business_id, outlet_id, order_id, customer_id, kind, method, amount, cash_received, staff_id)
    values (${p.id}, ${ctx.business.id}, ${o.outlet_id}, ${orderId}, ${o.customer_id}, ${kind}, ${p.method}, ${p.amount},
            ${p.method === "tunai" ? (p.cashReceived ?? p.amount) : null}, ${ctx.staff.id})`;
  const paid = o.paid_total + p.amount;
  await tx`update orders set paid_total = ${paid}, payment_status = ${paymentStatus(o.total, paid)}, updated_at = now() where id = ${orderId}`;
}

export async function addPayment(ctx: Ctx, orderId: string, p: AddPaymentInput): Promise<OrderDetailDto> {
  const sql = getSql();
  try {
    await sql.begin((tx) => applyPayment(tx, ctx, orderId, p, "pelunasan"));
  } catch (e) {
    if (!isUniqueViolation(e, "payments_pkey")) throw e; // bentrok id bersamaan: yang pertama sudah tercatat
  }
  return getOrder(ctx, orderId);
}

// ---------- status & pengambilan ----------

async function lockOrder(tx: Tx, ctx: Ctx, id: string) {
  const [o] = await tx<Array<{ status: OrderStatus; total: number; paid_total: number }>>`
    select status, total, paid_total from orders where id = ${id} and business_id = ${ctx.business.id} for update`;
  if (!o) throw notFound("Nota");
  return o;
}

export async function changeStatus(ctx: Ctx, id: string, to: OrderStatus, note?: string): Promise<OrderDetailDto> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const o = await lockOrder(tx, ctx, id);
    if (o.status === to) return; // sudah di status itu (tekan ganda)
    const check = checkStatusChange(o.status, to, ctx.staff.role, note);
    if (!check.ok) throw badRequest(check.reason);
    await tx`
      update orders set status = ${to}, updated_at = now(),
        finished_at = ${to === "selesai" ? sql`now()` : o.status === "selesai" ? null : sql`finished_at`}
      where id = ${id}`;
    await tx`insert into status_events (order_id, from_status, to_status, staff_id, note) values (${id}, ${o.status}, ${to}, ${ctx.staff.id}, ${note ?? null})`;
  });
  return getOrder(ctx, id);
}

export async function pickup(ctx: Ctx, id: string): Promise<OrderDetailDto> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const o = await lockOrder(tx, ctx, id);
    if (o.status === "diambil") return;
    const check = checkPickup(o.status, o.total, o.paid_total);
    if (!check.ok) throw badRequest(check.reason);
    await tx`update orders set status = 'diambil', taken_at = now(), updated_at = now() where id = ${id}`;
    await tx`insert into status_events (order_id, from_status, to_status, staff_id) values (${id}, ${o.status}, 'diambil', ${ctx.staff.id})`;
  });
  return getOrder(ctx, id);
}

// ---------- baca ----------

export async function getOrder(ctx: Ctx, id: string): Promise<OrderDetailDto> {
  const sql = getSql();
  const [r] = await sql<Array<SummaryRow & {
    customer_id: string; phone_wa: string | null; subtotal: number; discount: number; notes: string | null; tracking_token: string;
  }>>`
    select x.*, o.customer_id, c.phone_wa, o.subtotal, o.discount, o.notes, o.tracking_token
    from (${summarySelect(sql)} where o.id = ${id} and o.business_id = ${ctx.business.id}) x
    join orders o on o.id = x.id join customers c on c.id = o.customer_id`;
  if (!r) throw notFound("Nota");
  const lines = await sql<Array<{ service_name: string; qty: string; unit: Unit; unit_price: number; line_total: number }>>`
    select service_name, qty, unit, unit_price, line_total from order_lines where order_id = ${id} order by position, id`;
  const payments = await sql<Array<{ id: string; method: string; amount: number; paid_at: Date }>>`
    select id, method, amount, paid_at from payments where order_id = ${id} order by paid_at`;
  const events = await sql<Array<{ from_status: OrderStatus | null; to_status: OrderStatus; at: Date; by: string | null; note: string | null }>>`
    select e.from_status, e.to_status, e.at, s.name as by, e.note
    from status_events e left join staff s on s.id = e.staff_id where e.order_id = ${id} order by e.at, e.id`;
  return {
    ...toSummary(r),
    customerId: r.customer_id,
    customerPhoneWa: r.phone_wa,
    subtotal: r.subtotal,
    discount: r.discount,
    notes: r.notes,
    trackingUrl: trackingUrl(r.tracking_token),
    lines: lines.map((l) => ({ serviceName: l.service_name, qty: l.qty, unit: l.unit, unitPrice: l.unit_price, lineTotal: l.line_total })),
    payments: payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, paidAt: p.paid_at.toISOString() })),
    events: events.map((e) => ({ from: e.from_status, to: e.to_status, at: e.at.toISOString(), by: e.by, note: e.note })),
  };
}

const LIST_FILTERS = ["semua", "baru", "diproses", "selesai", "diambil", "batal"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

export async function listOrders(ctx: Ctx, opts: { status?: string; q?: string; cursor?: string; limit?: number }) {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const status = (LIST_FILTERS as readonly string[]).includes(opts.status ?? "") ? (opts.status as ListFilter) : "semua";
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const q = opts.q?.trim();
  let cur: { at: string; id: string } | null = null;
  if (opts.cursor) {
    const [at, cid] = Buffer.from(opts.cursor, "base64url").toString().split("|");
    if (!at || !cid) throw badRequest("Cursor tidak valid.");
    cur = { at, id: cid };
  }
  const rows = await sql<SummaryRow[]>`
    ${summarySelect(sql)}
    where o.business_id = ${ctx.business.id} and o.outlet_id = ${outlet.id}
      ${status !== "semua" ? sql`and o.status = ${status}` : sql``}
      ${q ? sql`and (o.nota_number ilike ${"%" + q + "%"} or c.name ilike ${"%" + q + "%"})` : sql``}
      ${cur ? sql`and (o.received_at, o.id) < (${cur.at}::timestamptz, ${cur.id}::uuid)` : sql``}
    order by o.received_at desc, o.id desc
    limit ${limit + 1}`;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? Buffer.from(`${last.received_at.toISOString()}|${last.id}`).toString("base64url") : null;
  const counts = await sql<Array<{ status: OrderStatus; n: number }>>`
    select status, count(*) as n from orders where business_id = ${ctx.business.id} and outlet_id = ${outlet.id} group by status`;
  return { orders: page.map(toSummary), nextCursor, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
}

export async function home(ctx: Ctx): Promise<HomeDto> {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const day = localDate(new Date(), outlet.timezone);
  const { start, end } = localDayRange(day, outlet.timezone);
  const [c] = await sql<Array<{ baru: number; diproses: number; selesai_hari_ini: number }>>`
    select count(*) filter (where status = 'baru') as baru,
           count(*) filter (where status = 'diproses') as diproses,
           count(*) filter (where finished_at >= ${start.toISOString()} and finished_at < ${end.toISOString()}) as selesai_hari_ini
    from orders where business_id = ${ctx.business.id} and outlet_id = ${outlet.id}`;
  const recent = await sql<SummaryRow[]>`
    ${summarySelect(sql)} where o.business_id = ${ctx.business.id} and o.outlet_id = ${outlet.id}
    order by o.received_at desc, o.id desc limit 5`;
  return { date: day, baru: c!.baru, diproses: c!.diproses, selesaiHariIni: c!.selesai_hari_ini, recent: recent.map(toSummary) };
}

export async function notaFor(ctx: Ctx, id: string): Promise<NotaDto> {
  const outlet = requireOutlet(ctx);
  const sql = getSql();
  const o = await getOrder(ctx, id);
  const [meta] = await sql<Array<{ cashier: string; o_name: string; o_address: string | null; o_wa: string | null; o_footer: string | null; tz: typeof outlet.timezone }>>`
    select s.name as cashier, ou.name as o_name, ou.address as o_address, ou.phone_wa as o_wa, ou.nota_footer as o_footer, ou.timezone as tz
    from orders x join staff s on s.id = x.cashier_staff_id join outlets ou on ou.id = x.outlet_id where x.id = ${id}`;
  const lastPayment = o.payments[o.payments.length - 1];
  const nota = {
    outlet: { name: meta!.o_name, address: meta!.o_address, phoneWa: meta!.o_wa ? formatWa(meta!.o_wa) : null, footer: meta!.o_footer },
    notaNumber: o.notaNumber,
    receivedAt: o.receivedAt,
    dueAt: o.dueAt,
    tz: meta!.tz,
    cashierName: meta!.cashier,
    customerName: o.customerName,
    lines: o.lines,
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    paidTotal: o.paidTotal,
    paymentMethodLabel: lastPayment ? METHOD_LABEL[lastPayment.method] ?? lastPayment.method : null,
    trackingUrl: o.trackingUrl,
    notes: o.notes,
  };
  return { nota, whatsappText: renderWhatsApp(nota), customerPhoneWa: o.customerPhoneWa };
}

export async function logMessage(ctx: Ctx, orderId: string, template: string) {
  const sql = getSql();
  const [o] = await sql<Array<{ phone_wa: string | null }>>`
    select c.phone_wa from orders o join customers c on c.id = o.customer_id where o.id = ${orderId} and o.business_id = ${ctx.business.id}`;
  if (!o) throw notFound("Nota");
  if (!o.phone_wa) throw new ApiError(400, "no_phone", "Pelanggan belum punya nomor WhatsApp.");
  await sql`
    insert into message_logs (business_id, order_id, channel, template, to_phone, status, staff_id, sent_at)
    values (${ctx.business.id}, ${orderId}, 'wa_manual', ${template}, ${o.phone_wa}, 'terkirim', ${ctx.staff.id}, now())`;
  return { ok: true };
}

/** Data halaman lacak publik: hanya yang aman untuk dilihat siapa pun yang memegang link. */
export async function trackingData(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sql = getSql();
  const [r] = await sql<Array<{
    id: string; nota_number: string; status: OrderStatus; customer_name: string; total: number; paid_total: number;
    received_at: Date; due_at: Date | null; finished_at: Date | null; taken_at: Date | null;
    outlet_name: string; outlet_address: string | null; outlet_wa: string | null; tz: "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";
  }>>`
    select o.id, o.nota_number, o.status, c.name as customer_name, o.total, o.paid_total, o.received_at, o.due_at, o.finished_at, o.taken_at,
           ou.name as outlet_name, ou.address as outlet_address, ou.phone_wa as outlet_wa, ou.timezone as tz
    from orders o join customers c on c.id = o.customer_id join outlets ou on ou.id = o.outlet_id
    where o.tracking_token = ${token}`;
  if (!r) return null;
  const lines = await sql<Array<{ service_name: string; qty: string; unit: Unit; line_total: number }>>`
    select service_name, qty, unit, line_total from order_lines where order_id = ${r.id} order by position, id`;
  return {
    notaNumber: r.nota_number,
    status: r.status,
    firstName: r.customer_name.split(/\s+/).slice(0, 2).join(" "),
    total: r.total,
    remaining: r.total - r.paid_total,
    receivedAt: r.received_at,
    dueAt: r.due_at,
    finishedAt: r.finished_at,
    takenAt: r.taken_at,
    tz: r.tz,
    outlet: { name: r.outlet_name, address: r.outlet_address, wa: r.outlet_wa },
    lines: lines.map((l) => ({ name: l.service_name, qty: formatQty(l.qty, l.unit), total: l.line_total })),
  };
}
