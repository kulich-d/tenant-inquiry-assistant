"use client";

import { ChevronRightIcon } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { summarizeContacts, type ContactsByInvoice } from "@/domain/contacts";
import type { TenantDebt } from "@/domain/types";
import { formatKr } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ContactSummary } from "./contact-summary";
import { InvoiceRow } from "./invoice-row";
import { StatusBadge } from "./status-badge";

type Props = {
  debt: TenantDebt;
  contacts: ContactsByInvoice;
  expanded: boolean;
  onExpandedChange: (tenantId: string) => void;
  onToggleContact: (invoiceId: string, emailed: boolean) => void;
};

export function TenantRows({ debt, contacts, expanded, onExpandedChange, onToggleContact }: Props) {
  const summary = summarizeContacts(
    debt.invoices.map((i) => i.invoiceId),
    contacts,
  );
  const toggle = () => onExpandedChange(debt.tenantId);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={toggle} data-state={expanded ? "open" : "closed"}>
        <TableCell className="w-8">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} invoices for ${debt.tenant}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            className="flex size-6 items-center justify-center rounded-md hover:bg-muted"
          >
            <ChevronRightIcon className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        </TableCell>
        <TableCell>
          <div className="font-medium">{debt.tenant}</div>
          <div className="text-xs text-muted-foreground">{formatKr(debt.totalRemaining)} owed</div>
        </TableCell>
        <TableCell className="text-muted-foreground">{debt.address}</TableCell>
        <TableCell>
          <StatusBadge status={debt.status} days={debt.maxDaysOverdue} />
        </TableCell>
        <TableCell>
          <ContactSummary summary={summary} />
        </TableCell>
      </TableRow>
      {expanded &&
        debt.invoices.map((invoice) => (
          <InvoiceRow
            key={invoice.invoiceId}
            invoice={invoice}
            contact={contacts[invoice.invoiceId]}
            onToggle={onToggleContact}
          />
        ))}
    </>
  );
}
