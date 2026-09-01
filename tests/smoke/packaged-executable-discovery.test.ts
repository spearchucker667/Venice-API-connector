import { describe, expect, test, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { findPackagedExecutable } from './smoke-utils';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('packaged executable discovery', () => {
  test('finds the unpacked Linux executable produced by electron-builder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-smoke-'));
    temporaryDirectories.push(root);
    const executable = path.join(root, 'release', 'linux-unpacked', 'venice-forge');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'fixture');

    expect(findPackagedExecutable(root, 'linux', 'x64')).toBe(executable);
  });

  test('finds a macOS app executable without assuming the bundle or binary name', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-smoke-'));
    temporaryDirectories.push(root);
    const executable = path.join(root, 'release', 'mac-arm64', 'Renamed Product.app', 'Contents', 'MacOS', 'renamed-product');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'fixture');

    expect(findPackagedExecutable(root, 'darwin', 'arm64')).toBe(executable);
  });

  test('finds the Windows unpacked executable produced by electron-builder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-smoke-'));
    temporaryDirectories.push(root);
    const unpackedDir = path.join(root, 'release', 'win-unpacked');
    const executable = path.join(unpackedDir, 'Venice Forge.exe');
    fs.mkdirSync(unpackedDir, { recursive: true });
    fs.writeFileSync(executable, 'fixture');
    fs.writeFileSync(path.join(unpackedDir, 'dummy.txt'), 'fixture');

    expect(findPackagedExecutable(root, 'win32', 'x64')).toBe(executable);
  });

  test('returns undefined when the platform package is absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-smoke-'));
    temporaryDirectories.push(root);

    expect(findPackagedExecutable(root, 'linux', 'x64')).toBeUndefined();
  });
});
