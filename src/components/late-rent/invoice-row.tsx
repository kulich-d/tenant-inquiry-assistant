"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import type { EmailedMark } from "@/domain/emailed-marks";
import type { OverdueInvoice } from "@/domain/types";
import { formatDayMonth, formatDays, formatKr, formatPeriod } from "@/lib/format";

type Props = {
  invoice: OverdueInvoice;
  mark: EmailedMark | undefined;
  onToggle: (invoiceId: string, emailed: boolean) => void;
};

export function InvoiceRow({ invoice, mark, onToggle }: Props) {
  return (
    <TableRow className="bg-muted/40 text-xs hover:bg-muted/40">
      <TableCell />
      <TableCell className="font-medium">
        {formatPeriod(invoice.period)}
        <span className="ml-2 font-normal text-muted-foreground">{invoice.invoiceId}</span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        <div>
          paid {formatKr(invoice.paid)} of {formatKr(invoice.amount)}
        </div>
        <ul aria-label={`Payments for ${formatPeriod(invoice.period)}`} className="mt-0.5">
          {invoice.payments.length === 0 ? (
            <li>No payments</li>
          ) : (
            invoice.payments.map((p) => (
              <li key={p.paymentId}>
                {formatDayMonth(p.bookedAt)} · {formatKr(p.amount)}
                {p.matchedBy === "name" && <span className="italic"> · matched by name “{p.reference}”</span>}
                {p.matchedBy === "confirmed" && (
                  <span className="italic">
                    {" "}
                    · confirmed by {p.confirmedBy} “{p.reference}”
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </TableCell>
      <TableCell>
        {formatKr(invoice.remaining)} left · {formatDays(invoice.daysOverdue)}
      </TableCell>
      <TableCell>
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            aria-label={`Emailed about ${formatPeriod(invoice.period)}`}
            checked={mark !== undefined}
            onCheckedChange={(checked) => onToggle(invoice.invoiceId, checked)}
          />
          {mark ? (
            <span>
              {mark.sentBy} · {formatDayMonth(mark.sentAt)}
            </span>
          ) : (
            <span className="text-muted-foreground">Not emailed</span>
          )}
        </label>
      </TableCell>
    </TableRow>
  );
}
