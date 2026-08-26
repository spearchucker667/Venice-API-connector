/** @fileoverview Regression tests for the renderer boot path in `main.tsx`.
 *
 *  Verifies that a rejected pre-flight hydration promise is caught and
 *  surfaces a fatal UI message instead of becoming an unhandled rejection.
 */

import { describe, it, expect } from "vitest";
import { bootApp } from "./main";

describe("bootApp rejection handling", () => {
  it("renders a fatal message when hydration rejects", async () => {
    const target = document.createElement("div");
    const rejectionError = new Error("bridge init exploded");
    const failingHydration = Promise.reject(rejectionError);

    // Swallow the expected rejection so the test runner does not flag it.
    failingHydration.catch(() => {});

    await bootApp(target, failingHydration);

    expect(target.textContent).toContain("Fatal Application Error");
    expect(target.textContent).toContain("pre-flight setup");
    expect(target.textContent).toContain("bridge init exploded");
  });
});
