import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/veniceClient", () => ({
  veniceFetch: vi.fn(),
}));

import { veniceFetch } from "../../services/veniceClient";
import { veniceResearchProvider } from "./veniceResearchProvider";

describe("veniceResearchProvider", () => {
  beforeEach(() => {
    vi.mocked(veniceFetch).mockReset();
  });

  it("wraps /augment/search and normalizes results", async () => {
    vi.mocked(veniceFetch).mockResolvedValueOnce({
      data: {
        results: [
          { title: "A", url: "https://a.com", snippet: "snip" },
          { name: "B", link: "https://b.com", description: "desc" },
        ],
      },
    } as any);

    const results = await veniceResearchProvider.search!({ query: "test" });

    expect(veniceFetch).toHaveBeenCalledWith(
      "/augment/search",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ query: "test", search_provider: "brave" }),
      })
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: "venice",
      title: "A",
      url: "https://a.com",
      snippet: "snip",
    });
    expect(results[1]).toMatchObject({
      provider: "venice",
      title: "B",
      url: "https://b.com",
      snippet: "desc",
    });
  });

  it("passes custom provider option through options as search_provider", async () => {
    vi.mocked(veniceFetch).mockResolvedValueOnce({ data: { results: [] } } as any);
    await veniceResearchProvider.search!({
      query: "x",
      options: { provider: "google" },
    });
    expect(veniceFetch).toHaveBeenCalledWith(
      "/augment/search",
      expect.objectContaining({
        body: expect.objectContaining({ search_provider: "google" }),
      })
    );
    expect(vi.mocked(veniceFetch).mock.calls[0][1]?.body).not.toHaveProperty("provider");
  });

  it("serializes maxResults as the documented limit field (clamped 1..20)", async () => {
    vi.mocked(veniceFetch).mockResolvedValueOnce({ data: { results: [] } } as any);
    await veniceResearchProvider.search!({
      query: "x",
      maxResults: 25,
    });
    const body = vi.mocked(veniceFetch).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ query: "x", limit: 20 });
    expect(body).not.toHaveProperty("maxResults");
  });

  it("omits search_provider for unsupported provider values", async () => {
    vi.mocked(veniceFetch).mockResolvedValueOnce({ data: { results: [] } } as any);
    await veniceResearchProvider.search!({
      query: "x",
      options: { provider: "auto" as any },
    });
    const body = vi.mocked(veniceFetch).mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ query: "x" });
    expect(body).not.toHaveProperty("search_provider");
  });

  it("wraps /augment/scrape and normalizes response", async () => {
    vi.mocked(veniceFetch).mockResolvedValueOnce({
      data: { markdown: "# Hello", title: "T" },
    } as any);

    const result = await veniceResearchProvider.scrape!({
      url: "https://example.com",
    });

    expect(veniceFetch).toHaveBeenCalledWith(
      "/augment/scrape",
      expect.objectContaining({
        method: "POST",
        body: { url: "https://example.com" },
      })
    );

    expect(result.provider).toBe("venice");
    expect(result.url).toBe("https://example.com");
    expect(result.markdown).toBe("# Hello");
    expect(result.title).toBe("T");
    expect(result.fetchedAt).toBeDefined();
  });

  it("falls back to text/content when markdown missing", async () => {
    vi.mocked(veniceFetch).mockResolvedValueOnce({
      data: { text: "plain", content: "c" },
    } as any);

    const result = await veniceResearchProvider.scrape!({
      url: "https://example.com",
    });

    expect(result.text).toBe("plain");
    expect(result.content).toBe("c"); // content present and preferred over text
  });
});
