import type { Page } from '@playwright/test';

export type Webserver = 'apache' | 'nginx' | 'openresty' | 'openlitespeed';

const CONF_FILES: Record<string, Webserver> = {
  'httpd.conf': 'apache',
  'nginx.conf': 'nginx',
  'openresty.conf': 'openresty',
  'openlitespeed.conf': 'openlitespeed',
};

let cached: Webserver | undefined;

// the webserver_conf page names the account's config file, the heading is translated so match the file name, nginx if it can't tell
export async function currentWebserver(page: Page): Promise<Webserver> {
  if (cached) return cached;
  try {
    const res = await page.request.get('/server/webserver_conf');
    const m = (await res.text()).match(/\b(httpd|nginx|openresty|openlitespeed)\.conf\b/);
    cached = m ? CONF_FILES[m[0]] : 'nginx';
  } catch {
    cached = 'nginx';
  }
  return cached;
}
