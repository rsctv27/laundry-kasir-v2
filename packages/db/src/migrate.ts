// Menjalankan file migrations/*.sql yang belum pernah dijalankan, berurutan, masing-masing dalam satu transaksi.
//   DATABASE_URL=... pnpm --filter @lk/db migrate
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from _migrations`).map((r) => r.name));
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(join(dir, file), "utf8"));
        await tx`insert into _migrations (name) values (${file})`;
      });
      console.log("migrasi:", file);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().catch((e) => { console.error(e); process.exit(1); });
}
