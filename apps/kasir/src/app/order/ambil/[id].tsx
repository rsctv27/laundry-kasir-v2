// S10: pengambilan dan pelunasan.
import { formatRupiah, type OrderDetailDto } from "@lk/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Package } from "lucide-react-native";
import { useRef, useState } from "react";
import { View } from "react-native";
import { CashInput, cashOk, PaymentPicker, type PayChoice } from "@/components/payment";
import { QrisImage } from "@/components/qris-image";
import { ActionBar, AppHeader, Body } from "@/components/screen";
import { Banner, Button, Card, Checkbox, Skeleton, sp, Txt } from "@/components/ui";
import { api, RequestError } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { uuid } from "@/lib/uuid";

export default function Ambil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: o, error, reload } = useLoad(() => api<OrderDetailDto>(`orders/${id}`), [id]);
  const [method, setMethod] = useState<Exclude<PayChoice, "nanti">>("tunai");
  const [cash, setCash] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const paymentId = useRef(uuid()).current; // tetap sama walau tombol ditekan ulang

  const remaining = o ? o.total - o.paidTotal : 0;
  const needsConfirm = remaining > 0 && (method === "qris" || method === "debit");
  const notReady = o && o.status !== "selesai";
  const canSubmit = !!o && !notReady && (remaining === 0 || ((method !== "tunai" || cashOk(remaining, cash)) && (!needsConfirm || confirmed)));

  async function submit() {
    if (!o || !canSubmit) return;
    setSaving(true); setActionError(null);
    try {
      if (remaining > 0) {
        const cashNum = Number(cash || 0);
        await api(`orders/${o.id}/payments`, {
          method: "POST",
          json: { id: paymentId, method, amount: remaining, cashReceived: method === "tunai" ? (cashNum || remaining) : undefined },
        });
      }
      await api(`orders/${o.id}/pickup`, { method: "POST", json: {} });
      router.back();
    } catch (e) {
      setActionError(e instanceof RequestError ? e.message : "Gagal menyimpan. Coba lagi.");
      void reload();
    } finally { setSaving(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Ambil cucian" subtitle={o?.notaNumber} back />
      <Body>
        {error && <Banner tone="danger" text={error} action={{ label: "Coba lagi", onPress: reload }} />}
        {actionError && <Banner tone="danger" text={actionError} />}
        {!o ? (
          !error && <Skeleton height={120} />
        ) : (
          <>
            {notReady && <Banner tone="warning" text="Cucian ini belum ditandai selesai." />}
            <Card style={{ gap: sp(1) }}>
              <Txt variant="sm" color="text-muted">{o.customerName}</Txt>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Txt weight={600}>{remaining > 0 ? "Sisa tagihan" : "Tagihan"}</Txt>
                <Txt variant="xl" tabular>{remaining > 0 ? formatRupiah(remaining) : "Lunas"}</Txt>
              </View>
              {remaining > 0 && o.paidTotal > 0 && <Txt variant="sm" color="text-muted">Sudah dibayar {formatRupiah(o.paidTotal)} dari {formatRupiah(o.total)}</Txt>}
            </Card>
            {remaining > 0 && !notReady && (
              <>
                <PaymentPicker value={method} onChange={(m) => { setMethod(m as typeof method); setConfirmed(false); }} allowLater={false} />
                {method === "tunai" && <CashInput total={remaining} value={cash} onChange={setCash} />}
                {method === "qris" && <QrisImage amountLabel={formatRupiah(remaining)} />}
                {needsConfirm && (
                  <Checkbox checked={confirmed} onChange={setConfirmed} label={method === "qris" ? `Dana ${formatRupiah(remaining)} sudah masuk lewat QRIS` : `Pembayaran ${formatRupiah(remaining)} di mesin EDC berhasil`} />
                )}
              </>
            )}
          </>
        )}
      </Body>
      <ActionBar>
        <Button label={remaining > 0 ? "Terima pembayaran & serahkan" : "Serahkan cucian"} icon={Package} size="lg" loading={saving} disabled={!canSubmit} onPress={submit} style={{ flex: 1 }} />
      </ActionBar>
    </View>
  );
}
