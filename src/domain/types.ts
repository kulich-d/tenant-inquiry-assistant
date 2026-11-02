import type { TeamMember } from "./contacts";

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
  reference: string;
  /**
   * "invoice": the tenant typed the invoice number. "name": the reference was exactly their full name.
   * "confirmed": the reference was part of a name and someone confirmed who it was.
   */
  matchedBy: "invoice" | "name" | "confirmed";
  confirmedBy?: TeamMember;
};

/** Sarah's answer to "who signs payments like this?": signature + amount → tenant. */
export type PaymentRule = {
  /** Normalized reference without filler words, e.g. "husleje Schmidt" → "schmidt". */
  signature: string;
  amount: number;
  tenantId: string;
  confirmedBy: TeamMember;
  /** ISO timestamp. */
  confirmedAt: string;
};

export type ConfirmedRule = PaymentRule & { tenant: string };

export type SuggestionCandidate = {
  tenantId: string;
  tenant: string;
  /** False if every invoice of theirs is already paid — then they're an unlikely payer. */
  owesSomething: boolean;
};

/** Unlinked payments that share a signature and amount, and who might have sent them. */
export type PaymentSuggestion = {
  signature: string;
  amount: number;
  /** Oldest first. */
  payments: { paymentId: string; bookedAt: IsoDate; reference: string }[];
  candidates: SuggestionCandidate[];
  /** The only candidate, or the only one who still owes something; `null` if Sarah has to choose. */
  suggestedTenantId: string | null;
};

/** Parsed exports, before any matching. */
export type LedgerData = {
  invoices: Invoice[];
  payments: Payment[];
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
  /** All tenants with at least one invoice — late or not. */
  tenantCount: number;
  openInvoices: OpenInvoice[];
  /** Payments signed with part of a name, waiting for someone to confirm who sent them. */
  suggestions: PaymentSuggestion[];
  rules: ConfirmedRule[];
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
