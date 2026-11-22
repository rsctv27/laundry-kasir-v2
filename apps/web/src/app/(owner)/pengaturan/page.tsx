"use client";
// S22 (sebagian): profil outlet, catatan kaki nota, gambar QRIS statis.
import { formatWa, type OutletDto } from "@lk/shared";
import { QrCode, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageTitle, useMe } from "@/components/owner";
import { Alert, Button, Card, Field } from "@/components/ui";
import { api, ClientError } from "@/lib/client";

export default function Pengaturan() {
  const me = useMe();
  const [outlet, setOutlet] = useState<OutletDto | null>(null);
  const [qris, setQris] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const isOwner = me.staff.role === "owner";

  const load = useCallback(async () => {
    const { outlets } = await api<{ outlets: OutletDto[] }>("outlets");
    const o = outlets.find((x) => x.id === me.outlet?.id) ?? outlets[0] ?? null;
    setOutlet(o);
    setQris(o?.hasQris ? (await api<{ dataUrl: string }>(`outlets/${o.id}/qris`)).dataUrl : null);
  }, [me.outlet?.id]);
  useEffect(() => { void load(); }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!outlet) return;
    const f = new FormData(e.currentTarget);
    setSaving(true); setMsg(null); setFields({});
    try {
      setOutlet(await api<OutletDto>(`outlets/${outlet.id}`, {
        method: "PATCH",
        json: {
          name: f.get("name"),
          address: String(f.get("address") ?? "") || null,
          phoneWa: String(f.get("phoneWa") ?? "") || undefined,
          notaFooter: String(f.get("notaFooter") ?? "") || null,
        },
      }));
      setMsg({ tone: "success", text: "Pengaturan outlet tersimpan. Nota berikutnya memakai data baru." });
    } catch (err) {
      if (err instanceof ClientError) { setMsg({ tone: "danger", text: err.message }); setFields(err.fields); }
    } finally { setSaving(false); }
  }

  async function upload(f: File) {
    if (!outlet) return;
    if (f.size > 512 * 1024) return setMsg({ tone: "danger", text: "Gambar maksimal 512 KB. Perkecil dulu ukurannya." });
    setUploading(true); setMsg(null);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
      await api(`outlets/${outlet.id}/qris`, { method: "PUT", json: { mime: f.type, dataBase64: dataUrl.split(",")[1] } });
      setQris(dataUrl);
      setMsg({ tone: "success", text: "Gambar QRIS tersimpan. Kasir akan melihatnya saat memilih QRIS." });
    } catch (err) {
      setMsg({ tone: "danger", text: err instanceof ClientError ? err.message : "Gagal mengunggah gambar." });
    } finally { setUploading(false); if (file.current) file.current.value = ""; }
  }

  async function removeQris() {
    if (!outlet) return;
    await api(`outlets/${outlet.id}/qris`, { method: "DELETE" });
    setQris(null);
  }

  if (!outlet) return <p className="text-muted">Memuat…</p>;
  return (
    <>
      <PageTitle title="Pengaturan outlet" />
      {!isOwner && <Alert tone="info">Hanya pemilik yang bisa mengubah pengaturan outlet.</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Profil outlet <span className="font-mono text-sm text-muted">({outlet.code})</span></h2>
          <form onSubmit={save} className="flex flex-col gap-4">
            <fieldset disabled={!isOwner} className="flex flex-col gap-4">
              <Field name="name" label="Nama outlet" defaultValue={outlet.name} required minLength={2} error={fields.name} />
              <Field name="address" label="Alamat" defaultValue={outlet.address ?? ""} error={fields.address} help="Tampil di nota dan halaman lacak." />
              <Field name="phoneWa" label="Nomor WhatsApp outlet" defaultValue={outlet.phoneWa ? formatWa(outlet.phoneWa) : ""} inputMode="tel" error={fields.phoneWa} />
              <Field name="notaFooter" label="Catatan kaki nota" defaultValue={outlet.notaFooter ?? ""} maxLength={120} placeholder="Contoh: Cucian tidak diambil 30 hari bukan tanggung jawab kami" error={fields.notaFooter} />
            </fieldset>
            {isOwner && <Button type="submit" loading={saving}>Simpan</Button>}
          </form>
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Gambar QRIS outlet</h2>
          <p className="text-sm text-muted">Unggah gambar QRIS dari bank atau penyedia pembayaran Anda (PNG/JPG/WEBP, maks. 512 KB). Kasir menampilkannya ke pelanggan saat memilih QRIS, lalu mengonfirmasi setelah dana masuk.</p>
          {qris ? (
            <img src={qris} alt="QRIS outlet" className="mx-auto size-56 rounded-md border border-border bg-bg object-contain p-2" />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-md bg-surface px-4 py-8 text-center text-sm text-muted">
              <QrCode aria-hidden className="size-10" />Belum ada gambar QRIS.
            </div>
          )}
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="qris-file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button variant="secondary" loading={uploading} onClick={() => file.current?.click()}><Upload aria-hidden className="size-5" /> {qris ? "Ganti gambar" : "Unggah gambar"}</Button>
              {qris && <Button variant="ghost" onClick={removeQris}><Trash2 aria-hidden className="size-5" /> Hapus</Button>}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
