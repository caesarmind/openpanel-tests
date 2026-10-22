import { test, expect } from '@playwright/test';
import { withProjectPage } from '../../helpers';

const localeMapping: Record<string, string> = {
    'ne': 'ne-np',
    'en': 'en-us',
    'pt': 'pt-br',
    'uk': 'uk-ua',
    'zh': 'zh-cn',
    'sr': 'sr-rs',
    'sv': 'sv-se',
};

async function getTranslation(locale: string) {
    const folder = localeMapping[locale] || `${locale}-${locale}`;
    const url = `https://raw.githubusercontent.com/stefanpejcic/openpanel-translations/main/${folder}/messages.po`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return null;
        }

        const text = await response.text();

        // Matches the msgstr for the "Change Language" msgid
        const regex = /msgid "Change Language"\s+msgstr "(.*)"/;
        const match = text.match(regex);

        return match ? match[1] : null;
    } catch {
        return null;
    }
}

const localesToTest = [
    'sr',
    'bg',
    'de',
    'es',
    'fr',
    'hu',
    'ne',
    'pt',
    'ro',
    'ru',
    'tr',
    'uk',
    'zh',
    'sv',
    'en',
];

// the last locale is en, but a failure halfway would leave the panel in another language for everything after
test.afterAll(async ({ browser }, testInfo) => {
    await withProjectPage(browser, testInfo, async page => {
        await page.goto('/account/language');
        await page.locator('button[type="submit"][name="locale"][value="en"]').click();
        await expect(page.getByRole('heading', { name: 'Change Language', exact: true })).toBeVisible();
    });
});

test.describe('Change and use locale', () => {

    for (const locale of localesToTest) {

        test(`locale: ${locale}`, async ({ page }) => {
            await page.goto('/account/language');

            let expectedText: string | null;

            if (locale === 'en') {
                expectedText = 'Change Language';
            } else {
                expectedText = await getTranslation(locale);
            }

            test.skip(
                !expectedText,
                `Translation key for "${locale}" not found on GitHub.`
            );

            const localeButton = page.locator(
                `button[type="submit"][name="locale"][value="${locale}"]`
            );

            await expect(localeButton).toBeVisible();

            await Promise.all([
                page.waitForLoadState('domcontentloaded'),
                localeButton.click(),
            ]);

            await expect(page).toHaveURL(/\/account\/language/);

            const translatedHeading = page.getByRole('heading', {
                name: expectedText!,
                exact: true,
            });

            await expect(translatedHeading).toBeVisible();
        });
    }
});
