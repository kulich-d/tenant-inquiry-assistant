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

export type OverdueInvoice = {
  invoiceId: string;
  period: Period;
  amount: number;
  paid: number;
  remaining: number;
  dueAt: IsoDate;
  daysOverdue: number;
  status: InvoiceStatus;
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

/** What the page needs: the late list and the parameters it was computed with. */
export type LateTenantsReport = {
  asOf: IsoDate;
  graceDays: number;
  /** Most overdue first. */
  tenants: TenantDebt[];
};
