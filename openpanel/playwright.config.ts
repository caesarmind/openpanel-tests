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

export default defineConfig({
  testDir: '.',

  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // classic menu (menu_style=classic), kept for legacy
    {
      name: 'tests',
      testDir: './tests',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: '.auth/session.json',
      },
    },
    // modern menu (menu_style=modern): same specs, menu-dependent steps branch on isModern()
    {
      name: 'tests-modern',
      testDir: './tests',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: '.auth/session-modern.json',
      },
    },
  ],
});
