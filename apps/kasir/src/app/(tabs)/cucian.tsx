// S08: daftar cucian per status dengan pencarian.
import type { OrderStatus, OrderSummaryDto } from "@lk/shared";
import { Search, Shirt } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { OrderRow } from "@/components/order-row";
import { AppHeader } from "@/components/screen";
import { Banner, c, EmptyState, Field, Skeleton, sp, Txt } from "@/components/ui";
import { api } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { useLoad } from "@/lib/use-load";
import { useSession } from "@/lib/session";
import { theme } from "@/theme.gen";

type Tab = "semua" | OrderStatus;
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "semua", label: "Semua" },
  { key: "baru", label: "Baru" },
  { key: "diproses", label: "Diproses" },
  { key: "selesai", label: "Belum diambil" },
  { key: "diambil", label: "Diambil" },
];
type ListRes = { orders: OrderSummaryDto[]; nextCursor: string | null; counts: Partial<Record<OrderStatus, number>> };

export default function Cucian() {
  const { me } = useSession();
  const m = useLayout().max("list");
  const limit = m ? { maxWidth: m, width: "100%" as const, alignSelf: "center" as const } : null;
  const tz = me?.outlet?.timezone ?? "Asia/Jakarta";
  const [tab, setTab] = useState<Tab>("semua");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [more, setMore] = useState<{ orders: OrderSummaryDto[]; cursor: string | null; loading: boolean }>({ orders: [], cursor: null, loading: false });

  const { data, error, loading, reload } = useLoad(async () => {
    const r = await api<ListRes>(`orders?status=${tab}&q=${encodeURIComponent(query)}&limit=30`);
    setMore({ orders: [], cursor: r.nextCursor, loading: false });
    return r;
  }, [tab, query]);

  const all = [...(data?.orders ?? []), ...more.orders];
  const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const count = (t: Tab) => (t === "semua" ? total : data?.counts[t] ?? 0);

  async function loadMore() {
    if (!more.cursor || more.loading) return;
    setMore((m) => ({ ...m, loading: true }));
    try {
      const r = await api<ListRes>(`orders?status=${tab}&q=${encodeURIComponent(query)}&limit=30&cursor=${more.cursor}`);
      setMore((m) => ({ orders: [...m.orders, ...r.orders], cursor: r.nextCursor, loading: false }));
    } catch { setMore((m) => ({ ...m, loading: false })); }
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Cucian" />
      <View style={st.searchWrap}><View style={limit}>
        <Field
          label="Cari nota atau nama pelanggan"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setQuery(q.trim())}
          onBlur={() => setQuery(q.trim())}
          returnKeyType="search"
          autoCapitalize="none"
          placeholder="Contoh: MLG1-261121 atau Sari"
        />
      </View></View>
      <View style={st.tabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={[{ paddingHorizontal: sp(2) }, limit]}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(t.key)} style={[st.tab, on && st.tabOn]}>
                <Txt weight={on ? 600 : 500} color={on ? "text" : "text-muted"}>{t.label}</Txt>
                <View style={[st.count, on && { backgroundColor: c.accent }]}>
                  <Txt variant="xs" weight={600} color={on ? "on-accent" : "text-muted"} tabular>{count(t.key)}</Txt>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {error && <Banner tone="danger" text={error} action={{ label: "Coba lagi", onPress: reload }} />}
      {!data && loading ? (
        <View style={{ padding: sp(4), gap: sp(4) }}>{[0, 1, 2].map((i) => <View key={i} style={{ gap: sp(2) }}><Skeleton width="40%" /><Skeleton width="80%" /></View>)}</View>
      ) : (
        <FlatList
          data={all}
          keyExtractor={(o) => o.id}
          renderItem={({ item, index }) => <OrderRow o={item} tz={tz} last={index === all.length - 1} />}
          refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          style={{ backgroundColor: c.surface }}
          contentContainerStyle={limit}
          ListEmptyComponent={
            query ? (
              <EmptyState icon={Search} title={`Tidak ada hasil untuk "${query}"`} text="Coba nomor nota lain atau sebagian nama pelanggan." />
            ) : (
              <EmptyState icon={Shirt} title={tab === "semua" ? "Belum ada cucian" : `Tidak ada cucian berstatus "${TABS.find((t) => t.key === tab)?.label}"`} />
            )
          }
          ListFooterComponent={more.loading ? <View style={{ padding: sp(4) }}><Skeleton width="60%" /></View> : undefined}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  searchWrap: { paddingHorizontal: sp(4), paddingTop: sp(3), paddingBottom: sp(2), backgroundColor: c["surface-raised"] },
  tabsBar: { backgroundColor: c["surface-raised"], borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { height: theme.control.md, paddingHorizontal: sp(3), flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabOn: { borderBottomColor: c.accent },
  count: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 1, borderRadius: theme.radius.pill, backgroundColor: c.surface, alignItems: "center" },
});
