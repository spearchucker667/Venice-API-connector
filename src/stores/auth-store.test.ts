// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  setApiKey: vi.fn(),
  setJinaApiKey: vi.fn(),
  setProviderApiKey: vi.fn(),
  getProviderSettings: vi.fn(async () => ({
    enabledProviders: {},
    autoFallbackEnabled: false,
    fallbackOrdering: [],
    nativeFallbackModels: {},
  })),
  getApiKeyStatus: vi.fn(async () => ({ configured: false, state: "not-configured" as const, storageMode: "encrypted" as const })),
  testApiKey: vi.fn(async (): Promise<any> => ({ ok: true, status: 200, message: "Connection successful", connectivity: { ok: true, kind: "verified" as const, checkedAt: "2026-08-26T00:00:00.000Z", statusCode: 200, endpoint: "models" as const } })),
}));

vi.mock("../services/desktopBridge", () => ({
  desktopApiKey: {
    set: bridgeMocks.setApiKey,
    delete: vi.fn(),
    isConfigured: vi.fn(async () => false),
    getStatus: bridgeMocks.getApiKeyStatus,
    test: bridgeMocks.testApiKey,
  },
  desktopJinaApiKey: {
    set: bridgeMocks.setJinaApiKey,
    delete: vi.fn(),
    isConfigured: vi.fn(async () => false),
  },
  desktopProviderApiKey: {
    set: bridgeMocks.setProviderApiKey,
    delete: vi.fn(),
    isConfigured: vi.fn(async () => false),
  },
  desktopProviderCredential: {
    set: vi.fn(),
    delete: vi.fn(),
    isConfigured: vi.fn(async () => false),
  },
  desktopProviderSettings: {
    get: bridgeMocks.getProviderSettings,
    update: vi.fn(),
  },
}));

import { desktopApiKey, desktopJinaApiKey } from "../services/desktopBridge";
import { selectHasVeniceKey, useAuthStore } from "./auth-store";
import { registerModelQueryClient } from "../services/modelQueryCoordinator";

const invalidateQueries = vi.fn(async () => undefined);
registerModelQueryClient({ invalidateQueries } as never);

