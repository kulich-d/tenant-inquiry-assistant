/**
 * Matching payments without an invoice number by the tenant's full name.
 *
 * Scenarios:
 * - Reference is exactly the full name → matched; case, extra spaces and how "å" is encoded don't matter.
 * - First name only, surname only, "husleje <full name>", empty → not matched (guesses, next step).
 * - A name shared by two tenants → not matched.
 * - Goes to the owed invoice with the due date closest to the booking date (Victor: Feb + Jun, paid 31 May → Jun).
 * - Tie in distance → the older invoice.
 * - Invoices already paid in full (by invoice number or an earlier name match) are skipped;
 *   two payments for the same tenant close two invoices.
 * - Nothing owed → the payment is left unmatched.
 * - Payments that carry an invoice number are never re-matched.
 */
import { describe, expect, it } from "vitest";

import { matchPaymentsByFullName, normalizeName } from "./matching";
import type { Invoice, Payment } from "./types";

function invoice(id: string, period: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    tenantId: "T094",
    tenant: "Victor Kristensen",
    address: "",
    period,
    amount: 7200,
    issuedAt: `${period}-01`,
    dueAt: `${period}-01`,
    ...overrides,
  };
}

function payment(id: string, reference: string, bookedAt: string, invoiceId: string | null = null): Payment {
  return { id, bookedAt, amount: 7200, reference, invoiceId };
}

const FEB = invoice("INV-FEB", "2026-02");
const JUN = invoice("INV-JUN", "2026-06");

describe("normalizeName", () => {
  it("ignores case, surrounding and repeated spaces, and Unicode form", () => {
    expect(normalizeName("  Karen   Jørgensen ")).toBe("karen jørgensen");
    // "Kåre" typed as one character (å) vs. "a" + combining ring.
    expect(normalizeName("Kåre Holm")).toBe(normalizeName("Kåre Holm"));
  });
});

describe("matchPaymentsByFullName", () => {
  it("matches a reference that is exactly the tenant's full name", () => {
    const matches = matchPaymentsByFullName([JUN], [payment("PAY-1", "victor  KRISTENSEN ", "2026-05-31")]);

    expect(matches).toEqual(new Map([["PAY-1", "INV-JUN"]]));
  });

  it.each(["Victor", "Kristensen", "husleje Victor Kristensen", "husleje kristensen", "rent", ""])(
    "does not match %j",
    (reference) => {
      expect(matchPaymentsByFullName([JUN], [payment("PAY-1", reference, "2026-05-31")])).toEqual(new Map());
    },
  );

  it("does not match a name shared by two tenants", () => {
    const twin = invoice("INV-TWIN", "2026-06", { tenantId: "T999" });

    expect(matchPaymentsByFullName([JUN, twin], [payment("PAY-1", "Victor Kristensen", "2026-05-31")])).toEqual(
      new Map(),
    );
  });

  it("picks the owed invoice with the due date closest to the booking date", () => {
    // 31 May: 119 days after February's due date, 1 day before June's.
    const matches = matchPaymentsByFullName([FEB, JUN], [payment("PAY-1", "Victor Kristensen", "2026-05-31")]);

    expect(matches.get("PAY-1")).toBe("INV-JUN");
  });

  it("picks the older invoice when two are equally close", () => {
    const older = invoice("INV-OLDER", "2026-03", { dueAt: "2026-03-01" });
    const newer = invoice("INV-NEWER", "2026-03", { dueAt: "2026-03-21" });

    // 11 Mar is 10 days from both due dates.
    const matches = matchPaymentsByFullName([newer, older], [payment("PAY-1", "Victor Kristensen", "2026-03-11")]);

    expect(matches.get("PAY-1")).toBe("INV-OLDER");
  });

  it("skips an invoice already paid by invoice number", () => {
    const payments = [payment("PAY-LINKED", "INV-JUN", "2026-05-30", "INV-JUN"), payment("PAY-1", "Victor Kristensen", "2026-05-31")];

    expect(matchPaymentsByFullName([FEB, JUN], payments).get("PAY-1")).toBe("INV-FEB");
  });

  it("closes two invoices with two payments, oldest payment first", () => {
    const payments = [payment("PAY-2", "Victor Kristensen", "2026-06-02"), payment("PAY-1", "Victor Kristensen", "2026-05-31")];

    expect(matchPaymentsByFullName([FEB, JUN], payments)).toEqual(
      new Map([
        ["PAY-1", "INV-JUN"],
        ["PAY-2", "INV-FEB"],
      ]),
    );
  });

  it("leaves the payment unmatched when nothing is owed", () => {
    const payments = [payment("PAY-LINKED", "INV-JUN", "2026-05-30", "INV-JUN"), payment("PAY-1", "Victor Kristensen", "2026-05-31")];

    expect(matchPaymentsByFullName([JUN], payments)).toEqual(new Map());
  });

  it("never re-matches a payment that has an invoice number", () => {
    const linked = payment("PAY-1", "Victor Kristensen", "2026-05-31", "INV-FEB");

    expect(matchPaymentsByFullName([FEB, JUN], [linked])).toEqual(new Map());
  });
});
