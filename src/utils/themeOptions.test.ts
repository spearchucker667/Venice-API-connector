import { describe, expect, it } from "vitest";
import { sortThemeOptions } from "./themeOptions";

describe("sortThemeOptions", () => {
  it("sorts visible labels case-insensitively with natural numeric ordering without mutation", () => {
    const options = [
      { id: "z", label: "zebra" },
      { id: "ten", label: "Theme 10" },
      { id: "two", label: "theme 2" },
      { id: "a", label: "Alpha" },
    ] as const;
    expect(sortThemeOptions(options).map((option) => option.id)).toEqual(["a", "two", "ten", "z"]);
    expect(options.map((option) => option.id)).toEqual(["z", "ten", "two", "a"]);
  });
});
