// @vitest-environment node

/** @fileoverview Focused tests for the Replicate prediction lifecycle service. */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateReplicateModel,
  createReplicatePrediction,
  cancelReplicatePrediction,
  downloadReplicateOutput,
  pollReplicatePrediction,
  testReplicateConnection,
  type ReplicatePrediction,
} from "./replicateService";

const TOKEN = "r8_test_token";

function mockFetch(response: { ok: boolean; status: number; statusText?: string; headers?: Headers; text?: string; arrayBuffer?: ArrayBuffer }) {
  const headers = response.headers ?? new Headers();
  return vi.fn().mockResolvedValueOnce({
    ok: response.ok,
    status: response.status,
    statusText: response.statusText ?? "",
    headers,
    text: vi.fn().mockResolvedValue(response.text ?? ""),
    arrayBuffer: vi.fn().mockResolvedValue(response.arrayBuffer ?? new ArrayBuffer(0)),
  } as unknown as Response);
}

describe("replicateService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("validateReplicateModel", () => {
    it("accepts owner/name and owner/name:version", () => {
      expect(validateReplicateModel("black-forest-labs/flux-schnell")).toBe("black-forest-labs/flux-schnell");
      expect(validateReplicateModel("black-forest-labs/flux-schnell:1.0")).toBe("black-forest-labs/flux-schnell:1.0");
    });

    it("rejects invalid model identifiers", () => {
      expect(() => validateReplicateModel("")).toThrow("Replicate model is required.");
      expect(() => validateReplicateModel("../etc/passwd")).toThrow("Replicate model identifier is invalid.");
      expect(() => validateReplicateModel("https://evil.com/model")).toThrow("Replicate model identifier is invalid.");
    });
  });

  describe("createReplicatePrediction", () => {
    it("creates a prediction with Bearer auth", async () => {
      const prediction: ReplicatePrediction = {
        id: "pred-123",
        status: "starting",
        input: { prompt: "a cat" },
      };
      const fetchMock = mockFetch({ ok: true, status: 200, text: JSON.stringify(prediction) });
      vi.stubGlobal("fetch", fetchMock);

      const result = await createReplicatePrediction(TOKEN, { model: "black-forest-labs/flux-schnell", input: { prompt: "a cat" } });
      expect(result.id).toBe("pred-123");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.replicate.com/v1/models/black-forest-labs%2Fflux-schnell/predictions");
      expect((init as RequestInit).method).toBe("POST");
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: "Bearer r8_test_token",
        "Content-Type": "application/json",
      });
    });

    it("throws a sanitized error on provider failure", async () => {
      const fetchMock = mockFetch({ ok: false, status: 402, text: JSON.stringify({ detail: "Payment required" }) });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createReplicatePrediction(TOKEN, { model: "black-forest-labs/flux-schnell", input: { prompt: "a cat" } }),
      ).rejects.toThrow("Payment required");
    });
  });

  describe("pollReplicatePrediction", () => {
    it("returns pending while processing", async () => {
      const prediction: ReplicatePrediction = { id: "pred-123", status: "processing", input: {} };
      vi.stubGlobal("fetch", mockFetch({ ok: true, status: 200, text: JSON.stringify(prediction) }));

      const result = await pollReplicatePrediction(TOKEN, "pred-123");
      expect(result.kind).toBe("pending");
    });

    it("returns completed with output URL", async () => {
      const prediction: ReplicatePrediction = {
        id: "pred-123",
        status: "succeeded",
        input: {},
        output: ["https://replicate.delivery/out.png"],
      };
      vi.stubGlobal("fetch", mockFetch({ ok: true, status: 200, text: JSON.stringify(prediction) }));

      const result = await pollReplicatePrediction(TOKEN, "pred-123");
      expect(result.kind).toBe("completed");
      if (result.kind === "completed") {
        expect(result.outputUrl).toBe("https://replicate.delivery/out.png");
      }
    });

    it("returns failed when output URL is missing", async () => {
      const prediction: ReplicatePrediction = { id: "pred-123", status: "succeeded", input: {}, output: {} };
      vi.stubGlobal("fetch", mockFetch({ ok: true, status: 200, text: JSON.stringify(prediction) }));

      const result = await pollReplicatePrediction(TOKEN, "pred-123");
      expect(result.kind).toBe("failed");
    });

    it("returns canceled for canceled predictions", async () => {
      const prediction: ReplicatePrediction = { id: "pred-123", status: "canceled", input: {} };
      vi.stubGlobal("fetch", mockFetch({ ok: true, status: 200, text: JSON.stringify(prediction) }));

      const result = await pollReplicatePrediction(TOKEN, "pred-123");
      expect(result.kind).toBe("canceled");
    });
  });

  describe("cancelReplicatePrediction", () => {
    it("treats 409 as already terminal", async () => {
      vi.stubGlobal("fetch", mockFetch({ ok: false, status: 409, text: "" }));
      await expect(cancelReplicatePrediction(TOKEN, "pred-123")).resolves.toBeDefined();
    });

    it("throws on other failures", async () => {
      vi.stubGlobal("fetch", mockFetch({ ok: false, status: 500, text: JSON.stringify({ detail: "Server error" }) }));
      await expect(cancelReplicatePrediction(TOKEN, "pred-123")).rejects.toThrow("Server error");
    });
  });

  describe("downloadReplicateOutput", () => {
    it("downloads a valid HTTPS output URL", async () => {
      const buffer = Buffer.from("image");
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: vi.fn().mockResolvedValue(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
      } as unknown as Response);
      vi.stubGlobal("fetch", fetchMock);

      const result = await downloadReplicateOutput("https://replicate.delivery/out.png");
      expect(result.mimeType).toBe("image/png");
      expect(result.buffer.toString()).toBe("image");
    });

    it("rejects non-HTTPS URLs", async () => {
      await expect(downloadReplicateOutput("http://replicate.delivery/out.png")).rejects.toThrow("not a valid HTTPS URL");
      await expect(downloadReplicateOutput("file:///etc/passwd")).rejects.toThrow("not a valid HTTPS URL");
    });
  });

  describe("testReplicateConnection", () => {
    it("reports verified on 200", async () => {
      vi.stubGlobal("fetch", mockFetch({ ok: true, status: 200, text: "{}" }));
      const result = await testReplicateConnection(TOKEN);
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it("reports invalid token on 401/403", async () => {
      vi.stubGlobal("fetch", mockFetch({ ok: false, status: 401, text: "{}" }));
      const result = await testReplicateConnection(TOKEN);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/Invalid Replicate API token/i);
    });
  });
});
