// Gambar QRIS statis outlet (diunggah pemilik di web). Tampil saat kasir memilih QRIS.
import type { OutletDto } from "@lk/shared";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { theme } from "@/theme.gen";
import { Banner, c, Skeleton, sp, Txt } from "./ui";

let cache: { outletId: string; dataUrl: string | null } | null = null;

export function QrisImage({ amountLabel }: { amountLabel: string }) {
  const { me } = useSession();
  const outletId = me?.outlet?.id;
  const [src, setSrc] = useState<string | null | undefined>(cache && cache.outletId === outletId ? cache.dataUrl : undefined);

  useEffect(() => {
    if (!outletId || src !== undefined) return;
    (async () => {
      try {
        const { outlets } = await api<{ outlets: OutletDto[] }>("outlets");
        const o = outlets.find((x) => x.id === outletId);
        const url = o?.hasQris ? (await api<{ dataUrl: string }>(`outlets/${outletId}/qris`)).dataUrl : null;
        cache = { outletId, dataUrl: url };
        setSrc(url);
      } catch { setSrc(null); }
    })();
  }, [outletId, src]);

  if (src === undefined) return <Skeleton width={240} height={240} style={{ alignSelf: "center" }} />;
  if (!src) return <Banner tone="info" text="Gambar QRIS outlet belum diunggah. Pemilik bisa mengunggahnya di web pemilik > Pengaturan." />;
  return (
    <View style={{ alignItems: "center", gap: sp(2), padding: sp(3), backgroundColor: c.bg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: c.border }}>
      <Image source={{ uri: src }} style={{ width: 240, height: 240 }} resizeMode="contain" accessibilityLabel="Kode QRIS outlet" />
      <Txt variant="sm" color="text-muted" style={{ textAlign: "center" }}>Minta pelanggan scan dan bayar {amountLabel}</Txt>
    </View>
  );
}
