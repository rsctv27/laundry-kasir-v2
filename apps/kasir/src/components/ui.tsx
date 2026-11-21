// Komponen dasar aplikasi kasir, mengikuti replica/design/components.md. Semua nilai dari theme.gen.ts.
import { Check, type LucideIcon } from "lucide-react-native";
import { forwardRef, useState } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputInstance, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { theme, type ColorRole } from "@/theme.gen";

export const c = theme.color;
export const sp = (i: number) => theme.space[i] ?? 0;

const FAMILY: Record<number, string> = { 400: "Inter_400Regular", 500: "Inter_500Medium", 600: "Inter_600SemiBold", 700: "Inter_700Bold" };
type Variant = keyof typeof theme.type;

export function Txt({
  variant = "base", weight, color = "text", tabular, mono, style, ...rest
}: TextProps & { variant?: Variant; weight?: 400 | 500 | 600 | 700; color?: ColorRole; tabular?: boolean; mono?: boolean }) {
  const t = theme.type[variant];
  const w = weight ?? t.weight;
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.3}
      style={[
        { fontSize: t.size, lineHeight: t.line, fontFamily: mono ? "monospace" : FAMILY[w] ?? FAMILY[400], color: c[color] },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
const BTN: Record<BtnVariant, { bg: string; fg: ColorRole; border?: string; pressed: string }> = {
  primary: { bg: c.accent, fg: "on-accent", pressed: c["accent-pressed"] },
  secondary: { bg: c["surface-raised"], fg: "text", border: c.border, pressed: c["accent-soft"] },
  ghost: { bg: "transparent", fg: "text", pressed: c["accent-soft"] },
  danger: { bg: c.danger, fg: "on-danger", pressed: c.danger },
};

export function Button({
  label, icon: Icon, variant = "primary", size = "md", loading, disabled, style, ...rest
}: Omit<PressableProps, "style"> & { label: string; icon?: LucideIcon; variant?: BtnVariant; size?: "md" | "lg"; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const v = BTN[variant];
  const off = disabled || loading;
  const fg = off && !loading ? "text-muted" : v.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        { height: theme.control[size], backgroundColor: off && !loading ? c.surface : pressed ? v.pressed : v.bg, borderColor: off && !loading ? c.border : v.border ?? "transparent" },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={c[v.fg]} size="small" /> : Icon ? <Icon size={20} color={c[fg]} /> : null}
      <Txt weight={600} color={fg} numberOfLines={1}>{loading ? `${label}…` : label}</Txt>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, label, variant = "ghost", disabled, ...rest }: PressableProps & { icon: LucideIcon; label: string; variant?: "ghost" | "secondary" }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        s.iconBtn,
        variant === "secondary" && { backgroundColor: c["surface-raised"], borderWidth: 1, borderColor: c.border },
        pressed && { backgroundColor: c["accent-soft"] },
      ]}
      {...rest}
    >
      <Icon size={22} color={disabled ? c["border-input"] : c.text} />
    </Pressable>
  );
}

export const Field = forwardRef<TextInputInstance, TextInputProps & { label: string; help?: string; error?: string; prefix?: string; suffix?: string }>(
  function Field({ label, help, error, prefix, suffix, onFocus, onBlur, style, ...rest }, ref) {
    const [focus, setFocus] = useState(false);
    return (
      <View style={{ gap: 6 }}>
        <Txt variant="sm" weight={500}>{label}</Txt>
        <View style={[s.input, focus && { borderColor: c.focus, borderWidth: 2, paddingHorizontal: sp(3) - 1 }, error && { borderColor: c.danger, borderWidth: 2, paddingHorizontal: sp(3) - 1 }]}>
          {prefix && <Txt weight={500} color="text-muted">{prefix}</Txt>}
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            placeholderTextColor={c["text-muted"]}
            onFocus={(e) => { setFocus(true); onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); onBlur?.(e); }}
            maxFontSizeMultiplier={1.3}
            style={[s.inputText, style]}
            {...rest}
          />
          {suffix && <Txt weight={500} color="text-muted">{suffix}</Txt>}
        </View>
        {error ? <Txt variant="xs" color="danger" weight={500}>{error}</Txt> : help ? <Txt variant="xs" color="text-muted">{help}</Txt> : null}
      </View>
    );
  },
);

