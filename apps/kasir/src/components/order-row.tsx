import { formatDateTime, formatRupiah, STATUS_LABEL, type OrderSummaryDto, type OutletTimezone } from "@lk/shared";
import { router } from "expo-router";
import { Clock } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Badge, c, sp, Txt } from "./ui";

export function OrderRow({ o, tz, last }: { o: OrderSummaryDto; tz: OutletTimezone; last?: boolean }) {
  const remaining = o.total - o.paidTotal;
  const late = o.dueAt && (o.status === "baru" || o.status === "diproses") && new Date(o.dueAt).getTime() < Date.now();
  const cancelled = o.status === "batal";
  const label = `Nota ${o.notaNumber}, ${o.customerName}, ${STATUS_LABEL[o.status]}${remaining > 0 && !cancelled ? `, sisa ${formatRupiah(remaining)}` : ""}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(`/order/${o.id}`)}
      style={({ pressed }) => [st.row, !last && st.border, pressed && { backgroundColor: c["accent-soft"] }]}
    >
      <View style={st.top}>
        <Txt weight={600} numberOfLines={1} style={[{ flex: 1 }, cancelled && st.strike]}>{o.customerName}</Txt>
        <Badge label={STATUS_LABEL[o.status]} tone={o.status} />
      </View>
      <Txt variant="sm" color="text-muted" numberOfLines={1} style={cancelled && st.strike}>
        <Txt variant="sm" color="text-muted" mono>{o.notaNumber}</Txt> · {o.linesSummary}
      </Txt>
      <View style={st.bottom}>
        {late ? (
          <View style={st.late}><Clock size={14} color={c.danger} /><Txt variant="sm" weight={600} color="danger">Terlambat</Txt></View>
        ) : (
          <Txt variant="sm" color="text-muted" numberOfLines={1} style={{ flex: 1 }}>
            {o.status === "diambil" || cancelled ? formatDateTime(o.receivedAt, tz) : o.dueAt ? `Selesai ${formatDateTime(o.dueAt, tz)}` : ""}
          </Txt>
        )}
        {cancelled ? null : remaining > 0 ? (
          <Txt variant="sm" weight={600} tabular>Sisa {formatRupiah(remaining)}</Txt>
        ) : (
          <Txt variant="sm" color="text-muted">Lunas</Txt>
        )}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { paddingVertical: sp(3), paddingHorizontal: sp(4), minHeight: 72, gap: 2, backgroundColor: c["surface-raised"] },
  border: { borderBottomWidth: 1, borderBottomColor: c.border },
  top: { flexDirection: "row", alignItems: "center", gap: sp(2) },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: sp(2), marginTop: 4 },
  late: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  strike: { textDecorationLine: "line-through" },
});
