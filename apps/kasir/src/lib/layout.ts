// Tata letak responsif: HP (bilah bawah), tablet, dan browser desktop (menu samping, konten terpusat).
import { useWindowDimensions } from "react-native";
import { theme } from "@/theme.gen";

export type Width = "content" | "list" | "form";

export function useLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= theme.layout.breakpoints.lg;
  const medium = width >= theme.layout.breakpoints.md;
  const max = (w: Width = "content") =>
    w === "form" ? theme.layout.kasir.form_max : !medium ? undefined : w === "list" ? theme.layout.kasir.list_max : theme.layout.kasir.content_max;
  return { width, wide, medium, max };
}

/** Lebar konten sebenarnya (setelah menu samping dan batas lebar). */
export function useContentWidth(w: Width = "content") {
  const { width, wide, max } = useLayout();
  const avail = width - (wide ? theme.layout.kasir.sidebar : 0);
  return Math.min(avail, max(w) ?? avail);
}
