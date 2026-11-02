"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type EmailedMark } from "@/domain/emailed-marks";
import { TEAM } from "@/domain/team";
import { findSuggestions } from "@/domain/matching";
import { markEmailed, unmarkEmailed } from "@/server/emailed-marks";
import { getDb } from "@/server/db/client";
import { getLedgerData } from "@/server/ledger";
import { confirmRule, deleteRule, listRules } from "@/server/rules";

// Server Actions are reachable by direct POST, so every input is validated here.
// There is no auth in v1: `sentBy` comes from the "You:" switcher and is only checked against the team list.

const invoiceId = z.string().regex(/^INV-\d+$/);

const markInput = z.object({
  invoiceIds: z.array(invoiceId).min(1).max(100),
  sentBy: z.enum(TEAM),
});

const unmarkInput = z.object({ invoiceId });

export type MarkEmailedResult =
  | { ok: true; stored: EmailedMark[]; alreadyMarked: EmailedMark[] }
  | { ok: false; error: string };

export type UnmarkEmailedResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "Couldn't save. Check your connection and try again.";

export async function markEmailedAction(input: z.input<typeof markInput>): Promise<MarkEmailedResult> {
  const parsed = markInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    const outcome = await markEmailed(await getDb(), parsed.data.invoiceIds, parsed.data.sentBy);
    refresh();
    return { ok: true, ...outcome };
  } catch (error) {
    console.error("markEmailedAction failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
}

export async function unmarkEmailedAction(input: z.input<typeof unmarkInput>): Promise<UnmarkEmailedResult> {
  const parsed = unmarkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    await unmarkEmailed(await getDb(), parsed.data.invoiceId);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("unmarkEmailedAction failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
}

// --- Confirming who sent payments signed with part of a name -----------------

const patternInput = z.object({
  signature: z.string().min(1).max(100),
  amount: z.number().int().positive(),
});

const confirmInput = patternInput.extend({
  tenantId: z.string().regex(/^T\d+$/),
  confirmedBy: z.enum(TEAM),
});

export type RuleResult = { ok: true } | { ok: false; error: string };

export async function confirmRuleAction(input: z.input<typeof confirmInput>): Promise<RuleResult> {
  const parsed = confirmInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { signature, amount, tenantId } = parsed.data;

  try {
    const db = await getDb();
    const rules = await listRules(db);
    const existing = rules.find((r) => r.signature === signature && r.amount === amount);
    if (existing) {
      return existing.tenantId === tenantId
        ? { ok: true }
        : { ok: false, error: `${existing.confirmedBy} already confirmed who sends these payments.` };
    }

    // Don't trust the browser: the tenant must be a real candidate for this pattern.
    const { invoices, payments } = await getLedgerData();
    const pattern = findSuggestions(invoices, payments, rules).find(
      (s) => s.signature === signature && s.amount === amount,
    );
    if (!pattern?.candidates.some((c) => c.tenantId === tenantId)) {
      return { ok: false, error: "That tenant doesn't match these payments." };
    }

    await confirmRule(db, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("confirmRuleAction failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
}

export async function undoRuleAction(input: z.input<typeof patternInput>): Promise<RuleResult> {
  const parsed = patternInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  try {
    await deleteRule(await getDb(), parsed.data.signature, parsed.data.amount);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("undoRuleAction failed", error);
    return { ok: false, error: SAVE_FAILED };
  }
}
