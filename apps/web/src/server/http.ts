import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} tidak ditemukan.`);
export const forbidden = (msg = "Anda tidak punya akses untuk ini.") => new ApiError(403, "forbidden", msg);
export const badRequest = (msg: string, fields?: Record<string, string>) => new ApiError(400, "bad_request", msg, fields);
export const conflict = (msg: string, fields?: Record<string, string>) => new ApiError(409, "conflict", msg, fields);

function allowedOrigins() {
  return (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** CORS hanya untuk origin yang terdaftar (aplikasi kasir versi web saat pengembangan). */
export function corsHeaders(req: Request): Headers {
  const h = new Headers();
  const origin = req.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Vary", "Origin");
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Access-Control-Allow-Headers", "authorization,content-type,x-outlet-id");
    h.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    h.set("Access-Control-Expose-Headers", "set-auth-token");
    h.set("Access-Control-Max-Age", "600");
  }
  return h;
}

export function json(req: Request, data: unknown, status = 200): Response {
  const h = corsHeaders(req);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/** Ubah error apa pun menjadi respons { error: { code, message, fields? } }. */
export function errorResponse(req: Request, e: unknown): Response {
  if (e instanceof ApiError) return json(req, { error: { code: e.code, message: e.message, fields: e.fields } }, e.status);
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join(".") || "_"] ??= i.message;
    return json(req, { error: { code: "validation", message: "Periksa lagi isian Anda.", fields } }, 400);
  }
  if (e instanceof SyntaxError) return json(req, { error: { code: "bad_json", message: "Format permintaan tidak valid." } }, 400);
  console.error("[api] error tak terduga:", e);
  return json(req, { error: { code: "internal", message: "Terjadi kesalahan di server. Coba lagi." } }, 500);
}

/** Kode error unik Postgres. */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as { code?: string; constraint_name?: string };
  return err?.code === "23505" && (!constraint || err.constraint_name === constraint);
}
