// HANYA UNTUK DEMO PENGEMBANGAN: mengisi riwayat 14 hari ke belakang untuk usaha contoh ("contoh"),
// supaya dashboard dan laporan punya isi. Order masa lalu tidak bisa dibuat lewat API (waktu selalu "sekarang"),
// jadi skrip ini menulis langsung ke database. Menolak berjalan di production.
//   pnpm --filter @lk/web tsx scripts/seed-history.ts
import { getSql } from "@lk/db";
import { lineTotal, notaNumber, paymentStatus, hundredthsToDecimal, toHundredths } from "@lk/shared";

if (process.env.NODE_ENV === "production") throw new Error("seed-history tidak boleh dijalankan di production");

async function main() {
  const sql = getSql();
  const [b] = await sql<Array<{ id: string }>>`select id from businesses where code = 'contoh'`;
  if (!b) throw new Error("Jalankan seed.ts dulu");
  const [done] = await sql`select 1 from orders where business_id = ${b.id} and notes = 'demo-riwayat' limit 1`;
  if (done) { console.log("Riwayat demo sudah ada."); return; }
  const [o] = await sql<Array<{ id: string; code: string }>>`select id, code from outlets where business_id = ${b.id} order by created_at limit 1`;
  const [kasir] = await sql<Array<{ id: string }>>`select id from staff where business_id = ${b.id} and role = 'kasir' limit 1`;
  const custs = await sql<Array<{ id: string }>>`select id from customers where business_id = ${b.id}`;
  const svcs = await sql<Array<{ id: string; name: string; pricing_unit: "kg" | "pcs"; price: number }>>`
    select id, name, pricing_unit, price from services where outlet_id = ${o!.id} and active order by sort_order`;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const methods = ["tunai", "tunai", "tunai", "qris", "qris", "debit"] as const;
  const cats = [["bahan", 45000], ["gas", 25000], ["listrik_air", 120000], ["perawatan", 75000]] as const;

  for (let back = 14; back >= 1; back--) {
    const day = new Date(Date.now() - back * 86_400_000);
    const n = 4 + Math.floor(rnd() * 7);
    for (let i = 1; i <= n; i++) {
      const at = new Date(day.getTime());
      at.setUTCHours(1 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0); // 08.00–17.59 WIB
      const svc = svcs[Math.floor(rnd() * svcs.length)]!;
      const qty = svc.pricing_unit === "kg" ? hundredthsToDecimal(150 + Math.floor(rnd() * 30) * 25) : String(1 + Math.floor(rnd() * 2));
      const total = lineTotal(qty, svc.price);
      const paid = rnd() < 0.9 ? total : 0;
      const id = crypto.randomUUID();
      await sql.begin(async (tx) => {
        await tx`insert into orders (id, business_id, outlet_id, nota_number, customer_id, cashier_staff_id, status, received_at, due_at,
                   finished_at, taken_at, subtotal, total, paid_total, payment_status, notes)
                 values (${id}, ${b.id}, ${o!.id}, ${notaNumber(o!.code, at, 100 + i)}, ${custs[Math.floor(rnd() * custs.length)]!.id}, ${kasir!.id},
                   ${paid ? "diambil" : "selesai"}, ${at.toISOString()}, ${new Date(at.getTime() + 72 * 3_600_000).toISOString()},
                   ${new Date(at.getTime() + 48 * 3_600_000).toISOString()}, ${paid ? new Date(at.getTime() + 72 * 3_600_000).toISOString() : null},
                   ${total}, ${total}, ${paid}, ${paymentStatus(total, paid)}, 'demo-riwayat')`;
        await tx`insert into order_lines (order_id, service_id, service_name, unit, unit_price, qty, line_total)
                 values (${id}, ${svc.id}, ${svc.name}, ${svc.pricing_unit}, ${svc.price}, ${hundredthsToDecimal(toHundredths(qty))}, ${total})`;
        if (paid) {
          await tx`insert into payments (business_id, outlet_id, order_id, customer_id, kind, method, amount, staff_id, paid_at)
                   select ${b.id}, ${o!.id}, ${id}, customer_id, 'order', ${methods[Math.floor(rnd() * methods.length)]!}, ${paid}, ${kasir!.id}, ${at.toISOString()}
                   from orders where id = ${id}`;
        }
      });
    }
    if (rnd() < 0.6) {
      const [cat, amt] = cats[Math.floor(rnd() * cats.length)]!;
      const dayStr = new Date(day.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
      await sql`insert into expenses (business_id, outlet_id, category, amount, note, spent_on, staff_id)
                values (${b.id}, ${o!.id}, ${cat}, ${amt}, 'demo-riwayat', ${dayStr}, ${kasir!.id})`;
    }
  }
  console.log("Riwayat demo 14 hari ditambahkan.");
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
