import type { LateTenantsReport, OverdueInvoice, Period, TenantDebt } from "@/domain/types";

// Hand-picked tenants from the dataset, as of 2026-10-13 with a 7-day grace period.
// Covers each case the UI must show: fully unpaid, paid in halves, one vs. several invoices.

function invoice(
  invoiceId: string,
  period: Period,
  amount: number,
  paid: number,
  daysOverdue: number,
): OverdueInvoice {
  return {
    invoiceId,
    period,
    amount,
    paid,
    remaining: amount - paid,
    dueAt: `${period}-01`,
    daysOverdue,
    status: paid === 0 ? "unpaid" : "partial",
  };
}

function tenant(tenantId: string, name: string, address: string, invoices: OverdueInvoice[]): TenantDebt {
  return {
    tenantId,
    tenant: name,
    address,
    status: invoices.some((i) => i.status === "unpaid") ? "late" : "partial",
    totalRemaining: invoices.reduce((sum, i) => sum + i.remaining, 0),
    maxDaysOverdue: Math.max(...invoices.map((i) => i.daysOverdue)),
    invoices,
  };
}

export const LATE_TENANTS_FIXTURE: LateTenantsReport = {
  asOf: "2026-10-13",
  graceDays: 7,
  tenants: [
    tenant("T045", "Frederik Hassan", "Vesterbrogade 86, 2. tv", [
      invoice("INV-0529", "2025-11", 9400, 4700, 346),
      invoice("INV-0530", "2025-12", 9400, 4700, 316),
      invoice("INV-0538", "2026-08", 9400, 4700, 73),
    ]),
    tenant("T082", "Mette Frandsen", "Blegdamsvej 39, 2. th", [
      invoice("INV-0976", "2026-01", 7900, 3950, 285),
      invoice("INV-0984", "2026-09", 7900, 3950, 42),
    ]),
    tenant("T017", "Clara Nielsen", "Amagerbrogade 55, 4. th", [
      invoice("INV-0199", "2026-05", 13900, 6950, 165),
      invoice("INV-0200", "2026-06", 13900, 6950, 134),
      invoice("INV-0201", "2026-07", 13900, 6950, 104),
      invoice("INV-0203", "2026-09", 13900, 6950, 42),
    ]),
    tenant("T057", "Rasmus Pedersen", "Vesterbrogade 106, 3. mf", [
      invoice("INV-0683", "2026-08", 11800, 0, 73),
      invoice("INV-0685", "2026-10", 11800, 0, 12),
    ]),
    tenant("T024", "Amira Johansen", "Nørrebrogade 28, 4. th", [
      invoice("INV-0288", "2026-10", 8500, 0, 12),
    ]),
    tenant("T073", "Clara Lund", "Nørrebrogade 80, 1. tv", [
      invoice("INV-0877", "2026-10", 13900, 0, 12),
    ]),
    tenant("T014", "Line Bach", "Frederiksborggade 12, 1. th", [
      invoice("INV-0168", "2026-10", 11000, 0, 12),
    ]),
    tenant("T091", "Sara Sørensen", "Østerbrogade 35, 4. tv", [
      invoice("INV-1093", "2026-10", 7200, 0, 12),
    ]),
  ],
};
