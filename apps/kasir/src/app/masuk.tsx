// S01: login kasir.
import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type TextInputInstance, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, Button, c, Field, sp, Txt } from "@/components/ui";
import { RequestError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { getItem, setItem } from "@/lib/storage";
import { theme } from "@/theme.gen";

export default function Masuk() {
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const userRef = useRef<TextInputInstance>(null);
  const passRef = useRef<TextInputInstance>(null);

  // Kode usaha diingat supaya kasir tidak perlu mengetik ulang setiap kali.
  useState(() => { void getItem("lk.businessCode").then((v) => v && setCode(v)); });

  const isEmail = username.includes("@");
  const canSubmit = (isEmail || code.trim().length >= 3) && username.trim().length >= 3 && password.length >= 6;

  async function submit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(code, username, password);
      if (!isEmail) await setItem("lk.businessCode", code.trim().toLowerCase());
      router.replace("/beranda");
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "Gagal masuk. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: sp(4), paddingTop: insets.top + sp(6), gap: sp(5), width: "100%", maxWidth: theme.layout.kasir.form_max, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: sp(1) }}>
          <Txt variant="xl" accessibilityRole="header">Masuk kasir</Txt>
          <Txt color="text-muted">Pakai kode usaha dan akun yang dibuat pemilik.</Txt>
        </View>
        {error && <Banner tone="danger" text={error} />}
        <View style={{ gap: sp(4) }}>
          <Field
            label="Kode usaha"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => userRef.current?.focus()}
            editable={!isEmail}
            help={isEmail ? "Tidak perlu diisi saat masuk dengan email." : undefined}
          />
          <Field
            ref={userRef}
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
            help="Pemilik bisa masuk dengan email."
          />
          <Field
            ref={passRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </View>
        <Button label="Masuk" size="lg" onPress={submit} loading={loading} disabled={!canSubmit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
