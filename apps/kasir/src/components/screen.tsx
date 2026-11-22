// Kerangka layar: header 56px, area isi, bilah aksi bawah. Sesuai components.md (AppHeader, ActionBar).
import { router } from "expo-router";
import { ChevronLeft, type LucideIcon } from "lucide-react-native";
import { ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLayout, type Width } from "@/lib/layout";
import { theme } from "@/theme.gen";
import { c, IconButton, sp, Txt } from "./ui";

export function AppHeader({
  title, subtitle, back, actions,
}: { title: string; subtitle?: string; back?: boolean | (() => void); actions?: Array<{ icon: LucideIcon; label: string; onPress: () => void }> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.header, { paddingTop: insets.top, height: theme.layout.kasir.header + insets.top }]}>
      {back ? (
        <IconButton icon={ChevronLeft} label="Kembali" onPress={typeof back === "function" ? back : () => (router.canGoBack() ? router.back() : router.replace("/"))} />
      ) : (
        <View style={{ width: sp(2) }} />
      )}
      <View style={{ flex: 1, minWidth: 0, paddingLeft: back ? 0 : sp(2) }}>
        <Txt variant="lg" numberOfLines={1} accessibilityRole="header">{title}</Txt>
        {subtitle && <Txt variant="xs" color="text-muted" numberOfLines={1}>{subtitle}</Txt>}
      </View>
      {actions?.map((a) => <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />)}
    </View>
  );
}

/** Area isi. Di layar lebar, konten dibatasi lebarnya dan diletakkan di tengah. */
export function Body({ children, scroll = true, width = "content", ...rest }: ScrollViewProps & { scroll?: boolean; width?: Width }) {
  const { max } = useLayout();
  const m = max(width);
  const limit = m ? { maxWidth: m, width: "100%" as const, alignSelf: "center" as const } : null;
  if (!scroll) return <View style={[st.body, limit]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.surface }} contentContainerStyle={[st.bodyContent, limit]} keyboardShouldPersistTaps="handled" {...rest}>
      {children}
    </ScrollView>
  );
}

export function ActionBar({ children, width = "content" }: { children: React.ReactNode; width?: Width }) {
  const insets = useSafeAreaInsets();
  const m = useLayout().max(width);
  return (
    <View style={[st.actionWrap, { paddingBottom: insets.bottom, height: theme.layout.kasir.action_bar + insets.bottom }]}>
      <View style={[st.action, m ? { maxWidth: m, width: "100%", alignSelf: "center" } : null]}>{children}</View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: sp(1), paddingRight: sp(2), paddingLeft: sp(1), backgroundColor: c["surface-raised"], borderBottomWidth: 1, borderBottomColor: c.border },
  body: { flex: 1, backgroundColor: c.surface, padding: sp(4), gap: sp(4) },
  bodyContent: { padding: sp(4), gap: sp(4), paddingBottom: sp(8) },
  actionWrap: { backgroundColor: c["surface-raised"], borderTopWidth: 1, borderTopColor: c.border, justifyContent: "center" },
  action: { flex: 1, flexDirection: "row", alignItems: "center", gap: sp(3), paddingHorizontal: sp(4) },
});
