"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { authClient } from "@/lib/client";

export default function DaftarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(f.get("name")),
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setLoading(false);
    if (error) return setError(error.code === "USER_ALREADY_EXISTS" || error.status === 422 ? "Email ini sudah terdaftar. Silakan masuk." : error.message ?? "Pendaftaran gagal.");
    router.push("/setup");
  }

  return (
    <main className="mx-auto flex max-w-kasir flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl">Daftar sebagai pemilik</h1>
        <p className="mt-1 text-sm text-muted">Akun ini untuk mengatur usaha, layanan, dan akun kasir.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field name="name" label="Nama Anda" autoComplete="name" required minLength={2} />
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field name="password" label="Password" type="password" autoComplete="new-password" required minLength={6} help="Minimal 6 karakter." />
        <Button type="submit" size="lg" loading={loading}>Daftar</Button>
      </form>
      <p className="text-sm text-muted">Sudah punya akun? <Link href="/masuk" className="font-semibold text-fg underline">Masuk</Link></p>
    </main>
  );
}
