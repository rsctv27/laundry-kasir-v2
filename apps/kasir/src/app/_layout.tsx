import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { c } from "@/components/ui";
import { DraftProvider } from "@/lib/draft";
import { SessionProvider } from "@/lib/session";

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.surface }} />;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <DraftProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.surface } }} />
        </DraftProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
