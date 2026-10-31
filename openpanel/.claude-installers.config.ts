// temporary: same as playwright.config.ts but setup has no serial teardown
import base from './playwright.config';
import { defineConfig } from '@playwright/test';

const projects = (base.projects ?? []).map(p => p.name === 'setup' ? { ...p, teardown: undefined } : p.name === 'serial' ? { ...p, dependencies: ['setup'] } : p);
export default defineConfig({ ...base, projects });
