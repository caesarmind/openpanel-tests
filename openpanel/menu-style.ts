import { test } from '@playwright/test';

// true when the running project uses the modern menu (see playwright.config.ts)
export const isModern = (): boolean => test.info().project.metadata.menuStyle !== 'classic';
