/**
 * Sorting the late list by Status (days overdue).
 *
 * Scenarios:
 * - Most overdue first, and least overdue first.
 * - Ties are ordered by name.
 * - The input list is not mutated.
 */
import { describe, expect, it } from "vitest";

import { sortByDaysOverdue } from "./sort";
import type { TenantDebt } from "./types";

const tenant = (name: string, maxDaysOverdue: number): TenantDebt => ({
  tenantId: name,
  tenant: name,
  address: "",
  status: "late",
  totalRemaining: 0,
  maxDaysOverdue,
  invoices: [],
});

const DEBTS = [tenant("Magnus", 12), tenant("Alma", 346), tenant("Clara", 42)];
const names = (debts: TenantDebt[]) => debts.map((d) => d.tenant);

describe("sortByDaysOverdue", () => {
  it("puts the most overdue first", () => {
    expect(names(sortByDaysOverdue(DEBTS, "desc"))).toEqual(["Alma", "Clara", "Magnus"]);
  });

  it("puts the least overdue first", () => {
    expect(names(sortByDaysOverdue(DEBTS, "asc"))).toEqual(["Magnus", "Clara", "Alma"]);
  });

  it("orders ties by name", () => {
    expect(names(sortByDaysOverdue([tenant("Bo", 12), tenant("Ada", 12)], "desc"))).toEqual(["Ada", "Bo"]);
  });

  it("does not mutate the input", () => {
    const input = [...DEBTS];

    sortByDaysOverdue(input, "asc");

    expect(input).toEqual(DEBTS);
  });
});
