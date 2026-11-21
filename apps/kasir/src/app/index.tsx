import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { c } from "@/components/ui";
import { useSession } from "@/lib/session";

export default function Index() {
  const { status } = useSession();
  if (status === "loading") {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.surface }}><ActivityIndicator color={c.accent} /></View>;
  }
  return <Redirect href={status === "signedIn" ? "/beranda" : "/masuk"} />;
}
