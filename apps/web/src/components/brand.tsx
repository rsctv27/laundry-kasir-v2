// Tanda aplikasi (sementara sampai logo resmi dibuat): kotak biru dengan mesin cuci putih.
import { WashingMachine } from "lucide-react";

const SIZE = {
  sm: { box: "size-8 rounded-md", icon: "size-5" },
  md: { box: "size-10 rounded-md", icon: "size-6" },
  lg: { box: "size-12 rounded-lg", icon: "size-7" },
} as const;

export function AppMark({ size = "md", inverse = false }: { size?: keyof typeof SIZE; inverse?: boolean }) {
  const s = SIZE[size];
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center ${s.box} ${inverse ? "bg-surface-raised text-accent" : "bg-accent text-on-accent"}`}>
      <WashingMachine className={s.icon} strokeWidth={2} />
    </span>
  );
}

export const APP_NAME = "laundry-kasir";
