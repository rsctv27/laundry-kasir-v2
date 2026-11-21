import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { corsHeaders, preflight } from "@/server/http";

const h = toNextJsHandler(auth);
// Tambahkan header CORS agar aplikasi kasir versi web (origin lain) bisa login saat pengembangan.
const withCors = (fn: (req: Request) => Promise<Response>) => async (req: Request) => {
  const res = await fn(req);
  const out = new Response(res.body, res);
  corsHeaders(req).forEach((v, k) => out.headers.set(k, v));
  return out;
};
export const GET = withCors(h.GET);
export const POST = withCors(h.POST);
export const OPTIONS = (req: Request) => preflight(req);
