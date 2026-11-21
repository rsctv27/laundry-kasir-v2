// PaymentMethodPicker + CashInput (S06, S10).
import { cashSuggestions, formatAngka, formatRupiah } from "@lk/shared";
import { Banknote, Clock, CreditCard, PiggyBank, QrCode, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/theme.gen";
import { c, Field, sp, Txt } from "./ui";

export type PayChoice = "tunai" | "nanti" | "qris" | "debit";
const OPTIONS: Array<{ key: PayChoice | "deposit"; label: string; icon: LucideIcon }> = [
  { key: "tunai", label: "Tunai", icon: Banknote },
  { key: "nanti", label: "Bayar saat ambil", icon: Clock },
  { key: "qris", label: "QRIS", icon: QrCode },
  { key: "debit", label: "Debit / EDC", icon: CreditCard },
  { key: "deposit", label: "Deposit", icon: PiggyBank },
];

export function PaymentPicker({ value, onChange, allowLater = true }: { value: PayChoice; onChange: (v: PayChoice) => void; allowLater?: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Cara bayar" style={{ gap: sp(2) }}>
      {OPTIONS.filter((o) => allowLater || o.key !== "nanti").map((o) => {
        const off = o.key === "deposit";
        const on = o.key === value;
        const Icon = o.icon;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: off }}
            accessibilityLabel={off ? `${o.label}, belum tersedia` : o.label}
            disabled={off}
            onPress={() => onChange(o.key as PayChoice)}
            style={[st.opt, on && st.optOn, off && { backgroundColor: c.surface }]}
          >
            <View style={[st.radio, on && st.radioOn]} />
            <Icon size={20} color={off ? c["text-muted"] : c.text} />
            <Txt weight={on ? 600 : 500} color={off ? "text-muted" : "text"} style={{ flex: 1 }}>{o.label}</Txt>
            {off && <Txt variant="sm" color="text-muted">Segera</Txt>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Uang diterima (teks, hanya angka) -> kembalian. */
export function CashInput({ total, value, onChange }: { total: number; value: string; onChange: (v: string) => void }) {
  const cash = Number(value.replace(/\D/g, "") || 0);
  const short = cash > 0 && cash < total;
  return (
    <View style={{ gap: sp(3) }}>
      <Field
        label="Uang diterima"
        prefix="Rp"
        keyboardType="number-pad"
        value={cash ? formatAngka(cash) : ""}
        onChangeText={(t) => onChange(t.replace(/\D/g, ""))}
        error={short ? `Uang kurang ${formatRupiah(total - cash)}` : undefined}
        placeholder={formatAngka(total)}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp(2) }}>
        {cashSuggestions(total).map((v) => {
          const on = cash === v;
          return (
            <Pressable key={v} accessibilityRole="button" accessibilityLabel={v === total ? "Uang pas" : formatRupiah(v)} onPress={() => onChange(String(v))} style={[st.chip, on && st.chipOn]}>
              <Txt variant="sm" weight={500} tabular>{v === total ? "Uang pas" : formatAngka(v)}</Txt>
            </Pressable>
          );
        })}
      </View>
      {cash >= total && (
        <View style={st.change} accessible accessibilityLabel={`Kembalian ${formatRupiah(cash - total)}`}>
          <Txt weight={600} color="success">Kembalian</Txt>
          <Txt variant="xl" color="success" tabular>{formatRupiah(cash - total)}</Txt>
        </View>
      )}
    </View>
  );
}

export function cashOk(total: number, value: string) {
  const cash = Number(value.replace(/\D/g, "") || 0);
  return cash === 0 || cash >= total; // kosong = dianggap uang pas
}

const st = StyleSheet.create({
  opt: { height: theme.control.lg, flexDirection: "row", alignItems: "center", gap: sp(3), paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, backgroundColor: c["surface-raised"] },
  optOn: { borderWidth: 2, borderColor: c.accent, paddingHorizontal: 13, backgroundColor: c["accent-soft"] },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c["border-input"] },
  radioOn: { borderWidth: 6, borderColor: c.accent },
  chip: { height: 40, paddingHorizontal: sp(3), borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c["surface-raised"], justifyContent: "center" },
  chipOn: { borderColor: c.accent, backgroundColor: c["accent-soft"] },
  change: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: sp(3), paddingHorizontal: 14, borderRadius: theme.radius.md, backgroundColor: c["success-soft"] },
});
