// S04: pilih pelanggan lama atau tambah baru.
import { formatWa, type CustomerDto } from "@lk/shared";
import { router } from "expo-router";
import { ChevronRight, UserPlus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, type TextInputInstance, View } from "react-native";
import { AppHeader, Body } from "@/components/screen";
import { Banner, Button, c, Card, Field, Skeleton, sp, Txt } from "@/components/ui";
import { api, RequestError } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { theme } from "@/theme.gen";

export default function Pelanggan() {
  const draft = useDraft();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const my = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ customers: CustomerDto[] }>(`customers?q=${encodeURIComponent(term)}`);
        if (my === seq.current) { setResults(r.customers); setError(null); }
      } catch (e) {
        if (my === seq.current) setError(e instanceof RequestError ? e.message : "Gagal mencari pelanggan.");
      } finally {
        if (my === seq.current) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const choose = (cu: CustomerDto) => { draft.setCustomer(cu); router.push("/transaksi/layanan"); };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Pelanggan" subtitle="Langkah 1 dari 3" back />
      <Body>
        {adding ? (
          <NewCustomer initial={q} onCancel={() => setAdding(false)} onCreated={choose} />
        ) : (
          <>
            <Field label="Cari nama atau nomor WhatsApp" value={q} onChangeText={setQ} autoFocus autoCapitalize="words" placeholder="Ketik minimal 2 huruf" returnKeyType="search" />
            {error && <Banner tone="danger" text={error} />}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {searching && !results ? (
                <View style={{ padding: sp(4), gap: sp(3) }}><Skeleton width="50%" /><Skeleton width="70%" /><Skeleton width="40%" /></View>
              ) : (
                <>
                  {results?.map((cu) => (
                    <Pressable key={cu.id} accessibilityRole="button" accessibilityLabel={`${cu.name}, ${cu.orderCount} order`} onPress={() => choose(cu)} style={({ pressed }) => [st.row, pressed && st.pressed]}>
                      <View style={st.avatar}><Txt weight={700}>{cu.name.replace(/^(bu|pak|mbak|mas|ibu|bapak)\s+/i, "").charAt(0).toUpperCase()}</Txt></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt weight={500} numberOfLines={1}>{cu.name}</Txt>
                        <Txt variant="sm" color="text-muted" tabular numberOfLines={1}>{cu.phoneWa ? formatWa(cu.phoneWa) : "Tanpa nomor WA"} · {cu.orderCount} order</Txt>
                      </View>
                      <ChevronRight size={20} color={c["text-muted"]} />
                    </Pressable>
                  ))}
                  {results && results.length === 0 && (
                    <View style={{ padding: sp(4) }}><Txt variant="sm" color="text-muted">Belum ada pelanggan dengan nama atau nomor itu.</Txt></View>
                  )}
                  <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={({ pressed }) => [st.row, pressed && st.pressed]}>
                    <View style={[st.avatar, { backgroundColor: c.surface }]}><UserPlus size={20} color={c.text} /></View>
                    <Txt weight={600} style={{ flex: 1 }} numberOfLines={1}>{q.trim() ? `Tambah pelanggan baru: "${q.trim()}"` : "Tambah pelanggan baru"}</Txt>
                  </Pressable>
                </>
              )}
            </Card>
          </>
        )}
      </Body>
    </View>
  );
}

function NewCustomer({ initial, onCancel, onCreated }: { initial: string; onCancel: () => void; onCreated: (c: CustomerDto) => void }) {
  const looksLikePhone = /^[\d\s+-]{4,}$/.test(initial.trim());
  const [name, setName] = useState(looksLikePhone ? "" : initial.trim());
  const [wa, setWa] = useState(looksLikePhone ? initial.trim() : "");
  const [address, setAddress] = useState("");
  const [birth, setBirth] = useState(""); // DD/MM/YYYY
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const waRef = useRef<TextInputInstance>(null);

  const birthIso = (() => {
    const m = birth.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1 || y < 1900 || dt.getTime() > Date.now()) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  })();
  const birthError = birth.trim() && !birthIso ? "Tulis seperti 17/04/1985" : undefined;

  async function save() {
    setSaving(true); setError(null); setFields({});
    try {
      const cu = await api<CustomerDto>("customers", {
        method: "POST",
        json: { name, phoneWa: wa || undefined, address: address || undefined, birthDate: birthIso ?? undefined },
      });
      onCreated(cu);
    } catch (e) {
      if (e instanceof RequestError) { setError(e.message); setFields(e.fields); } else setError("Gagal menyimpan pelanggan.");
    } finally { setSaving(false); }
  }

  return (
    <Card style={{ gap: sp(4) }}>
      <Txt variant="lg">Pelanggan baru</Txt>
      {error && <Banner tone="danger" text={error} />}
      <Field label="Nama" value={name} onChangeText={setName} autoFocus={!looksLikePhone} autoCapitalize="words" error={fields.name} returnKeyType="next" onSubmitEditing={() => waRef.current?.focus()} />
      <Field ref={waRef} label="Nomor WhatsApp" value={wa} onChangeText={setWa} keyboardType="phone-pad" autoFocus={looksLikePhone} error={fields.phoneWa} help="Untuk kirim nota dan kabar cucian. Boleh dikosongkan." />
      <Field label="Alamat (opsional)" value={address} onChangeText={setAddress} />
      <Field label="Tanggal lahir (opsional)" value={birth} onChangeText={setBirth} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" error={birthError ?? fields.birthDate} />
      <View style={{ flexDirection: "row", gap: sp(2) }}>
        <Button label="Batal" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Simpan & lanjut" onPress={save} loading={saving} disabled={name.trim().length < 1 || !!birthError} style={{ flex: 2 }} />
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: sp(3), paddingHorizontal: sp(3), minHeight: 64, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c["surface-raised"] },
  pressed: { backgroundColor: c["accent-soft"] },
  avatar: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: c["accent-soft"], alignItems: "center", justifyContent: "center" },
});
