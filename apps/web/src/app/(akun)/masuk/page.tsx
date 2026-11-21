"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { api, authClient } from "@/lib/client";

export default function MasukPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")) });
    if (error) {
      setLoading(false);
      return setError("Email atau password salah.");
    }
    try {
      await api("me");
      router.push("/dashboard");
    } catch {
      router.push("/setup"); // belum punya usaha
    }
  }

  return (
    <main className="mx-auto flex max-w-kasir flex-col gap-6 px-4 py-10">
      <h1 className="text-xl">Masuk</h1>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field name="password" label="Password" type="password" autoComplete="current-password" required />
        <Button type="submit" size="lg" loading={loading}>Masuk</Button>
      </form>
      <p className="text-sm text-muted">Kasir masuk lewat aplikasi kasir dengan kode usaha dan username.</p>
      <p className="text-sm text-muted">Belum punya akun? <Link href="/daftar" className="font-semibold text-fg underline">Daftar</Link></p>
    </main>
  );
}
