"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

import { isTeamMember, TEAM, type ContactsByInvoice, type TeamMember } from "@/domain/contacts";
import { createLocalStorageContactsStore, type ContactsStore } from "@/mocks/contactsStore";
import { SEED_CONTACTS } from "@/mocks/seedContacts";

// --- Contacts ---------------------------------------------------------------

const defaultContactsStore = createLocalStorageContactsStore("late-rent:contacts:v1", SEED_CONTACTS);

/** Inject a different store (tests, real API) by wrapping the tree in this provider. */
export const ContactsStoreContext = createContext<ContactsStore>(defaultContactsStore);

export function useContacts(): [ContactsByInvoice, ContactsStore] {
  const store = useContext(ContactsStoreContext);
  const contacts = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return [contacts, store];
}

// --- Current user -----------------------------------------------------------

const USER_KEY = "late-rent:user";
const DEFAULT_USER: TeamMember = TEAM[0];
const userListeners = new Set<() => void>();

function readUser(): TeamMember {
  try {
    const value = window.localStorage.getItem(USER_KEY);
    return isTeamMember(value) ? value : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

function subscribeUser(onChange: () => void) {
  userListeners.add(onChange);
  return () => userListeners.delete(onChange);
}

function setUser(user: TeamMember) {
  try {
    window.localStorage.setItem(USER_KEY, user);
  } catch {
    // Storage unavailable: the choice just won't persist.
  }
  userListeners.forEach((l) => l());
}

/** Who is using the page. No auth in v1 — picked in the header, remembered per browser. */
export function useCurrentUser(): [TeamMember, (user: TeamMember) => void] {
  const user = useSyncExternalStore(subscribeUser, readUser, () => DEFAULT_USER);
  return [user, setUser];
}
