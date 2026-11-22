// BottomNav kasir: Beranda · Cucian · Kas · Lainnya (ikon + label selalu tampil).
import { Redirect, Tabs } from "expo-router";
import { Ellipsis, House, Shirt, Wallet } from "lucide-react-native";
import { c } from "@/components/ui";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/lib/session";
import { theme } from "@/theme.gen";

export default function TabsLayout() {
  const { status } = useSession();
  const { wide } = useLayout();
  if (status === "signedOut") return <Redirect href="/masuk" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c["text-muted"],
        // Menu samping (layar lebar): item aktif diberi latar biru muda.
        tabBarActiveBackgroundColor: wide ? c["accent-soft"] : undefined,
        // HP: bilah bawah. Browser desktop / tablet lebar: menu samping dengan label di sebelah ikon.
        tabBarPosition: wide ? "left" : "bottom",
        tabBarVariant: wide ? "material" : "uikit",
        tabBarLabelPosition: wide ? "beside-icon" : "below-icon",
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: wide ? theme.type.base.size : theme.type.xs.size },
        tabBarStyle: wide
          ? { backgroundColor: c["surface-raised"], borderRightColor: c.border, borderRightWidth: 1, width: theme.layout.kasir.sidebar, minWidth: theme.layout.kasir.sidebar, maxWidth: theme.layout.kasir.sidebar, paddingTop: theme.space[6] }
          : { backgroundColor: c["surface-raised"], borderTopColor: c.border, minHeight: theme.layout.kasir.bottom_nav },
        tabBarItemStyle: wide ? { justifyContent: "flex-start", paddingHorizontal: theme.space[4], minHeight: theme.control.md, maxHeight: theme.control.lg } : undefined,
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
