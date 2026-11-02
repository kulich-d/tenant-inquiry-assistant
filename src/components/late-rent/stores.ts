"use client";

import { useSyncExternalStore } from "react";

import { isTeamMember, TEAM, type TeamMember } from "@/domain/contacts";
import { DEFAULT_GRACE_DAYS, parseGraceDays } from "@/domain/debt";

// Per-browser preferences. Shared data (emailed marks) lives on the server.

/** A small value remembered in localStorage, readable with `useSyncExternalStore`. */
function createPersistedValue<T extends string | number>(key: string, fallback: T, parse: (raw: string | null) => T | null) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const get = (): T => {
    try {
      return parse(window.localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const set = (value: T) => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Storage unavailable: the choice just won't persist.
    }
    notify();
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === key) notify();
  };

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    if (listeners.size === 1) window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
  };

  return function usePersistedValue(): [T, (value: T) => void] {
    return [useSyncExternalStore(subscribe, get, () => fallback), set];
  };
}

/** Who is using the page. No auth in v1 — picked in the header, remembered per browser. */
export const useCurrentUser = createPersistedValue<TeamMember>("late-rent:user", TEAM[0], (raw) =>
  isTeamMember(raw) ? raw : null,
);

/** Days after the due date that don't count as late. Remembered per browser. */
export const useGraceDays = createPersistedValue<number>("late-rent:grace-days", DEFAULT_GRACE_DAYS, parseGraceDays);
