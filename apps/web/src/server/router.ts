// Satu pintu untuk /api/v1/*: CORS, login, validasi, dan format error di satu tempat.
import {
  addPaymentInput, createBusinessInput, createCustomerInput, createOrderInput, createServiceInput, createStaffInput,
  statusChangeInput, type MeDto,
} from "@lk/shared";
import { z } from "zod";
import { requireCtx, requireRole, requireUser } from "./context";
import { createCustomer, getCustomer, searchCustomers } from "./customers";
import { ApiError, errorResponse, json } from "./http";
import { addPayment, changeStatus, createOrder, getOrder, home, listOrders, logMessage, notaFor, pickup } from "./orders";
import { createBusiness, createService, createStaff, listServices, listStaff } from "./setup";

type Handler = (req: Request, params: string[], url: URL) => Promise<unknown | Response>;
const uuid = z.string().uuid();
const body = async (req: Request) => (req.headers.get("content-length") === "0" ? {} : await req.json());

const routes: Array<[string, RegExp, Handler]> = [
  ["GET", /^me$/, async (req) => {
    const ctx = await requireCtx(req);
    const me: MeDto = {
      staff: { id: ctx.staff.id, name: ctx.staff.name, role: ctx.staff.role },
      business: ctx.business,
      outlet: ctx.outlet ? { id: ctx.outlet.id, name: ctx.outlet.name, code: ctx.outlet.code, timezone: ctx.outlet.timezone } : null,
    };
    return me;
  }],
  ["POST", /^businesses$/, async (req) => {
    const u = await requireUser(req);
    const input = createBusinessInput.parse(await body(req));
    return new Response(JSON.stringify(await createBusiness(u.id, u.name, input)), { status: 201 });
  }],
  ["GET", /^services$/, async (req, _p, url) => ({ services: await listServices(await requireCtx(req), url.searchParams.get("all") === "1") })],
  ["POST", /^services$/, async (req) => {
    const ctx = await requireCtx(req);
    requireRole(ctx, ["owner", "supervisor"]); // hak akses dicek sebelum isian divalidasi
    return created(await createService(ctx, createServiceInput.parse(await body(req))));
  }],
  ["GET", /^staff$/, async (req) => ({ staff: await listStaff(await requireCtx(req)) })],
  ["POST", /^staff$/, async (req) => {
    const ctx = await requireCtx(req);
    requireRole(ctx, ["owner"]);
    return created(await createStaff(ctx, createStaffInput.parse(await body(req))));
  }],
  ["GET", /^home$/, async (req) => home(await requireCtx(req))],
  ["GET", /^customers$/, async (req, _p, url) => ({ customers: await searchCustomers(await requireCtx(req), url.searchParams.get("q") ?? "") })],
  ["POST", /^customers$/, async (req) => created(await createCustomer(await requireCtx(req), createCustomerInput.parse(await body(req))))],
  ["GET", /^customers\/([^/]+)$/, async (req, [id]) => getCustomer(await requireCtx(req), uuid.parse(id))],
  ["POST", /^orders$/, async (req) => {
    const r = await createOrder(await requireCtx(req), createOrderInput.parse(await body(req)));
    return new Response(JSON.stringify(r.order), { status: r.created ? 201 : 200 });
  }],
  ["GET", /^orders$/, async (req, _p, url) =>
    listOrders(await requireCtx(req), {
      status: url.searchParams.get("status") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 30),
    })],
  ["GET", /^orders\/([^/]+)$/, async (req, [id]) => getOrder(await requireCtx(req), uuid.parse(id))],
  ["POST", /^orders\/([^/]+)\/status$/, async (req, [id]) => {
    const input = statusChangeInput.parse(await body(req));
    return changeStatus(await requireCtx(req), uuid.parse(id), input.to, input.note);
  }],
  ["POST", /^orders\/([^/]+)\/payments$/, async (req, [id]) => addPayment(await requireCtx(req), uuid.parse(id), addPaymentInput.parse(await body(req)))],
  ["POST", /^orders\/([^/]+)\/pickup$/, async (req, [id]) => pickup(await requireCtx(req), uuid.parse(id))],
  ["GET", /^orders\/([^/]+)\/nota$/, async (req, [id]) => notaFor(await requireCtx(req), uuid.parse(id))],
  ["POST", /^orders\/([^/]+)\/messages$/, async (req, [id]) => {
    const { template } = z.object({ template: z.enum(["nota", "siap_diambil"]) }).parse(await body(req));
    return logMessage(await requireCtx(req), uuid.parse(id), template);
  }],
];

function created(data: unknown) {
  return new Response(JSON.stringify(data), { status: 201 });
}

export async function dispatch(req: Request, path: string[]): Promise<Response> {
  try {
    const p = path.join("/");
    const url = new URL(req.url);
    let pathMatched = false;
    for (const [method, re, handler] of routes) {
      const m = p.match(re);
      if (!m) continue;
      pathMatched = true;
      if (method !== req.method) continue;
      const out = await handler(req, m.slice(1), url);
      if (out instanceof Response) return json(req, JSON.parse(await out.text()), out.status);
      return json(req, out);
    }
    if (pathMatched) throw new ApiError(405, "method_not_allowed", "Metode tidak didukung.");
    throw new ApiError(404, "not_found", "Endpoint tidak ditemukan.");
  } catch (e) {
    return errorResponse(req, e);
  }
}
