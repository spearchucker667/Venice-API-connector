// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ThemeMaker, themeToYaml } from "./ThemeMaker";
import { useSettingsStore } from "../stores/settings-store";
import { useConfigStore } from "../stores/config-store";
import { desktopFiles } from "../services/desktopBridge";
import { BUILTIN_DRACULA, BUILTIN_VENICE, resolveCodeThemeTokens } from "../theme";

vi.mock("../services/desktopBridge", async () => {
  const actual = await vi.importActual<typeof import("../services/desktopBridge")>(
    "../services/desktopBridge"
  );
  return {
    ...actual,
    desktopFiles: {
      exportYaml: vi.fn().mockResolvedValue(true),
      importYamlString: vi.fn().mockResolvedValue(null),
    },
    desktopConfig: {
      saveTheme: vi.fn().mockResolvedValue({ ok: true }),
      deleteTheme: vi.fn().mockResolvedValue({ ok: true }),
      loadMergedThemes: vi.fn().mockResolvedValue({ ok: true, themes: {}, warnings: [] }),
      onThemeUpdated: vi.fn(() => () => {}),
    },
  };
});

describe("ThemeMaker Custom Theme Engine Features", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      selectedThemeId: "builtin-venice",
      customTheme: null,
      customThemes: [],
      appearanceMode: "dark",
    });
    useConfigStore.getState().reset();
  });

  it("saves a new custom theme into settingsStore customThemes", async () => {
    render(<ThemeMaker />);
    fireEvent.click(screen.getByRole("button", { name: "+ Create New Theme" }));

    const saveButton = screen.getByRole("button", { name: "Save Theme" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.customThemes.length).toBeGreaterThan(0);
      expect(state.selectedThemeId).toContain("user-theme-");
    });
  });

  it("resets unsaved draft token changes when Cancel / Reset is clicked", async () => {
    render(<ThemeMaker />);
    
    // Select background token input and change value
    const bgInput = screen.getByLabelText("Background") as HTMLInputElement;
    fireEvent.change(bgInput, { target: { value: "#ff0055" } });
    expect(bgInput.value).toBe("#ff0055");

    const resetButton = screen.getByRole("button", { name: "Cancel / Reset" });
    fireEvent.click(resetButton);

    expect(bgInput.value).toBe(BUILTIN_VENICE.variants.dark.tokens.background);
  });

  it("deletes a user custom theme and falls back safely", async () => {
    const customThemeObj = {
      id: "user-test-theme",
      name: "User Test Theme",
      mode: "dark" as const,
      tokens: BUILTIN_DRACULA.variants.dark.tokens,
      code: BUILTIN_DRACULA.variants.dark.code,
    };
    useSettingsStore.setState({
      selectedThemeId: "user-test-theme",
      customTheme: customThemeObj,
      customThemes: [customThemeObj],
      appearanceMode: "dark",
    });

    render(<ThemeMaker />);
    const deleteButton = screen.getByRole("button", { name: "Delete Theme" });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.customThemes).toEqual([]);
      expect(state.selectedThemeId).toBe("builtin-venice");
    });
  });

  it("opens structured import preview modal when a YAML file is loaded", async () => {
    const draculaTheme = {
      id: BUILTIN_DRACULA.id,
      name: BUILTIN_DRACULA.name,
      mode: "dark" as const,
      tokens: BUILTIN_DRACULA.variants.dark.tokens,
      code: BUILTIN_DRACULA.variants.dark.code,
    };
    const validYaml = await themeToYaml(draculaTheme);
    const mockImport = vi.fn().mockResolvedValue(validYaml);
    vi.mocked(desktopFiles.importYamlString).mockImplementation(mockImport);

    render(<ThemeMaker />);
    const importBtn = screen.getByRole("button", { name: "Import Theme…" });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText("Import Theme Preview")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Forge Dracula").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: "Import & Apply" }));

    await waitFor(() => {
      expect(screen.queryByText("Import Theme Preview")).not.toBeInTheDocument();
    });
    expect(useSettingsStore.getState().customThemes.length).toBe(1);
  });

  it("updates code tokens when a syntax preset is selected", async () => {
    render(<ThemeMaker />);

    const presetSelect = screen.getByLabelText("Syntax preset") as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: "dracula" } });

    await waitFor(() => {
      expect(presetSelect.value).toBe("dracula");
    });

    const keywordInput = screen.getByLabelText("Keyword") as HTMLInputElement;
    expect(keywordInput.value).toBe(resolveCodeThemeTokens("dracula", "dark").keyword);
  });

  it("marks draft dirty and switches to automatic preset when a code token is edited", async () => {
    render(<ThemeMaker />);

    const keywordInput = screen.getByLabelText("Keyword") as HTMLInputElement;
    fireEvent.change(keywordInput, { target: { value: "#abcdef" } });

    await waitFor(() => {
      const presetSelect = screen.getByLabelText("Syntax preset") as HTMLSelectElement;
      expect(presetSelect.value).toBe("automatic");
    });
  });

  it("keeps light and dark code palettes independent", async () => {
    render(<ThemeMaker />);

    const keywordInput = screen.getByLabelText("Keyword") as HTMLInputElement;
    const darkKeyword = keywordInput.value;

    fireEvent.click(screen.getByText("Light Mode"));

    await waitFor(() => {
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    });

    const lightKeywordInput = screen.getByLabelText("Keyword") as HTMLInputElement;
    expect(lightKeywordInput.value).not.toBe(darkKeyword);

    fireEvent.change(lightKeywordInput, { target: { value: "#123456" } });
    expect(lightKeywordInput.value).toBe("#123456");

    fireEvent.click(screen.getByText("Dark Mode"));
    await waitFor(() => {
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    expect((screen.getByLabelText("Keyword") as HTMLInputElement).value).toBe(darkKeyword);
  });

  it("persists code config through save and create-from-active", async () => {
    render(<ThemeMaker />);

    const keywordInput = screen.getByLabelText("Keyword") as HTMLInputElement;
    fireEvent.change(keywordInput, { target: { value: "#abcdef" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Theme" }));

    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.customThemes.length).toBe(1);
      expect(state.customThemes[0].code.tokens.keyword).toBe("#abcdef");
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Create New Theme" }));

    await waitFor(() => {
      const state = useSettingsStore.getState();
      expect(state.customThemes.length).toBe(2);
      expect(state.customThemes[1].code.tokens.keyword).toBe("#abcdef");
    });
  });
});
