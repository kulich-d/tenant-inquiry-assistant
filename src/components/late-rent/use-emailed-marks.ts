"use client";

import { startTransition, useCallback, useOptimistic, useState } from "react";

import { markEmailedAction, unmarkEmailedAction } from "@/app/actions";
import { applyEmailedMarkChange, type EmailedMark, type EmailedMarksByInvoice } from "@/domain/emailed-marks";
import type { TeamMember } from "@/domain/team";
import { formatDayMonth } from "@/lib/format";

export type Notice = { kind: "error" | "info"; message: string };

function describeAlreadyMarked(marks: readonly EmailedMark[]): string {
  const [first] = marks;
  if (!first) return "";
  const what = marks.length === 1 ? "this invoice" : `${marks.length} of these invoices`;
  return `${first.sentBy} already emailed about ${what} (${formatDayMonth(first.sentAt)}). Their mark was kept.`;
}

/**
 * Emailed marks with optimistic updates: a tick shows at once, the server confirms
 * (and `refresh()` brings the stored state back as `serverMarks`), and a failed save rolls back.
 */
export function useEmailedMarks(serverMarks: EmailedMarksByInvoice, user: TeamMember) {
  const [marks, applyOptimistic] = useOptimistic(serverMarks, applyEmailedMarkChange);
  const [notice, setNotice] = useState<Notice | null>(null);

  const setEmailed = useCallback(
    (invoiceIds: string[], emailed: boolean) => {
      setNotice(null);
      startTransition(async () => {
        if (emailed) {
          applyOptimistic({ type: "mark", invoiceIds, sentBy: user, sentAt: new Date().toISOString() });
          const result = await markEmailedAction({ invoiceIds, sentBy: user });
          if (!result.ok) return setNotice({ kind: "error", message: result.error });
          const byOthers = result.alreadyMarked.filter((c) => c.sentBy !== user);
          if (byOthers.length > 0) setNotice({ kind: "info", message: describeAlreadyMarked(byOthers) });
        } else {
          applyOptimistic({ type: "unmark", invoiceIds });
          for (const invoiceId of invoiceIds) {
            const result = await unmarkEmailedAction({ invoiceId });
            if (!result.ok) return setNotice({ kind: "error", message: result.error });
          }
        }
      });
    },
    [applyOptimistic, user],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { marks, setEmailed, notice, dismissNotice };
}
