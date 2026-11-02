import { daysBetween } from "./dates";
import type { Invoice, Payment } from "./types";

/** "  Karen  Jørgensen " → "karen jørgensen". NFC so "ø" typed two ways compares equal. */
export function normalizeName(value: string): string {
  return value.normalize("NFC").toLowerCase().trim().split(/\s+/).join(" ");
}

/** normalized full name → tenantId. A name shared by two tenants is left out, so it never matches. */
function nameDirectory(invoices: readonly Invoice[]): Map<string, string> {
  const tenantsByName = new Map<string, Set<string>>();
  for (const i of invoices) {
    const name = normalizeName(i.tenant);
    tenantsByName.set(name, (tenantsByName.get(name) ?? new Set()).add(i.tenantId));
  }
  const directory = new Map<string, string>();
  for (const [name, tenants] of tenantsByName) {
    const [only] = tenants;
    if (tenants.size === 1 && only) directory.set(name, only);
  }
  return directory;
}

/**
 * Matches payments without an invoice number whose reference is exactly a tenant's full name.
 * Each goes to that tenant's still-owed invoice with the due date closest to the booking date
 * (tie → older), oldest payment first. Returns paymentId → invoiceId.
 */
export function matchPaymentsByFullName(
  invoices: readonly Invoice[],
  payments: readonly Payment[],
): Map<string, string> {
  const directory = nameDirectory(invoices);

  const paid = new Map<string, number>();
  for (const p of payments) {
    if (p.invoiceId !== null) paid.set(p.invoiceId, (paid.get(p.invoiceId) ?? 0) + p.amount);
  }
  const owes = (i: Invoice) => (paid.get(i.id) ?? 0) < i.amount;

  const byName = payments
    .filter((p) => p.invoiceId === null && directory.has(normalizeName(p.reference)))
    .sort((a, b) => a.bookedAt.localeCompare(b.bookedAt) || a.id.localeCompare(b.id));

  const matches = new Map<string, string>();
  for (const payment of byName) {
    const tenantId = directory.get(normalizeName(payment.reference));
    const distance = (i: Invoice) => Math.abs(daysBetween(i.dueAt, payment.bookedAt));
    const target = invoices
      .filter((i) => i.tenantId === tenantId && owes(i))
      .sort((a, b) => distance(a) - distance(b) || a.dueAt.localeCompare(b.dueAt))[0];
    if (!target) continue;

    matches.set(payment.id, target.id);
    paid.set(target.id, (paid.get(target.id) ?? 0) + payment.amount);
  }
  return matches;
}
