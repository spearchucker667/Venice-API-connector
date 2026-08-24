/** @fileoverview Hugging Face Inference Providers live model discovery with
 *  bounded disk cache and stale-while-revalidate fallback. */

import fs from "fs";
import path from "path";
import { app } from "electron";
import type {
  ProviderModel,
  ProviderModelCatalogResult,
  ProviderModelLifecycle,
} from "../../src/types/provider";
import { getProviderApiKey } from "./secureStore";
import { redactErrorMessage } from "../../src/shared/redaction";

const HF_MODELS_ENDPOINT = "https://router.huggingface.co/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_SCHEMA_VERSION = 1;

interface HuggingFaceModelsCache {
  version: number;
  fetchedAt: number;
  models: ProviderModel[];
}

function cacheFilePath(profileId: string): string {
  return path.join(
    app.getPath("userData"),
    "provider-catalogs",
    `huggingface-models-cache-v${CACHE_SCHEMA_VERSION}-${profileId}.json`,
  );
}

function readCache(profileId: string): HuggingFaceModelsCache | null {
  try {
    const raw = fs.readFileSync(cacheFilePath(profileId), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== CACHE_SCHEMA_VERSION) return null;
    if (typeof candidate.fetchedAt !== "number" || !Number.isFinite(candidate.fetchedAt)) return null;
    if (!Array.isArray(candidate.models)) return null;
    return {
      version: candidate.version as number,
      fetchedAt: candidate.fetchedAt as number,
      models: candidate.models as ProviderModel[],
    };
  } catch {
    return null;
  }
}

function writeCache(profileId: string, models: ProviderModel[], fetchedAt: number): void {
  const target = cacheFilePath(profileId);
  const temporary = `${target}.tmp`;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      temporary,
      JSON.stringify({ version: CACHE_SCHEMA_VERSION, fetchedAt, models }, null, 2),
      { encoding: "utf8", mode: 0o600 },
    );
    fs.renameSync(temporary, target);
  } catch (error) {
    // Cache writes are best-effort; discovery still returns live data.
    console.warn("[huggingfaceDiscovery] cache write failed:", redactErrorMessage(error));
  }
}

function isHfChatModel(modelId: string): boolean {
  // The HF Inference Providers chat endpoint supports a broad set of models.
  // We exclude obviously non-chat modalities (embeddings, image-only, audio,
  // classification) and treat everything else as chat-capable, which the UI
  // marks as live-discovered.
  const lower = modelId.toLowerCase();
  const excludedSubstrings = [
    "embedding",
    "similarity",
    "classifier",
    "classification",
    "vision-encoder",
    "speecht5",
    "wav2vec",
    "whisper",
    "t5-base",
    "t5-small",
    "sentence-transformers",
    "all-minilm",
  ];
  if (excludedSubstrings.some((substring) => lower.includes(substring))) return false;
  return true;
}

function normalizeHfModel(raw: unknown): ProviderModel | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === "string" ? entry.id : null;
  if (!id || !isHfChatModel(id)) return null;
  const lifecycle: ProviderModelLifecycle = "active";
  return {
    id: `huggingface:${id}`,
    name: id,
    provider: "huggingface",
    capabilities: { chat: true },
    lifecycle,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLiveHuggingFaceModels(apiKey: string): Promise<ProviderModel[]> {
  const response = await fetchWithTimeout(HF_MODELS_ENDPOINT, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "unknown");
    throw new Error(`HF model discovery failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as unknown;
  if (!json || typeof json !== "object" || !Array.isArray((json as Record<string, unknown>).data)) {
    throw new Error("HF model discovery returned an unexpected response shape.");
  }

  const entries = (json as Record<string, unknown>).data as unknown[];
  return entries.map(normalizeHfModel).filter((m): m is ProviderModel => m !== null);
}

/**
 * Returns the Hugging Face model catalog for the profile, using a cached copy
 * when fresh and refreshing in the background when stale or forced.
 */
export async function getHuggingFaceModelCatalog(
  profileId: string,
  options: { force?: boolean } = {},
): Promise<ProviderModelCatalogResult> {
  const checkedAt = Date.now();
  const apiKey = getProviderApiKey("huggingface", profileId);

  if (!apiKey) {
    return {
      providerId: "huggingface",
      models: [],
      fetchedAt: checkedAt,
      stale: true,
      source: "cached",
      error: "Hugging Face API key is not configured.",
    };
  }

  const cached = readCache(profileId);
  const isFresh = cached !== null && checkedAt - cached.fetchedAt < CACHE_TTL_MS;

  if (!options.force && isFresh && cached) {
    return {
      providerId: "huggingface",
      models: cached.models,
      fetchedAt: cached.fetchedAt,
      stale: false,
      source: "cached",
    };
  }

  try {
    const models = await fetchLiveHuggingFaceModels(apiKey);
    writeCache(profileId, models, checkedAt);
    return {
      providerId: "huggingface",
      models,
      fetchedAt: checkedAt,
      stale: false,
      source: "live",
    };
  } catch (error) {
    const message = redactErrorMessage(error);
    if (cached) {
      return {
        providerId: "huggingface",
        models: cached.models,
        fetchedAt: cached.fetchedAt,
        stale: true,
        source: "cached",
        error: message,
      };
    }
    return {
      providerId: "huggingface",
      models: [],
      fetchedAt: checkedAt,
      stale: true,
      source: "bundled",
      error: message,
    };
  }
}

/** Clears the cached Hugging Face model catalog for a profile. */
export function clearHuggingFaceModelCache(profileId: string): void {
  try {
    fs.unlinkSync(cacheFilePath(profileId));
  } catch {
    // Ignore missing-cache deletes.
  }
}
