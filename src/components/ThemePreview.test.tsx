// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemePreview } from "./ThemePreview";
import { familyToTheme } from "../theme/test-helpers";
import { BUILTIN_DRACULA, BUILTIN_GITHUB_LIGHT } from "../theme";

describe("ThemePreview", () => {
  it("renders the syntax preview section", () => {
    const theme = familyToTheme(BUILTIN_DRACULA, "dark");
    const { container } = render(<ThemePreview theme={theme} />);
    expect(screen.getByText("Syntax preview")).toBeInTheDocument();
    expect(container.textContent).toMatch(/type\s+ThemeMode/);
  });

  it("emits semantic token spans in the code preview", () => {
    const theme = familyToTheme(BUILTIN_DRACULA, "dark");
    const { container } = render(<ThemePreview theme={theme} />);
    const code = container.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code?.querySelector(".token.keyword")).not.toBeNull();
    expect(code?.querySelector(".token.string")).not.toBeNull();
    expect(code?.querySelector(".token.number")).not.toBeNull();
  });

  it("shows contrast warnings for low-contrast code palettes", () => {
    const theme = familyToTheme(BUILTIN_DRACULA, "dark");
    const badTheme = {
      ...theme,
      code: {
        ...theme.code,
        tokens: {
          ...theme.code.tokens,
          background: "#000000",
          foreground: "#010101",
        },
      },
    };
    render(<ThemePreview theme={badTheme} />);
    expect(screen.getByText(/Contrast warnings/)).toBeInTheDocument();
    expect(screen.getByText(/Code foreground \/ background/)).toBeInTheDocument();
  });

  it("uses distinct code colors for light and dark variants", () => {
    const dark = familyToTheme(BUILTIN_GITHUB_LIGHT, "dark");
    const light = familyToTheme(BUILTIN_GITHUB_LIGHT, "light");
    const { container: darkContainer } = render(<ThemePreview theme={dark} />);
    const { container: lightContainer } = render(<ThemePreview theme={light} />);

    const darkPreview = darkContainer.querySelector("[style*='--preview-code-bg']") as HTMLElement | null;
    const lightPreview = lightContainer.querySelector("[style*='--preview-code-bg']") as HTMLElement | null;
    expect(darkPreview?.style.getPropertyValue("--preview-code-bg")).not.toBe(
      lightPreview?.style.getPropertyValue("--preview-code-bg"),
    );
  });
});
