// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const config = require("../electron-builder.config.cjs") as Record<string, unknown>;
const { validateConfiguration } = require("app-builder-lib/out/util/config/config") as {
  validateConfiguration: (
    configuration: Record<string, unknown>,
    debugLogger: { add: (key: string, value: unknown) => void },
  ) => Promise<void>;
};

describe("electron-builder configuration", () => {
  it("matches the installed electron-builder schema", async () => {
    await expect(validateConfiguration(config, { add: () => undefined })).resolves.toBeUndefined();
  });

  it("declares a synchronized Linux desktop identity", () => {
    const pkg = require("../package.json") as { desktopName?: string };
    const linux = config.linux as { executableName?: string; syncDesktopName?: boolean };
    expect(pkg.desktopName).toBe("venice-forge.desktop");
    expect(linux.executableName).toBe("venice-forge");
    expect(linux.syncDesktopName).toBe(true);
  });
});
