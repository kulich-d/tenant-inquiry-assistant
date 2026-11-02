"use client";

import { useCallback, useState } from "react";

import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TenantDebt } from "@/domain/types";

import { useContacts, useCurrentUser } from "./stores";
import { TenantRows } from "./tenant-rows";

export function LateRentTable({ debts }: { debts: TenantDebt[] }) {
  const [contacts, store] = useContacts();
  const [user] = useCurrentUser();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const toggleExpanded = useCallback((tenantId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(tenantId)) next.add(tenantId);
      return next;
    });
  }, []);

  const toggleContact = useCallback(
    (invoiceId: string, emailed: boolean) =>
      emailed ? store.mark(invoiceId, user) : store.unmark(invoiceId),
    [store, user],
  );

  if (debts.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">Everyone is paid up.</p>;
  }

  return (
    <Table className="table-fixed">
      <colgroup>
        <col className="w-10" />
        <col className="w-[24%]" />
        <col className="w-[28%]" />
        <col className="w-[22%]" />
        <col />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead>Tenant</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Emailed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {debts.map((debt) => (
          <TenantRows
            key={debt.tenantId}
            debt={debt}
            contacts={contacts}
            expanded={expanded.has(debt.tenantId)}
            onExpandedChange={toggleExpanded}
            onToggleContact={toggleContact}
          />
        ))}
      </TableBody>
    </Table>
  );
}
