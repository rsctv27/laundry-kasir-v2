// Skema Drizzle, cerminan dari migrations/0000_init.sql (sumber kebenaran tetap file SQL).
import { sql } from "drizzle-orm";
import {
  bigint, boolean, char, date, doublePrecision, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const money = (name: string) => bigint(name, { mode: "number" });
const stamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};

// ---------- Better Auth ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("displayUsername"),
  createdAt: ts("createdAt").notNull().defaultNow(),
  updatedAt: ts("updatedAt").notNull().defaultNow(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: ts("createdAt").notNull().defaultNow(),
  updatedAt: ts("updatedAt").notNull().defaultNow(),
});
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: ts("accessTokenExpiresAt"),
  refreshTokenExpiresAt: ts("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("createdAt").notNull().defaultNow(),
  updatedAt: ts("updatedAt").notNull().defaultNow(),
});
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expiresAt").notNull(),
  createdAt: ts("createdAt").notNull().defaultNow(),
  updatedAt: ts("updatedAt").notNull().defaultNow(),
});

// ---------- usaha ----------
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  ownerUserId: text("owner_user_id").notNull().references(() => user.id),
  currency: char("currency", { length: 3 }).notNull().default("IDR"),
  ...stamps,
});

export const outlets = pgTable("outlets", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address"),
  phoneWa: text("phone_wa"),
  timezone: text("timezone", { enum: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] }).notNull().default("Asia/Jakarta"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  attendanceRadiusM: integer("attendance_radius_m"),
  notaHeader: text("nota_header"),
  notaFooter: text("nota_footer"),
  waTemplate: text("wa_template"),
  qrisImagePath: text("qris_image_path"),
  payLaterNeedsApproval: boolean("pay_later_needs_approval").notNull().default(true),
  active: boolean("active").notNull().default(true),
  ...stamps,
});

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  outletId: uuid("outlet_id"),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["owner", "supervisor", "kasir", "produksi", "kurir"] }).notNull(),
  active: boolean("active").notNull().default(true),
  ...stamps,
});

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phoneWa: text("phone_wa"),
  address: text("address"),
  birthDate: date("birth_date"),
  notes: text("notes"),
  ...stamps,
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  outletId: uuid("outlet_id").notNull(),
  name: text("name").notNull(),
  pricingUnit: text("pricing_unit", { enum: ["kg", "pcs"] }).notNull(),
  price: money("price").notNull(),
  durationHours: integer("duration_hours").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...stamps,
});

export const itemTypes = pgTable("item_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  ...stamps,
});

export const notaCounters = pgTable(
  "nota_counters",
  {
    outletId: uuid("outlet_id").notNull().references(() => outlets.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    lastSeq: integer("last_seq").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.outletId, t.day] })],
);

export const orderStatusEnum = ["baru", "diproses", "selesai", "diambil", "batal"] as const;
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  outletId: uuid("outlet_id").notNull(),
  notaNumber: text("nota_number").notNull(),
  customerId: uuid("customer_id").notNull(),
  cashierStaffId: uuid("cashier_staff_id").notNull(),
  promoId: uuid("promo_id"),
  status: text("status", { enum: orderStatusEnum }).notNull().default("baru"),
  receivedAt: ts("received_at").notNull().defaultNow(),
  dueAt: ts("due_at"),
  finishedAt: ts("finished_at"),
  takenAt: ts("taken_at"),
  cancelledAt: ts("cancelled_at"),
  cancelReason: text("cancel_reason"),
  subtotal: money("subtotal").notNull(),
  discount: money("discount").notNull().default(0),
  total: money("total").notNull(),
  paidTotal: money("paid_total").notNull().default(0),
  paymentStatus: text("payment_status", { enum: ["belum_bayar", "sebagian", "lunas"] }).notNull().default("belum_bayar"),
  trackingToken: text("tracking_token").notNull().default(sql`encode(gen_random_bytes(16), 'hex')`),
  notes: text("notes"),
  ...stamps,
});

export const orderLines = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
  serviceName: text("service_name").notNull(),
  unit: text("unit", { enum: ["kg", "pcs"] }).notNull(),
  unitPrice: money("unit_price").notNull(),
  qty: numeric("qty", { precision: 8, scale: 2 }).notNull(),
  lineTotal: money("line_total").notNull(),
  itemCounts: jsonb("item_counts").$type<Record<string, number>>().notNull().default({}),
  position: integer("position").notNull().default(0),
  ...stamps,
});

export const statusEvents = pgTable("status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: text("from_status", { enum: orderStatusEnum }),
  toStatus: text("to_status", { enum: orderStatusEnum }).notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  note: text("note"),
  at: ts("at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  outletId: uuid("outlet_id").notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  customerId: uuid("customer_id").notNull(),
  kind: text("kind", { enum: ["order", "pelunasan", "topup", "refund"] }).notNull(),
  method: text("method", { enum: ["tunai", "qris", "debit", "deposit", "ewallet"] }).notNull(),
  amount: money("amount").notNull(),
  cashReceived: money("cash_received"),
  externalRef: text("external_ref").unique(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  paidAt: ts("paid_at").notNull().defaultNow(),
  ...stamps,
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  outletId: uuid("outlet_id").notNull(),
  category: text("category", { enum: ["bahan", "gas", "listrik_air", "gaji", "sewa", "perawatan", "lainnya"] }).notNull(),
  amount: money("amount").notNull(),
  note: text("note"),
  spentOn: date("spent_on").notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  ...stamps,
});

export const messageLogs = pgTable("message_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["wa_manual", "wa_api", "sms"] }).notNull(),
  template: text("template").notNull(),
  toPhone: text("to_phone").notNull(),
  status: text("status", { enum: ["dibuat", "terkirim", "gagal"] }).notNull().default("dibuat"),
  providerMessageId: text("provider_message_id").unique(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "set null" }),
  sentAt: ts("sent_at"),
  ...stamps,
});
// Tabel promos, pay_later_approvals, deposit_ledger, attendance sudah ada di migrasi;
// definisi Drizzle-nya ditambahkan saat fiturnya dibangun (Milestone 3).
