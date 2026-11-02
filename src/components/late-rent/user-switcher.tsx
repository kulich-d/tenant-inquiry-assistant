"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isTeamMember, TEAM } from "@/domain/contacts";

import { useCurrentUser } from "./stores";

export function UserSwitcher() {
  const [user, setUser] = useCurrentUser();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span id="user-switcher-label">You:</span>
      <Select value={user} onValueChange={(value) => isTeamMember(value) && setUser(value)}>
        <SelectTrigger aria-labelledby="user-switcher-label" className="min-w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEAM.map((member) => (
            <SelectItem key={member} value={member}>
              {member}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
