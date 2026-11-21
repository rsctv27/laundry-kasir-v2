// S11/S12 (kas & statistik harian) dibangun di Milestone 2. Sementara: layar penanda yang jujur.
import { Wallet } from "lucide-react-native";
import { View } from "react-native";
import { AppHeader, Body } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";

export default function Kas() {
  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Kas" />
      <Body>
        <Card>
          <EmptyState icon={Wallet} title="Catatan kas belum tersedia" text="Pencatatan pengeluaran dan ringkasan uang harian sedang dibangun." />
        </Card>
      </Body>
    </View>
  );
}
