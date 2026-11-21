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

export const createCustomerInput = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  phoneWa: waOptional,
  address: z.string().trim().max(200).optional(),
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

export type CreateBusinessInput = z.infer<typeof createBusinessInput>;
export type CreateServiceInput = z.infer<typeof createServiceInput>;
export type CreateStaffInput = z.infer<typeof createStaffInput>;
export type CreateCustomerInput = z.infer<typeof createCustomerInput>;
export type CreateOrderInput = z.infer<typeof createOrderInput>;
export type AddPaymentInput = z.infer<typeof addPaymentInput>;
