// S05: pilih layanan dan isi berat / jumlah.
import { formatQtyNumber, formatRupiah, toHundredths, type ServiceDto } from "@lk/shared";
import { Redirect, router } from "expo-router";
import { Check, Clock, Minus, Plus, Shirt } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppHeader, ActionBar, Body } from "@/components/screen";
import { Banner, Button, c, Card, EmptyState, IconButton, noOutline, Skeleton, sp, Txt } from "@/components/ui";
import { api } from "@/lib/api";
import { safeLineTotal, useDraft, type DraftLine } from "@/lib/draft";
import { useContentWidth } from "@/lib/layout";
import { useLoad } from "@/lib/use-load";
import { theme } from "@/theme.gen";

const duration = (h: number) => (h % 24 === 0 ? `${h / 24} hari` : `${h} jam`);

export default function Layanan() {
  const draft = useDraft();
  const { data, error, loading, reload } = useLoad(() => api<{ services: ServiceDto[] }>("services"));
  // 2 kolom di HP, 3 di tablet, 4 di layar lebar.
  const inner = useContentWidth("list") - theme.space[4] * 2;
  const cols = inner >= 720 ? 4 : inner >= 480 ? 3 : 2;
  const cardW = Math.floor((inner - theme.space[2] * (cols - 1)) / cols);
  if (!draft.customer) return <Redirect href="/transaksi/pelanggan" />;

  const selected = (id: string) => draft.lines.some((l) => l.service.id === id);
  const ready = draft.lines.length > 0 && draft.validLines.length === draft.lines.length;

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Layanan" subtitle="Langkah 2 dari 3" back />
      <Body width="list">
        <Card style={st.cust}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight={600} numberOfLines={1}>{draft.customer.name}</Txt>
            <Txt variant="sm" color="text-muted">{draft.customer.orderCount} order sebelumnya</Txt>
          </View>
          <Button label="Ganti" variant="ghost" onPress={() => router.back()} />
        </Card>
        {error && <Banner tone="danger" text={error} action={{ label: "Coba lagi", onPress: reload }} />}
        {!data && loading ? (
          <View style={st.grid}>{[0, 1, 2, 3].map((i) => <View key={i} style={[st.svc, { gap: sp(2), width: cardW }]}><Skeleton width="70%" /><Skeleton width="50%" /></View>)}</View>
        ) : data && data.services.length === 0 ? (
          <Card><EmptyState icon={Shirt} title="Belum ada layanan" text="Minta pemilik menambahkan layanan dan harga di web pemilik." /></Card>
        ) : (
          <View style={st.grid}>
            {data?.services.map((s) => {
              const on = selected(s.id);
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${s.name}, ${formatRupiah(s.price)} per ${s.pricingUnit}, ${duration(s.durationHours)}`}
                  onPress={() => draft.toggleService(s)}
                  style={[st.svc, { width: cardW }, on && st.svcOn]}
                >
                  {on && <View style={st.tick}><Check size={14} color={c["on-accent"]} /></View>}
                  <Txt weight={600} style={{ paddingRight: sp(6) }} numberOfLines={2}>{s.name}</Txt>
                  <Txt variant="sm" tabular>{formatRupiah(s.price)} / {s.pricingUnit}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Clock size={12} color={c["text-muted"]} /><Txt variant="xs" color="text-muted">{duration(s.durationHours)}</Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {draft.lines.length > 0 && (
          <Card style={{ paddingVertical: sp(1) }}>
            {draft.lines.map((l, i) => <QtyRow key={l.service.id} line={l} last={i === draft.lines.length - 1} onChange={(q) => draft.setQty(l.service.id, q)} />)}
          </Card>
        )}
      </Body>
      <ActionBar width="list">
        <View style={{ flex: 1 }}>
          <Txt variant="xs" color="text-muted">{draft.lines.length} layanan</Txt>
          <Txt variant="lg" tabular>{formatRupiah(draft.total)}</Txt>
        </View>
        <Button label="Lanjut" size="lg" disabled={!ready} onPress={() => router.push("/transaksi/bayar")} />
      </ActionBar>
    </View>
  );
}

function QtyRow({ line, last, onChange }: { line: DraftLine; last: boolean; onChange: (q: string) => void }) {
  const kg = line.service.pricingUnit === "kg";
  let h = 0;
  try { h = toHundredths(line.qty); } catch { h = 0; }
  const step = kg ? 50 : 100;
  const min = kg ? 50 : 100;
  const set = (v: number) => onChange(formatQtyNumber(v / 100));
  const invalid = safeLineTotal(line) === 0 || (!kg && !/^\d+$/.test(line.qty));
  return (
    <View style={[st.qtyRow, !last && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={600} numberOfLines={2}>{line.service.name}</Txt>
        <Txt variant="xs" color={invalid ? "danger" : "text-muted"}>{invalid ? (kg ? "Isi berat, misalnya 3,25" : "Isi jumlah bulat") : kg ? "Berat (kg)" : "Jumlah"}</Txt>
      </View>
      <View style={st.stepper}>
        <IconButton icon={Minus} label={kg ? "Kurangi 0,5 kg" : "Kurangi 1"} variant="secondary" disabled={h <= min} onPress={() => set(Math.max(min, h - step))} />
        <View style={st.qtyBox}>
          <TextInput
            accessibilityLabel={kg ? `Berat ${line.service.name} dalam kilogram` : `Jumlah ${line.service.name}`}
            value={line.qty}
            onChangeText={(t) => onChange(kg ? t.replace(/[^\d,]/g, "").replace(/(,.*?),/g, "$1") : t.replace(/\D/g, ""))}
            keyboardType={kg ? "decimal-pad" : "number-pad"}
            selectTextOnFocus
            maxLength={7}
            style={st.qtyInput}
          />
          <Txt variant="sm" weight={500} color="text-muted">{kg ? "kg" : "pcs"}</Txt>
        </View>
        <IconButton icon={Plus} label={kg ? "Tambah 0,5 kg" : "Tambah 1"} variant="secondary" onPress={() => set(h - (h % step) + step)} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  cust: { flexDirection: "row", alignItems: "center", gap: sp(3), paddingVertical: sp(2) },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: sp(2) },
  svc: { minHeight: 88, backgroundColor: c["surface-raised"], borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.lg, padding: sp(3), gap: 2 },
  svcOn: { borderWidth: 2, borderColor: c.accent, padding: sp(3) - 1, backgroundColor: c["accent-soft"] },
  tick: { position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: sp(3), paddingVertical: sp(3) },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBox: { width: 92, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  qtyInput: { width: 56, minWidth: 0, textAlign: "right", fontFamily: "Inter_600SemiBold", fontSize: theme.type.lg.size, color: c.text, fontVariant: ["tabular-nums"], paddingVertical: 0, borderBottomWidth: 2, borderBottomColor: c["border-input"], ...noOutline },
});
