// Antarmuka printer. Layar hanya memakai ini, jadi library Bluetooth bisa diganti tanpa menyentuh layar.
export interface PrinterDevice { name: string; address: string; kind: "bt" | "ble" | "dual" | "unknown" }

export interface PrinterDriver {
  /** false di platform tanpa Bluetooth (versi web). */
  available: boolean;
  scan(): Promise<PrinterDevice[]>;
  connect(address: string): Promise<void>;
  isConnected(address: string): Promise<boolean>;
  printRaw(address: string, bytes: Uint8Array): Promise<void>;
  disconnect(address?: string): Promise<void>;
}

export class PrinterError extends Error {
  constructor(public code: "unavailable" | "permission" | "connect" | "print" | "scan", message: string) {
    super(message);
  }
}
