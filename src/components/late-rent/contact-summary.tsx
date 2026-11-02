import type { ContactSummary as Summary } from "@/domain/contacts";
import { formatDayMonth } from "@/lib/format";

export function ContactSummary({ summary }: { summary: Summary }) {
  switch (summary.kind) {
    case "none":
      return <span className="font-medium text-destructive">Nobody yet</span>;
    case "some":
      return (
        <span className="text-amber-700 dark:text-amber-400">
          {summary.contacted} of {summary.total} invoices
        </span>
      );
    case "all": {
      const who = `${summary.latest.sentBy} · ${formatDayMonth(summary.latest.sentAt)}`;
      return (
        <span className="text-muted-foreground">
          {summary.total === 1 ? who : `All ${summary.total} · last ${who}`}
        </span>
      );
    }
  }
}
