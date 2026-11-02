"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { MAX_GRACE_DAYS, parseGraceDays } from "@/domain/debt";

import { useGraceDays } from "./stores";

export function GracePeriodInput() {
  const [graceDays, setGraceDays] = useGraceDays();
  // What the user is typing; `null` when not editing, so outside changes show through.
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const invalid = draft !== null && parseGraceDays(draft) === null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <label htmlFor={id}>Late after</label>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_GRACE_DAYS}
          step={1}
          className="w-16 text-foreground"
          value={draft ?? String(graceDays)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            const days = parseGraceDays(e.target.value);
            if (days !== null) setGraceDays(days);
          }}
          onBlur={() => setDraft(null)}
        />
        <span>days past due</span>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          Enter whole days from 0 to {MAX_GRACE_DAYS}
        </p>
      )}
    </div>
  );
}
