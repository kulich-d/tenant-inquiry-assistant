import { buildLedgerSnapshot } from "@/domain/ledger";
import type { Invoice, LedgerData, Payment } from "@/domain/types";

// A slice of the real dataset, small enough to reason about in UI tests. As of 2026-10-13:
// - Rasmus Pedersen: Aug + Oct unpaid (73 and 12 days)
// - Clara Nielsen: Sep half paid by invoice number, then 3.475 kr by full name (42 days)
// - Line Bach: Oct unpaid (12 days); a payment signed "husleje bach" waits for review
// - Sara Andersen: Oct paid in full — never listed

const AS_OF = "2026-10-13";

const invoice = (
  id: string,
  tenantId: string,
  tenant: string,
  address: string,
  period: string,
  amount: number,
): Invoice => ({ id, tenantId, tenant, address, period, amount, issuedAt: `${period}-01`, dueAt: `${period}-01` });

const INVOICES: Invoice[] = [
  invoice("INV-0683", "T057", "Rasmus Pedersen", "Vesterbrogade 106, 3. mf", "2026-08", 11800),
  invoice("INV-0685", "T057", "Rasmus Pedersen", "Vesterbrogade 106, 3. mf", "2026-10", 11800),
  invoice("INV-0203", "T017", "Clara Nielsen", "Amagerbrogade 55, 4. th", "2026-09", 13900),
  invoice("INV-0168", "T014", "Line Bach", "Frederiksborggade 12, 1. th", "2026-10", 11000),
  invoice("INV-0012", "T001", "Sara Andersen", "Gammel Kongevej 85, st. tv", "2026-10", 12500),
];

const PAYMENTS: Payment[] = [
  { id: "PAY-1", bookedAt: "2026-08-31", amount: 6950, reference: "INV-0203", invoiceId: "INV-0203" },
  { id: "PAY-3", bookedAt: "2026-09-15", amount: 3475, reference: "Clara Nielsen", invoiceId: null },
  { id: "PAY-4", bookedAt: "2026-10-02", amount: 11000, reference: "husleje bach", invoiceId: null },
  { id: "PAY-2", bookedAt: AS_OF, amount: 12500, reference: "INV-0012", invoiceId: "INV-0012" },
];

export const TEST_LEDGER: LedgerData = { invoices: INVOICES, payments: PAYMENTS };

export const TEST_SNAPSHOT = buildLedgerSnapshot(TEST_LEDGER, []);