describe("configured Venice key gating", () => {
  beforeEach(() => {
    bridgeMocks.setApiKey.mockReset();
    bridgeMocks.setJinaApiKey.mockReset();
    bridgeMocks.getApiKeyStatus.mockReset();
    bridgeMocks.getApiKeyStatus.mockResolvedValue({ configured: false, state: "not-configured", storageMode: "encrypted" });
    bridgeMocks.testApiKey.mockReset();
    bridgeMocks.testApiKey.mockResolvedValue({ ok: true, status: 200, message: "Connection successful", connectivity: { ok: true, kind: "verified", checkedAt: "2026-08-26T00:00:00.000Z", statusCode: 200, endpoint: "models" } });
    vi.mocked(desktopApiKey.delete).mockReset();
    invalidateQueries.mockClear();
    useAuthStore.setState({
      apiKey: null,
      isConfigured: false,
      jinaApiKey: null,
      jinaIsConfigured: false,
      hydrationStatus: "idle",
      hydrationError: null,
    });
  });

  // VERIFY-037: persisted OS-secure configuration must unlock the UI without
  // copying the raw key back into renderer memory after restart.
  it("treats OS-secure configured state as usable without a renderer key", () => {
    expect(selectHasVeniceKey({ apiKey: null, isConfigured: true })).toBe(true);
    expect(selectHasVeniceKey({ apiKey: null, isConfigured: false })).toBe(false);
  });

  it("routes primary UI key gates through the configured-state selector", () => {
    const root = path.resolve(__dirname, "../..");
    const files = [
      "src/components/chat/chat-view.tsx",
      "src/components/image/image-view.tsx",
      "src/components/video/video-view.tsx",
      "src/components/audio/audio-view.tsx",
      "src/components/image/image-tools.tsx",
      "src/components/embeddings/embeddings-view.tsx",
      "src/components/music/music-view.tsx",
      "src/components/playground/playground-chat.tsx",
      "src/components/layout/header.tsx",
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source, file).toContain("selectHasVeniceKey");
      expect(source, file).not.toMatch(/useAuthStore\(\(s\) => s\.apiKey/);
    }
  });

  it("does not retain a Venice key after a successful secure-store write", async () => {
    bridgeMocks.setApiKey.mockResolvedValueOnce({ ok: true, storageMode: "encrypted" });
    await useAuthStore.getState().setApiKey("venice_secret_fixture");
    expect(useAuthStore.getState()).toMatchObject({ apiKey: null, isConfigured: true });
  });

  it("keeps Venice configured state unchanged when secure-store write fails", async () => {
    bridgeMocks.setApiKey.mockResolvedValueOnce({ ok: false, code: "SECRET_STORAGE_WRITE_FAILED", safeMessage: "The key could not be stored securely." });
    const outcome = await useAuthStore.getState().setApiKey("venice_secret_fixture");
    expect(outcome).toEqual({ stored: false, code: "SECRET_STORAGE_WRITE_FAILED", safeMessage: "The key could not be stored securely." });
    expect(useAuthStore.getState()).toMatchObject({ apiKey: null, isConfigured: false });
  });

  it("retains a stored key and reports invalid validation when Venice rejects it (no silent rollback)", async () => {
    bridgeMocks.setApiKey.mockResolvedValueOnce({ ok: true, storageMode: "encrypted" });
    bridgeMocks.testApiKey.mockResolvedValueOnce({
      ok: false,
      status: 401,
      message: "Unauthorized",
      connectivity: { ok: false, kind: "invalid-api-key", checkedAt: "2026-08-26T00:00:00.000Z", statusCode: 401, safeMessage: "API key was found, but Venice rejected it. Re-enter the key in Config.", retryable: false },
    });

    const outcome = await useAuthStore.getState().setApiKey("venice_secret_fixture");
    // P1-003: a key the user stored must remain stored so the user can
    // deliberately delete or replace it. We do NOT auto-roll-back storage
    // on Venice auth rejection; we surface the typed invalid outcome.
    expect(outcome).toEqual({ stored: true, validation: "invalid" });
    expect(useAuthStore.getState()).toMatchObject({ isConfigured: true, credentialFailureCode: "PROVIDER_AUTH_REJECTED" });
  });

  it("retains a securely stored key while reporting a network verification failure", async () => {
    bridgeMocks.setApiKey.mockResolvedValueOnce({ ok: true, storageMode: "encrypted" });
    bridgeMocks.testApiKey.mockResolvedValueOnce({
      ok: false,
      status: 0,
      message: "Network request failed",
      connectivity: { ok: false, kind: "network-failure", checkedAt: "2026-08-26T00:00:00.000Z", statusCode: 0, safeMessage: "Network request failed before Venice responded.", retryable: true },
    });

    const outcome = await useAuthStore.getState().setApiKey("venice_secret_fixture");
    expect(outcome).toEqual({ stored: true, validation: "network-error" });
    expect(desktopApiKey.delete).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ isConfigured: true, credentialFailureCode: "NETWORK_ERROR" });
  });

  it("does not retain a Jina key and rejects failed secure-store writes", async () => {
    bridgeMocks.setJinaApiKey.mockResolvedValueOnce({ ok: true });
    await useAuthStore.getState().setJinaApiKey("jina_secret_fixture");
    expect(useAuthStore.getState()).toMatchObject({ jinaApiKey: null, jinaIsConfigured: true });

    useAuthStore.setState({ jinaApiKey: null, jinaIsConfigured: false });
    bridgeMocks.setJinaApiKey.mockResolvedValueOnce({ ok: false, error: "Bearer secret" });
    await expect(useAuthStore.getState().setJinaApiKey("jina_secret_fixture")).rejects.toThrow("Failed to save Jina API key.");
    expect(useAuthStore.getState()).toMatchObject({ jinaApiKey: null, jinaIsConfigured: false });
  });
  it("checkConfiguration fetches and updates isConfigured for both Venice and Jina", async () => {
    bridgeMocks.getApiKeyStatus.mockResolvedValueOnce({ configured: true, state: "configured", storageMode: "encrypted" } as any);
    vi.mocked(desktopJinaApiKey.isConfigured).mockResolvedValueOnce(false);

    await useAuthStore.getState().checkConfiguration();

    expect(desktopApiKey.getStatus).toHaveBeenCalled();
    expect(desktopJinaApiKey.isConfigured).toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ isConfigured: true, jinaIsConfigured: false, hydrationStatus: "ready" });
  });

  it("publishes Venice readiness before slower fallback-provider checks finish", async () => {
    let resolveJina!: (value: boolean) => void;
    bridgeMocks.getApiKeyStatus.mockResolvedValueOnce({ configured: true, state: "configured", storageMode: "encrypted" } as any);
    vi.mocked(desktopJinaApiKey.isConfigured).mockReturnValueOnce(new Promise((resolve) => {
      resolveJina = resolve;
    }));

    const checking = useAuthStore.getState().checkConfiguration();
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState()).toMatchObject({ isConfigured: true, hydrationStatus: "checking" });
    resolveJina(false);
    await checking;
    expect(useAuthStore.getState().hydrationStatus).toBe("ready");
  });

  it("invalidates the model query after setting and clearing the Venice key", async () => {
    bridgeMocks.setApiKey.mockResolvedValue({ ok: true, storageMode: "encrypted" });
    vi.mocked(desktopApiKey.delete).mockResolvedValue({ ok: true, storageMode: "encrypted" } as never);
    await useAuthStore.getState().setApiKey("venice_secret_fixture");
    await useAuthStore.getState().clearApiKey();
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ["models"] });
  });

  it("clearApiKey calls delete on desktopBridge and updates state", async () => {
    vi.mocked(desktopApiKey.delete).mockResolvedValueOnce({ ok: true, storageMode: "encrypted" } as any);
    useAuthStore.setState({ isConfigured: true, apiKey: "some-key" });

    await useAuthStore.getState().clearApiKey();

    expect(desktopApiKey.delete).toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ isConfigured: false, apiKey: null });
  });

  it("clearJinaApiKey calls delete on desktopBridge and updates state", async () => {
    vi.mocked(desktopJinaApiKey.delete).mockResolvedValueOnce({ ok: true } as any);
    useAuthStore.setState({ jinaIsConfigured: true, jinaApiKey: "some-key" });

    await useAuthStore.getState().clearJinaApiKey();

    expect(desktopJinaApiKey.delete).toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ jinaIsConfigured: false, jinaApiKey: null });
  });
});
