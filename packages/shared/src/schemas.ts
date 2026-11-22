// Skema input API. Dipakai server untuk validasi dan aplikasi untuk validasi form.
import { z } from "zod";
import { normalizeWa } from "./phone";

const rupiah = z.number().int().nonnegative().max(1_000_000_000);
const qty = z.string().regex(/^\d{1,6}([.,]\d{1,2})?$/, "Jumlah tidak valid");
const waOptional = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeWa(v);
    if (!n) { ctx.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid" }); return z.NEVER; }
    return n;
  });

export const createBusinessInput = z.object({
  businessName: z.string().trim().min(2, "Nama usaha terlalu pendek").max(80),
  businessCode: z.string().trim().toLowerCase().regex(/^[a-z0-9]{3,12}$/, "Kode usaha 3–12 huruf kecil atau angka"),
  outletName: z.string().trim().min(2).max(80),
  outletCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "Kode outlet 2–6 huruf besar atau angka"),
  outletAddress: z.string().trim().max(200).optional(),
  outletPhoneWa: waOptional,
});

export const createServiceInput = z.object({
  name: z.string().trim().min(2).max(60),
  pricingUnit: z.enum(["kg", "pcs"]),
  price: rupiah,
  durationHours: z.number().int().positive().max(24 * 30),
});

export const createStaffInput = z.object({
  name: z.string().trim().min(2).max(60),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9]{3,20}$/, "Username 3–20 huruf kecil atau angka"),
  password: z.string().min(6, "Password minimal 6 karakter").max(64),
  role: z.enum(["supervisor", "kasir", "produksi", "kurir"]),
  outletId: z.string().uuid().nullable(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD");

export const createCustomerInput = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  phoneWa: waOptional,
  address: z.string().trim().max(200).optional(),
  birthDate: isoDate.optional(),
});

export const paymentMethod = z.enum(["tunai", "qris", "debit", "deposit", "ewallet"]);

export const createOrderInput = z.object({
  id: z.string().uuid(), // dibuat aplikasi kasir: kunci idempotency
  customerId: z.string().uuid(),
  lines: z
    .array(z.object({ serviceId: z.string().uuid(), qty }))
    .min(1, "Pilih minimal satu layanan")
    .max(20),
  notes: z.string().trim().max(300).optional(),
  payment: z
    .object({ id: z.string().uuid(), method: paymentMethod, amount: rupiah.positive(), cashReceived: rupiah.optional() })
    .optional(),
});

export const addPaymentInput = z.object({
  id: z.string().uuid(),
  method: paymentMethod,
  amount: rupiah.positive(),
  cashReceived: rupiah.optional(),
});

export const statusChangeInput = z.object({
  to: z.enum(["baru", "diproses", "selesai"]),
  note: z.string().trim().max(200).optional(),
});

export const updateServiceInput = z
  .object({
    name: z.string().trim().min(2).max(60),
    price: rupiah,
    durationHours: z.number().int().positive().max(24 * 30),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Tidak ada yang diubah");

export const updateOutletInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    address: z.string().trim().max(200).nullable(),
    phoneWa: waOptional,
    notaFooter: z.string().trim().max(120).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Tidak ada yang diubah");

export const uploadQrisInput = z.object({
  mime: z.enum(["image/png", "image/jpeg", "image/webp"], { message: "Gunakan gambar PNG, JPG, atau WEBP" }),
  dataBase64: z.string().min(10).max(700_000, "Gambar maksimal 512 KB"),
});

export const EXPENSE_CATEGORIES = ["bahan", "gas", "listrik_air", "gaji", "sewa", "perawatan", "lainnya"] as const;
export const EXPENSE_LABEL: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  bahan: "Sabun & bahan", gas: "Gas", listrik_air: "Listrik & air", gaji: "Gaji", sewa: "Sewa", perawatan: "Perawatan mesin", lainnya: "Lainnya",
};

export const createExpenseInput = z.object({
  id: z.string().uuid(), // dibuat aplikasi: kunci idempotency
  category: z.enum(EXPENSE_CATEGORIES),
  amount: rupiah.positive("Nominal harus lebih dari 0"),
  note: z.string().trim().max(200).optional(),
  spentOn: isoDate.optional(), // default: hari ini (zona waktu outlet)
});

export const cancelOrderInput = z.object({ reason: z.string().trim().min(3, "Tulis alasan pembatalan").max(200) });

export const periodQuery = z.object({ from: isoDate, to: isoDate, outlet: z.string().uuid().or(z.literal("all")).default("all") });

export type CreateBusinessInput = z.infer<typeof createBusinessInput>;
export type CreateServiceInput = z.infer<typeof createServiceInput>;
export type CreateStaffInput = z.infer<typeof createStaffInput>;
export type CreateCustomerInput = z.infer<typeof createCustomerInput>;
export type CreateOrderInput = z.infer<typeof createOrderInput>;
export type AddPaymentInput = z.infer<typeof addPaymentInput>;
export type UpdateServiceInput = z.infer<typeof updateServiceInput>;
export type UpdateOutletInput = z.infer<typeof updateOutletInput>;
export type CreateExpenseInput = z.infer<typeof createExpenseInput>;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