export function Card({ style, ...rest }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return <View style={[s.card, style]} {...rest} />;
}

export function SectionTitle({ children }: { children: string }) {
  return <Txt variant="sm" weight={600} color="text-muted" style={{ letterSpacing: 0.5, textTransform: "uppercase" }}>{children}</Txt>;
}

export function Badge({ label, tone }: { label: string; tone: keyof typeof theme.status }) {
  const st = theme.status[tone];
  return (
    <View style={[s.badge, { backgroundColor: c[st.bg as ColorRole] }, tone === "diambil" && { borderWidth: 1, borderColor: c.border }]}>
      <Txt variant="xs" weight={600} color={st.fg as ColorRole}>{label}</Txt>
    </View>
  );
}

export function Banner({ tone, icon: Icon, text, action }: { tone: "warning" | "danger" | "info" | "success"; icon?: LucideIcon; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View accessibilityRole="alert" style={[s.banner, { backgroundColor: c[`${tone}-soft`] }]}>
      {Icon && <Icon size={20} color={c[tone]} />}
      <Txt variant="sm" weight={500} color={tone} style={{ flex: 1 }}>{text}</Txt>
      {action && (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={s.bannerBtn}>
          <Txt variant="sm" weight={600}>{action.label}</Txt>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <Icon size={40} color={c["text-muted"]} />
      <Txt weight={600} style={{ textAlign: "center" }}>{title}</Txt>
      {text && <Txt variant="sm" color="text-muted" style={{ textAlign: "center" }}>{text}</Txt>}
      {action}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange(!checked)} style={s.checkRow}>
      <View style={[s.check, checked && { backgroundColor: c.accent, borderColor: c.accent }]}>{checked && <Check size={16} color={c["on-accent"]} />}</View>
      <Txt style={{ flex: 1 }}>{label}</Txt>
    </Pressable>
  );
}

export function Skeleton({ width = "100%", height = 14, style }: { width?: ViewStyle["width"]; height?: number; style?: StyleProp<ViewStyle> }) {
  return <View accessibilityElementsHidden style={[{ width, height, borderRadius: theme.radius.sm, backgroundColor: c.border }, style]} />;
}

export const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: sp(2), paddingHorizontal: sp(4), borderRadius: theme.radius.md, borderWidth: 1 },
  iconBtn: { width: theme.control.md, height: theme.control.md, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.md },
  input: { minHeight: theme.control.md, flexDirection: "row", alignItems: "center", gap: sp(2), paddingHorizontal: sp(3), borderWidth: 1, borderColor: c["border-input"], borderRadius: theme.radius.md, backgroundColor: c.bg },
  inputText: { flex: 1, minHeight: theme.control.md - 4, fontSize: theme.type.base.size, fontFamily: "Inter_400Regular", color: c.text, paddingVertical: 0, outlineWidth: 0 } as TextStyle, // fokus ditandai border, bukan outline browser
  card: { backgroundColor: c["surface-raised"], borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.lg, padding: sp(4) },
  badge: { height: 24, paddingHorizontal: 10, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  banner: { flexDirection: "row", alignItems: "center", gap: sp(2) + 2, paddingVertical: sp(2) + 2, paddingHorizontal: sp(4) },
  bannerBtn: { height: 36, paddingHorizontal: sp(3), borderRadius: theme.radius.md, backgroundColor: c["surface-raised"], borderWidth: 1, borderColor: c.border, justifyContent: "center" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: sp(3), minHeight: theme.control.md },
  check: { width: 24, height: 24, borderRadius: theme.radius.sm, borderWidth: 2, borderColor: c["border-input"], alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: sp(2), paddingVertical: sp(7), paddingHorizontal: sp(4) },
});
