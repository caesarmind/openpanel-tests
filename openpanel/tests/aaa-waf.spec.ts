import { test, expect, Page, Locator } from '@playwright/test';

const BLOCKED_STATUSES = [403, 406, 409, 422];

// Toggle lives on the list page, one per domain row → must be scoped
function wafToggle(page: Page, domain: string) {
  return page.locator('#waf-domains-table tbody tr')
    .filter({
      has: page.locator(`input[name="domain_name"][value="${domain}"]`)
    })
    .locator('button[aria-checked]');
}

async function setWaf(page: Page, domain: string, desiredOn: boolean) {
  await page.goto('/server/waf');
  const toggle = wafToggle(page, domain);
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-checked') !== String(desiredOn)) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', String(desiredOn));
  }
}

async function openDomainPage(page: Page, domain: string) {
  await page.goto(`/server/waf/${domain}`);
  await expect(page).toHaveURL(new RegExp(`/server/waf/${domain.replace(/\./g, '\\.')}$`));
}

// WAF config is applied asynchronously (reload of the web server / modsec),
// so poll the status instead of asserting once right after the change.
async function statusOf(page: Page, url: string) {
  // the web server restarts to apply the change, a reset connection just means poll again
  try {
    return (await page.request.get(url, { failOnStatusCode: false, timeout: 10_000 })).status();
  } catch {
    return 0;
  }
}

async function expectBlocked(page: Page, url: string) {
  await expect
    .poll(async () => BLOCKED_STATUSES.includes(await statusOf(page, url)), {
      message: `expected ${url} to be blocked`,
      timeout: 30_000,
    })
    .toBe(true);
}

async function expectAllowed(page: Page, url: string) {
  await expect
    .poll(() => statusOf(page, url), {
      message: `expected ${url} to be allowed`,
      timeout: 30_000,
    })
    .toBe(200);
}

// Rule exceptions sit in a collapsed <details> that's only open by default when some are set
async function openExceptions(page: Page): Promise<Locator> {
  const details = page.locator('details', { has: page.locator('#removed_rules') });
  if (!(await details.evaluate(el => (el as HTMLDetailsElement).open))) {
    await details.locator('summary').click();
  }
  await expect(page.locator('#removed_rules')).toBeVisible();
  return details;
}

async function saveExceptions(
  page: Page,
  domain: string,
  field: '#removed_rules' | '#removed_tags',
  value: string
) {
  const details = await openExceptions(page);
  await page.locator(field).fill(value);

  // Wait for the actual save request instead of guessing with waitForLoadState
  const [response] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'POST'),
    details.getByRole('button', { name: /save/i }).click(),
  ]);
  expect(response.status()).toBeLessThan(400);

  // Reload to prove the value was persisted server-side
  await openDomainPage(page, domain);
  await openExceptions(page);
  await expect(page.locator(field)).toHaveValue(value);
}

test('waf status', async ({ page }) => {
  await page.goto('/server/waf');

  await expect(
    page.getByRole('heading', { name: 'Web Firewall', level: 1 })
  ).toBeVisible();

  await expect(page.locator('#waf-domains-table')).toBeVisible();
});

test('waf on/off and disabled rules for domain', async ({ page }) => {
  test.setTimeout(120_000);

  const domain = 'wp.tests.openpanel.org';

  const blockedUrl = `https://${domain}/?q=<script>alert(1)</script>`;
  const cleanUrl = `https://${domain}/`;

  // ── 1. WAF ON → blocked request should be blocked, clean should pass ───────
  await setWaf(page, domain, true);

  await expectBlocked(page, blockedUrl);
  await expectAllowed(page, cleanUrl);

  // ── 2. WAF OFF → both requests should pass ─────────────────────────────────
  await setWaf(page, domain, false);

  await expectAllowed(page, blockedUrl);
  await expectAllowed(page, cleanUrl);

  // ── 3. WAF ON + disable rule by ID → previously blocked request now passes ─
  await setWaf(page, domain, true);
  await expectBlocked(page, blockedUrl);

  await openDomainPage(page, domain);

  const ruleId = '941100 941110 941160 941390 949110';
  await saveExceptions(page, domain, '#removed_rules', ruleId);

  await expectAllowed(page, blockedUrl);
  await expectAllowed(page, cleanUrl);

  // Clear disabled rule IDs
  await saveExceptions(page, domain, '#removed_rules', '');
  await expectBlocked(page, blockedUrl);

  // ── 4. WAF ON + disable rule by TAG → previously blocked request now passes ─
  const ruleTag = 'attack-xss';
  await saveExceptions(page, domain, '#removed_tags', ruleTag);

  await expectAllowed(page, blockedUrl);
  await expectAllowed(page, cleanUrl);

  // ── 5. Cleanup – clear disabled tags, confirm blocking restored ────────────
  await saveExceptions(page, domain, '#removed_tags', '');
  await expectBlocked(page, blockedUrl);
});

test('waf logs show blocked requests for domain', async ({ page }) => {
  const domain = 'wp.tests.openpanel.org';
  const blockedUrl = `https://${domain}/?q=<script>alert(1)</script>`;

  await setWaf(page, domain, true);
  await expectBlocked(page, blockedUrl);

  for (let i = 0; i < 3; i++) {
    expect(BLOCKED_STATUSES).toContain(await statusOf(page, blockedUrl));
  }

  await page.goto(`/server/waf/log/${domain}`);

  const logsTable = page.locator('#waf-logs-table');
  await expect(logsTable).toBeVisible();
  await expect(page.locator('h1')).toContainText(domain);

  const rows = logsTable.locator('tbody tr');
  await expect(rows).not.toHaveCount(0);
  const rowCount = await rows.count();

  // Scoped so it can't collide with the sidebar search input
  const searchInput = page.getByRole('region', { name: /log/i })
                        .locator('input[type="search"]:visible');
  await searchInput.fill('alert(1)');

  await expect(rows.first()).toContainText('alert(1)');
  expect(await rows.count()).toBeGreaterThan(0);

  await searchInput.fill('');
  await expect(rows).toHaveCount(rowCount);
});
