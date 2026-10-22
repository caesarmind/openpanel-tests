# OpenPanel tests

Playwright end-to-end tests for the OpenPanel (user) panel.

## Prepare OpenPanel server

1. Install/update OpenPanel on the server: `bash <(curl -sSL https://openpanel.org)` | `opencli update --beta`
2. On the OpenPanel server run:

   ```bash
   bash <(curl -sSL https://raw.githubusercontent.com/stefanpejcic/openpanel-tests/refs/heads/main/openpanel/prepare.sh)
   ```

## Prepare Playwright tests

1. Download all tests: `cd /root/playwright-test && git pull`
2. Add logins to `/root/playwright-test/openpanel/.env`:
   ```
   BASE_URL=
   PANEL_USERNAME=
   PANEL_PASSWORD=
   ```

## Run manually

```bash
cd /root/playwright-test && npx playwright test -c openpanel/playwright.config.ts --project=tests --ui
```

## Run headlessly (parallel)

This is what `run-tests.sh` and cron use — no `--ui`, since there's no
display available in cron. Spec files don't depend on each other, so they
run in parallel; tests inside one file still run in order.

```bash
cd /root/playwright-test && npx playwright test -c openpanel/playwright.config.ts --project=tests --workers=4
```

- Adding a domain restarts the webserver and recreates php-fpm and the
  mailserver, which kills app installs running at the same time. So the setup
  step adds every domain the suite uses (`SUITE_DOMAINS` in `helpers.ts`)
  before the parallel tests start. Each spec still calls `ensureDomains()` for
  its own domain, so any spec can also run on its own, e.g.
  `npx playwright test -c openpanel/playwright.config.ts --project=tests tests/wordpress.spec.ts`.
  Domains are added one at a time (a lock in the OS temp dir).
- Specs that change something for the whole account (add/delete domains,
  stop all containers, block the runner's IP, restart the webserver or MySQL,
  switch PHP versions, end every session, switch the UI language, enable 2FA...) live
  in `tests/serial/`. They run one at a time after the parallel ones, as the
  `serial` project (the setup project's teardown, so it runs even when some
  parallel tests failed). Each one puts back what it changed.
- `tests` uses the modern menu (the default). The classic menu is still there as
  `--project=tests-classic`. Run one menu style at a time, both use the same
  account and domains.

## Automated daily runs (cron)

`run-tests.sh` runs the suite headlessly (`WORKERS`, default 4), writes a
results table into this README (below), and commits + pushes it so the
latest run is visible on git without needing to log into the server.

Pushing requires `GITHUB_TOKEN` (a token with write access to this repo).
Copy `/root/playwright-test/.env.template` to `/root/playwright-test/.env`
and fill it in — this is the same file `opencli/os_install.sh` reads. If
`GITHUB_TOKEN` isn't set, the script still commits locally, it just skips
the push.

