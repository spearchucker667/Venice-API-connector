// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import { constants as fsConstants } from "fs";
import os from "os";
import path from "path";
import { readRegularFileNoFollow } from "./secureFile";

// VERIFY-126: protocol-served local files are read from a validated no-follow descriptor.
describe("readRegularFileNoFollow", () => {
  let root = "";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "vf-secure-file-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("reads a regular file", async () => {
    const file = path.join(root, "audio.mp3");
    fs.writeFileSync(file, "audio-bytes");
    await expect(readRegularFileNoFollow(file)).resolves.toEqual(Buffer.from("audio-bytes"));
  });

  it.runIf(process.platform !== "win32")("rejects a symbolic link", async () => {
    const target = path.join(root, "target.mp3");
    const link = path.join(root, "link.mp3");
    fs.writeFileSync(target, "secret");
    fs.symlinkSync(target, link);
    await expect(readRegularFileNoFollow(link)).rejects.toThrow();
  });

  it("rejects a directory", async () => {
    await expect(readRegularFileNoFollow(root)).rejects.toThrow("Not a regular file");
  });

  // VERIFY-126 follow-up: TOCTOU regression for VF-AUD-20260831-P2-005.
  // The character-cache protocol previously called `fs.promises.stat(dp)` and
  // then `fs.createReadStream(dp)` against the same path. Between those two
  // open() calls an attacker who can write to the cache directory could
  // unlink+rename the file to swap content. The descriptor-backed pattern
  // opens once with O_NOFOLLOW; fstat and readFile then operate on the same
  // inode, so a later unlink+replace at the same path is invisible to the
  // in-flight read.
  it.runIf(process.platform !== "win32")(
    "reads original bytes after the path is replaced on disk (TOCTOU regression)",
    async () => {
      const file = path.join(root, "image.bin");
      fs.writeFileSync(file, "original-bytes");

      const handle = await fs.promises.open(
        file,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      try {
        // Replace the path on disk between the open and the read.
        fs.unlinkSync(file);
        fs.writeFileSync(file, "replacement-bytes");

        const stat = await handle.stat();
        expect(stat.isFile()).toBe(true);
        const bytes = await handle.readFile();
        expect(bytes).toEqual(Buffer.from("original-bytes"));
      } finally {
        await handle.close();
      }
    },
  );
});
