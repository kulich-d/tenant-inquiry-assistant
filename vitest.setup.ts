import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  // Server tests run in the node environment, without a DOM.
  if (typeof window === "undefined") return;
  cleanup();
  window.localStorage.clear();
});
