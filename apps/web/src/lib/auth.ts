import { account, getDb, session, user, verification } from "@lk/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, username } from "better-auth/plugins";

const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: { enabled: true, minPasswordLength: 6, maxPasswordLength: 64 },
  // Username staf disimpan sebagai <kode_usaha>_<username>, jadi batasnya dilonggarkan.
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 40 }), bearer()],
  trustedOrigins: origins,
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
});

export type Auth = typeof auth;
