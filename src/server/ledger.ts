import "server-only";

import { cacheLife } from "next/cache";
import { z } from "zod";

import invoicesJson from "../../data/invoices.json";
import paymentsJson from "../../data/payments.json";
import { computeOpenInvoices, latestBookingDate } from "@/domain/debt";
import type { Invoice, LedgerSnapshot, Payment } from "@/domain/types";

// Parse at the boundary: the raw exports are snake_case and untrusted.

const isoDate = z.iso.date();

const invoiceSchema = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    tenant: z.string(),
    address: z.string(),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.number().int().positive(),
    issued_at: isoDate,
    due_at: isoDate,
  })
  .transform(
    (r): Invoice => ({
      id: r.id,
      tenantId: r.tenant_id,
      tenant: r.tenant,
      address: r.address,
      period: r.period,
      amount: r.amount,
      issuedAt: r.issued_at,
      dueAt: r.due_at,
    }),
  );

const paymentSchema = z
  .object({
    id: z.string(),
    booked_at: isoDate,
    amount: z.number().int().positive(),
    reference: z.string(),
    invoice_id: z.string().nullable(),
  })
  .transform(
    (r): Payment => ({
      id: r.id,
      bookedAt: r.booked_at,
      amount: r.amount,
      reference: r.reference,
      invoiceId: r.invoice_id,
    }),
  );

/**
 * Open invoices as of the latest bank booking. Only this goes to the browser —
 * the grace period is applied there so Sarah can change it instantly.
 * Cached: the exports are static files, so this runs once, not per request.
 */
export async function getLedgerSnapshot(): Promise<LedgerSnapshot> {
  "use cache";
  cacheLife("max");

  const invoices = z.array(invoiceSchema).parse(invoicesJson);
  const payments = z.array(paymentSchema).parse(paymentsJson);
  const asOf = latestBookingDate(payments);
  return {
    asOf,
    tenantCount: new Set(invoices.map((i) => i.tenantId)).size,
    openInvoices: computeOpenInvoices(invoices, payments, asOf),
  };
}
