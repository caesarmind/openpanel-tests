import { test, expect } from '@playwright/test';

// data the user page loads for an account, and a service limit changed and put back

const USER = 'testinguser';

test.beforeEach(async ({ page }) => {
  const res = await page.request.get(`/users/${USER}`);
  test.skip(!res.ok(), `${USER} does not exist on this server`);
});

test('container stats list the running services', async ({ page }) => {
  const res = await page.request.get(`/containers/stats/${USER}`);
  expect(res.ok()).toBeTruthy();
  const stats = (await res.json()).container_stats ?? [];
  for (const c of stats) {
    expect(c.Name).toBeTruthy();
    expect(c.MemLimit).toBeGreaterThan(0);
  }
  console.log(`${USER}: ${stats.length} running containers`);
});

test('disk, notes and usage history load', async ({ page }) => {
  const disk = await (await page.request.get(`/client/disk/${USER}`)).json();
  expect(disk.map((d: any) => d.Type)).toContain('Containers');

  const notes = await (await page.request.get(`/get_user_notes/${USER}`)).json();
  expect(notes).toHaveProperty('notes');

  // one json object per line, newest last
  const history = (await (await page.request.get(`/get_resource_usage_history/${USER}`)).text()).trim();
  if (history) {
    const last = JSON.parse(history.split('\n').pop()!);
    expect(last.user).toBe(USER);
    expect(last.memory.total.bytes).toBeGreaterThan(0);
  }
});

test('a service process limit is saved and then put back', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/users/${USER}#services`);
  const form = page.locator(`form[action^="/containers/${USER}/pids/"]`).first();
  test.skip(await form.count() === 0, `${USER} has no services listed`);

  const action = (await form.getAttribute('action'))!;
  const service = action.split('/').pop()!;
  const original = await form.locator('input[name="value"]').inputValue();
  const csrf = await form.locator('input[name="csrf_token"]').inputValue();
  const set = async (value: string) => {
    const res = await page.request.post(action, { form: { csrf_token: csrf, value }, headers: { Referer: page.url() } });
    expect(res.status()).toBeLessThan(400);
  };

  await set('1234');
  // same url with a hash wouldn't load the page again
  await page.reload();
  await expect(page.locator(`form[action="${action}"] input[name="value"]`)).toHaveValue('1234');

  await set(original);
  await page.reload();
  await expect(page.locator(`form[action="${action}"] input[name="value"]`)).toHaveValue(original);
  console.log(`${service}: pids 1234 saved, back to ${original}`);
});
