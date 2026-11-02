/**
 * Emailed marks — the "Emailed" column for a tenant, and local tick/untick.
 *
 * Scenarios:
 * - No overdue invoice has been emailed about → "none" (Nobody yet).
 * - Some invoices emailed about → "some" with the count (e.g. 1 of 3).
 * - Every invoice emailed about → "all" with the most recent mark.
 * - Marks on other tenants' invoices don't count.
 * - Local tick/untick (used for optimistic UI): adds marks, never overwrites an existing one, removes without mutating.
 */
import { describe, expect, it } from "vitest";

import { applyEmailedMarkChange, summarizeEmailedMarks, type EmailedMark } from "./emailed-marks";

const mark = (invoiceId: string, sentBy: EmailedMark["sentBy"], sentAt: string): EmailedMark => ({
  invoiceId,
  sentBy,
  sentAt,
});

describe("summarizeEmailedMarks", () => {
  it("is 'none' when no invoice has been emailed about", () => {
    expect(summarizeEmailedMarks(["INV-1", "INV-2"], {})).toEqual({ kind: "none" });
  });

  it("counts emailed invoices when only some are covered", () => {
    const marks = { "INV-1": mark("INV-1", "Jonas", "2026-08-12T10:00:00.000Z") };

    expect(summarizeEmailedMarks(["INV-1", "INV-2", "INV-3"], marks)).toEqual({
      kind: "some",
      emailed: 1,
      total: 3,
    });
  });

  it("is 'all' with the most recent mark when every invoice is covered", () => {
    const older = mark("INV-1", "Jonas", "2026-08-12T10:00:00.000Z");
    const newer = mark("INV-2", "Sarah", "2026-10-09T10:00:00.000Z");

    expect(summarizeEmailedMarks(["INV-1", "INV-2"], { "INV-1": older, "INV-2": newer })).toEqual({
      kind: "all",
      total: 2,
      latest: newer,
    });
  });

  it("ignores marks on other tenants' invoices", () => {
    const marks = { "INV-OTHER": mark("INV-OTHER", "Sarah", "2026-10-01T10:00:00.000Z") };

    expect(summarizeEmailedMarks(["INV-1"], marks)).toEqual({ kind: "none" });
  });
});

describe("applyEmailedMarkChange", () => {
  const sarahs = mark("INV-1", "Sarah", "2026-10-01T10:00:00.000Z");

  it("adds marks for the given invoices", () => {
    const next = applyEmailedMarkChange({}, { type: "mark", invoiceIds: ["INV-1", "INV-2"], sentBy: "Jonas", sentAt: "t" });

    expect(Object.keys(next)).toEqual(["INV-1", "INV-2"]);
  });

  it("never overwrites an existing mark", () => {
    const next = applyEmailedMarkChange({ "INV-1": sarahs }, { type: "mark", invoiceIds: ["INV-1"], sentBy: "Jonas", sentAt: "t" });

    expect(next["INV-1"]).toBe(sarahs);
  });

  it("removes marks and leaves the original untouched", () => {
    const before = { "INV-1": sarahs };

    expect(applyEmailedMarkChange(before, { type: "unmark", invoiceIds: ["INV-1"] })).toEqual({});
    expect(before).toEqual({ "INV-1": sarahs });
  });
});
