// S07: nota setelah transaksi tersimpan (juga bisa dibuka ulang dari detail order).
import { NOTA_COLUMNS, waLink, type NotaDto } from "@lk/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Check, MessageCircle, Printer, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { NotaPaper } from "@/components/nota-paper";
import { ActionBar, AppHeader, Body } from "@/components/screen";
import { Banner, Button, c, Skeleton, sp, Txt } from "@/components/ui";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/use-load";
import { loadPrinterSettings, printMode, printNota, PrinterError, type PrinterSettings } from "@/printer";
import { theme } from "@/theme.gen";

export default function Nota() {
  const { id, baru } = useLocalSearchParams<{ id: string; baru?: string }>();
  const { data, error, reload } = useLoad(() => api<NotaDto>(`orders/${id}/nota`), [id]);
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string; retry?: boolean } | null>(null);

  useEffect(() => { void loadPrinterSettings().then(setSettings); }, []);

  // Kembali ke beranda yang sudah ada (bukan membuka beranda baru di atas tumpukan).
  const close = () => (baru ? router.dismissTo("/beranda") : router.canGoBack() ? router.back() : router.replace(`/order/${id}`));

  const doPrint = useCallback(async () => {
    if (!data || !settings) return;
    if (printMode === "bluetooth" && !settings.address) return router.push("/printer");
    setPrinting(true);
    setMsg(null);
    try {
      await printNota(data.nota, settings);
      setMsg(
        printMode === "browser"
          ? { tone: "info", text: "Dialog cetak dibuka. Pilih printer thermal dan ukuran kertas " + settings.paper.replace("mm", " mm") + "." }
          : { tone: "success", text: settings.productionCopy ? "Nota dan label produksi tercetak." : "Nota tercetak." },
      );
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof PrinterError ? e.message : "Gagal mencetak.", retry: true });
    } finally {
      setPrinting(false);
    }
  }, [data, settings]);

  async function sendWa() {
    if (!data?.customerPhoneWa) return;
    await Linking.openURL(waLink(data.customerPhoneWa, data.whatsappText));
    api(`orders/${id}/messages`, { method: "POST", json: { template: "nota" } }).catch(() => {});
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Nota" actions={[{ icon: X, label: "Tutup", onPress: close }]} />
      <Body>
        {error && <Banner tone="danger" text={error} action={{ label: "Coba lagi", onPress: reload }} />}
        {data ? (
          <>
            <View style={st.done}>
              <View style={st.ok}><Check size={22} color={c.success} /></View>
              <View>
                <Txt weight={600}>{baru ? "Transaksi tersimpan" : "Nota"}</Txt>
                <Txt variant="sm" color="text-muted" mono>{data.nota.notaNumber}</Txt>
              </View>
            </View>
            {msg && <Banner tone={msg.tone} text={msg.text} action={msg.retry ? { label: "Coba lagi", onPress: doPrint } : undefined} />}
            {!data.customerPhoneWa && <Banner tone="info" text="Pelanggan belum punya nomor WhatsApp, jadi nota hanya bisa dicetak." />}
            <NotaPaper nota={data.nota} columns={NOTA_COLUMNS[settings?.paper ?? "58mm"]} />
          </>
        ) : !error ? (
          <View style={{ gap: sp(3) }}><Skeleton width="50%" height={20} /><Skeleton height={400} /></View>
        ) : null}
      </Body>
      <ActionBar>
        <Button label="Kirim WA" icon={MessageCircle} variant="secondary" size="lg" disabled={!data?.customerPhoneWa} onPress={sendWa} style={{ flex: 1 }} />
        <Button label="Cetak" icon={Printer} size="lg" loading={printing} disabled={!data} onPress={doPrint} style={{ flex: 1 }} />
      </ActionBar>
    </View>
  );
}

const st = StyleSheet.create({
  done: { flexDirection: "row", alignItems: "center", gap: sp(3) },
  ok: { width: 40, height: 40, borderRadius: theme.radius.pill, backgroundColor: c["success-soft"], alignItems: "center", justifyContent: "center" },
});
