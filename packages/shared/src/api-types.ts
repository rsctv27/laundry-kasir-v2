// Bentuk respons API, dipakai bersama oleh server dan aplikasi kasir.
import type { PaymentStatus, Unit } from "./money";
import type { NotaData } from "./nota";
import type { OrderStatus, StaffRole } from "./status";
import type { OutletTimezone } from "./time";

export interface ApiError { error: { code: string; message: string; fields?: Record<string, string> } }

export interface MeDto {
  staff: { id: string; name: string; role: StaffRole };
  business: { id: string; name: string; code: string };
  outlet: { id: string; name: string; code: string; timezone: OutletTimezone } | null;
}

export interface ServiceDto { id: string; name: string; pricingUnit: Unit; price: number; durationHours: number; active?: boolean }

export interface CustomerDto { id: string; name: string; phoneWa: string | null; address: string | null; birthDate?: string | null; orderCount: number }

export interface OrderSummaryDto {
  id: string;
  notaNumber: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  paidTotal: number;
  receivedAt: string;
  dueAt: string | null;
  linesSummary: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  customerId: string;
  customerPhoneWa: string | null;
  subtotal: number;
  discount: number;
  notes: string | null;
  trackingUrl: string;
  lines: Array<{ serviceName: string; qty: string; unit: Unit; unitPrice: number; lineTotal: number }>;
  payments: Array<{ id: string; method: string; amount: number; paidAt: string }>;
  events: Array<{ from: OrderStatus | null; to: OrderStatus; at: string; by: string | null; note: string | null }>;
}

export interface NotaDto { nota: NotaData; whatsappText: string; customerPhoneWa: string | null }

export interface HomeDto { date: string; baru: number; diproses: number; selesaiHariIni: number; recent: OrderSummaryDto[] }

export interface ExpenseDto { id: string; category: string; amount: number; note: string | null; spentOn: string; staffName: string | null; createdAt: string; canDelete: boolean }

export interface DailyStatsDto {
  date: string;
  notaMasuk: number;
  omzet: number;
  batal: number;
  totalKg: string;
  totalPcs: number;
  notaDiambil: number;
  kasMasuk: number;
  kasPerMetode: Record<"tunai" | "qris" | "debit" | "ewallet" | "deposit", number>;
  pengeluaran: number;
  tunaiDiLaci: number;
  piutang: { count: number; amount: number; orders: OrderSummaryDto[] };
}

export interface ReportDayRow { date: string; nota: number; omzet: number; kasMasuk: number; pengeluaran: number; labaKas: number }
export interface ReportDto {
  from: string;
  to: string;
  outlet: { id: string; name: string } | null;
  days: ReportDayRow[];
  totals: Omit<ReportDayRow, "date">;
  kasPerMetode: Record<string, number>;
  pengeluaranPerKategori: Record<string, number>;
  perOutlet: Array<{ id: string; name: string; omzet: number; kasMasuk: number; pengeluaran: number }>;
  piutang: { count: number; amount: number };
}

export interface OutletDto { id: string; name: string; code: string; address: string | null; phoneWa: string | null; notaFooter: string | null; timezone: OutletTimezone; hasQris: boolean }
