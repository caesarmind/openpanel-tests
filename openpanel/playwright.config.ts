import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.BASE_URL;

// workers inherit this from the main process, so random names survive a worker restart after a failed test
process.env.TEST_RUN_ID ||= Math.random().toString(36).slice(2, 8);

if (!BASE_URL) {
  throw new Error('BASE_URL must be set in .env');
}

const SESSION = '.auth/session.json';
const SESSION_MODERN = '.auth/session-modern.json';

// Spec files are independent of each other and run in parallel (--workers=N), tests inside a file stay in order.
// tests/serial/ holds specs that change something account-wide (stop all containers, block the runner's IP,
// restart the webserver or MySQL, end every session, switch the UI language, enable 2FA...), which would break
// whatever runs next to them. They run one at a time as the setup's teardown, so after the parallel tests,
// even when some of those failed.
export default defineConfig({
  testDir: '.',

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  },

  // menuStyle pins the menu_style cookie at login (auth.setup.ts), isModern() reads it
  projects: [
    // modern menu (menu_style=modern), the default
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      teardown: 'serial',
      metadata: { menuStyle: 'modern' },
    },
    {
      name: 'tests',
      testDir: './tests',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /[\\/]serial[\\/]/,
      dependencies: ['setup'],
      metadata: { menuStyle: 'modern' },
      use: {
        storageState: SESSION_MODERN,
      },
    },
    {
      name: 'serial',
      testDir: './tests/serial',
      testMatch: /.*\.spec\.ts/,
      workers: 1,
      metadata: { menuStyle: 'modern' },
      use: {
        storageState: SESSION_MODERN,
      },
    },
    // classic menu (menu_style=classic), kept for legacy: same specs, menu-dependent steps branch on isModern()
    {
      name: 'setup-classic',
      testMatch: /auth\.setup\.ts/,
      teardown: 'serial-classic',
      metadata: { menuStyle: 'classic' },
    },
    {
      name: 'tests-classic',
      testDir: './tests',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /[\\/]serial[\\/]/,
      dependencies: ['setup-classic'],
      metadata: { menuStyle: 'classic' },
      use: {
        storageState: SESSION,
      },
    },
    {
      name: 'serial-classic',
      testDir: './tests/serial',
      testMatch: /.*\.spec\.ts/,
      workers: 1,
      metadata: { menuStyle: 'classic' },
      use: {
        storageState: SESSION,
      },
    },
  ],
});
