import path from 'path';
import fs from 'fs';
import os from 'os';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

export function findPackagedExecutable(
  root: string,
  platform: NodeJS.Platform = os.platform(),
  architecture: string = os.arch(),
): string | undefined {
  const releaseDir = path.join(root, 'release');

  if (platform === 'win32') {
    const unpacked = path.join(releaseDir, "win-unpacked");
    if (!fs.existsSync(unpacked)) return undefined;
    const executable = fs.readdirSync(unpacked, { withFileTypes: true })
      .find(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"));
    return executable ? path.join(unpacked, executable.name) : undefined;
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

export async function launchPackagedApp(executablePath: string, userDataDir: string, electronApplications: ElectronApplication[]): Promise<{
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

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => window.veniceForge?.isDesktop === true);
  return { electronApplication, page, rendererErrors, cspViolations };
}

export function bootstrapFailures(rendererErrors: string[]): string[] {
  return rendererErrors.filter(error =>
    /pageerror:|uncaught|unhandled|fatal application error|failed to mount react root|cannot find module|syntaxerror|referenceerror/i.test(error),
  );
}

export async function closeTrackedApplication(electronApplication: ElectronApplication, electronApplications: ElectronApplication[]): Promise<void> {
  const index = electronApplications.indexOf(electronApplication);
  if (index >= 0) electronApplications.splice(index, 1);
  await electronApplication.close();
}
