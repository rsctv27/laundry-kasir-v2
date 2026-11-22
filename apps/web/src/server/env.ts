// Alamat situs dan origin yang dipercaya, untuk lokal maupun Vercel.
// Di Vercel, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, dan VERCEL_BRANCH_URL diisi otomatis (tanpa https://).

const https = (host?: string) => (host ? `https://${host}` : undefined);
const trim = (s: string) => s.replace(/\/$/, "");

/** Alamat utama aplikasi: dipakai untuk link lacak cucian di nota dan baseURL login. */
export function siteUrl(): string {
  return trim(
    process.env.PUBLIC_BASE_URL ||
      process.env.BETTER_AUTH_URL ||
      https(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
      "http://localhost:3000",
  );
}

/** Origin lain yang boleh memanggil API dan login: CORS_ORIGINS, plus alamat preview Vercel. */
export function trustedOrigins(): string[] {
  const list = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    const o = https(host);
    if (o && !list.includes(o)) list.push(o);
  }
  return list.map(trim);
}
