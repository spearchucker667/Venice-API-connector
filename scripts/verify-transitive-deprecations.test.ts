import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

describe("verify-transitive-deprecations (VF-AUD-20260831-P3-006)", () => {
  it("exits 0 against the current package-lock.json (all known deprecations are allowlisted)", () => {
    const result = execFileSync(
      "node",
      [path.join(process.cwd(), "scripts/verify-transitive-deprecations.cjs")],
      { encoding: "utf-8", stdio: "pipe" },
    );
    expect(result).toContain("OK");
    expect(result).toContain("known deprecation(s) within the allowlist");
  });
});
