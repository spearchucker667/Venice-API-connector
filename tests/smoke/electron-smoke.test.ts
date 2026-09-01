import { afterEach, describe, expect, test } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

const smokeTest = process.env.RUN_ELECTRON_SMOKE === 'true' ? test : test.skip;

const temporaryDirectories: string[] = [];
const electronApplications: ElectronApplication[] = [];

const FIRST_RUN_WARNING = '18+ Age Requirement & Content Warning';
const RESTORED_PROFILE_ID = 'restored-profile';
const RESTORED_PROFILE_PROBE_ID = 'electron-bootstrap-probe';

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

async function closeTrackedApplication(electronApplication: ElectronApplication): Promise<void> {
  const index = electronApplications.indexOf(electronApplication);
  if (index >= 0) electronApplications.splice(index, 1);
  await electronApplication.close();
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

smokeTest('packaged Electron crosses first-run onboarding and restores the trusted profile bootstrap', async () => {
  const root = process.cwd();
  const exePath = findPackagedExecutable(root);

  if (!exePath || !fs.existsSync(exePath)) {
    throw new Error(`Packaged app not found for ${os.platform()}/${os.arch()}. Did you run the platform dist command?`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'venice-forge-electron-integration-'));
  temporaryDirectories.push(userDataDir);

  const firstRun = await launchPackagedApp(exePath, userDataDir);
  await firstRun.page.getByText(FIRST_RUN_WARNING, { exact: false }).waitFor({ timeout: 30_000 });
  await firstRun.page.getByRole('button', { name: 'I understand and am 18+' }).click();
  await firstRun.page.getByRole('heading', { level: 3, name: 'Welcome to Venice Forge' }).waitFor();
  await firstRun.page.getByRole('button', { name: 'Continue' }).click();
  await firstRun.page.getByRole('heading', { level: 3, name: 'Profiles' }).waitFor();
  await firstRun.page.getByRole('button', { name: 'Continue' }).click();
  await firstRun.page.getByRole('heading', { level: 3, name: 'Secure by Default' }).waitFor();
  await firstRun.page.getByRole('button', { name: 'Continue' }).click();
  await firstRun.page.getByRole('heading', { level: 3, name: 'Family Safe Mode' }).waitFor();
  await firstRun.page.getByRole('button', { name: 'Get Started' }).click();
  await firstRun.page.getByRole('heading', { level: 2, name: 'Connect to Venice' }).waitFor();

  await firstRun.page.evaluate((restoredProfileId) => {
    const raw = window.localStorage.getItem('venice-profiles');
    if (!raw) throw new Error('The onboarding flow did not persist the profile store.');
    const persisted = JSON.parse(raw) as { state?: Record<string, unknown>; version?: number };
    persisted.state = {
      ...(persisted.state ?? {}),
      profiles: [
        { id: 'default', name: 'Default Profile', onboardingCompleted: true },
        { id: restoredProfileId, name: 'Restored Profile', onboardingCompleted: true },
      ],
      activeProfileId: restoredProfileId,
      globalOnboardingCompleted: true,
    };
    window.localStorage.setItem('venice-profiles', JSON.stringify(persisted));
    // The restart must recover this value from the sanitized Zustand payload
    // and bind it through profileSession:activate; do not pre-seed the routing key.
    window.localStorage.removeItem('venice-active-profile-id');
  }, RESTORED_PROFILE_ID);

  expect(bootstrapFailures(firstRun.rendererErrors)).toEqual([]);
  expect(
    firstRun.cspViolations.filter(message => /style-src|refused to apply inline style/i.test(message)),
  ).toEqual([]);
  await closeTrackedApplication(firstRun.electronApplication);

  const restoredRun = await launchPackagedApp(exePath, userDataDir);
  await restoredRun.page.getByRole('heading', { level: 2, name: 'Connect to Venice' }).waitFor({ timeout: 30_000 });
  expect(await restoredRun.page.getByText(FIRST_RUN_WARNING, { exact: false }).count()).toBe(0);
  expect(await restoredRun.page.getByRole('heading', { level: 3, name: 'Welcome to Venice Forge' }).count()).toBe(0);

  const restoredState = await restoredRun.page.evaluate(async ({ profileId, probeId }) => {
    const activeProfileId = window.localStorage.getItem('venice-active-profile-id');
    const persisted = JSON.parse(window.localStorage.getItem('venice-profiles') ?? '{}') as {
      state?: { activeProfileId?: unknown; globalOnboardingCompleted?: unknown };
    };
    const now = Date.now();
    const saveResult = await window.veniceForge!.chat.save({
      id: probeId,
      title: 'Electron bootstrap probe',
      createdAt: now,
      updatedAt: now,
      model: 'test-model',
      messages: [],
    });
    return {
      bridgeIsDesktop: window.veniceForge?.isDesktop === true,
      activeProfileId,
      persistedActiveProfileId: persisted.state?.activeProfileId,
      onboardingCompleted: persisted.state?.globalOnboardingCompleted,
      saveOk: saveResult.ok,
      requestedProfileId: profileId,
    };
  }, { profileId: RESTORED_PROFILE_ID, probeId: RESTORED_PROFILE_PROBE_ID });

  expect(restoredState).toEqual({
    bridgeIsDesktop: true,
    activeProfileId: RESTORED_PROFILE_ID,
    persistedActiveProfileId: RESTORED_PROFILE_ID,
    onboardingCompleted: true,
    saveOk: true,
    requestedProfileId: RESTORED_PROFILE_ID,
  });
  expect(
    fs.existsSync(path.join(
      userDataDir,
      'chat-history',
      'profiles',
      RESTORED_PROFILE_ID,
      `${RESTORED_PROFILE_PROBE_ID}.json`,
    )),
  ).toBe(true);
  expect(
    fs.existsSync(path.join(userDataDir, 'chat-history', `${RESTORED_PROFILE_PROBE_ID}.json`)),
  ).toBe(false);
  expect(bootstrapFailures(restoredRun.rendererErrors)).toEqual([]);
  expect(
    restoredRun.cspViolations.filter(message => /style-src|refused to apply inline style/i.test(message)),
  ).toEqual([]);
}, 90_000);