With `GITHUB_TOKEN` set, it also keeps a single [GitHub issue](https://github.com/stefanpejcic/openpanel-tests/issues)
in sync for this script: opens one the first time a run fails, updates
that same issue (with a "still failing" comment) on every subsequent
failing run instead of opening duplicates, and closes it with a comment
once a run passes again.

```bash
chmod +x /root/playwright-test/openpanel/run-tests.sh
```

Add to crontab (`crontab -e`) to run daily at 22:00:

```cron
0 22 * * * /root/playwright-test/openpanel/run-tests.sh >> /root/playwright-test/user_cron.log 2>&1
```

Full logs, the Playwright HTML report, and the raw JSON results for each
run are kept under `/root/playwright-test/logs/` (not committed to git,
pruned after 30 days). The README below only ever shows the *latest* run.

## Automated Test Results

<!-- AUTOMATED-RESULTS:START -->
### Latest OpenPanel run

**Last run:** 2026-09-14 22:00:04 UTC  
**Result:** ✅ All passed — 0 passed, 0 failed, 580 skipped (580 total) in 2.4s

<details>
<summary>Full results (580 tests)</summary>

| Test file | Test | Status | Duration |
|---|---|---|---|
| 2fa.spec.ts | enable 2FA | ⏭️ | 0ms |
| 2fa.spec.ts | disable 2FA | ⏭️ | 0ms |
| a-malware_scan.spec.ts | malware scanner page loads | ⏭️ | 0ms |
| a-malware_scan.spec.ts | start a scan and see streamed results | ⏭️ | 0ms |
| a-malware_scan.spec.ts | quarantine page loads | ⏭️ | 0ms |
| a-malware_scan.spec.ts | quarantine page links back to scanner | ⏭️ | 0ms |
| aa-filemanager.spec.ts | create file | ⏭️ | 0ms |
| aa-filemanager.spec.ts | create folder | ⏭️ | 0ms |
| aa-filemanager.spec.ts | copy file to folder | ⏭️ | 0ms |
| aa-filemanager.spec.ts | move file | ⏭️ | 0ms |
| aa-filemanager.spec.ts | delete file to trash | ⏭️ | 0ms |
| aa-filemanager.spec.ts | restore file from trash | ⏭️ | 0ms |
| aa-filemanager.spec.ts | delete multiple items permanently | ⏭️ | 0ms |
| aa-filemanager.spec.ts | create file with editor | ⏭️ | 0ms |
| aa-filemanager.spec.ts | view file content | ⏭️ | 0ms |
| aa-filemanager.spec.ts | edit file content | ⏭️ | 0ms |
| aa-filemanager.spec.ts | rename file | ⏭️ | 0ms |
| aa-filemanager.spec.ts | change file permissions | ⏭️ | 0ms |
| aa-filemanager.spec.ts | upload file from URL | ⏭️ | 0ms |
| aa-filemanager.spec.ts | compress files | ⏭️ | 0ms |
| aa-filemanager.spec.ts | extract files | ⏭️ | 0ms |
| aa-filemanager.spec.ts | cleanup subdir | ⏭️ | 0ms |
| aa-filemanager.spec.ts | /disk-usage | ⏭️ | 0ms |
| aa-filemanager.spec.ts | /inodes-explorer | ⏭️ | 0ms |
| aaa-domains.spec.ts | add domains | ⏭️ | 0ms |
| aaa-domains.spec.ts | verify files created for a new domain | ⏭️ | 0ms |
| aaa-domains.spec.ts | search domains | ⏭️ | 0ms |
| aaa-domains.spec.ts | check columns for domains table | ⏭️ | 0ms |
| aaa-domains.spec.ts | vhost editor | ⏭️ | 0ms |
| aaa-domains.spec.ts | change docroot | ⏭️ | 0ms |
| aaa-domains.spec.ts | add dns record | ⏭️ | 0ms |
| aaa-domains.spec.ts | edit dns record | ⏭️ | 0ms |
| aaa-domains.spec.ts | delete dns record | ⏭️ | 0ms |
| aaa-domains.spec.ts | export dns zone | ⏭️ | 0ms |
| aaa-domains.spec.ts | edit zone file | ⏭️ | 0ms |
| aaa-domains.spec.ts | reset dns zone | ⏭️ | 0ms |
| aaa-domains.spec.ts | dynamic dns record | ⏭️ | 0ms |
| aaa-domains.spec.ts | redirects | ⏭️ | 0ms |
| aaa-domains.spec.ts | suspend domain | ⏭️ | 0ms |
| aaa-domains.spec.ts | unsuspend domain | ⏭️ | 0ms |
| aaa-domains.spec.ts | delete domain | ⏭️ | 0ms |
| aaa-waf.spec.ts | waf status | ⏭️ | 0ms |
| aaa-waf.spec.ts | waf on/off and disabled rules for domain | ⏭️ | 0ms |
| aaa-waf.spec.ts | waf logs show blocked requests for domain | ⏭️ | 0ms |
| aaaa-ssl.spec.ts | view ssl info | ⏭️ | 0ms |
| aaaa-ssl.spec.ts | add custom ssl | ⏭️ | 0ms |
| aaaa-ssl.spec.ts | switch back to Lets Encrypt | ⏭️ | 0ms |
| aaaaa-ip_blocker.spec.ts | IP Blocker | ⏭️ | 0ms |
| autoinstaller.spec.ts | auto-installer page loads | ⏭️ | 0ms |
| autoinstaller.spec.ts | auto-installer shows available applications | ⏭️ | 0ms |
| autoinstaller.spec.ts | auto-installer search/filter works | ⏭️ | 0ms |
| autoinstaller.spec.ts | auto-installer install form is accessible | ⏭️ | 0ms |
| backups.spec.ts | access backups page | ⏭️ | 0ms |
| backups.spec.ts | access backup settings | ⏭️ | 0ms |
| backups.spec.ts | save backup settings | ⏭️ | 0ms |
| backups.spec.ts | access backup destination | ⏭️ | 0ms |
| backups.spec.ts | run backup | ⏭️ | 0ms |
| backups.spec.ts | list backups from destination | ⏭️ | 0ms |
| capitalize_domains.spec.ts | capitalize domains page loads | ⏭️ | 0ms |
| capitalize_domains.spec.ts | letter buttons are rendered for domain | ⏭️ | 0ms |
| capitalize_domains.spec.ts | toggle a letter to uppercase and save | ⏭️ | 0ms |
| capitalize_domains.spec.ts | revert domain capitalization to original | ⏭️ | 0ms |
| cronjobs.spec.ts | list | ⏭️ | 0ms |
| cronjobs.spec.ts | create job | ⏭️ | 0ms |
| cronjobs.spec.ts | view logs | ⏭️ | 0ms |
| cronjobs.spec.ts | edit as file | ⏭️ | 0ms |
| cronjobs.spec.ts | edit job | ⏭️ | 0ms |
| cronjobs.spec.ts | delete job | ⏭️ | 0ms |
| dashboard.spec.ts | access dashboard | ⏭️ | 0ms |
| dashboard.spec.ts | sidebar open/close | ⏭️ | 0ms |
| dashboard.spec.ts | toggle dark mode | ⏭️ | 0ms |
| dashboard.spec.ts | search results | ⏭️ | 0ms |
| dashboard.spec.ts | icons mode toggle | ⏭️ | 0ms |
| dashboard.spec.ts | icon sections drag&sort | ⏭️ | 0ms |
| dashboard.spec.ts | icon sections open/close | ⏭️ | 0ms |
| dashboard.spec.ts | menu items collapse/expand individually | ⏭️ | 0ms |
| dashboard.spec.ts | menu items collapse/expand all | ⏭️ | 0ms |
| drupal.spec.ts | tests/drupal.spec.ts › 1. install app | ⏭️ | 0ms |
| drupal.spec.ts | tests/drupal.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| drupal.spec.ts | tests/drupal.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| drupal.spec.ts | tests/drupal.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| drupal.spec.ts | tests/drupal.spec.ts › 5. remove app | ⏭️ | 0ms |
| emails.spec.ts | emails accounts page loads and shows table | ⏭️ | 0ms |
| emails.spec.ts | emails accounts new-email button links to /emails/new | ⏭️ | 0ms |
| emails.spec.ts | emails accounts export button is present | ⏭️ | 0ms |
| emails.spec.ts | create email new page loads | ⏭️ | 0ms |
| emails.spec.ts | create email password generate button fills field | ⏭️ | 0ms |
| emails.spec.ts | create email toggle password visibility | ⏭️ | 0ms |
| emails.spec.ts | create emails and verify dashboard count | ⏭️ | 0ms |
| emails.spec.ts | emails accounts search filters rows | ⏭️ | 0ms |
| emails.spec.ts | edit email page loads for existing account | ⏭️ | 0ms |
| emails.spec.ts | edit email — suspend incoming | ⏭️ | 0ms |
| emails.spec.ts | edit email — suspend outgoing | ⏭️ | 0ms |
| emails.spec.ts | edit email — restore allow incoming and outgoing | ⏭️ | 0ms |
| emails.spec.ts | edit email — change password via generate button | ⏭️ | 0ms |
| emails.spec.ts | edit email — manual password change | ⏭️ | 0ms |
| emails.spec.ts | edit email — delete button links to delete page | ⏭️ | 0ms |
| emails.spec.ts | connect devices page loads for an email | ⏭️ | 0ms |
| emails.spec.ts | connect devices back button goes to /emails | ⏭️ | 0ms |
| emails.spec.ts | webmail autologin and send/receive | ⏭️ | 0ms |
| emails.spec.ts | email filters selector page loads | ⏭️ | 0ms |
| emails.spec.ts | email filters selector navigates to email filter page | ⏭️ | 0ms |
| emails.spec.ts | email filter GUI page loads for email | ⏭️ | 0ms |
| emails.spec.ts | email filter — add a filter rule in GUI mode | ⏭️ | 0ms |
| emails.spec.ts | email filter raw mode shows textarea | ⏭️ | 0ms |
| emails.spec.ts | import emails page loads | ⏭️ | 0ms |
| emails.spec.ts | import emails file input accepts csv and xlsx only | ⏭️ | 0ms |
| emails.spec.ts | import emails back button links to /emails | ⏭️ | 0ms |
| emails.spec.ts | export emails returns a CSV download | ⏭️ | 0ms |
| emails.spec.ts | aliases list page loads | ⏭️ | 0ms |
| emails.spec.ts | new alias page loads | ⏭️ | 0ms |
| emails.spec.ts | new alias — domain selector updates @domain preview | ⏭️ | 0ms |
| emails.spec.ts | create alias and verify in list | ⏭️ | 0ms |
| emails.spec.ts | aliases search filters rows | ⏭️ | 0ms |
| emails.spec.ts | alias detail page loads for existing alias | ⏭️ | 0ms |
| emails.spec.ts | alias detail — add then remove a destination | ⏭️ | 0ms |
| emails.spec.ts | delete alias and verify removal | ⏭️ | 0ms |
| emails.spec.ts | default address selector page loads | ⏭️ | 0ms |
| emails.spec.ts | default address domain selector navigates to domain page | ⏭️ | 0ms |
| emails.spec.ts | default address detail page shows current config or empty state | ⏭️ | 0ms |
| emails.spec.ts | default address — set and clear catch-all | ⏭️ | 0ms |
| emails.spec.ts | delete emails and verify dashboard count | ⏭️ | 0ms |
| emails.spec.ts | delete email page shows selector when no address given | ⏭️ | 0ms |
| favorites.spec.ts | Left-click to add | ⏭️ | 0ms |
| favorites.spec.ts | check table | ⏭️ | 0ms |
| favorites.spec.ts | Yellow star | ⏭️ | 0ms |
| favorites.spec.ts | Right-click to remove | ⏭️ | 0ms |
| favorites.spec.ts | search table | ⏭️ | 0ms |
| favorites.spec.ts | delete in table | ⏭️ | 0ms |
| fixpermissions.spec.ts | fix permissions | ⏭️ | 0ms |
| forgot_password.spec.ts | reset password page loads | ⏭️ | 0ms |
| forgot_password.spec.ts | submit empty email shows error | ⏭️ | 0ms |
| forgot_password.spec.ts | submit invalid email format shows error | ⏭️ | 0ms |
| forgot_password.spec.ts | submit valid email shows confirmation | ⏭️ | 0ms |
| forgot_password.spec.ts | invalid reset token shows error | ⏭️ | 0ms |
| ftp.spec.ts | create account | ⏭️ | 0ms |
| ftp.spec.ts | login, upload, list, download, delete | ⏭️ | 0ms |
| ftp.spec.ts | password change | ⏭️ | 0ms |
| ftp.spec.ts | path change | ⏭️ | 0ms |
| ftp.spec.ts | filezilla config | ⏭️ | 0ms |
| ftp.spec.ts | cyberduck config | ⏭️ | 0ms |
| ftp.spec.ts | search | ⏭️ | 0ms |
| ftp.spec.ts | account delete | ⏭️ | 0ms |
| goaccess.spec.ts | traffic stats page loads | ⏭️ | 0ms |
| goaccess.spec.ts | traffic stats shows domain list | ⏭️ | 0ms |
| joomla.spec.ts | tests/joomla.spec.ts › 1. install app | ⏭️ | 0ms |
| joomla.spec.ts | tests/joomla.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| joomla.spec.ts | tests/joomla.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| joomla.spec.ts | tests/joomla.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| joomla.spec.ts | tests/joomla.spec.ts › 5. remove app | ⏭️ | 0ms |
| last_login.spec.ts | table, clipboard, activity link, search filter and dashboard IP | ⏭️ | 0ms |
| matomo.spec.ts | tests/matomo.spec.ts › 1. install app | ⏭️ | 0ms |
| matomo.spec.ts | tests/matomo.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| matomo.spec.ts | tests/matomo.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| matomo.spec.ts | tests/matomo.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| matomo.spec.ts | tests/matomo.spec.ts › 5. remove app | ⏭️ | 0ms |
| mediawiki.spec.ts | tests/mediawiki.spec.ts › 1. install app | ⏭️ | 0ms |
| mediawiki.spec.ts | tests/mediawiki.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| mediawiki.spec.ts | tests/mediawiki.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| mediawiki.spec.ts | tests/mediawiki.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| mediawiki.spec.ts | tests/mediawiki.spec.ts › 5. remove app | ⏭️ | 0ms |
| moodle.spec.ts | tests/moodle.spec.ts › 1. install app | ⏭️ | 0ms |
| moodle.spec.ts | tests/moodle.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| moodle.spec.ts | tests/moodle.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| moodle.spec.ts | tests/moodle.spec.ts › 4. remove app | ⏭️ | 0ms |
| mysql.spec.ts | list databases | ⏭️ | 0ms |
| mysql.spec.ts | create database | ⏭️ | 0ms |
| mysql.spec.ts | show system databases | ⏭️ | 0ms |
| mysql.spec.ts | show database sizes | ⏭️ | 0ms |
| mysql.spec.ts | phpmyadmin auto-login | ⏭️ | 0ms |
| mysql.spec.ts | list users | ⏭️ | 0ms |
| mysql.spec.ts | show system users | ⏭️ | 0ms |
| mysql.spec.ts | create user | ⏭️ | 0ms |
| mysql.spec.ts | change password | ⏭️ | 0ms |
| mysql.spec.ts | grant CREATE ROUTE privilege | ⏭️ | 0ms |
| mysql.spec.ts | grant NO privileges | ⏭️ | 0ms |
| mysql.spec.ts | grant ALL PRIVILEGES | ⏭️ | 0ms |
| mysql.spec.ts | revoke privileges | ⏭️ | 0ms |
| mysql.spec.ts | database wizard | ⏭️ | 0ms |
| mysql.spec.ts | remote access | ⏭️ | 0ms |
| mysql.spec.ts | processlist | ⏭️ | 0ms |
| mysql.spec.ts | configuration editor | ⏭️ | 0ms |
| mysql.spec.ts | import | ⏭️ | 0ms |
| mysql.spec.ts | export | ⏭️ | 0ms |
| mysql.spec.ts | delete user | ⏭️ | 0ms |
| mysql.spec.ts | delete database | ⏭️ | 0ms |
| nextcloud.spec.ts | tests/nextcloud.spec.ts › 1. install app | ⏭️ | 0ms |
| nextcloud.spec.ts | tests/nextcloud.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| nextcloud.spec.ts | tests/nextcloud.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| nextcloud.spec.ts | tests/nextcloud.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| nextcloud.spec.ts | tests/nextcloud.spec.ts › 5. remove app | ⏭️ | 0ms |
| nodejs.spec.ts | tests/nodejs.spec.ts › 1. create app files | ⏭️ | 0ms |
| nodejs.spec.ts | tests/nodejs.spec.ts › 2. install app | ⏭️ | 0ms |
| nodejs.spec.ts | tests/nodejs.spec.ts › 3. verify app appears on /sites | ⏭️ | 0ms |
| nodejs.spec.ts | tests/nodejs.spec.ts › 4. verify app is responding | ⏭️ | 0ms |
| notifications.spec.ts | notifications page loads | ⏭️ | 0ms |
| notifications.spec.ts | notifications page has toggles or settings | ⏭️ | 0ms |
| notifications.spec.ts | save notification preferences | ⏭️ | 0ms |
| notifications.spec.ts | notification settings persist after reload | ⏭️ | 0ms |
| opencart.spec.ts | tests/opencart.spec.ts › 1. install app | ⏭️ | 0ms |
| opencart.spec.ts | tests/opencart.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| opencart.spec.ts | tests/opencart.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| opencart.spec.ts | tests/opencart.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| opencart.spec.ts | tests/opencart.spec.ts › 5. remove app | ⏭️ | 0ms |
| passkeys.spec.ts | passkeys settings page loads | ⏭️ | 0ms |
| passkeys.spec.ts | register a new passkey | ⏭️ | 0ms |
| passkeys.spec.ts | remove a passkey | ⏭️ | 0ms |
| php_extensions.spec.ts | extensions version selector page loads | ⏭️ | 0ms |
| php_extensions.spec.ts | select version navigates to per-version extensions page | ⏭️ | 0ms |
| php_extensions.spec.ts | toggle an extension enable/disable | ⏭️ | 0ms |
| php_extensions.spec.ts | available extensions list loads in install modal | ⏭️ | 0ms |
| php.spec.ts | list versions | ⏭️ | 0ms |
| php.spec.ts | change default php version | ⏭️ | 0ms |
| php.spec.ts | edit php options | ⏭️ | 0ms |
| php.spec.ts | edit php.ini files | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › filter table rows | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › version counter filter | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › clear search | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 8.5 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 8.4 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 8.3 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 8.2 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 8.1 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 8.0 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 7.4 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 7.3 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 7.2 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 7.1 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 7.0 | ⏭️ | 0ms |
| php.spec.ts | tests/php.spec.ts › php 5.6 | ⏭️ | 0ms |
| postgresql.spec.ts | list databases | ⏭️ | 0ms |
| postgresql.spec.ts | create database | ⏭️ | 0ms |
| postgresql.spec.ts | list users | ⏭️ | 0ms |
| postgresql.spec.ts | create user | ⏭️ | 0ms |
| postgresql.spec.ts | change password | ⏭️ | 0ms |
| postgresql.spec.ts | assign user to database | ⏭️ | 0ms |
| postgresql.spec.ts | revoke user from database | ⏭️ | 0ms |
| postgresql.spec.ts | database wizard | ⏭️ | 0ms |
| postgresql.spec.ts | processlist | ⏭️ | 0ms |
| postgresql.spec.ts | configuration editor | ⏭️ | 0ms |
| postgresql.spec.ts | remote access | ⏭️ | 0ms |
| postgresql.spec.ts | import | ⏭️ | 0ms |
| postgresql.spec.ts | delete user | ⏭️ | 0ms |
| postgresql.spec.ts | delete database | ⏭️ | 0ms |
| prestashop.spec.ts | tests/prestashop.spec.ts › 1. install app | ⏭️ | 0ms |
| prestashop.spec.ts | tests/prestashop.spec.ts › 2. verify app appears on /sites | ⏭️ | 0ms |
| prestashop.spec.ts | tests/prestashop.spec.ts › 3. verify app is responding | ⏭️ | 0ms |
| prestashop.spec.ts | tests/prestashop.spec.ts › 4. admin auto-login link generation works | ⏭️ | 0ms |
| prestashop.spec.ts | tests/prestashop.spec.ts › 5. remove app | ⏭️ | 0ms |
| process_manager.spec.ts | tests/process_manager.spec.ts › loads process table with at least one row | ⏭️ | 0ms |
| process_manager.spec.ts | tests/process_manager.spec.ts › kill a random process, expect toast and row removed | ⏭️ | 0ms |
| process_manager.spec.ts | tests/process_manager.spec.ts › refresh and confirm killed PID is absent | ⏭️ | 0ms |
| process_manager.spec.ts | tests/process_manager.spec.ts › search filters rows correctly | ⏭️ | 0ms |
| python.spec.ts | tests/python.spec.ts › 1. create app files | ⏭️ | 0ms |
| python.spec.ts | tests/python.spec.ts › 2. install app | ⏭️ | 0ms |
| python.spec.ts | tests/python.spec.ts › 3. verify app appears on /sites | ⏭️ | 0ms |
| python.spec.ts | tests/python.spec.ts › 4. verify app is responding | ⏭️ | 0ms |
| resource_usage.spec.ts | Resource Usage page loads with gauges | ⏭️ | 0ms |
| resource_usage.spec.ts | Resource Usage page shows CPU and RAM gauges when data available | ⏭️ | 0ms |
| resource_usage.spec.ts | Usage History page loads | ⏭️ | 0ms |
| resource_usage.spec.ts | Usage History search filters rows | ⏭️ | 0ms |
| resource_usage.spec.ts | Usage History show all checkbox loads all data | ⏭️ | 0ms |
| resource_usage.spec.ts | Usage History show all checkbox can be unchecked | ⏭️ | 0ms |
| resource_usage.spec.ts | Usage History pagination works | ⏭️ | 0ms |
| resource_usage.spec.ts | View Usage History button navigates correctly | ⏭️ | 0ms |
| server_info.spec.ts | server info page | ⏭️ | 0ms |
| services.spec.ts | services list page | ⏭️ | 0ms |
| services.spec.ts | services list contains expected entries | ⏭️ | 0ms |
| services.spec.ts | webserver service page (nginx / apache / openlitespeed) | ⏭️ | 0ms |
| services.spec.ts | mysql service page | ⏭️ | 0ms |
| services.spec.ts | php-fpm-8.5 service page | ⏭️ | 0ms |
| services.spec.ts | restart a service | ⏭️ | 0ms |
| services.spec.ts | service version selector | ⏭️ | 0ms |
| website_builder.spec.ts | website builder install page loads | ⏭️ | 0ms |
| website_builder.spec.ts | install form has domain selector | ⏭️ | 0ms |
| website_builder.spec.ts | website builder | ⏭️ | 0ms |
| websites.spec.ts | auto-installer page has install links | ⏭️ | 0ms |
| wordpress.spec.ts | list wordpress sites | ⏭️ | 0ms |
| wordpress.spec.ts | install wordpress | ⏭️ | 0ms |
| wordpress.spec.ts | wordpress security hardening page | ⏭️ | 0ms |
| wordpress.spec.ts | wordpress vulnerability scan | ⏭️ | 0ms |
| wordpress.spec.ts | wp-cli check update preferences check | ⏭️ | 0ms |
| wordpress.spec.ts | generate backup | ⏭️ | 0ms |
| wordpress.spec.ts | list backup | ⏭️ | 0ms |
| wordpress.spec.ts | wordpress reload data | ⏭️ | 0ms |
| wordpress.spec.ts | wp manager data | ⏭️ | 0ms |
| wordpress.spec.ts | live preview | ⏭️ | 0ms |
| wordpress.spec.ts | wp-admin autologin | ⏭️ | 0ms |
| wordpress.spec.ts | general options | ⏭️ | 0ms |
| wordpress.spec.ts | maintenance mode | ⏭️ | 0ms |
| wordpress.spec.ts | cache flush | ⏭️ | 0ms |
| wordpress.spec.ts | live visitors count | ⏭️ | 0ms |
| wordpress.spec.ts | waf on/off | ⏭️ | 0ms |
| wordpress.spec.ts | wp remove | ⏭️ | 0ms |
| wordpress.spec.ts | tests/wordpress.spec.ts › wp-admin - upgrade wordpress core | ⏭️ | 0ms |
| wordpress.spec.ts | tests/wordpress.spec.ts › wp-admin - install scrollchart plugin | ⏭️ | 0ms |
| wordpress.spec.ts | tests/wordpress.spec.ts › wp-admin - install nexusslash theme | ⏭️ | 0ms |
| z-cache.spec.ts | redis | ⏭️ | 0ms |
| z-cache.spec.ts | valkey | ⏭️ | 0ms |
| z-cache.spec.ts | memcached | ⏭️ | 0ms |
| z-cache.spec.ts | elasticsearch | ⏭️ | 0ms |
| z-cache.spec.ts | opensearch | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: sr | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: bg | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: de | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: es | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: fr | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: hu | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: ne | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: pt | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: ro | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: ru | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: tr | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: uk | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: zh | ⏭️ | 0ms |
| zz-account_language.spec.ts | tests/zz-account_language.spec.ts › locale: en | ⏭️ | 0ms |
| zzz-json_assets.spec.ts | favicon endpoint redirects to a favicon image | ⏭️ | 0ms |
| zzz-json_assets.spec.ts | favicon endpoint rejects a domain the user does not own | ⏭️ | 0ms |
| zzz-json_assets.spec.ts | screenshot endpoint returns an image | ⏭️ | 0ms |
| zzz-json_assets.spec.ts | screenshot endpoint rejects a domain the user does not own | ⏭️ | 0ms |
| zzz-json_assets.spec.ts | screenshot can be force-regenerated via POST | ⏭️ | 0ms |
| zzzz-varnish_cache.spec.ts | enable varnish | ⏭️ | 0ms |
| zzzz-varnish_cache.spec.ts | should show domains table and enable Varnish | ⏭️ | 0ms |
| zzzz-varnish_cache.spec.ts | should display container log and show Varnish Cache & Container stats | ⏭️ | 0ms |
| zzzz-varnish_cache.spec.ts | should disable Varnish for domain | ⏭️ | 0ms |
| zzzz-varnish_cache.spec.ts | disable varnish | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | check columns for docker table | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | containers page loads with header and table | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | containers search filters rows | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | containers page New Service button navigates to add form | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | edit cpu, ram and toggle container state for all rows | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | add new service form loads | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | add new service - invalid name shows error | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | add new service - image blur suggests service name | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | add new service - add and remove volume entry | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | add new service - Back to Containers link works | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | delete confirm page loads for a custom service | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | delete confirm - core service returns 403 | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | delete confirm - php-fpm service returns 403 | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | change mysql page loads | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | change webserver page loads | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | logs page loads with container selector | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | logs page - selecting container loads log content | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | logs page - ?container= param pre-selects and loads | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | terminal page without container shows service picker | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | terminal page - selecting service redirects | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | terminal | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | terminal - reconnect button appears after disconnect | ⏭️ | 0ms |
| zzzzz-docker.spec.ts | containers status endpoint returns JSON | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | POST /api/malware-scanner/scan runs a real clamscan | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects wrong credentials with 401 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns token shape for valid credentials | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects empty body | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a list of API endpoints | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › includes a representative sample of modules/api/ routes | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › resolves without error | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns account fields | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects empty body | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a sessions array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unknown session token returns 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns the service list | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unknown service returns 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns compose config | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns running_containers | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns state/health shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unknown service returns 500 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restart a disposable test service | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns domains with stats availability | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns stats availability for TEST_DOMAIN | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns sites, counts and technologies | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns blocked_ips array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a request with no valid IPs | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › blocks a scratch IP then removes all blocks | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a domains map | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing domain/subdomain | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects unowned domain | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates an entry | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the entry | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns domains with zone_file_exists flags | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns records or 404 if no zone file | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing fields | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates an A record | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH updates the record | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the record | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › resets the zone to default | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a domain->status map | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status and rule exclusions | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects invalid status | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › reads current status, flips it, flips it back | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns paginated entries | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › ?seconds param is reflected in response | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › accepts tags and ids | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects unknown id_type | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns available php versions | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unknown version returns 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing content | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns available_keys and current_config | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a body with no recognized keys | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns extension list | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns installable extensions | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects empty extensions list | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns idle/busy status with no install_id | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › enables then disables a low-risk extension | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns webmail running state | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid email | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns the live webserver config | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing content | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › writes back the same content it read | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns jobs and containers | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns raw file content | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing fields | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid schedule | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns log entries or a clear not-found error | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an overlong job filter | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a job | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH updates the job | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the job | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › protected service name is rejected | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restart -> read logs | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns accounts array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing fields | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a path outside /var/www/html/ | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns raw connections text | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects unknown config type | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates an account | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH updates the password | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH updates the path | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the account | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restarts the service | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restarts the service | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restarts the service | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restarts the service | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restarts the service | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns status and domain_statuses | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns running or stopped shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a domain status map | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects invalid status | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › restarts varnish | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns databases array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid database name | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a reserved database name | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns databases/users/assigned_databases | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns processlist array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns enabled/server_ip/port | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns configuration and available_keys | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a body with no recognized keys | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a database | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a user | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST grants privileges | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › GET privileges reflects the grant | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › GET tables on the new (empty) database | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH updates the user password | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE revokes grants | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the user | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the database | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › flips the setting and flips it back | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns databases array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a reserved database name | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns databases/users/assigned_databases | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns processlist array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns enabled/server_ip/port | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns configuration or a clear container-down error | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a body with no recognized keys | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a database | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a user | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST grants privileges | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH updates the user password | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE revokes grants | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the user | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the database | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › flips the setting and flips it back | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns entries sorted by inode_count | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects path traversal | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns entries with size/path | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects path traversal | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns usage data or a clear not-yet-available error | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns paginated entries | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › ?page=2 is reflected in response | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns quarantine_files array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a directory outside /var/www/html | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a non-existent directory | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns an emails array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing fields | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns per-domain deliverability checks | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an unknown config type | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns an aliases array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid target address | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a mailbox | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › GET returns the mailbox detail | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PATCH suspends incoming mail | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PUT sets a filter | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates an alias to the mailbox | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the mailbox | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a missing domain_id | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unknown site_id returns 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a site | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › PUT updates the html/css | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a sites array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns site detail or 404 if unmanaged | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › kicks off an async scan | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid domain param | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › pagespeed | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › wp-vulnerability | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns sites and count | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects both backup flags disabled | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing backup_date | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns available hardening rules | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unknown site_id returns 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an unknown action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a missing domain | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › list_plugins | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › list_themes | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › cache_flush | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › creates a backup of TEST_DOMAIN | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns a processes array | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid pid | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a pid that is not one of the caller's processes | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › returns domains with total | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a missing domain | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unowned domain returns 403 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns status shape | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns a docroot | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects a docroot outside /var/www/html/ | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns redirect status | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an invalid url | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns ssl_mode | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects an unknown action | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns vhost content or 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects empty vhost content | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns records or 404 | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › rejects missing fields | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates a record | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the record | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › TEST_DOMAIN returns paginated logs | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST creates the domain | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST suspends it | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › POST unsuspends it | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › DELETE removes the domain | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › unauthenticated requests are rejected on all protected routes | ⏭️ | 0ms |
| zzzzzz-api.spec.ts | tests/zzzzzz-api.spec.ts › a garbage bearer token is rejected the same way | ⏭️ | 0ms |
| zzzzzzz-activity_log.spec.ts | activity log contains all known recorded user actions | ⏭️ | 0ms |
| zzzzzzz-webserver_conf.spec.ts | access webserver configuration page | ⏭️ | 0ms |
| zzzzzzz-webserver_conf.spec.ts | editor contains valid config content | ⏭️ | 0ms |
| zzzzzzz-webserver_conf.spec.ts | save webserver configuration | ⏭️ | 0ms |
| zzzzzzz-webserver_conf.spec.ts | invalid config is rejected | ⏭️ | 0ms |
| zzzzzzzz-active_sessions.spec.ts | active sessions: search, activity logs, terminate session | ⏭️ | 0ms |
| zzzzzzzz-logout.spec.ts | logout | ⏭️ | 0ms |
| zzzzzzzzz-account_settings.spec.ts | email address | ⏭️ | 0ms |
| zzzzzzzzz-account_settings.spec.ts | password | ⏭️ | 0ms |

</details>
<!-- AUTOMATED-RESULTS:END -->
