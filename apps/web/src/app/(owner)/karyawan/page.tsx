"use client";
// S19: karyawan dan akun kasir.
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageTitle, useMe } from "@/components/owner";
import { Alert, Button, Card, Field, Select } from "@/components/ui";
import { api, ClientError } from "@/lib/client";

type StaffRow = { id: string; name: string; role: string; username: string | null; outletName: string | null; active: boolean };
const ROLE_LABEL: Record<string, string> = { owner: "Pemilik", supervisor: "Supervisor", kasir: "Kasir", produksi: "Produksi", kurir: "Kurir" };

export default function Karyawan() {
  const me = useMe();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    api<{ staff: StaffRow[] }>("staff").then((r) => setStaff(r.staff)).catch((e) => setError(e instanceof ClientError && e.status === 403 ? "Hanya pemilik yang bisa mengatur karyawan." : e.message));
  }, []);
  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setLoading(true); setError(null); setFields({}); setDone(null);
    try {
      const r = await api<{ username: string; name: string }>("staff", {
        method: "POST",
        json: { name: f.get("name"), username: f.get("username"), password: f.get("password"), role: f.get("role"), outletId: me.outlet?.id ?? null },
      });
      form.reset();
      setDone(`Akun ${r.name} siap. Masuk di aplikasi kasir dengan kode usaha "${me.business.code}" dan username "${r.username}".`);
      load();
    } catch (err) {
      if (err instanceof ClientError) { setError(err.message); setFields(err.fields); }
    } finally { setLoading(false); }
  }

  return (
    <>
      <PageTitle title="Karyawan" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-0">
          {!staff ? <p className="p-4 text-muted">Memuat…</p> : (
            <ul className="divide-y divide-border">
              {staff.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="text-sm text-muted">{s.username ? `@${s.username}` : "masuk dengan email"}{s.outletName ? ` · ${s.outletName}` : ""}</p></div>
                  <span className="rounded-pill bg-surface px-2.5 py-1 text-xs font-semibold text-muted">{ROLE_LABEL[s.role] ?? s.role}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex h-fit flex-col gap-3">
          <h2 className="text-base font-semibold">Buat akun kasir</h2>
          {error && <Alert>{error}</Alert>}
          {done && <Alert tone="success">{done}</Alert>}
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field name="name" label="Nama" required minLength={2} error={fields.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field name="username" label="Username" autoCapitalize="none" required pattern="[a-z0-9]{3,20}" error={fields.username} help="Huruf kecil/angka" />
              <Field name="password" label="Password" type="password" autoComplete="new-password" required minLength={6} error={fields.password} />
            </div>
            <Select name="role" label="Peran" defaultValue="kasir">
              <option value="kasir">Kasir</option><option value="supervisor">Supervisor</option>
            </Select>
            <Button type="submit" variant="secondary" loading={loading}><Plus aria-hidden className="size-5" /> Buat akun</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
