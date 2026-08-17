/** @fileoverview Unit tests for the canonical /augment/search wire builder. */

import { describe, expect, it } from "vitest";
import {
  VENICE_SEARCH_MAX_LIMIT,
  buildVeniceSearchPayload,
  clampVeniceSearchLimit,
  normalizeVeniceSearchProvider,
} from "./veniceSearchWire";

describe("veniceSearchWire", () => {
  it("builds the documented WebSearchRequest body with search_provider and limit", () => {
    const payload = buildVeniceSearchPayload("latest AI news", {
      provider: "brave",
      limit: 5,
    });
    expect(payload).toEqual({
      query: "latest AI news",
      search_provider: "brave",
      limit: 5,
    });
  });

  it("omits search_provider and limit when not supplied", () => {
    const payload = buildVeniceSearchPayload("test");
    expect(payload).toEqual({ query: "test" });
    expect(payload).not.toHaveProperty("search_provider");
    expect(payload).not.toHaveProperty("limit");
  });

  it("omits search_provider for values outside the documented enum", () => {
    for (const bad of ["auto", "jina", "duckduckgo", undefined, null, 42]) {
      const payload = buildVeniceSearchPayload("x", { provider: bad as never });
      expect(payload).not.toHaveProperty("search_provider");
      expect(payload.query).toBe("x");
    }
    expect(normalizeVeniceSearchProvider("google")).toBe("google");
    expect(normalizeVeniceSearchProvider("brave")).toBe("brave");
  });

  it("clamps limit into the documented 1..20 range", () => {
    expect(clampVeniceSearchLimit(0)).toBe(1);
    expect(clampVeniceSearchLimit(25)).toBe(VENICE_SEARCH_MAX_LIMIT);
    expect(clampVeniceSearchLimit(7)).toBe(7);
    expect(clampVeniceSearchLimit(undefined)).toBeUndefined();
    expect(clampVeniceSearchLimit("abc")).toBeUndefined();
    const payload = buildVeniceSearchPayload("x", { limit: 100 });
    expect(payload.limit).toBe(VENICE_SEARCH_MAX_LIMIT);
  });

  it("trims and truncates the query to the documented 400-char maximum", () => {
    const longQuery = "q".repeat(500);
    const payload = buildVeniceSearchPayload(`  ${longQuery}  `);
    expect(payload.query.length).toBe(400);
  });

  it("never emits the legacy provider / maxResults names", () => {
    const payload = buildVeniceSearchPayload("x", {
      provider: "google",
      limit: 3,
    }) as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty("provider");
    expect(payload).not.toHaveProperty("maxResults");
  });
});
