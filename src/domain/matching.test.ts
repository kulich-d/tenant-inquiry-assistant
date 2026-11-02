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
 * - Signature: filler words ("husleje", "rent") and periods are removed; nothing left → not a name.
 * - A confirmed rule (signature + amount → tenant) matches every such payment, with the same allocation.
 * - Suggestions: grouped by signature + amount; candidates by rent and name words; suggest the only
 *   candidate, or the only one who still owes; otherwise Sarah chooses. Full-name, no-name and
 *   already-confirmed payments are not suggested.
 */
import { describe, expect, it } from "vitest";

import { findSuggestions, matchUnlinkedPayments, normalizeName, signature } from "./matching";
import type { Invoice, Payment, PaymentRule } from "./types";

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

/** paymentId → invoiceId, for the full-name cases. */
const matchByFullName = (invoices: Invoice[], payments: Payment[]) =>
  new Map([...matchUnlinkedPayments(invoices, payments)].map(([paymentId, m]) => [paymentId, m.invoiceId]));

const rule = (overrides: Partial<PaymentRule>): PaymentRule => ({
  signature: "victor",
  amount: 7200,
  tenantId: "T094",
  confirmedBy: "Sarah",
  confirmedAt: "2026-11-02T09:00:00.000Z",
  ...overrides,
});

describe("normalizeName", () => {
  it("ignores case, surrounding and repeated spaces, and Unicode form", () => {
    expect(normalizeName("  Karen   Jørgensen ")).toBe("karen jørgensen");
    // "Kåre" typed as one character (å) vs. "a" + combining ring.
    expect(normalizeName("Kåre Holm")).toBe(normalizeName("Kåre Holm"));
  });
});

describe("matchUnlinkedPayments — full name", () => {
  it("matches a reference that is exactly the tenant's full name", () => {
    const matches = matchByFullName([JUN], [payment("PAY-1", "victor  KRISTENSEN ", "2026-05-31")]);

    expect(matches).toEqual(new Map([["PAY-1", "INV-JUN"]]));
  });

  it.each(["Victor", "Kristensen", "husleje Victor Kristensen", "husleje kristensen", "rent", ""])(
    "does not match %j",
    (reference) => {
      expect(matchByFullName([JUN], [payment("PAY-1", reference, "2026-05-31")])).toEqual(new Map());
    },
  );

  it("does not match a name shared by two tenants", () => {
    const twin = invoice("INV-TWIN", "2026-06", { tenantId: "T999" });

    expect(matchByFullName([JUN, twin], [payment("PAY-1", "Victor Kristensen", "2026-05-31")])).toEqual(
      new Map(),
    );
  });

  it("picks the owed invoice with the due date closest to the booking date", () => {
    // 31 May: 119 days after February's due date, 1 day before June's.
    const matches = matchByFullName([FEB, JUN], [payment("PAY-1", "Victor Kristensen", "2026-05-31")]);

    expect(matches.get("PAY-1")).toBe("INV-JUN");
  });

  it("picks the older invoice when two are equally close", () => {
    const older = invoice("INV-OLDER", "2026-03", { dueAt: "2026-03-01" });
    const newer = invoice("INV-NEWER", "2026-03", { dueAt: "2026-03-21" });

    // 11 Mar is 10 days from both due dates.
    const matches = matchByFullName([newer, older], [payment("PAY-1", "Victor Kristensen", "2026-03-11")]);

    expect(matches.get("PAY-1")).toBe("INV-OLDER");
  });

  it("skips an invoice already paid by invoice number", () => {
    const payments = [payment("PAY-LINKED", "INV-JUN", "2026-05-30", "INV-JUN"), payment("PAY-1", "Victor Kristensen", "2026-05-31")];

    expect(matchByFullName([FEB, JUN], payments).get("PAY-1")).toBe("INV-FEB");
  });

  it("closes two invoices with two payments, oldest payment first", () => {
    const payments = [payment("PAY-2", "Victor Kristensen", "2026-06-02"), payment("PAY-1", "Victor Kristensen", "2026-05-31")];

    expect(matchByFullName([FEB, JUN], payments)).toEqual(
      new Map([
        ["PAY-1", "INV-JUN"],
        ["PAY-2", "INV-FEB"],
      ]),
    );
  });

  it("leaves the payment unmatched when nothing is owed", () => {
    const payments = [payment("PAY-LINKED", "INV-JUN", "2026-05-30", "INV-JUN"), payment("PAY-1", "Victor Kristensen", "2026-05-31")];

    expect(matchByFullName([JUN], payments)).toEqual(new Map());
  });

  it("never re-matches a payment that has an invoice number", () => {
    const linked = payment("PAY-1", "Victor Kristensen", "2026-05-31", "INV-FEB");

    expect(matchByFullName([FEB, JUN], [linked])).toEqual(new Map());
  });
});

