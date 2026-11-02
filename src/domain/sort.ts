import type { TenantDebt } from "./types";

export type SortDirection = "asc" | "desc";

/** Sorted copy by days overdue. Ties: name. */
export function sortByDaysOverdue(debts: readonly TenantDebt[], direction: SortDirection): TenantDebt[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...debts].sort((a, b) => sign * (a.maxDaysOverdue - b.maxDaysOverdue) || a.tenant.localeCompare(b.tenant));
}
