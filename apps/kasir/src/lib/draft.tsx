// Draf transaksi yang sedang dibuat (S04 -> S05 -> S06). Id order dibuat sekali di awal dan dipakai ulang
// kalau kasir menekan simpan dua kali atau mengirim ulang setelah sinyal putus.
import { formatQty, lineTotal, type CustomerDto, type ServiceDto, type Unit } from "@lk/shared";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { uuid } from "./uuid";

export interface DraftLine { service: ServiceDto; qty: string } // qty memakai koma, mis. "3,25"
interface Draft { orderId: string; paymentId: string; customer: CustomerDto | null; lines: DraftLine[] }

interface DraftValue extends Draft {
  start: () => void;
  setCustomer: (c: CustomerDto) => void;
  toggleService: (s: ServiceDto) => void;
  setQty: (serviceId: string, qty: string) => void;
  reset: () => void;
  total: number;
  validLines: DraftLine[];
}

const fresh = (): Draft => ({ orderId: uuid(), paymentId: uuid(), customer: null, lines: [] });
const Ctx = createContext<DraftValue | null>(null);

export function safeFormatQty(qty: string, unit: Unit): string {
  try { return formatQty(qty, unit); } catch { return `${qty} ${unit}`; }
}

export function safeLineTotal(l: DraftLine): number {
  try { return lineTotal(l.qty, l.service.price); } catch { return 0; }
}

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [d, setD] = useState<Draft>(fresh);

  const start = useCallback(() => setD(fresh()), []);
  const reset = start;
  const setCustomer = useCallback((c: CustomerDto) => setD((x) => ({ ...x, customer: c })), []);
  const toggleService = useCallback(
    (s: ServiceDto) =>
      setD((x) =>
        x.lines.some((l) => l.service.id === s.id)
          ? { ...x, lines: x.lines.filter((l) => l.service.id !== s.id) }
          : { ...x, lines: [...x.lines, { service: s, qty: "1" }] },
      ),
    [],
  );
  const setQty = useCallback(
    (serviceId: string, qty: string) => setD((x) => ({ ...x, lines: x.lines.map((l) => (l.service.id === serviceId ? { ...l, qty } : l)) })),
    [],
  );

  const validLines = d.lines.filter((l) => safeLineTotal(l) > 0 && (l.service.pricingUnit === "kg" || /^\d+$/.test(l.qty)));
  const total = d.lines.reduce((a, l) => a + safeLineTotal(l), 0);
  const value = useMemo(
    () => ({ ...d, start, setCustomer, toggleService, setQty, reset, total, validLines }),
    [d, start, setCustomer, toggleService, setQty, reset, total, validLines],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDraft() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDraft di luar DraftProvider");
  return v;
}
