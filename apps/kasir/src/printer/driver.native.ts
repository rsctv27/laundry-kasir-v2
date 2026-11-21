// Android: printer thermal Bluetooth (Classic atau BLE) lewat react-native-thermal-printer-driver.
// Butuh development build (tidak jalan di Expo Go). Diuji di Milestone 0 dengan printer asli outlet.
import ThermalPrinter from "react-native-thermal-printer-driver";
import { PermissionsAndroid, Platform } from "react-native";
import { PrinterError, type PrinterDevice, type PrinterDriver } from "./types";

async function ensurePermissions() {
  if (Platform.OS !== "android") return;
  const needed =
    Number(Platform.Version) >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(needed);
  if (!needed.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED)) {
    throw new PrinterError("permission", "Izinkan akses Bluetooth agar aplikasi bisa menemukan printer.");
  }
}

/** Alamat dari hasil scan diberi awalan transport (bt:/ble:) kalau belum ada. */
function withPrefix(address: string, kind: PrinterDevice["kind"]) {
  if (/^(bt|ble|tcp):/.test(address)) return address;
  return `${kind === "ble" ? "ble" : "bt"}:${address}`;
}

export const driver: PrinterDriver = {
  available: true,
  async scan() {
    await ensurePermissions();
    try {
      const { paired, found } = await ThermalPrinter.scan();
      const seen = new Set<string>();
      return [...paired, ...found]
        .map((d) => ({ name: d.name || "Tanpa nama", address: withPrefix(d.address, d.deviceType), kind: d.deviceType }))
        .filter((d) => (seen.has(d.address) ? false : (seen.add(d.address), true)));
    } catch (e) {
      throw new PrinterError("scan", `Gagal mencari printer: ${(e as Error).message}`);
    }
  },
  async connect(address) {
    await ensurePermissions();
    try {
      await ThermalPrinter.connect(address, { timeout: 10000 });
    } catch (e) {
      throw new PrinterError("connect", `Printer tidak tersambung. Pastikan printer menyala dan dekat. (${(e as Error).message})`);
    }
  },
  async isConnected(address) {
    try { return await ThermalPrinter.isConnected(address); } catch { return false; }
  },
  async printRaw(address, bytes) {
    try {
      if (!(await ThermalPrinter.isConnected(address))) await ThermalPrinter.connect(address, { timeout: 10000 });
      await ThermalPrinter.printRaw(address, Array.from(bytes), { timeout: 15000 });
    } catch (e) {
      throw new PrinterError("print", `Gagal mencetak: ${(e as Error).message}`);
    }
  },
  async disconnect(address) {
    try { await ThermalPrinter.disconnect(address); } catch { /* sudah terputus */ }
  },
};
