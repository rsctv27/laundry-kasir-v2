export const ORDER_STATUSES = ["baru", "diproses", "selesai", "diambil", "batal"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type StaffRole = "owner" | "supervisor" | "kasir" | "produksi" | "kurir";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  diambil: "Diambil",
  batal: "Batal",
};

const FORWARD: Record<OrderStatus, OrderStatus | null> = {
  baru: "diproses",
  diproses: "selesai",
  selesai: null, // ke "diambil" hanya lewat alur pengambilan (cek pembayaran)
  diambil: null,
  batal: null,
};
const BACKWARD: Partial<Record<OrderStatus, OrderStatus>> = { diproses: "baru", selesai: "diproses" };
const SUPERVISOR_UP: StaffRole[] = ["owner", "supervisor"];

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/** Perubahan status lewat tombol status (bukan pengambilan, bukan pembatalan). */
export function checkStatusChange(from: OrderStatus, to: OrderStatus, role: StaffRole, note?: string): TransitionCheck {
  if (FORWARD[from] === to) return { ok: true };
  if (BACKWARD[from] === to) {
    if (!SUPERVISOR_UP.includes(role)) return { ok: false, reason: "Hanya supervisor atau owner yang bisa memundurkan status." };
    if (!note?.trim()) return { ok: false, reason: "Isi alasan saat memundurkan status." };
    return { ok: true };
  }
  return { ok: false, reason: `Status tidak bisa diubah dari ${STATUS_LABEL[from]} ke ${STATUS_LABEL[to]}.` };
}

export function nextStatus(from: OrderStatus): OrderStatus | null {
  return FORWARD[from];
}

export function canCancel(status: OrderStatus, role: StaffRole): TransitionCheck {
  if (!SUPERVISOR_UP.includes(role)) return { ok: false, reason: "Hanya supervisor atau owner yang bisa membatalkan nota." };
  if (status !== "baru" && status !== "diproses") return { ok: false, reason: "Nota yang sudah selesai atau diambil tidak bisa dibatalkan." };
  return { ok: true };
}

/** Pengambilan: harus selesai dan lunas (bayar-nanti dengan persetujuan menyusul di Milestone 3). */
export function checkPickup(status: OrderStatus, total: number, paid: number): TransitionCheck {
  if (status !== "selesai") return { ok: false, reason: "Cucian belum selesai." };
  if (paid < total) return { ok: false, reason: "Lunasi dulu sisa tagihan sebelum cucian diambil." };
  return { ok: true };
}
