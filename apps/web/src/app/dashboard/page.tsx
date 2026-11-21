"use client";
// S18 + S19 versi minimal: layanan & harga, akun staf. Dashboard angka (S20) menyusul di Milestone 2.
import { formatRupiah, type MeDto, type ServiceDto } from "@lk/shared";
import { LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Field, Select } from "@/components/ui";
import { api, authClient, ClientError } from "@/lib/client";

type StaffRow = { id: string; name: string; role: string; username: string | null; outletName: string | null; active: boolean };
const ROLE_LABEL: Record<string, string> = { owner: "Pemilik", supervisor: "Supervisor", kasir: "Kasir", produksi: "Produksi", kurir: "Kurir" };
const durationLabel = (h: number) => (h % 24 === 0 ? `${h / 24} hari` : `${h} jam`);

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<MeDto | null>(null);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await api<MeDto>("me");
      setMe(m);
      const [s, st] = await Promise.all([api<{ services: ServiceDto[] }>("services?all=1"), api<{ staff: StaffRow[] }>("staff")]);
      setServices(s.services);
      setStaff(st.staff);
    } catch (e) {
      if (e instanceof ClientError && e.status === 401) return router.push("/masuk");
      if (e instanceof ClientError && e.code === "no_business") return router.push("/setup");
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  if (loadError) return <main className="mx-auto max-w-owner p-6"><Alert>{loadError}</Alert></main>;
  if (!me) return <main className="mx-auto max-w-owner p-6 text-muted">Memuat…</main>;

  return (
    <main className="mx-auto flex max-w-owner flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl">{me.business.name}</h1>
          <p className="text-sm text-muted">{me.outlet?.name} · kode usaha <span className="font-mono font-semibold text-fg">{me.business.code}</span></p>
        </div>
        <Button variant="secondary" size="sm" onClick={async () => { await authClient.signOut(); router.push("/masuk"); }}>
          <LogOut aria-hidden className="size-4" /> Keluar
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <ServicesCard services={services} onAdded={load} />
        <StaffCard staff={staff} me={me} onAdded={load} />
      </div>
    </main>
  );
}

function ServicesCard({ services, onAdded }: { services: ServiceDto[]; onAdded: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const unitDays = f.get("durationUnit") === "hari";
    setLoading(true); setError(null); setFields({});
    try {
      await api("services", {
        method: "POST",
        json: {
          name: f.get("name"),
          pricingUnit: f.get("pricingUnit"),
          price: Number(String(f.get("price")).replace(/\D/g, "")),
          durationHours: Number(f.get("duration")) * (unitDays ? 24 : 1),
        },
      });
      form.reset();
      onAdded();
    } catch (err) {
      if (err instanceof ClientError) { setError(err.message); setFields(err.fields); }
    } finally { setLoading(false); }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg">Layanan &amp; harga</h2>
      {services.length === 0 ? (
        <p className="rounded-md bg-surface px-4 py-6 text-center text-sm text-muted">Belum ada layanan. Tambahkan minimal satu agar kasir bisa membuat transaksi.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="text-sm text-muted">{durationLabel(s.durationHours)}</p></div>
              <p className="tabular-nums">{formatRupiah(s.price)} / {s.pricingUnit}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-muted">Tambah layanan</h3>
        {error && <Alert>{error}</Alert>}
        <Field name="name" label="Nama layanan" placeholder="Contoh: Cuci setrika reguler" required minLength={2} error={fields.name} />
        <div className="grid grid-cols-2 gap-3">
          <Field name="price" label="Harga" prefix="Rp" inputMode="numeric" required error={fields.price} />
          <Select name="pricingUnit" label="Per" defaultValue="kg"><option value="kg">kg</option><option value="pcs">pcs</option></Select>
          <Field name="duration" label="Lama pengerjaan" inputMode="numeric" type="number" min={1} defaultValue={3} required error={fields.durationHours} />
          <Select name="durationUnit" label="Satuan" defaultValue="hari"><option value="hari">hari</option><option value="jam">jam</option></Select>
        </div>
        <Button type="submit" variant="secondary" loading={loading}><Plus aria-hidden className="size-5" /> Tambah layanan</Button>
      </form>
    </Card>
  );
}

function StaffCard({ staff, me, onAdded }: { staff: StaffRow[]; me: MeDto; onAdded: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      onAdded();
    } catch (err) {
      if (err instanceof ClientError) { setError(err.message); setFields(err.fields); }
    } finally { setLoading(false); }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg">Karyawan</h2>
      <ul className="divide-y divide-border rounded-md border border-border">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="text-sm text-muted">{s.username ? `@${s.username}` : "login dengan email"}{s.outletName ? ` · ${s.outletName}` : ""}</p></div>
            <span className="rounded-pill bg-surface px-2.5 py-1 text-xs font-semibold text-muted">{ROLE_LABEL[s.role] ?? s.role}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-muted">Buat akun kasir</h3>
        {error && <Alert>{error}</Alert>}
        {done && <Alert tone="success">{done}</Alert>}
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
  );
}
