import { account, getDb, session, user, verification } from "@lk/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, username } from "better-auth/plugins";
import { siteUrl, trustedOrigins } from "@/server/env";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || siteUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: { enabled: true, minPasswordLength: 6, maxPasswordLength: 64 },
  // Username staf disimpan sebagai <kode_usaha>_<username>, jadi batasnya dilonggarkan.
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 40 }), bearer()],
  trustedOrigins: trustedOrigins(),
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
});

export type Auth = typeof auth;
