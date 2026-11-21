// Menu lainnya: printer, akun, keluar.
import { router } from "expo-router";
import { ChevronRight, LogOut, Printer, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AppHeader, Body } from "@/components/screen";
import { c, Card, sp, Txt } from "@/components/ui";
import { useSession } from "@/lib/session";

const ROLE: Record<string, string> = { owner: "Pemilik", supervisor: "Supervisor", kasir: "Kasir", produksi: "Produksi", kurir: "Kurir" };

function Item({ icon: Icon, label, sub, onPress, danger }: { icon: LucideIcon; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [st.item, pressed && { backgroundColor: c["accent-soft"] }]}>
      <Icon size={22} color={danger ? c.danger : c.text} />
      <View style={{ flex: 1 }}>
        <Txt weight={500} color={danger ? "danger" : "text"}>{label}</Txt>
        {sub && <Txt variant="sm" color="text-muted">{sub}</Txt>}
      </View>
      {!danger && <ChevronRight size={20} color={c["text-muted"]} />}
    </Pressable>
  );
}

export default function Lainnya() {
  const { me, signOut } = useSession();
  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Lainnya" />
      <Body>
        <Card>
          <Txt weight={600}>{me?.staff.name}</Txt>
          <Txt variant="sm" color="text-muted">{ROLE[me?.staff.role ?? ""] ?? ""} · {me?.business.name} · {me?.outlet?.name}</Txt>
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Item icon={Printer} label="Printer" sub="Pilih printer, ukuran kertas, uji cetak" onPress={() => router.push("/printer")} />
          <View style={{ height: 1, backgroundColor: c.border }} />
          <Item icon={LogOut} label="Keluar" danger onPress={async () => { await signOut(); router.replace("/masuk"); }} />
        </Card>
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: sp(3), paddingHorizontal: sp(4), minHeight: 64, backgroundColor: c["surface-raised"] },
});
