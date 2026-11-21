// BottomNav kasir: Beranda · Cucian · Kas · Lainnya (ikon + label selalu tampil).
import { Redirect, Tabs } from "expo-router";
import { Ellipsis, House, Shirt, Wallet } from "lucide-react-native";
import { c } from "@/components/ui";
import { useSession } from "@/lib/session";
import { theme } from "@/theme.gen";

export default function TabsLayout() {
  const { status } = useSession();
  if (status === "signedOut") return <Redirect href="/masuk" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c["text-muted"],
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: theme.type.xs.size },
        tabBarStyle: { backgroundColor: c["surface-raised"], borderTopColor: c.border, minHeight: theme.layout.kasir.bottom_nav },
        sceneStyle: { backgroundColor: c.surface },
      }}
    >
      <Tabs.Screen name="beranda" options={{ title: "Beranda", tabBarIcon: ({ color }) => <House size={22} color={color} /> }} />
      <Tabs.Screen name="cucian" options={{ title: "Cucian", tabBarIcon: ({ color }) => <Shirt size={22} color={color} /> }} />
      <Tabs.Screen name="kas" options={{ title: "Kas", tabBarIcon: ({ color }) => <Wallet size={22} color={color} /> }} />
      <Tabs.Screen name="lainnya" options={{ title: "Lainnya", tabBarIcon: ({ color }) => <Ellipsis size={22} color={color} /> }} />
    </Tabs>
  );
}
