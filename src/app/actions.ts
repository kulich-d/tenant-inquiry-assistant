"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { TEAM, type Contact } from "@/domain/contacts";
import { markEmailed, unmarkEmailed } from "@/server/contacts";
import { getDb } from "@/server/db/client";

// Server Actions are reachable by direct POST, so every input is validated here.
// There is no auth in v1: `sentBy` comes from the "You:" switcher and is only checked against the team list.

const invoiceId = z.string().regex(/^INV-\d+$/);

const markInput = z.object({
  invoiceIds: z.array(invoiceId).min(1).max(100),
  sentBy: z.enum(TEAM),
});

const unmarkInput = z.object({ invoiceId });

export type MarkEmailedResult =
  | { ok: true; stored: Contact[]; alreadyMarked: Contact[] }
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
