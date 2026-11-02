"use client";

import { useCallback, useMemo, useState } from "react";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContactsByInvoice } from "@/domain/contacts";
import { sortByDaysOverdue, type SortDirection } from "@/domain/sort";
import type { TenantDebt } from "@/domain/types";

import { NoticeBanner } from "./notice-banner";
import { SortableHead } from "./sortable-head";
import { useCurrentUser } from "./stores";
import { TenantRows } from "./tenant-rows";
import { useEmailedMarks } from "./use-emailed-marks";

type Props = {
  debts: TenantDebt[];
  /** Emailed marks as stored on the server. */
  contacts: ContactsByInvoice;
  /** tenantId → unconfirmed payments they might have sent. */
  paymentsToReview?: Readonly<Record<string, number>>;
};

export function LateRentTable({ debts, contacts: serverContacts, paymentsToReview = {} }: Props) {
  const [user] = useCurrentUser();
  const { contacts, setEmailed, notice, dismissNotice } = useEmailedMarks(serverContacts, user);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [direction, setDirection] = useState<SortDirection>("desc");
  const sorted = useMemo(() => sortByDaysOverdue(debts, direction), [debts, direction]);
  const toggleDirection = useCallback(() => setDirection((d) => (d === "desc" ? "asc" : "desc")), []);

  const toggleExpanded = useCallback((tenantId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(tenantId)) next.add(tenantId);
      return next;
    });
  }, []);

  const toggleContact = useCallback(
    (invoiceId: string, emailed: boolean) => setEmailed([invoiceId], emailed),
    [setEmailed],
  );
  const markAll = useCallback((invoiceIds: string[]) => setEmailed(invoiceIds, true), [setEmailed]);

  if (debts.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">Everyone is paid up.</p>;
  }

  return (
    <>
      {notice && <NoticeBanner notice={notice} onDismiss={dismissNotice} />}
      <Table className="table-fixed">
        <colgroup>
          <col className="w-10" />
          <col className="w-[24%]" />
          <col className="w-[26%]" />
          <col className="w-[20%]" />
          <col />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Tenant</TableHead>
            <TableHead>Property</TableHead>
            <SortableHead direction={direction} onToggle={toggleDirection}>
              Status
            </SortableHead>
            <TableHead>Emailed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((debt) => (
            <TenantRows
              key={debt.tenantId}
              debt={debt}
              contacts={contacts}
              expanded={expanded.has(debt.tenantId)}
              onExpandedChange={toggleExpanded}
              onToggleContact={toggleContact}
              onMarkAll={markAll}
              paymentsToReview={paymentsToReview[debt.tenantId] ?? 0}
            />
          ))}
        </TableBody>
      </Table>
    </>
  );
}
