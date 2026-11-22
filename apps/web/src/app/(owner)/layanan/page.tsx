"use client";
// S18: layanan & harga (tambah, ubah, nonaktifkan).
import { formatRupiah, type ServiceDto } from "@lk/shared";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/owner";
import { Alert, Button, Card, Field, Select } from "@/components/ui";
import { api, ClientError } from "@/lib/client";

const durationLabel = (h: number) => (h % 24 === 0 ? `${h / 24} hari` : `${h} jam`);
const splitDuration = (h: number) => (h % 24 === 0 ? { value: h / 24, unit: "hari" } : { value: h, unit: "jam" });

export default function Layanan() {
  const [services, setServices] = useState<ServiceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ services: ServiceDto[] }>("services?all=1").then((r) => setServices(r.services)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <PageTitle title="Layanan & harga" />
      <p className="-mt-3 text-sm text-muted">Perubahan harga hanya berlaku untuk nota baru. Nota lama tetap memakai harga saat transaksi.</p>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-0">
          {!services ? (
            <p className="p-4 text-muted">Memuat…</p>
          ) : services.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Belum ada layanan. Tambahkan minimal satu agar kasir bisa membuat transaksi.</p>
          ) : (
            <ul className="divide-y divide-border">{services.map((s) => <ServiceRow key={s.id} s={s} onChanged={load} />)}</ul>
          )}
        </Card>
        <AddService onAdded={load} />
      </div>
    </>
  );
}

function ServiceRow({ s, onChanged }: { s: ServiceDto; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = splitDuration(s.durationHours);

  async function patch(json: Record<string, unknown>) {
    setBusy(true); setError(null);
    try { await api(`services/${s.id}`, { method: "PATCH", json }); setEditing(false); onChanged(); }
    catch (e) { setError(e instanceof ClientError ? e.message : "Gagal menyimpan."); }
    finally { setBusy(false); }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-3 p-4">
        {error && <Alert>{error}</Alert>}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void patch({
              name: f.get("name"),
              price: Number(String(f.get("price")).replace(/\D/g, "")),
              durationHours: Number(f.get("duration")) * (f.get("unit") === "hari" ? 24 : 1),
            });
          }}
        >
          <Field name="name" label="Nama layanan" defaultValue={s.name} required minLength={2} />
          <div className="grid grid-cols-3 gap-3">
            <Field name="price" label={`Harga / ${s.pricingUnit}`} prefix="Rp" inputMode="numeric" defaultValue={String(s.price)} required />
            <Field name="duration" label="Lama" type="number" min={1} defaultValue={d.value} required />
            <Select name="unit" label="Satuan" defaultValue={d.unit}><option value="hari">hari</option><option value="jam">jam</option></Select>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Batal</Button>
            <Button type="submit" loading={busy}>Simpan</Button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${s.active ? "" : "bg-surface"}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${s.active ? "" : "text-muted"}`}>{s.name}</p>
        <p className="text-sm text-muted">{durationLabel(s.durationHours)}{s.active ? "" : " · nonaktif, tidak tampil di kasir"}</p>
      </div>
      <p className="tabular-nums">{formatRupiah(s.price)} / {s.pricingUnit}</p>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Ubah ${s.name}`}><Pencil aria-hidden className="size-4" /> Ubah</Button>
        <Button variant="secondary" size="sm" loading={busy} onClick={() => patch({ active: !s.active })}>{s.active ? "Nonaktifkan" : "Aktifkan"}</Button>
      </div>
      {error && <div className="w-full"><Alert>{error}</Alert></div>}
    </li>
  );
}

function AddService({ onAdded }: { onAdded: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setLoading(true); setError(null); setFields({});
    try {
      await api("services", {
        method: "POST",
        json: {
          name: f.get("name"),
          pricingUnit: f.get("pricingUnit"),
          price: Number(String(f.get("price")).replace(/\D/g, "")),
          durationHours: Number(f.get("duration")) * (f.get("durationUnit") === "hari" ? 24 : 1),
        },
      });
      form.reset();
      onAdded();
    } catch (err) {
      if (err instanceof ClientError) { setError(err.message); setFields(err.fields); }
    } finally { setLoading(false); }
  }
  return (
    <Card className="flex h-fit flex-col gap-3">
      <h2 className="text-base font-semibold">Tambah layanan</h2>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field name="name" label="Nama layanan" placeholder="Contoh: Cuci setrika reguler" required minLength={2} error={fields.name} />
        <div className="grid grid-cols-2 gap-3">
          <Field name="price" label="Harga" prefix="Rp" inputMode="numeric" required error={fields.price} />
          <Select name="pricingUnit" label="Per" defaultValue="kg"><option value="kg">kg</option><option value="pcs">pcs</option></Select>
          <Field name="duration" label="Lama pengerjaan" type="number" min={1} defaultValue={3} required error={fields.durationHours} />
          <Select name="durationUnit" label="Satuan" defaultValue="hari"><option value="hari">hari</option><option value="jam">jam</option></Select>
        </div>
        <Button type="submit" variant="secondary" loading={loading}><Plus aria-hidden className="size-5" /> Tambah layanan</Button>
      </form>
    </Card>
  );
}
