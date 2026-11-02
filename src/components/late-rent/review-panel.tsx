"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { confirmRuleAction, undoRuleAction, type RuleResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { ConfirmedRule, PaymentSuggestion, SuggestionCandidate } from "@/domain/types";
import { formatDayMonth, formatKr } from "@/lib/format";
import { cn } from "@/lib/utils";

import { NoticeBanner } from "./notice-banner";
import { useCurrentUser, useReviewPanelOpen } from "./stores";

type Props = {
  suggestions: PaymentSuggestion[];
  rules: ConfirmedRule[];
};

/** How the payments were actually signed, e.g. “husleje schmidt” — more recognisable than the signature. */
const signedAs = (s: PaymentSuggestion) => [...new Set(s.payments.map((p) => `“${p.reference}”`))].join(" / ");

/**
 * Payments signed with part of a name. Sarah confirms who sent them once; the answer becomes a rule
 * that covers every payment signed the same way, and the debts update.
 */
export function ReviewPanel({ suggestions, rules }: Props) {
  const [user] = useCurrentUser();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panelState, setOpen] = useReviewPanelOpen();
  const open = panelState === "open";

  const run = (action: () => Promise<RuleResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  };
  const confirm = (s: PaymentSuggestion, tenantId: string) =>
    run(() => confirmRuleAction({ signature: s.signature, amount: s.amount, tenantId, confirmedBy: user }));
  const undo = (r: ConfirmedRule) => run(() => undoRuleAction({ signature: r.signature, amount: r.amount }));

  if (suggestions.length === 0 && rules.length === 0) return null;
  const paymentCount = suggestions.reduce((sum, s) => sum + s.payments.length, 0);

  return (
    <section aria-labelledby="review-heading" className="mb-6 rounded-lg border px-4 py-3">
      <h2 id="review-heading" className="font-medium">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="review-content"
          onClick={() => setOpen(open ? "collapsed" : "open")}
          className="-mx-1 flex items-center gap-1.5 rounded-md px-1 text-left hover:bg-muted"
        >
          <ChevronRightIcon aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
          <span>
            Payments to review{" "}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {paymentCount} {paymentCount === 1 ? "payment" : "payments"} signed with part of a name
            </span>
          </span>
        </button>
      </h2>

      {open && (
        <div id="review-content">
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm who sent them once — it applies to every payment signed the same way.
          </p>

          {error && (
            <div className="mt-3">
              <NoticeBanner notice={{ kind: "error", message: error }} onDismiss={() => setError(null)} />
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="mt-3 divide-y">
              {suggestions.map((s) => (
                <li key={`${s.signature}|${s.amount}`} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">
                      {signedAs(s)} · {formatKr(s.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.payments.length} {s.payments.length === 1 ? "payment" : "payments"}:{" "}
                      {s.payments.map((p) => formatDayMonth(p.bookedAt)).join(", ")}
                    </div>
                  </div>
                  <CandidateChoice suggestion={s} disabled={pending} onPick={(tenantId) => confirm(s, tenantId)} />
                </li>
              ))}
            </ul>
          )}

          {rules.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Confirmed ({rules.length})</summary>
              <ul className="mt-2 divide-y">
                {rules.map((r) => (
                  <li key={`${r.signature}|${r.amount}`} className="flex items-center justify-between gap-3 py-1.5">
                    <span>
                      “{r.signature}” · {formatKr(r.amount)} → <span className="font-medium">{r.tenant}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.confirmedBy}, {formatDayMonth(r.confirmedAt)}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      aria-label={`Undo “${r.signature}” · ${formatKr(r.amount)} → ${r.tenant}`}
                      onClick={() => undo(r)}
                    >
                      Undo
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

type ChoiceProps = {
  suggestion: PaymentSuggestion;
  disabled: boolean;
  onPick: (tenantId: string) => void;
};

function CandidateChoice({ suggestion, disabled, onPick }: ChoiceProps) {
  const suggested = suggestion.candidates.find((c) => c.tenantId === suggestion.suggestedTenantId);
  const others = suggestion.candidates.filter((c) => c !== suggested);
  const label = (c: SuggestionCandidate) => `${c.tenant}${c.owesSomething ? "" : " (owes nothing)"}`;
  const what = `${signedAs(suggestion)} · ${formatKr(suggestion.amount)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggested ? (
        <>
          <span>
            <span className="text-muted-foreground">Suggested:</span> <span className="font-medium">{suggested.tenant}</span>
          </span>
          <Button size="xs" disabled={disabled} aria-label={`Confirm ${suggested.tenant} for ${what}`} onClick={() => onPick(suggested.tenantId)}>
            Confirm
          </Button>
          {others.length > 0 && <span className="text-muted-foreground">or</span>}
        </>
      ) : (
        <span className="text-muted-foreground">Who paid?</span>
      )}
      {others.map((c) => (
        <Button
          key={c.tenantId}
          variant="outline"
          size="xs"
          disabled={disabled}
          aria-label={`Confirm ${c.tenant} for ${what}`}
          onClick={() => onPick(c.tenantId)}
        >
          {label(c)}
        </Button>
      ))}
    </div>
  );
}
