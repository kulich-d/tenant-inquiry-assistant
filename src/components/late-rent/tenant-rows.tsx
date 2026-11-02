"use client";

import { ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  onMarkAll: (invoiceIds: string[]) => void;
  /** Unconfirmed payments this tenant might have sent — a reason to check before emailing. */
  paymentsToReview: number;
};

export function TenantRows({
  debt,
  contacts,
  expanded,
  onExpandedChange,
  onToggleContact,
  onMarkAll,
  paymentsToReview,
}: Props) {
  const invoiceIds = debt.invoices.map((i) => i.invoiceId);
  const summary = summarizeContacts(invoiceIds, contacts);
  const notEmailed = invoiceIds.filter((id) => !contacts[id]);
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
          {paymentsToReview > 0 && (
            <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              Possibly paid · {paymentsToReview} to review
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <ContactSummary summary={summary} />
            {notEmailed.length > 0 && (
              <Button
                variant="outline"
                size="xs"
                aria-label={`Mark ${debt.tenant} as emailed`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAll(notEmailed);
                }}
              >
                {invoiceIds.length === 1 ? "Mark emailed" : "Mark all emailed"}
              </Button>
            )}
          </div>
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
