import { afterEach, describe, expect, test } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const smokeTest = process.env.RUN_ELECTRON_SMOKE === 'true' ? test : test.skip;

const temporaryDirectories: string[] = [];

export function findPackagedExecutable(
  root: string,
  platform: NodeJS.Platform = os.platform(),
  architecture: string = os.arch(),
): string | undefined {
  const releaseDir = path.join(root, 'release');

  if (platform === 'win32') {
    if (!fs.existsSync(releaseDir)) return undefined;
    const portable = fs.readdirSync(releaseDir).find(file => file.endsWith('-Portable.exe'));
    return portable ? path.join(releaseDir, portable) : undefined;
  }

  if (platform === 'darwin') {
    const archs = architecture === 'arm64' ? ['mac-arm64', 'mac'] : ['mac', 'mac-arm64'];
    const searchDirectories = [...archs.map(directory => path.join(releaseDir, directory)), releaseDir];

    const findExecutableInBundle = (directory: string): string | undefined => {
      if (!fs.existsSync(directory)) return undefined;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(directory, entry.name);
        if (entry.name.endsWith('.app')) {
          const executableDirectory = path.join(entryPath, 'Contents', 'MacOS');
          if (!fs.existsSync(executableDirectory)) continue;
          const executable = fs.readdirSync(executableDirectory, { withFileTypes: true })
            .find(candidate => candidate.isFile());
          if (executable) return path.join(executableDirectory, executable.name);
          continue;
        }
        const nestedExecutable = findExecutableInBundle(entryPath);
        if (nestedExecutable) return nestedExecutable;
      }
      return undefined;
    };

    for (const directory of searchDirectories) {
      const executable = findExecutableInBundle(directory);
      if (executable) return executable;
    }
    return undefined;
  }

  if (platform === 'linux') {
    const unpackedDirectories = architecture === 'arm64'
      ? ['linux-arm64-unpacked', 'linux-unpacked']
      : ['linux-unpacked', 'linux-arm64-unpacked'];
    for (const directory of unpackedDirectories) {
      const executable = path.join(releaseDir, directory, 'venice-forge');
      if (fs.existsSync(executable)) return executable;
    }
  }

  return undefined;
}

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

  test('returns undefined when the platform package is absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-smoke-'));
    temporaryDirectories.push(root);

    expect(findPackagedExecutable(root, 'linux', 'x64')).toBeUndefined();
  });
});

smokeTest('packaged electron app launches successfully', async () => {
  const root = process.cwd();
  const exePath = findPackagedExecutable(root);

  if (!exePath || !fs.existsSync(exePath)) {
    throw new Error(`Packaged app not found for ${os.platform()}/${os.arch()}. Did you run the platform dist command?`);
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn(exePath!, [], {
      stdio: 'pipe',
      env: { ...process.env, VENICE_FORGE_SMOKE_TEST: 'true' }
    });

    let stdout = '';
    let stderr = '';
    let hasExited = false;
    let exitCode: number | null = null;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('exit', (code) => {
      hasExited = true;
      exitCode = code ?? null;
    });

    // If it survives for 5 seconds without crashing, send SIGTERM and verify clean shutdown.
    setTimeout(() => {
      if (hasExited) {
        // Exited early — code was already checked in the listener, so this path only
        // triggers if exitCode is 0/null (resolve) or non-zero (reject).
        if (exitCode !== 0 && exitCode !== null) {
          reject(new Error(`App exited early with code ${exitCode}. stdout: ${stdout}\nstderr: ${stderr}`));
        } else {
          resolve();
        }
        return;
      }

      // Still running after 5 s — check for obvious fatal errors in output before killing.
      const combined = stdout + stderr;
      const fatalPatterns = [/Cannot find module/i, /SyntaxError/i, /ReferenceError/i, /FATAL/i, /crash reporter/i];
      for (const pattern of fatalPatterns) {
        if (pattern.test(combined)) {
          child.kill('SIGKILL');
          reject(new Error(`Detected fatal pattern ${pattern} in output. stdout: ${stdout}\nstderr: ${stderr}`));
          return;
        }
      }

      child.kill('SIGTERM');

      // Give the process up to 3 s to exit gracefully after SIGTERM.
      const termTimeout = setTimeout(() => {
        if (!hasExited) {
          child.kill('SIGKILL');
          reject(new Error('App did not exit within 3 s of SIGTERM; forcibly killed.'));
        }
      }, 3000);

      child.on('exit', () => {
        clearTimeout(termTimeout);
        if (exitCode !== 0 && exitCode !== null) {
          reject(new Error(`App exited with code ${exitCode} after SIGTERM. stdout: ${stdout}\nstderr: ${stderr}`));
        } else {
          resolve();
        }
      });
    }, 5000);
  });
}, 10000);
