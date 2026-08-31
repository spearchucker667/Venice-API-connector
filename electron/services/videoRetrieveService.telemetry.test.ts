// @vitest-environment node
// VERIFY-158 regression guard: video retrieve emits exactly one inspector
// telemetry pair (request + completion) reusing the same eventId, tagged with
// source = main-video / transport = venice, and never carries a provider
// download_url, signed URL, or raw response payload past the bus.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  persistStream: vi.fn(),
  download: vi.fn(),
  persistMedia: vi.fn(),
  getApiKey: vi.fn(() => "secret-key"),
  publishInspectorRequest: vi.fn(() => "evt-video-1"),
  publishInspectorCompletion: vi.fn(),
}));

vi.mock("electron", () => ({ app: { getVersion: () => "test" } }));
vi.mock("https", () => ({ default: { request: mocks.request } }));
vi.mock("./secureStore", () => ({ getApiKey: mocks.getApiKey }));
vi.mock("./generatedMediaStream", () => ({
  persistGeneratedMp4Stream: mocks.persistStream,
}));
vi.mock("./generatedVideoDownload", () => ({
  downloadGeneratedVideo: mocks.download,
}));
vi.mock("./generatedMediaStore", () => ({
  persistGeneratedMedia: mocks.persistMedia,
}));
vi.mock("./runtimeSafetySettings", () => ({
  getRuntimeLocalFamilySafeModeEnabled: vi.fn(() => false),
}));
vi.mock("./inspectorTelemetry", () => ({
  publishInspectorRequest: mocks.publishInspectorRequest,
  publishInspectorCompletion: mocks.publishInspectorCompletion,
}));

import { retrieveVideoQueueResult } from "./videoRetrieveService";

const durable = {
  id: "a".repeat(64),
  url: `venice-media://${"a".repeat(64)}`,
  mimeType: "video/mp4",
  byteCount: 12,
  sha256: "a".repeat(64),
};

function respond(status: number, contentType: string, body: Buffer): void {
  const request = new EventEmitter() as EventEmitter & {
    end: (body?: string) => void;
    destroy: (error: Error) => void;
  };
  request.destroy = (error) => request.emit("error", error);
  request.end = () => {
    const response = new PassThrough() as PassThrough & {
      statusCode: number;
      headers: Record<string, string>;
    };
    response.statusCode = status;
    response.headers = { "content-type": contentType };
    const callback = mocks.request.mock.calls.at(-1)?.[1] as (
      response: PassThrough
    ) => void;
    callback(response);
    response.end(body);
  };
  mocks.request.mockReturnValueOnce(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiKey.mockReturnValue("secret-key");
  mocks.persistStream.mockResolvedValue(durable);
  mocks.download.mockResolvedValue(durable);
  mocks.persistMedia.mockResolvedValue(durable);
  mocks.publishInspectorRequest.mockReturnValue("evt-video-1");
});

describe("retrieveVideoQueueResult — Phase C inspector telemetry (VERIFY-158)", () => {
  it("emits one request and one completion reusing eventId on success", async () => {
    respond(200, "application/json", Buffer.from(JSON.stringify({ status: "COMPLETED" })));

    await retrieveVideoQueueResult({
      queueId: "q-1",
      model: "model",
      profileId: "default",
      queueDownloadUrl: "https://media.example/video.mp4",
    });

    expect(mocks.publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(mocks.publishInspectorRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "main-video",
        transport: "venice",
        endpoint: "/video/retrieve",
        method: "POST",
        summaries: expect.objectContaining({
          taskId: "q-1",
          model: "model",
        }),
      })
    );

    expect(mocks.publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = mocks.publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-video-1");
    expect(completionArg.source).toBe("main-video");
    expect(completionArg.transport).toBe("venice");
    expect(completionArg.status).toBe(200);
    expect(completionArg.error).toBeUndefined();
  });

  it("emits completion reusing eventId on processing poll (no terminal status yet)", async () => {
    respond(200, "application/json", Buffer.from(JSON.stringify({ status: "PROCESSING" })));

    await retrieveVideoQueueResult({
      queueId: "q-2",
      model: "model",
      profileId: "default",
    });

    expect(mocks.publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(mocks.publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = mocks.publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-video-1");
    expect(completionArg.source).toBe("main-video");
    expect(completionArg.transport).toBe("venice");
    expect(completionArg.endpoint).toBe("/video/retrieve");
    // processing polls are non-terminal: no status yet, no error.
    expect(completionArg.status).toBeUndefined();
    expect(completionArg.error).toBeUndefined();
  });

  it("does not leak the provider download_url into completion summaries or error", async () => {
    respond(
      200,
      "application/json",
      Buffer.from(JSON.stringify({ status: "COMPLETED", download_url: "https://provider.example/secret-signed.mp4" }))
    );

    await retrieveVideoQueueResult({
      queueId: "q-3",
      model: "model",
      profileId: "default",
      queueDownloadUrl: "https://provider.example/secret-signed.mp4",
    });

    const completionArg = mocks.publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-video-1");
    const serialized = JSON.stringify(completionArg);
    expect(serialized).not.toContain("secret-signed");
    expect(serialized).not.toContain("download_url");
  });

  it("emits completion with sanitized error when dispatcher throws", async () => {
    respond(200, "video/mp4", Buffer.from("invalid"));
    mocks.persistStream.mockRejectedValueOnce(
      new Error("Video media could not be persisted. --- THE SIGNED URL https://provider.example/x.mp4 ---")
    );

    await expect(
      retrieveVideoQueueResult({
        queueId: "q-4",
        model: "model",
        profileId: "default",
      })
    ).rejects.toBeDefined();

    expect(mocks.publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(mocks.publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = mocks.publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-video-1");
    expect(completionArg.error).toEqual(expect.stringMatching(/video|persist/i));
    const serialized = JSON.stringify(completionArg);
    expect(serialized).not.toContain("provider.example/x.mp4");
  });
});
