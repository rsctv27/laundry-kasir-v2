// S11 + S12: statistik harian, pengeluaran, dan nota belum lunas.
import {
  EXPENSE_CATEGORIES, EXPENSE_LABEL, formatAngka, formatDay, formatQtyNumber, formatRupiah, localDate,
  type DailyStatsDto, type ExpenseCategory, type ExpenseDto,
} from "@lk/shared";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Receipt, Trash2, Wallet } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { OrderRow } from "@/components/order-row";
import { AppHeader, Body } from "@/components/screen";
import { Banner, Button, c, Card, EmptyState, Field, IconButton, SectionTitle, Skeleton, sp, Txt } from "@/components/ui";
import { api, RequestError } from "@/lib/api";
import { useLayout } from "@/lib/layout";
import { useLoad } from "@/lib/use-load";
import { useSession } from "@/lib/session";
import { uuid } from "@/lib/uuid";
import { theme } from "@/theme.gen";

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const METHOD_LABEL: Record<string, string> = { tunai: "Tunai", qris: "QRIS", debit: "Debit / EDC", ewallet: "E-wallet" };

export default function Kas() {
  const { me } = useSession();
  const tz = me?.outlet?.timezone ?? "Asia/Jakarta";
  const today = localDate(new Date(), tz);
  const [day, setDay] = useState(today);
  const { medium } = useLayout();
  const stats = useLoad(() => api<DailyStatsDto>(`stats/daily?date=${day}`), [day]);
  const exp = useLoad(() => api<{ expenses: ExpenseDto[]; total: number }>(`expenses?date=${day}`), [day]);
  const [adding, setAdding] = useState(false);
  const s = stats.data;
  const isToday = day === today;
  const label = isToday ? "Hari ini" : day === shift(today, -1) ? "Kemarin" : formatDay(`${day}T05:00:00Z`, tz);

  const summaryText = useMemo(() => {
    if (!s || !me) return "";
    const lines = [
      `Ringkasan ${me.outlet?.name ?? ""} · ${formatDay(`${day}T05:00:00Z`, tz)}`,
      `Nota masuk: ${s.notaMasuk} (omzet ${formatRupiah(s.omzet)})`,
      `Nota diambil: ${s.notaDiambil}`,
      `Berat: ${formatQtyNumber(s.totalKg)} kg · ${s.totalPcs} pcs`,
      `Uang masuk: ${formatRupiah(s.kasMasuk)}`,
      ...Object.entries(METHOD_LABEL).filter(([k]) => s.kasPerMetode[k as keyof typeof s.kasPerMetode] > 0)
        .map(([k, l]) => `  - ${l}: ${formatRupiah(s.kasPerMetode[k as keyof typeof s.kasPerMetode])}`),
      `Pengeluaran: ${formatRupiah(s.pengeluaran)}`,
      `Perkiraan tunai di laci: ${formatRupiah(s.tunaiDiLaci)}`,
      `Belum lunas: ${s.piutang.count} nota (${formatRupiah(s.piutang.amount)})`,
      `Dicatat oleh ${me.staff.name}`,
    ];
    return lines.join("\n");
  }, [s, me, day, tz]);

  const reload = () => { void stats.reload(); void exp.reload(); };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Kas" subtitle={me?.outlet?.name} />
      <View style={st.dayBar}>
        <IconButton icon={ChevronLeft} label="Hari sebelumnya" onPress={() => setDay(shift(day, -1))} />
        <Txt weight={600} style={{ minWidth: 140, textAlign: "center" }} accessibilityLiveRegion="polite">{label}</Txt>
        <IconButton icon={ChevronRight} label="Hari berikutnya" disabled={isToday} onPress={() => setDay(shift(day, 1))} />
      </View>
      <Body>
        {(stats.error || exp.error) && <Banner tone="danger" text={stats.error ?? exp.error ?? ""} action={{ label: "Coba lagi", onPress: reload }} />}

        <Card style={{ gap: sp(1) }}>
          <Txt variant="sm" color="text-muted">Uang masuk</Txt>
          {s ? <Txt variant="display" tabular accessibilityLabel={`Uang masuk ${formatRupiah(s.kasMasuk)}`}>{formatRupiah(s.kasMasuk)}</Txt> : <Skeleton width={180} height={40} />}
          {s && (
            <View style={{ gap: 4, marginTop: sp(2) }}>
              {Object.entries(METHOD_LABEL).map(([k, l]) => {
                const v = s.kasPerMetode[k as keyof typeof s.kasPerMetode] ?? 0;
                return (
                  <View key={k} style={st.between}>
                    <Txt variant="sm" color={v > 0 ? "text" : "text-muted"}>{l}</Txt>
                    <Txt variant="sm" tabular color={v > 0 ? "text" : "text-muted"}>{formatRupiah(v)}</Txt>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <View style={[st.grid, medium && { flexWrap: "nowrap" }]}>
          {(
            [
              ["Nota masuk", s ? String(s.notaMasuk) : null, s && s.batal > 0 ? `${s.batal} batal` : undefined],
              ["Omzet", s ? formatRupiah(s.omzet) : null, undefined],
              ["Nota diambil", s ? String(s.notaDiambil) : null, undefined],
              ["Berat cucian", s ? `${formatQtyNumber(s.totalKg)} kg` : null, s && s.totalPcs > 0 ? `+ ${s.totalPcs} pcs` : undefined],
            ] as const
          ).map(([l, v, sub]) => (
            <View key={l} style={[st.stat, { flexBasis: medium ? 0 : "47%" }]} accessible accessibilityLabel={`${l}: ${v ?? "memuat"}`}>
              <Txt variant="xs" color="text-muted" numberOfLines={1}>{l}</Txt>
              {v === null ? <Skeleton width={60} height={24} style={{ marginTop: 6 }} /> : <Txt variant="lg" tabular numberOfLines={1} style={{ marginTop: 4 }}>{v}</Txt>}
              {sub && <Txt variant="xs" color="text-muted">{sub}</Txt>}
            </View>
          ))}
        </View>

        {s && (
          <View style={st.drawer} accessible accessibilityLabel={`Perkiraan uang tunai di laci ${formatRupiah(s.tunaiDiLaci)}`}>
            <View style={{ flex: 1 }}>
              <Txt weight={600} color="success">Perkiraan tunai di laci</Txt>
              <Txt variant="xs" color="success">Tunai masuk {formatRupiah(s.kasPerMetode.tunai)} − pengeluaran {formatRupiah(s.pengeluaran)}</Txt>
            </View>
            <Txt variant="xl" color="success" tabular>{formatRupiah(s.tunaiDiLaci)}</Txt>
          </View>
        )}

        {s && (
          <Button
            label="Kirim ringkasan ke pemilik"
            icon={MessageCircle}
            variant="secondary"
            onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(summaryText)}`)}
          />
        )}

        <View style={st.between}>
          <SectionTitle>Pengeluaran</SectionTitle>
          {exp.data && <Txt weight={600} tabular>{formatRupiah(exp.data.total)}</Txt>}
        </View>
        {adding ? (
          <ExpenseForm day={day} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />
        ) : (
          <Button label="Catat pengeluaran" icon={Plus} variant="secondary" onPress={() => setAdding(true)} disabled={day < shift(today, -1) && me?.staff.role === "kasir"} />
        )}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {!exp.data && exp.loading ? (
            <View style={{ padding: sp(4), gap: sp(3) }}><Skeleton width="60%" /><Skeleton width="40%" /></View>
          ) : exp.data && exp.data.expenses.length === 0 ? (
            <EmptyState icon={Wallet} title="Belum ada pengeluaran" text={isToday ? "Catat pembelian sabun, gas, atau biaya lain hari ini." : "Tidak ada pengeluaran di hari ini."} />
          ) : (
            exp.data?.expenses.map((e, i) => <ExpenseRow key={e.id} e={e} last={i === exp.data!.expenses.length - 1} onDeleted={reload} />)
          )}
        </Card>

        <View style={st.between}>
          <SectionTitle>Belum lunas</SectionTitle>
          {s && <Txt weight={600} tabular>{s.piutang.count} nota · {formatRupiah(s.piutang.amount)}</Txt>}
        </View>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {s && s.piutang.orders.length === 0 ? (
            <EmptyState icon={Receipt} title="Semua nota sudah lunas" />
          ) : (
            s?.piutang.orders.map((o, i) => <OrderRow key={o.id} o={o} tz={tz} last={i === s.piutang.orders.length - 1} />)
          )}
        </Card>
      </Body>
    </View>
  );
}

function ExpenseForm({ day, onCancel, onSaved }: { day: string; onCancel: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<ExpenseCategory>("bahan");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [id] = useState(uuid); // tetap sama kalau tombol simpan ditekan ulang
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const n = Number(amount || 0);

  async function save() {
    setSaving(true); setError(null); setFields({});
    try {
      await api("expenses", { method: "POST", json: { id, category, amount: n, note: note.trim() || undefined, spentOn: day } });
      onSaved();
    } catch (e) {
      if (e instanceof RequestError) { setError(e.message); setFields(e.fields); } else setError("Gagal menyimpan.");
    } finally { setSaving(false); }
  }

  return (
    <Card style={{ gap: sp(4) }}>
      {error && <Banner tone="danger" text={error} />}
      <View style={{ gap: sp(2) }}>
        <Txt variant="sm" weight={500}>Jenis pengeluaran</Txt>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: sp(2) }}>
          {EXPENSE_CATEGORIES.map((k) => {
            const on = k === category;
            return (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setCategory(k)} style={[st.chip, on && st.chipOn]}>
                <Txt variant="sm" weight={on ? 600 : 500}>{EXPENSE_LABEL[k]}</Txt>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Field label="Nominal" prefix="Rp" keyboardType="number-pad" value={n ? formatAngka(n) : ""} onChangeText={(t) => setAmount(t.replace(/\D/g, ""))} error={fields.amount} />
      <Field label="Catatan (opsional)" value={note} onChangeText={setNote} placeholder="Contoh: deterjen 5 liter" />
      <View style={{ flexDirection: "row", gap: sp(2) }}>
        <Button label="Batal" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Simpan" onPress={save} loading={saving} disabled={n <= 0} style={{ flex: 2 }} />
      </View>
    </Card>
  );
}

function ExpenseRow({ e, last, onDeleted }: { e: ExpenseDto; last: boolean; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = EXPENSE_LABEL[e.category as ExpenseCategory] ?? e.category;
  async function del() {
    setBusy(true);
    try { await api(`expenses/${e.id}`, { method: "DELETE" }); onDeleted(); } catch { setBusy(false); setConfirm(false); }
  }
  return (
    <View style={[st.expRow, !last && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={500} numberOfLines={1}>{label}</Txt>
        <Txt variant="sm" color="text-muted" numberOfLines={1}>{[e.note, e.staffName].filter(Boolean).join(" · ")}</Txt>
      </View>
      <Txt weight={600} tabular>{formatRupiah(e.amount)}</Txt>
      {e.canDelete && (confirm ? (
        <Button label="Hapus" variant="danger" loading={busy} onPress={del} />
      ) : (
        <IconButton icon={Trash2} label={`Hapus pengeluaran ${label}`} onPress={() => setConfirm(true)} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  dayBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: sp(2), backgroundColor: c["surface-raised"], borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: sp(1) },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: sp(3) },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: sp(2) },
  stat: { flexGrow: 1, backgroundColor: c["surface-raised"], borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.lg, padding: sp(3) },
  drawer: { flexDirection: "row", alignItems: "center", gap: sp(3), padding: sp(4), borderRadius: theme.radius.lg, backgroundColor: c["success-soft"] },
  chip: { height: 40, paddingHorizontal: sp(3), borderRadius: theme.radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c["surface-raised"], justifyContent: "center" },
  chipOn: { borderColor: c.accent, backgroundColor: c["accent-soft"] },
  expRow: { flexDirection: "row", alignItems: "center", gap: sp(3), paddingHorizontal: sp(4), minHeight: 64, backgroundColor: c["surface-raised"] },
});
