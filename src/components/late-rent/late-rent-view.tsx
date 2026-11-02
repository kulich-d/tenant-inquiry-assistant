"use client";

import { useMemo } from "react";

import type { EmailedMarksByInvoice } from "@/domain/emailed-marks";
import { groupLateTenants } from "@/domain/debt";
import type { LedgerSnapshot, PaymentSuggestion } from "@/domain/types";
import { formatDate, formatKr } from "@/lib/format";

import { GracePeriodInput } from "./grace-period-input";
import { LateRentTable } from "./late-rent-table";
import { ReviewPanel } from "./review-panel";
import { useGraceDays } from "./stores";
import { UserSwitcher } from "./user-switcher";

type Props = {
  snapshot: LedgerSnapshot;
  marks: EmailedMarksByInvoice;
};

export function LateRentView({ snapshot, marks }: Props) {
  const [graceDays] = useGraceDays();
  const tenants = useMemo(
    () => groupLateTenants(snapshot.openInvoices, graceDays),
    [snapshot.openInvoices, graceDays],
  );
  const totalOwed = tenants.reduce((sum, t) => sum + t.totalRemaining, 0);
  const paymentsToReview = useMemo(() => countPaymentsToReview(snapshot.suggestions), [snapshot.suggestions]);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Late rent</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bank data as of {formatDate(snapshot.asOf)}</p>
          <p className="mt-1 text-sm" aria-live="polite">
            {tenants.length} of {snapshot.tenantCount} tenants late · {formatKr(totalOwed)} outstanding
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <GracePeriodInput />
          <UserSwitcher />
        </div>
      </header>
      <ReviewPanel suggestions={snapshot.suggestions} rules={snapshot.rules} />
      <LateRentTable debts={tenants} marks={marks} paymentsToReview={paymentsToReview} />
    </>
  );
}

/** tenantId → how many unconfirmed payments they might have sent. */
function countPaymentsToReview(suggestions: readonly PaymentSuggestion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of suggestions) {
    for (const c of s.candidates) counts[c.tenantId] = (counts[c.tenantId] ?? 0) + s.payments.length;
  }
  return counts;
}
