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

export interface ServiceDto { id: string; name: string; pricingUnit: Unit; price: number; durationHours: number }

export interface CustomerDto { id: string; name: string; phoneWa: string | null; address: string | null; orderCount: number }

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
