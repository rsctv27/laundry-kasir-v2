// S06: ringkasan + pembayaran, lalu simpan. Id order dari draf membuat simpan ulang aman (tidak dobel).
import { formatRupiah, type OrderDetailDto } from "@lk/shared";
import { Redirect, router } from "expo-router";
import { Printer } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CashInput, cashOk, PaymentPicker, type PayChoice } from "@/components/payment";
import { QrisImage } from "@/components/qris-image";
import { ActionBar, AppHeader, Body } from "@/components/screen";
import { Banner, Button, Card, Checkbox, sp, Txt } from "@/components/ui";
import { api, RequestError } from "@/lib/api";
import { safeFormatQty, safeLineTotal, useDraft } from "@/lib/draft";

export default function Bayar() {
  const draft = useDraft();
  const [method, setMethod] = useState<PayChoice>("tunai");
  const [cash, setCash] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [details, setDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!draft.customer || draft.lines.length === 0) return <Redirect href="/transaksi/pelanggan" />;

  const total = draft.total;
  const needsConfirm = method === "qris" || method === "debit";
  const canSave = (method !== "tunai" || cashOk(total, cash)) && (!needsConfirm || confirmed);

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const cashNum = Number(cash || 0);
      const order = await api<OrderDetailDto>("orders", {
        method: "POST",
        json: {
          id: draft.orderId,
          customerId: draft.customer!.id,
          lines: draft.lines.map((l) => ({ serviceId: l.service.id, qty: l.qty })),
          payment:
            method === "nanti"
              ? undefined
              : { id: draft.paymentId, method, amount: total, cashReceived: method === "tunai" ? (cashNum || total) : undefined },
        },
      });
      router.replace(`/nota/${order.id}?baru=1`);
      draft.reset();
    } catch (e) {
      setError(
        e instanceof RequestError && e.status === 0
          ? "Belum tersimpan karena koneksi putus. Tekan simpan lagi saat sinyal kembali; transaksi tidak akan tercatat dua kali."
          : e instanceof RequestError ? e.message : "Gagal menyimpan transaksi.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Pembayaran" subtitle="Langkah 3 dari 3" back />
      <Body>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: sp(3) }}>
            <Txt variant="sm" color="text-muted" style={{ flex: 1 }} numberOfLines={1}>{draft.customer.name} · {draft.lines.length} layanan</Txt>
            <Pressable accessibilityRole="button" onPress={() => setDetails((d) => !d)}>
              <Txt variant="sm" weight={600} style={{ textDecorationLine: "underline" }}>{details ? "Tutup rincian" : "Rincian"}</Txt>
            </Pressable>
          </View>
          {details && (
            <View style={{ gap: sp(2), marginTop: sp(3) }}>
              {draft.lines.map((l) => (
                <View key={l.service.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: sp(3) }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="sm">{l.service.name}</Txt>
                    <Txt variant="sm" color="text-muted" tabular>{safeFormatQty(l.qty, l.service.pricingUnit)} × {formatRupiah(l.service.price)}</Txt>
                  </View>
                  <Txt variant="sm" tabular>{formatRupiah(safeLineTotal(l))}</Txt>
                </View>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: sp(3) }}>
            <Txt weight={600}>Total</Txt>
            <Txt variant="xl" tabular accessibilityLabel={`Total ${formatRupiah(total)}`}>{formatRupiah(total)}</Txt>
          </View>
        </Card>
        {error && <Banner tone="danger" text={error} />}
        <PaymentPicker value={method} onChange={(m) => { setMethod(m); setConfirmed(false); }} />
        {method === "tunai" && <CashInput total={total} value={cash} onChange={setCash} />}
        {method === "qris" && <QrisImage amountLabel={formatRupiah(total)} />}
        {method === "nanti" && <Banner tone="info" text="Tagihan dibayar saat pelanggan mengambil cucian." />}
        {needsConfirm && (
          <Checkbox
            checked={confirmed}
            onChange={setConfirmed}
            label={method === "qris" ? `Dana ${formatRupiah(total)} sudah masuk lewat QRIS` : `Pembayaran ${formatRupiah(total)} di mesin EDC berhasil`}
          />
        )}
      </Body>
      <ActionBar>
        <Button label="Simpan & lihat nota" icon={Printer} size="lg" onPress={save} loading={saving} disabled={!canSave} style={{ flex: 1 }} />
      </ActionBar>
    </View>
  );
}
