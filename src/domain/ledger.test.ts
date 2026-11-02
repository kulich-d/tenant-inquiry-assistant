/**
 * Ledger snapshot — what the page gets, before and after Sarah confirms a rule.
 *
 * Scenarios:
 * - Without rules: a payment signed "husleje bach" is a suggestion and Line Bach still owes October.
 * - With the rule confirmed: October is paid (labelled "confirmed by Sarah"), the suggestion is gone,
 *   and the rule is listed with the tenant's name.
 * - Counts every tenant, late or not; as-of is the latest booking.
 */
import { describe, expect, it } from "vitest";

import { TEST_LEDGER } from "@/test/ledgerFixture";

import { buildLedgerSnapshot } from "./ledger";
import type { PaymentRule } from "./types";

const BACH: PaymentRule = {
  signature: "bach",
  amount: 11000,
  tenantId: "T014",
  confirmedBy: "Sarah",
  confirmedAt: "2026-11-02T09:00:00.000Z",
};

const lineBachOpen = (rules: PaymentRule[]) =>
  buildLedgerSnapshot(TEST_LEDGER, rules).openInvoices.filter((i) => i.tenantId === "T014");

describe("buildLedgerSnapshot", () => {
  it("suggests the payment signed 'husleje bach' and keeps Line Bach's October open", () => {
    const snapshot = buildLedgerSnapshot(TEST_LEDGER, []);

    expect(snapshot.suggestions).toMatchObject([{ signature: "bach", amount: 11000, suggestedTenantId: "T014" }]);
    expect(lineBachOpen([])).toHaveLength(1);
  });

  it("applies a confirmed rule: the invoice is paid and the suggestion is gone", () => {
    const snapshot = buildLedgerSnapshot(TEST_LEDGER, [BACH]);

    expect(lineBachOpen([BACH])).toEqual([]);
    expect(snapshot.suggestions).toEqual([]);
    expect(snapshot.rules).toEqual([{ ...BACH, tenant: "Line Bach" }]);
  });

  it("counts every tenant and uses the latest booking as the as-of date", () => {
    const snapshot = buildLedgerSnapshot(TEST_LEDGER, []);

    expect(snapshot.tenantCount).toBe(4);
    expect(snapshot.asOf).toBe("2026-10-13");
  });
});
