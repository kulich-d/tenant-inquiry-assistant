export const TEAM = ["Sarah", "Jonas"] as const;
export type TeamMember = (typeof TEAM)[number];

export function isTeamMember(value: unknown): value is TeamMember {
  return TEAM.includes(value as TeamMember);
}
