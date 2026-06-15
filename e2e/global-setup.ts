import { execSync } from 'node:child_process';

import waitOn from 'wait-on';

async function waitForApiHealthy() {
  const maxRetries = 60;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: `healthcheck-${Date.now()}@example.com`,
          password: 'not-used'
        })
      });

      if (response.status !== 502 && response.status !== 503 && response.status !== 504) {
        return;
      }
    } catch (_error) {
      // Ignore transient startup errors and continue retrying.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  throw new Error('API healthcheck timeout: http://127.0.0.1:4000/api/auth/login');
}

async function globalSetup() {
  execSync('docker compose up -d --build', { stdio: 'inherit' });

  await waitOn({
    resources: ['tcp:127.0.0.1:4000', 'tcp:127.0.0.1:3000', 'http-get://127.0.0.1:3000/auth'],
    timeout: 10 * 60 * 1000,
    interval: 1000,
    tcpTimeout: 1000
  });

  await waitForApiHealthy();
}

export default globalSetup;