describe("signature", () => {
  it.each([
    ["husleje Schmidt", "schmidt"],
    ["  Alma ", "alma"],
    ["2026-02 rent Kasper", "kasper"],
    ["rent", ""],
    ["husleje", ""],
    ["2026-02 rent", ""],
    ["", ""],
  ])("%j → %j", (reference, expected) => {
    expect(signature(reference)).toBe(expected);
  });
});

describe("matchUnlinkedPayments — confirmed rules", () => {
  it("applies a confirmed rule to every payment with that signature and amount", () => {
    const payments = [payment("PAY-1", "Victor", "2026-01-31"), payment("PAY-2", "husleje victor", "2026-05-31")];

    const matches = matchUnlinkedPayments([FEB, JUN], payments, [rule({})]);

    expect(matches).toEqual(
      new Map([
        ["PAY-1", { invoiceId: "INV-FEB", matchedBy: "confirmed", confirmedBy: "Sarah" }],
        ["PAY-2", { invoiceId: "INV-JUN", matchedBy: "confirmed", confirmedBy: "Sarah" }],
      ]),
    );
  });

  it("needs the amount to match the rule too", () => {
    const other = { ...payment("PAY-1", "Victor", "2026-05-31"), amount: 3600 };

    expect(matchUnlinkedPayments([JUN], [other], [rule({})])).toEqual(new Map());
  });

  it("does nothing without a rule", () => {
    expect(matchUnlinkedPayments([JUN], [payment("PAY-1", "Victor", "2026-05-31")])).toEqual(new Map());
  });
});

describe("findSuggestions", () => {
  // Two Almas with the same rent; Alma Hassan has paid everything by invoice number.
  const almaAndersen = invoice("INV-AA", "2026-06", { tenantId: "T066", tenant: "Alma Andersen", amount: 8500 });
  const almaHassan = invoice("INV-AH", "2026-06", { tenantId: "T069", tenant: "Alma Hassan", amount: 8500 });
  const hassanPaid = { ...payment("PAY-AH", "INV-AH", "2026-06-01", "INV-AH"), amount: 8500 };
  const alma = (id: string, bookedAt: string) => ({ ...payment(id, "Alma", bookedAt), amount: 8500 });

  it("groups payments by signature and amount, oldest first", () => {
    const [group] = findSuggestions([JUN], [payment("PAY-2", "husleje victor", "2026-06-02"), payment("PAY-1", "Victor", "2026-05-31")]);

    expect(group).toMatchObject({ signature: "victor", amount: 7200, suggestedTenantId: "T094" });
    expect(group?.payments.map((p) => p.paymentId)).toEqual(["PAY-1", "PAY-2"]);
  });

  it("suggests the only candidate", () => {
    const [group] = findSuggestions([JUN], [payment("PAY-1", "Kristensen", "2026-05-31")]);

    expect(group?.candidates).toEqual([{ tenantId: "T094", tenant: "Victor Kristensen", owesSomething: true }]);
    expect(group?.suggestedTenantId).toBe("T094");
  });

  it("suggests the only candidate who still owes something", () => {
    const [group] = findSuggestions([almaAndersen, almaHassan], [hassanPaid, alma("PAY-1", "2026-06-01")]);

    expect(group?.candidates.map((c) => [c.tenant, c.owesSomething])).toEqual([
      ["Alma Andersen", true],
      ["Alma Hassan", false],
    ]);
    expect(group?.suggestedTenantId).toBe("T066");
  });

  it("leaves the choice to Sarah when both candidates owe something", () => {
    const [group] = findSuggestions([almaAndersen, almaHassan], [alma("PAY-1", "2026-06-01")]);

    expect(group?.candidates).toHaveLength(2);
    expect(group?.suggestedTenantId).toBeNull();
  });

  it("only considers tenants whose rent equals the amount", () => {
    const wrongAmount = { ...payment("PAY-1", "Victor", "2026-05-31"), amount: 9999 };

    expect(findSuggestions([JUN], [wrongAmount])).toEqual([]);
  });

  it.each([
    ["a full-name payment (matched automatically)", "Victor Kristensen"],
    ["a payment with no name", "husleje"],
    ["a name nobody has", "Zed"],
  ])("does not suggest %s", (_, reference) => {
    expect(findSuggestions([JUN], [payment("PAY-1", reference, "2026-05-31")])).toEqual([]);
  });

  it("stops suggesting a pattern once it is confirmed", () => {
    expect(findSuggestions([JUN], [payment("PAY-1", "Victor", "2026-05-31")], [rule({})])).toEqual([]);
  });
});
