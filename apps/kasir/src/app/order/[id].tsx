// S09: detail order, ubah status, menuju pengambilan.
import {
  formatDateTime, formatQty, formatRupiah, formatWa, nextStatus, STATUS_LABEL, waLink, type OrderDetailDto,
} from "@lk/shared";
import { router, useLocalSearchParams } from "expo-router";
import { MessageCircle, Package, Play, Receipt, CheckCheck } from "lucide-react-native";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { ActionBar, AppHeader, Body } from "@/components/screen";
import { Badge, Banner, Button, c, Card, Skeleton, sp, Txt } from "@/components/ui";
import { api, RequestError } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { useSession } from "@/lib/session";

const METHOD: Record<string, string> = { tunai: "Tunai", qris: "QRIS", debit: "Debit", ewallet: "E-wallet", deposit: "Deposit" };
const PAY_LABEL = { lunas: "Lunas", sebagian: "Bayar sebagian", belum_bayar: "Belum bayar" } as const;

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const tz = me?.outlet?.timezone ?? "Asia/Jakarta";
  const { data: o, error, reload, setData } = useLoad(() => api<OrderDetailDto>(`orders/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function advance() {
    if (!o) return;
    const to = nextStatus(o.status);
    if (!to) return;
    setBusy(true); setActionError(null);
    try { setData(await api<OrderDetailDto>(`orders/${o.id}/status`, { method: "POST", json: { to } })); }
    catch (e) { setActionError(e instanceof RequestError ? e.message : "Gagal mengubah status."); }
    finally { setBusy(false); }
  }

  async function notifyReady() {
    if (!o?.customerPhoneWa) return;
    const text = `Halo ${o.customerName}, cucian Anda dengan nota ${o.notaNumber} sudah selesai dan siap diambil.` +
      (o.total - o.paidTotal > 0 ? ` Sisa pembayaran ${formatRupiah(o.total - o.paidTotal)}.` : "") + `\n\nCek status: ${o.trackingUrl}`;
    await Linking.openURL(waLink(o.customerPhoneWa, text));
    api(`orders/${o.id}/messages`, { method: "POST", json: { template: "siap_diambil" } }).catch(() => {});
  }

  const remaining = o ? o.total - o.paidTotal : 0;
  const next = o ? nextStatus(o.status) : null;

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title={o?.notaNumber ?? "Nota"} subtitle={o ? `Masuk ${formatDateTime(o.receivedAt, tz)}` : undefined} back actions={o ? [{ icon: Receipt, label: "Lihat nota", onPress: () => router.push(`/nota/${o.id}`) }] : []} />
      <Body>
        {error && <Banner tone="danger" text={error} action={{ label: "Coba lagi", onPress: reload }} />}
        {actionError && <Banner tone="danger" text={actionError} />}
        {!o ? (
          !error && <View style={{ gap: sp(3) }}><Skeleton width="60%" height={20} /><Skeleton height={120} /><Skeleton height={80} /></View>
        ) : (
          <>
            <Card style={{ gap: sp(2) }}>
              <View style={st.between}>
                <Txt variant="lg" numberOfLines={1} style={{ flex: 1 }}>{o.customerName}</Txt>
                <Badge label={STATUS_LABEL[o.status]} tone={o.status} />
              </View>
              {o.customerPhoneWa && <Txt variant="sm" color="text-muted" tabular>{formatWa(o.customerPhoneWa)}</Txt>}
              {o.dueAt && o.status !== "diambil" && o.status !== "batal" && <Txt variant="sm" color="text-muted">Perkiraan selesai {formatDateTime(o.dueAt, tz)}</Txt>}
              {o.notes && <Txt variant="sm">Catatan: {o.notes}</Txt>}
            </Card>

            <Card style={{ gap: sp(2) }}>
              {o.lines.map((l, i) => (
                <View key={i} style={st.between}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="sm">{l.serviceName}</Txt>
                    <Txt variant="sm" color="text-muted" tabular>{formatQty(l.qty, l.unit)} × {formatRupiah(l.unitPrice)}</Txt>
                  </View>
                  <Txt variant="sm" tabular>{formatRupiah(l.lineTotal)}</Txt>
                </View>
              ))}
              <View style={st.divider} />
              <View style={st.between}><Txt weight={600}>Total</Txt><Txt variant="lg" tabular>{formatRupiah(o.total)}</Txt></View>
              <View style={st.between}>
                <Badge label={PAY_LABEL[o.paymentStatus]} tone={o.paymentStatus} />
                {remaining > 0 && <Txt weight={600} tabular>Sisa {formatRupiah(remaining)}</Txt>}
              </View>
              {o.payments.map((p) => (
                <View key={p.id} style={st.between}>
                  <Txt variant="sm" color="text-muted">{METHOD[p.method] ?? p.method} · {formatDateTime(p.paidAt, tz)}</Txt>
                  <Txt variant="sm" color="text-muted" tabular>{formatRupiah(p.amount)}</Txt>
                </View>
              ))}
            </Card>

            <Card style={{ gap: sp(2) }}>
              <Txt weight={600}>Riwayat</Txt>
              {o.events.map((e, i) => (
                <View key={i} style={st.between}>
                  <Txt variant="sm">{STATUS_LABEL[e.to]}{e.by ? ` · ${e.by}` : ""}{e.note ? ` · ${e.note}` : ""}</Txt>
                  <Txt variant="sm" color="text-muted" tabular>{formatDateTime(e.at, tz)}</Txt>
                </View>
              ))}
            </Card>

            {o.status === "selesai" && o.customerPhoneWa && (
              <Button label="Kabari pelanggan lewat WA" icon={MessageCircle} variant="secondary" onPress={notifyReady} />
            )}
          </>
        )}
      </Body>
      {o && (o.status === "baru" || o.status === "diproses" || o.status === "selesai") && (
        <ActionBar>
          {next ? (
            <Button
              label={o.status === "baru" ? "Mulai proses" : "Tandai selesai"}
              icon={o.status === "baru" ? Play : CheckCheck}
              size="lg"
              loading={busy}
              onPress={advance}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              label={remaining > 0 ? "Lunasi & serahkan" : "Serahkan cucian"}
              icon={Package}
              size="lg"
              onPress={() => router.push(`/order/ambil/${o.id}`)}
              style={{ flex: 1 }}
            />
          )}
        </ActionBar>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: sp(3) },
  divider: { height: 1, backgroundColor: c.border, marginVertical: sp(1) },
});
