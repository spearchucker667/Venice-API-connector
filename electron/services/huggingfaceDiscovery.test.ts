// @vitest-environment node

import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let userDataPath = "";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => userDataPath) },
}));

vi.mock("./secureStore", () => ({
  getProviderApiKey: vi.fn(),
}));

import { getProviderApiKey } from "./secureStore";
import {
  clearHuggingFaceModelCache,
  getHuggingFaceModelCatalog,
} from "./huggingfaceDiscovery";

const mockedGetProviderApiKey = vi.mocked(getProviderApiKey);

describe("huggingfaceDiscovery", () => {
  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "vf-hf-discovery-"));
    mockedGetProviderApiKey.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    fs.rmSync(userDataPath, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("returns an error when no API key is configured", async () => {
    mockedGetProviderApiKey.mockReturnValue(null);
    const result = await getHuggingFaceModelCatalog("default");
    expect(result.providerId).toBe("huggingface");
    expect(result.models).toEqual([]);
    expect(result.stale).toBe(true);
    expect(result.error).toContain("not configured");
  });

  it("fetches live models and caches them", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        object: "list",
        data: [
          { id: "meta-llama/Meta-Llama-3.1-70B-Instruct", object: "model" },
          { id: "deepseek-ai/DeepSeek-R1", object: "model" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.source).toBe("live");
    expect(result.stale).toBe(false);
    expect(result.models.map((m) => m.id)).toEqual([
      "huggingface:meta-llama/Meta-Llama-3.1-70B-Instruct",
      "huggingface:deepseek-ai/DeepSeek-R1",
    ]);
    expect(result.models.every((m) => m.lifecycle === "active")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://router.huggingface.co/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer hf-test-key" }),
      }),
    );

    // Second call within TTL should use cache without another network request.
    fetchMock.mockClear();
    const cached = await getHuggingFaceModelCatalog("default");
    expect(cached.source).toBe("cached");
    expect(cached.stale).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters out non-chat model shapes", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        object: "list",
        data: [
          { id: "sentence-transformers/all-MiniLM-L6-v2", object: "model" },
          { id: "openai/whisper-large-v3", object: "model" },
          { id: "Qwen/Qwen2.5-72B-Instruct", object: "model" },
        ],
      }),
    }));

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.models.map((m) => m.id)).toEqual(["huggingface:Qwen/Qwen2.5-72B-Instruct"]);
  });

  it("returns stale cached data when the live fetch fails", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    // Seed cache with a live fetch first.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        object: "list",
        data: [{ id: "meta-llama/Meta-Llama-3.1-70B-Instruct", object: "model" }],
      }),
    }));
    await getHuggingFaceModelCatalog("default");

    clearHuggingFaceModelCache("default");
    // After clearing cache, a failed fetch with no cache returns an error.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" }));
    const result = await getHuggingFaceModelCatalog("default");
    expect(result.source).toBe("bundled");
    expect(result.stale).toBe(true);
    expect(result.error).toContain("401");
  });

  it("force-refreshes even when the cache is fresh", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ object: "list", data: [{ id: "a/b", object: "model" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getHuggingFaceModelCatalog("default");
    fetchMock.mockClear();
    const forced = await getHuggingFaceModelCatalog("default", { force: true });
    expect(forced.source).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
