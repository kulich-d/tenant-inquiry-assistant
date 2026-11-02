/**
 * Contact summary — the "Emailed" column for a tenant.
 *
 * Scenarios:
 * - No overdue invoice has been emailed about → "none" (Nobody yet).
 * - Some invoices emailed about → "some" with the count (e.g. 1 of 3).
 * - Every invoice emailed about → "all" with the most recent contact.
 * - Marks on other tenants' invoices don't count.
 * - Only known team members (Sarah, Jonas) are accepted as authors.
 */
import { describe, expect, it } from "vitest";

import { isTeamMember, summarizeContacts, type Contact } from "./contacts";

const contact = (invoiceId: string, sentBy: Contact["sentBy"], sentAt: string): Contact => ({
  invoiceId,
  sentBy,
  sentAt,
});

describe("summarizeContacts", () => {
  it("is 'none' when no invoice has been emailed about", () => {
    expect(summarizeContacts(["INV-1", "INV-2"], {})).toEqual({ kind: "none" });
  });

  it("counts contacted invoices when only some are covered", () => {
    const contacts = { "INV-1": contact("INV-1", "Jonas", "2026-08-12T10:00:00.000Z") };

    expect(summarizeContacts(["INV-1", "INV-2", "INV-3"], contacts)).toEqual({
      kind: "some",
      contacted: 1,
      total: 3,
    });
  });

  it("is 'all' with the most recent contact when every invoice is covered", () => {
    const older = contact("INV-1", "Jonas", "2026-08-12T10:00:00.000Z");
    const newer = contact("INV-2", "Sarah", "2026-10-09T10:00:00.000Z");

    expect(summarizeContacts(["INV-1", "INV-2"], { "INV-1": older, "INV-2": newer })).toEqual({
      kind: "all",
      total: 2,
      latest: newer,
    });
  });

  it("ignores contacts for other tenants' invoices", () => {
    const contacts = { "INV-OTHER": contact("INV-OTHER", "Sarah", "2026-10-01T10:00:00.000Z") };

    expect(summarizeContacts(["INV-1"], contacts)).toEqual({ kind: "none" });
  });
});

describe("isTeamMember", () => {
  it("accepts only known team members", () => {
    expect(isTeamMember("Sarah")).toBe(true);
    expect(isTeamMember("Jonas")).toBe(true);
    expect(isTeamMember("sarah")).toBe(false);
    expect(isTeamMember(null)).toBe(false);
  });
});
