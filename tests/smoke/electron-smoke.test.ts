import { afterEach, describe, expect, test } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

const smokeTest = process.env.RUN_ELECTRON_SMOKE === 'true' ? test : test.skip;

const temporaryDirectories: string[] = [];
const electronApplications: ElectronApplication[] = [];

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

afterEach(async () => {
  for (const electronApplication of electronApplications.splice(0)) {
    await electronApplication.close().catch(() => undefined);
  }
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

async function launchPackagedApp(executablePath: string, userDataDir: string): Promise<{
  electronApplication: ElectronApplication;
  page: Page;
  rendererErrors: string[];
  cspViolations: string[];
}> {
  const rendererErrors: string[] = [];
  const cspViolations: string[] = [];
  const electronApplication = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    timeout: 30_000,
  });
  electronApplications.push(electronApplication);
  const page = await electronApplication.firstWindow({ timeout: 30_000 });

  await page.exposeFunction('__reportCspViolation', (message: string) => {
    cspViolations.push(message);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const detail = `${event.violatedDirective}; blockedURI=${event.blockedURI}; originalPolicy=${event.originalPolicy}`;
      (window as unknown as Record<string, (msg: string) => void>).__reportCspViolation(
        `securitypolicyviolation: ${detail}`,
      );
    });
  });

  page.on('pageerror', error => rendererErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error') rendererErrors.push(`console: ${text}`);
    if (/content.security.policy|csp|violated.directive|refused to apply inline/i.test(text)) {
      cspViolations.push(`console: ${text}`);
    }
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => window.veniceForge?.isDesktop === true);
  return { electronApplication, page, rendererErrors, cspViolations };
}

function bootstrapFailures(rendererErrors: string[]): string[] {
  return rendererErrors.filter(error =>
    /pageerror:|uncaught|unhandled|fatal application error|failed to mount react root|cannot find module|syntaxerror|referenceerror/i.test(error),
  );
}

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

smokeTest('packaged Electron app launches without CSP style-src violations', async () => {
  const root = process.cwd();
  const exePath = findPackagedExecutable(root);

  if (!exePath || !fs.existsSync(exePath)) {
    throw new Error(`Packaged app not found for ${os.platform()}/${os.arch()}. Did you run the platform dist command?`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-electron-integration-'));
  temporaryDirectories.push(userDataDir);

  const run = await launchPackagedApp(exePath, userDataDir);

  expect(bootstrapFailures(run.rendererErrors)).toEqual([]);
  expect(
    run.cspViolations.filter(message => /style-src|refused to apply inline style/i.test(message)),
  ).toEqual([]);
}, 60_000);
