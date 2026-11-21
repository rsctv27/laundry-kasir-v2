// Database tes dikosongkan dan dimigrasi ulang setiap kali tes dijalankan.
import postgres from "postgres";
import { migrate } from "@lk/db/migrate";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/lk_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema public cascade; create schema public;");
  await sql.end();
  await migrate(url);
}
