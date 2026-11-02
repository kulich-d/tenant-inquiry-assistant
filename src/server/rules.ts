import { and, eq } from "drizzle-orm";

import type { TeamMember } from "@/domain/team";
import type { PaymentRule } from "@/domain/types";

import type { Db } from "./db";
import { paymentRules } from "./db/schema";

export async function listRules(db: Db): Promise<PaymentRule[]> {
  return db.select().from(paymentRules);
}

/**
 * Stores "this signature + amount is this tenant". First confirmation wins, like emailed marks:
 * if someone already confirmed the pattern, their rule is kept and returned.
 */
export async function confirmRule(
  db: Db,
  rule: { signature: string; amount: number; tenantId: string; confirmedBy: TeamMember },
  now: Date = new Date(),
): Promise<PaymentRule> {
  await db
    .insert(paymentRules)
    .values({ ...rule, confirmedAt: now.toISOString() })
    .onConflictDoNothing({ target: [paymentRules.signature, paymentRules.amount] });
  const [stored] = await db
    .select()
    .from(paymentRules)
    .where(and(eq(paymentRules.signature, rule.signature), eq(paymentRules.amount, rule.amount)));
  if (!stored) throw new Error("Rule was not stored");
  return stored;
}

export async function deleteRule(db: Db, signature: string, amount: number): Promise<void> {
  await db.delete(paymentRules).where(and(eq(paymentRules.signature, signature), eq(paymentRules.amount, amount)));
}
