// Versi web / tanpa Bluetooth: tidak bisa mencetak. Android memakai driver.native.ts.
import { PrinterError, type PrinterDriver } from "./types";

const unavailable = () => Promise.reject(new PrinterError("unavailable", "Cetak nota hanya tersedia di aplikasi Android."));

export const driver: PrinterDriver = {
  available: false,
  scan: unavailable,
  connect: unavailable,
  isConnected: async () => false,
  printRaw: unavailable,
  disconnect: async () => {},
};
