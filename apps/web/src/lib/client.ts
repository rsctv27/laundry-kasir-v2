"use client";
import type { ApiError } from "@lk/shared";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export class ClientError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

/** Panggil /api/v1 dari web owner (sesi lewat cookie). */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/v1/${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiError>;
  if (!res.ok) {
    const e = data.error;
    throw new ClientError(res.status, e?.code ?? "unknown", e?.message ?? "Terjadi kesalahan.", e?.fields ?? {});
  }
  return data;
}
