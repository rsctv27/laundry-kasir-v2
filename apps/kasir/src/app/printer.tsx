// Milestone 0: cari printer, sambungkan, pilih ukuran kertas, uji cetak.
import { NOTA_COLUMNS } from "@lk/shared";
import { Bluetooth, Check, Printer as PrinterIcon, RefreshCw } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { NotaPaper } from "@/components/nota-paper";
import { AppHeader, Body } from "@/components/screen";
import { Banner, Button, c, Card, Checkbox, EmptyState, sp, Txt } from "@/components/ui";
import {
  driver, loadPrinterSettings, printNota, PrinterError, SAMPLE_NOTA, savePrinterSettings, type PrinterDevice, type PrinterSettings,
} from "@/printer";
import { theme } from "@/theme.gen";

export default function PrinterScreen() {
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [devices, setDevices] = useState<PrinterDevice[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  useEffect(() => { void loadPrinterSettings().then(setSettings); }, []);
  const update = async (patch: Partial<PrinterSettings>) => {
    const next = { ...(settings as PrinterSettings), ...patch };
    setSettings(next);
    await savePrinterSettings(next);
  };

  async function scan() {
    setScanning(true); setMsg(null);
    try { setDevices(await driver.scan()); }
    catch (e) { setMsg({ tone: "danger", text: e instanceof PrinterError ? e.message : "Gagal mencari printer." }); }
    finally { setScanning(false); }
  }

  async function choose(d: PrinterDevice) {
    setConnecting(d.address); setMsg(null);
    try {
      await driver.connect(d.address);
      await update({ address: d.address, name: d.name });
      setMsg({ tone: "success", text: `Tersambung ke ${d.name}. Coba uji cetak.` });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof PrinterError ? e.message : "Gagal menyambung." });
    } finally { setConnecting(null); }
  }

  async function test() {
    if (!settings) return;
    setTesting(true); setMsg(null);
    try {
      await printNota({ ...SAMPLE_NOTA, receivedAt: new Date().toISOString() }, settings);
      setMsg({ tone: "success", text: "Terkirim ke printer. Periksa: garis lurus sampai tepi, angka rata kanan, QR bisa di-scan." });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof PrinterError ? e.message : "Gagal mencetak." });
    } finally { setTesting(false); }
  }

  if (!settings) return <View style={{ flex: 1 }}><AppHeader title="Printer" back /></View>;

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Printer" back />
      <Body>
        {!driver.available && <Banner tone="info" icon={PrinterIcon} text="Printer Bluetooth hanya bisa dipakai di aplikasi Android. Pengaturan kertas tetap bisa dicoba di sini." />}
        {msg && <Banner tone={msg.tone} text={msg.text} />}

        <Card style={{ gap: sp(3) }}>
          <Txt weight={600}>Ukuran kertas</Txt>
          <View style={{ flexDirection: "row", gap: sp(2) }}>
            {(["58mm", "80mm"] as const).map((p) => {
              const on = settings.paper === p;
              return (
                <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => update({ paper: p })} style={[st.seg, on && st.segOn]}>
                  <Txt weight={on ? 600 : 500}>{p.replace("mm", " mm")}</Txt>
                  <Txt variant="xs" color="text-muted">{NOTA_COLUMNS[p]} karakter/baris</Txt>
                </Pressable>
              );
            })}
          </View>
          <Checkbox checked={settings.productionCopy} onChange={(v) => update({ productionCopy: v })} label="Cetak juga label produksi (tanpa harga)" />
        </Card>

        {driver.available && (
          <Card style={{ gap: sp(3) }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Txt weight={600}>Printer</Txt>
                <Txt variant="sm" color="text-muted">{settings.name ? `Dipakai: ${settings.name}` : "Belum ada printer dipilih"}</Txt>
              </View>
              <Button label={devices ? "Cari ulang" : "Cari printer"} icon={devices ? RefreshCw : Bluetooth} variant="secondary" loading={scanning} onPress={scan} />
            </View>
            {devices && devices.length === 0 && (
              <EmptyState icon={Bluetooth} title="Printer tidak ditemukan" text="Nyalakan printer dan pasangkan dulu di pengaturan Bluetooth HP, lalu cari ulang." />
            )}
            {devices?.map((d) => {
              const on = d.address === settings.address;
              return (
                <Pressable key={d.address} accessibilityRole="button" onPress={() => choose(d)} style={({ pressed }) => [st.dev, on && st.devOn, pressed && { backgroundColor: c["accent-soft"] }]}>
                  <Bluetooth size={20} color={c.text} />
                  <View style={{ flex: 1 }}>
                    <Txt weight={500} numberOfLines={1}>{d.name}</Txt>
                    <Txt variant="xs" color="text-muted">{d.address}</Txt>
                  </View>
                  {connecting === d.address ? <Txt variant="sm" color="text-muted">Menyambung…</Txt> : on ? <Check size={20} color={c.success} /> : null}
                </Pressable>
              );
            })}
            <Button label="Uji cetak" icon={PrinterIcon} onPress={test} loading={testing} disabled={!settings.address} />
          </Card>
        )}

        <Txt variant="sm" color="text-muted">Contoh hasil cetak di kertas {settings.paper.replace("mm", " mm")}:</Txt>
        <NotaPaper nota={SAMPLE_NOTA} columns={NOTA_COLUMNS[settings.paper]} />
      </Body>
    </View>
  );
}

const st = StyleSheet.create({
  seg: { flex: 1, minHeight: theme.control.lg, borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c["surface-raised"] },
  segOn: { borderWidth: 2, borderColor: c.accent, backgroundColor: c["accent-soft"] },
  dev: { flexDirection: "row", alignItems: "center", gap: sp(3), minHeight: 56, paddingHorizontal: sp(3), borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md },
  devOn: { borderColor: c.success },
});
