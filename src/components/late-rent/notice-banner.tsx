import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Notice } from "./use-emailed-marks";

export function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <div
      role={notice.kind === "error" ? "alert" : "status"}
      className={cn(
        "mb-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
        notice.kind === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
      )}
    >
      <p>{notice.message}</p>
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="rounded-md p-0.5 hover:bg-foreground/10">
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
