/**
 * Team — who can mark invoices as emailed and confirm payment rules.
 *
 * Scenarios:
 * - Only known team members (Sarah, Jonas) are accepted, case-sensitively.
 */
import { describe, expect, it } from "vitest";

import { isTeamMember } from "./team";

describe("isTeamMember", () => {
  it("accepts only known team members", () => {
    expect(isTeamMember("Sarah")).toBe(true);
    expect(isTeamMember("Jonas")).toBe(true);
    expect(isTeamMember("sarah")).toBe(false);
    expect(isTeamMember(null)).toBe(false);
  });
});
