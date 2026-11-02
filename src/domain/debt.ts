import { daysBetween } from "./dates";
import type {
  Invoice,
  InvoicePayment,
  IsoDate,
  OpenInvoice,
  OverdueInvoice,
  Payment,
  TenantDebt,
} from "./types";

export const DEFAULT_GRACE_DAYS = 7;
export const MAX_GRACE_DAYS = 60;

/** A grace period typed by the user: whole days, 0–60. `null` if not valid. */
export function parseGraceDays(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
  const days = Number(raw);
  return days <= MAX_GRACE_DAYS ? days : null;
}

/** Latest booking date in the bank export — the freshest point the data describes. */
export function latestBookingDate(payments: readonly Payment[]): IsoDate {
  const first = payments[0];
  if (!first) throw new Error("No payments to derive the as-of date from");
  return payments.reduce((max, p) => (p.bookedAt > max ? p.bookedAt : max), first.bookedAt);
}

/** Payments per invoice, oldest first. Unlinked payments (`invoiceId = null`) are out of scope for v1. */
function paymentsByInvoice(payments: readonly Payment[]): Map<string, InvoicePayment[]> {
  const byInvoice = new Map<string, InvoicePayment[]>();
  for (const p of payments) {
    if (p.invoiceId === null) continue;
    const list = byInvoice.get(p.invoiceId) ?? [];
    list.push({ paymentId: p.id, bookedAt: p.bookedAt, amount: p.amount });
    byInvoice.set(p.invoiceId, list);
  }
  for (const list of byInvoice.values()) list.sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  return byInvoice;
}

/**
 * Every invoice that is past due on `asOf` and not fully paid, with its payments.
 * The grace period is applied later, so it can change without recomputing this.
 */
export function computeOpenInvoices(
  invoices: readonly Invoice[],
  payments: readonly Payment[],
  asOf: IsoDate,
): OpenInvoice[] {
  const byInvoice = paymentsByInvoice(payments);
  const open: OpenInvoice[] = [];

  for (const invoice of invoices) {
    const daysOverdue = daysBetween(invoice.dueAt, asOf);
    if (daysOverdue <= 0) continue;

    const invoicePayments = byInvoice.get(invoice.id) ?? [];
    const paid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = invoice.amount - paid;
    if (remaining <= 0) continue;

    open.push({
      invoiceId: invoice.id,
      tenantId: invoice.tenantId,
      tenant: invoice.tenant,
      address: invoice.address,
      period: invoice.period,
      amount: invoice.amount,
      paid,
      remaining,
      dueAt: invoice.dueAt,
      daysOverdue,
      status: paid === 0 ? "unpaid" : "partial",
      payments: invoicePayments,
    });
  }
  return open;
}

/** An invoice counts as late only once `graceDays` have passed: 7 days with grace 7 is not late, 8 is. */
export const isOverdue = (invoice: OpenInvoice, graceDays: number) => invoice.daysOverdue > graceDays;

/** Tenants with at least one overdue invoice, most overdue first; their invoices oldest first. */
export function groupLateTenants(openInvoices: readonly OpenInvoice[], graceDays: number): TenantDebt[] {
  const byTenant = new Map<string, TenantDebt>();

  for (const open of openInvoices) {
    if (!isOverdue(open, graceDays)) continue;

    const { tenantId, tenant, address, ...invoice } = open;
    const debt = byTenant.get(tenantId) ?? {
      tenantId,
      tenant,
      address,
      status: "partial",
      totalRemaining: 0,
      maxDaysOverdue: 0,
      invoices: [] as OverdueInvoice[],
    };
    debt.invoices.push(invoice);
    debt.totalRemaining += invoice.remaining;
    debt.maxDaysOverdue = Math.max(debt.maxDaysOverdue, invoice.daysOverdue);
    if (invoice.status === "unpaid") debt.status = "late";
    byTenant.set(tenantId, debt);
  }

  const debts = [...byTenant.values()];
  for (const d of debts) d.invoices.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return debts.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || a.tenant.localeCompare(b.tenant));
}
