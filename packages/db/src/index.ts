import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

declare global {
  // eslint-disable-next-line no-var
  var __lkSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __lkDrizzle: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

/** Satu koneksi per proses (aman saat hot reload Next.js). */
export function getSql() {
  if (!globalThis.__lkSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum diisi");
    globalThis.__lkSql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      prepare: false,
      onnotice: () => {},
      // bigint (rupiah, count) sebagai number biasa; aman sampai 9 juta miliar.
      types: { bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) } },
    });
  }
  return globalThis.__lkSql;
}

/**
 * Drizzle memakai koneksinya sendiri: Drizzle mengganti parser tanggal pada klien postgres.js yang dipakainya,
 * jadi klien itu tidak boleh dipakai bersama query SQL mentah (getSql) yang mengharapkan objek Date.
 */
export function getDb() {
  if (!globalThis.__lkDrizzle) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum diisi");
    const client = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX_AUTH ?? 5), prepare: false, onnotice: () => {} });
    globalThis.__lkDrizzle = drizzle(client, { schema });
  }
  return globalThis.__lkDrizzle;
}
export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
