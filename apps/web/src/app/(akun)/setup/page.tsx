"use client";
// S17: owner mengisi usaha dan outlet pertama.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field } from "@/components/ui";
import { api, ClientError } from "@/lib/client";

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await api("businesses", { method: "POST", json: f });
      router.push("/dashboard");
    } catch (err) {
      setLoading(false);
      if (err instanceof ClientError) {
        if (err.status === 401) return router.push("/masuk");
        if (err.code === "conflict" && !Object.keys(err.fields).length) return router.push("/dashboard");
        setError(err.message);
        setFields(err.fields);
      } else setError("Tidak bisa terhubung ke server.");
    }
  }

  return (
    <main className="mx-auto flex max-w-kasir flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl">Siapkan usaha Anda</h1>
        <p className="mt-1 text-sm text-muted">Bisa diubah nanti. Outlet lain bisa ditambahkan belakangan.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Usaha</h2>
          <Field name="businessName" label="Nama usaha" required minLength={2} error={fields.businessName} />
          <Field
            name="businessCode"
            label="Kode usaha"
            required
            pattern="[a-z0-9]{3,12}"
            autoCapitalize="none"
            error={fields.businessCode}
            help="3–12 huruf kecil atau angka, tanpa spasi. Kasir mengetik kode ini saat masuk."
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Outlet pertama</h2>
          <Field name="outletName" label="Nama outlet" required minLength={2} error={fields.outletName} />
          <Field
            name="outletCode"
            label="Kode outlet"
            required
            pattern="[A-Za-z0-9]{2,6}"
            error={fields.outletCode}
            help="2–6 huruf atau angka. Jadi awalan nomor nota, misalnya MLG1-261121-001."
          />
          <Field name="outletAddress" label="Alamat (opsional)" error={fields.outletAddress} />
          <Field name="outletPhoneWa" label="Nomor WhatsApp outlet (opsional)" inputMode="tel" prefix="+62" error={fields.outletPhoneWa} help="Tampil di nota dan halaman lacak pelanggan." />
        </Card>
        <Button type="submit" size="lg" loading={loading}>Simpan dan lanjut</Button>
      </form>
    </main>
  );
}
