// S03: beranda kasir.
import { formatDay, type HomeDto } from "@lk/shared";
import { router, useFocusEffect } from "expo-router";
import { Plus, Printer, Search, Shirt } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { OrderRow } from "@/components/order-row";
import { AppHeader, Body } from "@/components/screen";
import { Banner, Button, c, Card, EmptyState, SectionTitle, Skeleton, sp, Txt } from "@/components/ui";
import { api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useLoad } from "@/lib/use-load";
import { useSession } from "@/lib/session";
import { driver, loadPrinterSettings } from "@/printer";
import { theme } from "@/theme.gen";

export default function Beranda() {
  const { me } = useSession();
  const draft = useDraft();
  const { data, error, loading, reload } = useLoad(() => api<HomeDto>("home"));
  const [printerReady, setPrinterReady] = useState(true);
  const tz = me?.outlet?.timezone ?? "Asia/Jakarta";

  useFocusEffect(useCallback(() => {
    if (!driver.available) return;
    void loadPrinterSettings().then(async (s) => setPrinterReady(!!s.address && (await driver.isConnected(s.address))));
  }, []));

  const newTransaction = () => { draft.start(); router.push("/transaksi/pelanggan"); };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader
        title={me?.outlet?.name ?? "Kasir"}
        subtitle={`${formatDay(new Date(), tz)} · ${me?.staff.name ?? ""}`}
        actions={[{ icon: Search, label: "Cari nota", onPress: () => router.push("/cucian") }]}
      />
      {driver.available && !printerReady && (
        <Banner tone="warning" icon={Printer} text="Printer belum tersambung" action={{ label: "Sambungkan", onPress: () => router.push("/printer") }} />
      )}
      <Body refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}>
        <Button label="Buat transaksi" icon={Plus} size="lg" onPress={newTransaction} />
        {error && <Banner tone="danger" text={error} action={{ label: "Coba lagi", onPress: reload }} />}
        <View style={st.stats}>
          {(
            [["Baru masuk", data?.baru], ["Diproses", data?.diproses], ["Selesai hari ini", data?.selesaiHariIni]] as const
          ).map(([label, v]) => (
            <View key={label} style={st.stat} accessible accessibilityLabel={`${label}: ${v ?? "memuat"}`}>
              <Txt variant="xs" color="text-muted" numberOfLines={1}>{label}</Txt>
              {v === undefined ? <Skeleton width={32} height={28} style={{ marginTop: 6 }} /> : <Txt variant="xl" tabular style={{ marginTop: 4 }}>{v}</Txt>}
            </View>
          ))}
        </View>
        <SectionTitle>Transaksi terakhir</SectionTitle>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {!data && loading ? (
            <View style={{ padding: sp(4), gap: sp(3) }}><Skeleton width="40%" /><Skeleton width="85%" /><Skeleton width="60%" /></View>
          ) : data && data.recent.length === 0 ? (
            <EmptyState
              icon={Shirt}
              title="Belum ada cucian hari ini"
              text="Cucian yang diterima akan muncul di sini."
              action={<Button label="Buat transaksi" icon={Plus} onPress={newTransaction} style={{ marginTop: sp(2) }} />}
            />
          ) : (
            data?.recent.map((o, i) => <OrderRow key={o.id} o={o} tz={tz} last={i === data.recent.length - 1} />)
          )}
        </Card>
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  stats: { flexDirection: "row", gap: sp(2) },
  stat: { flex: 1, backgroundColor: c["surface-raised"], borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.lg, padding: sp(3) },
});
