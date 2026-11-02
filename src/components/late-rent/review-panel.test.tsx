/**
 * "Payments to review" — Sarah confirms who sent payments signed with part of a name.
 *
 * Scenarios:
 * - A pattern with a suggested tenant: shows how it was signed, the amount and dates; Confirm sends the
 *   rule for the current user.
 * - The other candidate can be picked instead ("or Alma Hassan (owes nothing)").
 * - No suggestion (two candidates who both owe): "Who paid?" with one button per candidate.
 * - A failed confirmation shows the server's message.
 * - Confirmed rules are listed with who confirmed them; Undo removes the rule.
 * - Nothing to review and nothing confirmed → the panel is not shown.
 * - The panel can be collapsed and expanded from its heading; the choice is remembered after a reload.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmRuleAction, undoRuleAction } from "@/app/actions";
import type { ConfirmedRule, PaymentSuggestion } from "@/domain/types";

import { ReviewPanel } from "./review-panel";

vi.mock("@/app/actions", () => ({ confirmRuleAction: vi.fn(), undoRuleAction: vi.fn() }));

const ALMA: PaymentSuggestion = {
  signature: "alma",
  amount: 8500,
  payments: [
    { paymentId: "PAY-1", bookedAt: "2026-01-10", reference: "Alma" },
    { paymentId: "PAY-2", bookedAt: "2026-03-04", reference: "Alma" },
  ],
  candidates: [
    { tenantId: "T066", tenant: "Alma Andersen", owesSomething: true },
    { tenantId: "T069", tenant: "Alma Hassan", owesSomething: false },
  ],
  suggestedTenantId: "T066",
};

const HANSEN: PaymentSuggestion = {
  signature: "hansen",
  amount: 7900,
  payments: [{ paymentId: "PAY-3", bookedAt: "2026-05-03", reference: "husleje hansen" }],
  candidates: [
    { tenantId: "T071", tenant: "Laura Hansen", owesSomething: true },
    { tenantId: "T011", tenant: "Louise Hansen", owesSomething: true },
  ],
  suggestedTenantId: null,
};

const KASPER_RULE: ConfirmedRule = {
  signature: "kasper",
  amount: 11800,
  tenantId: "T076",
  tenant: "Kasper Frandsen",
  confirmedBy: "Jonas",
  confirmedAt: "2026-11-01T10:00:00.000Z",
};

beforeEach(() => {
  vi.mocked(confirmRuleAction).mockResolvedValue({ ok: true });
  vi.mocked(undoRuleAction).mockResolvedValue({ ok: true });
});

const patternRow = (signedAs: string) => screen.getByText(signedAs, { exact: false }).closest("li")!;

describe("ReviewPanel", () => {
  it("shows a pattern with its suggested tenant and confirms it for the current user", async () => {
    const user = userEvent.setup();
    render(<ReviewPanel suggestions={[ALMA]} rules={[]} />);

    const row = patternRow("“Alma” · 8.500 kr");
    expect(row).toHaveTextContent("2 payments: 10 Jan, 4 Mar");
    expect(row).toHaveTextContent("Suggested: Alma Andersen");

    await user.click(within(row).getByRole("button", { name: "Confirm Alma Andersen for “Alma” · 8.500 kr" }));

    expect(confirmRuleAction).toHaveBeenCalledWith({ signature: "alma", amount: 8500, tenantId: "T066", confirmedBy: "Sarah" });
  });

  it("lets Sarah pick the other candidate instead", async () => {
    window.localStorage.setItem("late-rent:user", "Jonas");
    const user = userEvent.setup();
    render(<ReviewPanel suggestions={[ALMA]} rules={[]} />);

    await user.click(screen.getByRole("button", { name: "Confirm Alma Hassan for “Alma” · 8.500 kr" }));

    expect(screen.getByText("Alma Hassan (owes nothing)")).toBeInTheDocument();
    expect(confirmRuleAction).toHaveBeenCalledWith({ signature: "alma", amount: 8500, tenantId: "T069", confirmedBy: "Jonas" });
  });

  it("asks who paid when there is no suggestion", () => {
    render(<ReviewPanel suggestions={[HANSEN]} rules={[]} />);

    const row = patternRow("“husleje hansen” · 7.900 kr");
    expect(row).toHaveTextContent("Who paid?");
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["Laura Hansen", "Louise Hansen"]);
  });

  it("shows the server's message when confirming fails", async () => {
    vi.mocked(confirmRuleAction).mockResolvedValue({ ok: false, error: "Jonas already confirmed who sends these payments." });
    const user = userEvent.setup();
    render(<ReviewPanel suggestions={[ALMA]} rules={[]} />);

    await user.click(screen.getByRole("button", { name: /^Confirm Alma Andersen/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Jonas already confirmed who sends these payments.");
  });

  it("lists confirmed rules and undoes one", async () => {
    const user = userEvent.setup();
    render(<ReviewPanel suggestions={[]} rules={[KASPER_RULE]} />);

    await user.click(screen.getByText("Confirmed (1)"));
    expect(screen.getByText("Kasper Frandsen").closest("li")).toHaveTextContent("“kasper” · 11.800 kr → Kasper Frandsen · Jonas, 1 Nov");

    await user.click(screen.getByRole("button", { name: "Undo “kasper” · 11.800 kr → Kasper Frandsen" }));

    expect(undoRuleAction).toHaveBeenCalledWith({ signature: "kasper", amount: 11800 });
  });

  it("is not shown when there is nothing to review or undo", () => {
    const { container } = render(<ReviewPanel suggestions={[]} rules={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("collapses and expands from the heading, and remembers it", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ReviewPanel suggestions={[ALMA]} rules={[]} />);
    const toggle = screen.getByRole("button", { name: /Payments to review/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("“Alma” · 8.500 kr", { exact: false })).not.toBeInTheDocument();
    expect(toggle).toHaveTextContent("2 payments signed with part of a name");

    unmount();
    render(<ReviewPanel suggestions={[ALMA]} rules={[]} />);
    const reloaded = screen.getByRole("button", { name: /Payments to review/ });
    expect(reloaded).toHaveAttribute("aria-expanded", "false");

    await user.click(reloaded);

    expect(screen.getByText("“Alma” · 8.500 kr", { exact: false })).toBeInTheDocument();
  });
});
