/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/** Rent period, `YYYY-MM`. */
export type Period = string;

export type Invoice = {
  id: string;
  tenantId: string;
  tenant: string;
  address: string;
  period: Period;
  amount: number;
  issuedAt: IsoDate;
  dueAt: IsoDate;
};

export type Payment = {
  id: string;
  bookedAt: IsoDate;
  amount: number;
  reference: string;
  /** Set only when the tenant typed the invoice number; `null` otherwise. */
  invoiceId: string | null;
};

export type InvoiceStatus = "unpaid" | "partial";

/** A bank payment as shown under its invoice. */
export type InvoicePayment = {
  paymentId: string;
  bookedAt: IsoDate;
  amount: number;
};

export type OverdueInvoice = {
  invoiceId: string;
  period: Period;
  amount: number;
  paid: number;
  remaining: number;
  dueAt: IsoDate;
  daysOverdue: number;
  status: InvoiceStatus;
  /** Oldest first. */
  payments: InvoicePayment[];
};

/** An invoice past its due date with money still owed — before the grace period is applied. */
export type OpenInvoice = OverdueInvoice & {
  tenantId: string;
  tenant: string;
  address: string;
};

/** What the server hands the page: every open invoice and the date the data is valid for. */
export type LedgerSnapshot = {
  asOf: IsoDate;
  openInvoices: OpenInvoice[];
};

export type TenantStatus = "late" | "partial";

export type TenantDebt = {
  tenantId: string;
  tenant: string;
  address: string;
  status: TenantStatus;
  totalRemaining: number;
  maxDaysOverdue: number;
  /** Oldest first. */
  invoices: OverdueInvoice[];
};
