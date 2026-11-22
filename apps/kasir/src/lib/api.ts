import type { ApiError, MeDto } from "@lk/shared";
import { getItem, removeItem, setItem } from "./storage";

// "same-origin": versi web yang disajikan dari server yang sama (mis. https://domain/kasir) memanggil /api secara relatif.
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
export const API_URL = RAW_API_URL === "same-origin" ? "" : RAW_API_URL.replace(/\/$/, "");
const TOKEN_KEY = "lk.session";

export class RequestError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadToken() {
  token = await getItem(TOKEN_KEY);
  return token;
}
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

async function request<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<{ data: T; res: Response }> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        accept: "application/json",
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(rest.headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new RequestError(0, "offline", "Tidak bisa terhubung ke server. Periksa koneksi internet.");
  }
  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiError> & { message?: string; code?: string };
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    const e = data.error;
    throw new RequestError(res.status, e?.code ?? data.code ?? "unknown", e?.message ?? data.message ?? "Terjadi kesalahan.", e?.fields ?? {});
  }
  return { data, res };
}

/** Panggil /api/v1/<path>. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return (await request<T>(`${API_URL}/api/v1/${path}`, init)).data;
}

/** Login kasir: kode usaha + username. Owner juga bisa login dengan email. */
export async function signIn(businessCode: string, usernameOrEmail: string, password: string): Promise<MeDto> {
  const id = usernameOrEmail.trim().toLowerCase();
  const isEmail = id.includes("@");
  const path = isEmail ? "sign-in/email" : "sign-in/username";
  const body = isEmail ? { email: id, password } : { username: `${businessCode.trim().toLowerCase()}_${id}`, password };
  token = null;
  try {
    const { res } = await request(`${API_URL}/api/auth/${path}`, { method: "POST", json: body });
    const t = res.headers.get("set-auth-token");
    if (!t) throw new RequestError(500, "no_token", "Server tidak mengirim sesi.");
    token = t;
  } catch (e) {
    if (e instanceof RequestError && (e.status === 401 || e.status === 400)) {
      throw new RequestError(401, "bad_credentials", "Kode usaha, username, atau password salah.");
    }
    throw e;
  }
  try {
    const me = await api<MeDto>("me");
    await setItem(TOKEN_KEY, token);
    return me;
  } catch (e) {
    token = null;
    throw e;
  }
}

export async function signOut() {
  try { await request(`${API_URL}/api/auth/sign-out`, { method: "POST", json: {} }); } catch { /* tetap keluar di HP */ }
  token = null;
  await removeItem(TOKEN_KEY);
}
