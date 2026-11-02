"use client";

import { useMemo } from "react";

import { groupLateTenants } from "@/domain/debt";
import type { LedgerSnapshot } from "@/domain/types";
import { formatDate, formatKr } from "@/lib/format";

import { GracePeriodInput } from "./grace-period-input";
import { LateRentTable } from "./late-rent-table";
import { useGraceDays } from "./stores";
import { UserSwitcher } from "./user-switcher";

export function LateRentView({ snapshot }: { snapshot: LedgerSnapshot }) {
  const [graceDays] = useGraceDays();
  const tenants = useMemo(
    () => groupLateTenants(snapshot.openInvoices, graceDays),
    [snapshot.openInvoices, graceDays],
  );
  const totalOwed = tenants.reduce((sum, t) => sum + t.totalRemaining, 0);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Late rent</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bank data as of {formatDate(snapshot.asOf)}</p>
          <p className="mt-1 text-sm" aria-live="polite">
            {tenants.length} {tenants.length === 1 ? "tenant" : "tenants"} · {formatKr(totalOwed)} outstanding
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <GracePeriodInput />
          <UserSwitcher />
        </div>
      </header>
      <LateRentTable debts={tenants} />
    </>
  );
}
