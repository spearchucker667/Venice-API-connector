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

function makeChatModel(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    object: "model",
    pipeline_tag: "text-generation",
    modalities: { input: ["text"], output: ["text"] },
    providers: ["hf-inference"],
    context_length: 4096,
    pricing: { input: 0.5, output: 1.5 },
    supports_tool_calling: true,
    supports_structured_output: true,
    ...overrides,
  };
}

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
          makeChatModel("meta-llama/Meta-Llama-3.1-70B-Instruct"),
          makeChatModel("deepseek-ai/DeepSeek-R1"),
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
    expect(result.models[0].contextLength).toBe(4096);
    expect(result.models[0].pricing).toEqual({ input: 0.5, output: 1.5 });
    expect(result.models[0].toolSupport).toBe(true);
    expect(result.models[0].structuredOutput).toBe(true);
    expect(result.models[0].providerAvailability).toEqual(["hf-inference"]);
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

  it("accepts text/chat architecture models", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [
            makeChatModel("Qwen/Qwen2.5-72B-Instruct"),
            { id: "org/Llama-Chat", object: "model", pipeline_tag: "conversational" },
            { id: "org/Text2Text", object: "model", task: "text2text-generation" },
          ],
        }),
      }),
    );

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.models.map((m) => m.id)).toEqual([
      "huggingface:Qwen/Qwen2.5-72B-Instruct",
      "huggingface:org/Llama-Chat",
      "huggingface:org/Text2Text",
    ]);
  });

  it("rejects image/audio/embedding-only models", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [
            {
              id: "black-forest-labs/FLUX.1-dev",
              object: "model",
              pipeline_tag: "image-generation",
              modalities: { input: ["text"], output: ["image"] },
            },
            {
              id: "openai/whisper-large-v3",
              object: "model",
              pipeline_tag: "automatic-speech-recognition",
              modalities: { input: ["audio"], output: ["text"] },
            },
            {
              id: "sentence-transformers/all-MiniLM-L6-v2",
              object: "model",
              pipeline_tag: "sentence-similarity",
            },
            makeChatModel("Qwen/Qwen2.5-72B-Instruct"),
          ],
        }),
      }),
    );

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.models.map((m) => m.id)).toEqual([
      "huggingface:Qwen/Qwen2.5-72B-Instruct",
    ]);
  });

  it("rejects models with no compatible provider", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [
            makeChatModel("good/model"),
            makeChatModel("no/provider", { providers: [] }),
            makeChatModel("weird/provider", { providers: [{ id: "unknown-vendor" }] }),
          ],
        }),
      }),
    );

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.models.map((m) => m.id)).toEqual(["huggingface:good/model"]);
  });

  it("rejects unavailable models", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [
            makeChatModel("good/model"),
            makeChatModel("retired/model", { status: "retired" }),
            makeChatModel("unavailable/model", { lifecycle: "unavailable" }),
          ],
        }),
      }),
    );

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.models.map((m) => m.id)).toEqual(["huggingface:good/model"]);
  });

  it("filters out non-chat model shapes using the fallback blacklist", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [
            { id: "sentence-transformers/all-MiniLM-L6-v2", object: "model" },
            { id: "openai/whisper-large-v3", object: "model" },
            makeChatModel("Qwen/Qwen2.5-72B-Instruct"),
          ],
        }),
      }),
    );

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.models.map((m) => m.id)).toEqual([
      "huggingface:Qwen/Qwen2.5-72B-Instruct",
    ]);
  });

  it("returns stale cached data when the live fetch fails", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    // Seed cache with a live fetch first.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [makeChatModel("meta-llama/Meta-Llama-3.1-70B-Instruct")],
        }),
      }),
    );
    await getHuggingFaceModelCatalog("default");

    clearHuggingFaceModelCache("default");
    // After clearing cache, a failed fetch with no cache returns an error.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" }),
    );
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
      json: async () => ({
        object: "list",
        data: [makeChatModel("a/b")],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getHuggingFaceModelCatalog("default");
    fetchMock.mockClear();
    const forced = await getHuggingFaceModelCatalog("default", { force: true });
    expect(forced.source).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns stale cache when the cached copy is past TTL", async () => {
    vi.useFakeTimers();
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [makeChatModel("cached/model")],
        }),
      }),
    );
    const first = await getHuggingFaceModelCatalog("default");
    expect(first.source).toBe("live");

    // Simulate time passing beyond TTL without a successful refresh.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      }),
    );
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);

    const stale = await getHuggingFaceModelCatalog("default");
    expect(stale.source).toBe("cached");
    expect(stale.stale).toBe(true);
    expect(stale.models.map((m) => m.id)).toEqual(["huggingface:cached/model"]);

    vi.useRealTimers();
  });

  it("ignores corrupt cache files and falls back to bundled", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    const cacheDir = path.join(userDataPath, "provider-catalogs");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, "huggingface-models-cache-v1-default.json"),
      "not valid json",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Server error",
      }),
    );

    const result = await getHuggingFaceModelCatalog("default");
    expect(result.source).toBe("bundled");
    expect(result.stale).toBe(true);
    expect(result.error).toContain("500");
  });

  it("survives concurrent refreshes without corrupting the cache", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [makeChatModel("concurrent/model")],
        }),
      }),
    );

    const [a, b] = await Promise.all([
      getHuggingFaceModelCatalog("default"),
      getHuggingFaceModelCatalog("default"),
    ]);
    expect(a.source).toBe("live");
    expect(b.source).toBe("live");
    expect(a.models.map((m) => m.id)).toEqual(["huggingface:concurrent/model"]);

    // Cache file must still be valid JSON.
    const cacheFile = path.join(
      userDataPath,
      "provider-catalogs",
      "huggingface-models-cache-v1-default.json",
    );
    expect(JSON.parse(fs.readFileSync(cacheFile, "utf8")).models).toHaveLength(1);
  });

  it("rejects invalid profile identifiers that could traverse paths", async () => {
    mockedGetProviderApiKey.mockReturnValue("hf-test-key");
    await expect(getHuggingFaceModelCatalog("../evil")).rejects.toThrow("Profile id");
  });
});
