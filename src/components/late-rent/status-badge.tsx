import { Badge } from "@/components/ui/badge";
import type { TenantStatus } from "@/domain/types";
import { formatDays } from "@/lib/format";

const LABEL: Record<TenantStatus, string> = { late: "Late", partial: "Partly paid" };

export function StatusBadge({ status, days }: { status: TenantStatus; days: number }) {
  return (
    <Badge
      variant={status === "late" ? "destructive" : "secondary"}
      className={
        status === "partial"
          ? "bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
          : undefined
      }
    >
      {LABEL[status]} · {formatDays(days)}
    </Badge>
  );
}
