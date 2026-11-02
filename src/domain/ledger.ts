import { computeOpenInvoices, latestBookingDate } from "./debt";
import { findSuggestions } from "./matching";
import type { LedgerData, LedgerSnapshot, PaymentRule } from "./types";

/** Everything the page needs from the exports, given the rules confirmed so far. */
export function buildLedgerSnapshot({ invoices, payments }: LedgerData, rules: readonly PaymentRule[]): LedgerSnapshot {
  const asOf = latestBookingDate(payments);
  const tenantNames = new Map(invoices.map((i) => [i.tenantId, i.tenant]));

  return {
    asOf,
    tenantCount: tenantNames.size,
    openInvoices: computeOpenInvoices(invoices, payments, asOf, rules),
    suggestions: findSuggestions(invoices, payments, rules),
    rules: rules
      .map((r) => ({ ...r, tenant: tenantNames.get(r.tenantId) ?? r.tenantId }))
      .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt)),
  };
}
