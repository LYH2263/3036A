import { execSync } from 'node:child_process';

function globalTeardown() {
  const keepServices = process.env.E2E_KEEP_SERVICES === '1';
  const shouldCleanup = process.env.CI === 'true' || !keepServices;

  if (!shouldCleanup) {
    return;
  }

  execSync('docker compose down -v', { stdio: 'inherit' });
}

export default globalTeardown;
