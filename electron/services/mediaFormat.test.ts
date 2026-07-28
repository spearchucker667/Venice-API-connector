import { describe, expect, it } from "vitest";

import {
  mediaBytesMatchMime,
  mediaExtensionForMime,
  normalizeMediaMime,
} from "./mediaFormat";

const ascii = (value: string): Buffer => Buffer.from(value, "ascii");

describe("mediaFormat", () => {
  it("normalizes MIME parameters and casing", () => {
    expect(normalizeMediaMime(" Image/PNG ; charset=binary ")).toBe("image/png");
  });

  it.each([
    ["video/mp4", "mp4"],
    ["audio/mp4", "m4a"],
    ["audio/aac", "aac"],
    ["audio/mpeg", "mp3"],
    ["audio/wav", "wav"],
    ["audio/x-wav", "wav"],
    ["audio/flac", "flac"],
    ["audio/ogg", "ogg"],
    ["audio/opus", "opus"],
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/jpg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["image/avif", "avif"],
  ])("maps %s to .%s", (mimeType, extension) => {
    expect(mediaExtensionForMime(mimeType)).toBe(extension);
  });

  it("returns no extension for unsupported media", () => {
    expect(mediaExtensionForMime("application/octet-stream")).toBeUndefined();
  });

  it.each([
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
    ["image/jpg", Buffer.from([0xff, 0xd8, 0xff])],
    ["image/webp", ascii("RIFF0000WEBP")],
    ["image/gif", ascii("GIF87a")],
    ["image/gif", ascii("GIF89a")],
    ["image/avif", ascii("0000ftypavif")],
    ["image/avif", ascii("0000ftypavis")],
    ["video/mp4", ascii("0000ftypmp42")],
    ["audio/mp4", ascii("0000ftypM4A ")],
    ["audio/mpeg", ascii("ID3")],
    ["audio/mpeg", Buffer.from([0xff, 0xe0])],
    ["audio/wav", ascii("RIFF0000WAVE")],
    ["audio/x-wav", ascii("RIFF0000WAVE")],
    ["audio/flac", ascii("fLaC")],
    ["audio/ogg", ascii("OggS")],
    ["audio/opus", ascii("OggS")],
    ["audio/aac", Buffer.from([0xff, 0xf0])],
  ])("accepts valid %s signatures", (mimeType, bytes) => {
    expect(mediaBytesMatchMime(bytes, mimeType)).toBe(true);
  });

  it.each([
    ["image/png", ascii("not-png!")],
    ["image/jpeg", ascii("bad")],
    ["image/webp", ascii("RIFF0000NOPE")],
    ["image/gif", ascii("GIF00a")],
    ["image/avif", ascii("0000ftypheic")],
    ["video/mp4", ascii("not-an-mp4!!")],
    ["audio/mpeg", ascii("bad")],
    ["audio/wav", ascii("RIFF0000NOPE")],
    ["audio/flac", ascii("bad!")],
    ["audio/ogg", ascii("bad!")],
    ["audio/aac", Buffer.from([0x00, 0x00])],
    ["application/octet-stream", ascii("unknown")],
    ["image/png", Buffer.alloc(0)],
  ])("rejects invalid %s signatures", (mimeType, bytes) => {
    expect(mediaBytesMatchMime(bytes, mimeType)).toBe(false);
  });
});
