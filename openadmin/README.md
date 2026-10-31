# OpenAdmin tests

Playwright end-to-end tests for the OpenAdmin (admin) panel.

## Setup

1. Download the tests: `cd /root/playwright-test && git pull`
2. Add logins to `/root/playwright-test/openadmin/.env`:
   ```
   BASE_URL=
   PANEL_USERNAME=
   PANEL_PASSWORD=
   ```
3. Optional, to test multi-server: add a second server with an Enterprise license.
   The suite joins it to `BASE_URL` as a slave (if it isn't already) and runs every
   spec a second time on it through the master, as the `tests-slave` project.
   ```
   SLAVE_URL=https://203.0.113.20:2087
   SLAVE_USERNAME=
   SLAVE_PASSWORD=
   ```

## Run manually

```bash
cd /root/playwright-test && npx playwright test -c openadmin/playwright.config.ts --project=tests --ui
```

## Run headlessly (single worker)

This is what `run-tests.sh` and cron use — no `--ui`, since there's no
display available in cron. Always run this suite with a single worker;
running it in parallel hammers the shared test server and causes
contention-related failures that aren't real bugs.

```bash
cd /root/playwright-test && npx playwright test -c openadmin/playwright.config.ts --project=tests --workers=1
```

With `SLAVE_URL` set, add `--project=tests-slave` to also run every spec on the slave.

## Automated daily runs (cron)

`run-tests.sh` runs the suite headlessly on a single worker, writes a
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
chmod +x /root/playwright-test/openadmin/run-tests.sh
```

Add to crontab (`crontab -e`) to run daily at 17:00:

```cron
0 17 * * * /root/playwright-test/openadmin/run-tests.sh >> /root/playwright-test/admin_cron.log 2>&1
```

Full logs, the Playwright HTML report, and the raw JSON results for each
run are kept under `/root/playwright-test/logs/` (not committed to git,
pruned after 30 days). The README below only ever shows the *latest* run.

**Note:** two tests in this suite (`reboot.spec.ts`, and the OpenAdmin
self-restart in `general_settings.spec.ts`) genuinely reboot/restart the
server. Expect a brief outage each time this suite runs.

## Automated Test Results

<!-- AUTOMATED-RESULTS:START -->
### Latest OpenAdmin run

**Last run:** 2026-09-14 17:06:49 UTC  
**Result:** ❌ 22 failed — 268 passed, 22 failed, 101 skipped (391 total) in 6m 47s

#### ❌ Failures

| Test file | Test | Status | Error |
|---|---|---|---|
| aa-users.spec.ts | create user | ❌ | Error: expect(locator).toBeVisible() failed |
| emails_actions_extra.spec.ts | delete account modal requires explicit confirm (not confirmed) | ❌ | Error: expect(locator).toBeVisible() failed |
| emails.spec.ts | emails accounts webmail link present per row | ❌ | Error: expect(locator).toBeVisible() failed |
| notifications_top.spec.ts | acknowledge all button is present and submits without confirmation | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/notifications |
| notifications_top.spec.ts | delete all button requires a second confirm click (not confirmed) | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/notifications |
| onboarding.spec.ts | onboarding page loads with the intro step | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/onboarding |
| onboarding.spec.ts | Start walks through steps 1-3 with progress indicator and Back navigation | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/onboarding |
| onboarding.spec.ts | config and user/plan step cards link to their real settings pages | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/onboarding |
| onboarding.spec.ts | Skip for now leaves onboarding without dismissing it | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/onboarding |
| process_manager.spec.ts | tests/process_manager.spec.ts › search | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/server/processes |
| process_manager.spec.ts | tests/process_manager.spec.ts › asc/desc sorting | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/server/processes |
| process_manager.spec.ts | tests/process_manager.spec.ts › strace | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/server/processes |
| process_manager.spec.ts | tests/process_manager.spec.ts › kill | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/server/processes |
| reboot.spec.ts | reboot | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/server/reboot |
| search.spec.ts | searching a known page surfaces it in the dropdown and navigates on click | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/dashboard |
| search.spec.ts | searching an existing username surfaces a user result | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/dashboard |
| search.spec.ts | searching an existing website surfaces a website result | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/dashboard |
| search.spec.ts | clearing the search query restores the dropdown results | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/dashboard |
| security_basic_auth.spec.ts | basic auth settings page loads with expected fields | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/security/basic_auth |
| security_basic_auth.spec.ts | generate password button fills password field | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/security/basic_auth |
| security_basic_auth.spec.ts | toggle password visibility button switches input type | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/security/basic_auth |
| security_basic_auth.spec.ts | save basic auth settings persists username (kept disabled) | ❌ | Error: page.goto: net::ERR_CONNECTION_REFUSED at https://185.7.32.112:2087/security/basic_auth |

<details>
<summary>Full results (391 tests)</summary>

| Test file | Test | Status | Duration |
|---|---|---|---|
| a-plans.spec.ts | create new hosting plan and verify all fields | ✅ | 2.5s |
| a-plans.spec.ts | edit hosting plan and verify all fields | ✅ | 2.2s |
| a-plans.spec.ts | delete hosting plan | ✅ | 3.3s |
| a-plans.spec.ts | search hosting plans | ✅ | 1.4s |
| a-plans.spec.ts | check columns for hosting plans | ✅ | 3.9s |
| aa-users.spec.ts | view users | ✅ | 336ms |
| aa-users.spec.ts | create user | ❌ | 2m 0s |
| aa-users.spec.ts | test autologin | ✅ | 1.2s |
| aa-users.spec.ts | open single user | ✅ | 1.3s |
| aa-users.spec.ts | test tabs | ✅ | 2.3s |
| aa-users.spec.ts | toggle columns | ✅ | 6.5s |
| aa-users.spec.ts | delete user | ✅ | 2.5s |
| aa-users.spec.ts | recreate user | ✅ | 4.4s |
| account.spec.ts | admin is forbidden from the reseller self-service account page | ✅ | 78ms |
| backups_system.spec.ts | system backups page loads with Backups/Runs/Settings tabs | ✅ | 265ms |
| backups_system.spec.ts | backups tab lists archives or shows the empty state | ✅ | 267ms |
| backups_system.spec.ts | search filters the backups table | ⏭️ | 250ms |
| backups_system.spec.ts | runs tab lists run history or shows the empty state | ✅ | 333ms |
| backups_system.spec.ts | settings tab saves and restores destination and retention | ✅ | 654ms |
| backups_user.spec.ts | user backups page loads with Settings/Configuration/Runs tabs and a schedule badge | ✅ | 265ms |
| backups_user.spec.ts | settings tab shows the current schedule choice | ✅ | 246ms |
| backups_user.spec.ts | configuration tab restores and saves the default backup.env | ✅ | 539ms |
| backups_user.spec.ts | runs tab shows run log or the empty state, gated Run Backup Now by schedule | ✅ | 336ms |
| crons.spec.ts | manage crons | ✅ | 7.8s |
| dashboard.spec.ts | access dashboard | ✅ | 842ms |
| dashboard.spec.ts | sidebar | ✅ | 1.5s |
| dashboard.spec.ts | dark mode | ✅ | 1.1s |
| dashboard.spec.ts | /json/system | ✅ | 841ms |
| dashboard.spec.ts | /json/cpu | ✅ | 1.1s |
| dashboard.spec.ts | /json/memory | ✅ | 139ms |
| dashboard.spec.ts | /json/load | ✅ | 122ms |
| dashboard.spec.ts | /json/disk | ✅ | 127ms |
| demo_mode.spec.ts | demo mode page renders branch matching current state | ✅ | 284ms |
| domains_add.spec.ts | create domain | ✅ | 3.1s |
| domains_dns_cluster.spec.ts | dns cluster page renders enabled or disabled branch | ✅ | 282ms |
| domains_dns_cluster.spec.ts | add server form validates IPv4 format client-side | ⏭️ | 267ms |
| domains_dns_cluster.spec.ts | search filters cluster nodes table | ⏭️ | 274ms |
| domains_logs_stats.spec.ts | domain logs selector page loads when no domain chosen | ✅ | 313ms |
| domains_logs_stats.spec.ts | domain access logs table loads with search/columns for a real domain | ✅ | 435ms |
| domains_logs_stats.spec.ts | domain goaccess stats page loads or shows not-yet-generated message | ✅ | 495ms |
| domains_ssl.spec.ts | ssl management page loads for a domain | ✅ | 676ms |
| domains_ssl.spec.ts | ssl status shows AutoSSL, Custom SSL, or Unknown branch | ✅ | 573ms |
| domains_ssl.spec.ts | custom certificate upload form is present | ✅ | 555ms |
| domains_vhost_caddy_editor.spec.ts | vhost editor loads, edits, saves, and reverts | ✅ | 1.6s |
| domains_vhost_caddy_editor.spec.ts | vhost editor domain selector page loads when no domain in URL | ✅ | 302ms |
| domains_vhost_caddy_editor.spec.ts | caddyfile editor loads with warning banner | ✅ | 423ms |
| domains_vhost_caddy_editor.spec.ts | caddyfile editor domain selector page loads when no domain in URL | ✅ | 317ms |
| emails_actions_extra.spec.ts | per-row actions dropdown exposes password/quota/restrict/delete | ✅ | 906ms |
| emails_actions_extra.spec.ts | set quota for an account, then revert to its original value | ⏭️ | 810ms |
| emails_actions_extra.spec.ts | restrictions modal opens for an account (not submitted) | ✅ | 1.2s |
| emails_actions_extra.spec.ts | delete account modal requires explicit confirm (not confirmed) | ❌ | 1.2s |
| emails_actions_extra.spec.ts | webmail link opens SSO redirect in a new tab | ✅ | 2.3s |
| emails_actions_extra.spec.ts | queue retry/delete bulk actions are clickable when messages exist | ⏭️ | 2.2s |
| emails_actions_extra.spec.ts | individual report can be opened from the reports list | ⏭️ | 332ms |
| emails_actions_extra.spec.ts | domain-limits raw mode save persists edited content, then reverts | ✅ | 885ms |
| emails.spec.ts | emails accounts page loads | ✅ | 781ms |
| emails.spec.ts | emails accounts search filters rows | ✅ | 858ms |
| emails.spec.ts | emails accounts webmail link present per row | ❌ | 5.7s |
| emails.spec.ts | emails queue page loads | ✅ | 1.9s |
| emails.spec.ts | emails queue refresh button reloads page | ✅ | 2.5s |
| emails.spec.ts | emails queue search filters rows | ✅ | 1.4s |
| emails.spec.ts | emails queue bulk actions visible when messages exist | ✅ | 1.6s |
| emails.spec.ts | emails settings page loads | ✅ | 660ms |
| emails.spec.ts | emails settings shows mailserver status badge | ✅ | 886ms |
| emails.spec.ts | emails settings webmail domain input accepts value | ✅ | 1.0s |
| emails.spec.ts | emails settings service toggles are present | ✅ | 957ms |
| emails.spec.ts | emails settings storage type select is present | ✅ | 889ms |
| emails.spec.ts | email rate limits page loads | ✅ | 515ms |
| emails.spec.ts | email rate limits shows rules table or empty state | ✅ | 451ms |
| emails.spec.ts | email rate limits search input filters rows | ✅ | 555ms |
| emails.spec.ts | email rate limits edit pencil opens inline input | ✅ | 572ms |
| emails.spec.ts | email rate limits raw mode toggle shows textarea | ✅ | 366ms |
| emails.spec.ts | emails reports page loads | ✅ | 292ms |
| features.spec.ts | list sets | ✅ | 269ms |
| features.spec.ts | create a set | ✅ | 437ms |
| features.spec.ts | edit features | ✅ | 1.2s |
| features.spec.ts | enable all features | ✅ | 1.3s |
| features.spec.ts | disable all features | ✅ | 1.4s |
| features.spec.ts | delete a set | ✅ | 771ms |
| features.spec.ts | prevent delete default set | ✅ | 244ms |
| firewall.spec.ts | test firewall gui | ✅ | 1.2s |
| firewall.spec.ts | whitelist an ip address | ✅ | 2.1s |
| general_settings.spec.ts | update proxy and test restart needed msg | ✅ | 2.1s |
| login_2fa.spec.ts | navigating directly to /login/2fa without a pending session redirects to login | ✅ | 200ms |
| notifications_top.spec.ts | notifications page loads with table and edit settings link | ✅ | 243ms |
| notifications_top.spec.ts | search filters the notifications table | ✅ | 340ms |
| notifications_top.spec.ts | acknowledge a single unread notification | ✅ | 365ms |
| notifications_top.spec.ts | delete single notification requires a second confirm click | ✅ | 3.4s |
| notifications_top.spec.ts | acknowledge all button is present and submits without confirmation | ❌ | 1.1s |
| notifications_top.spec.ts | delete all button requires a second confirm click (not confirmed) | ❌ | 1.2s |
| onboarding.spec.ts | onboarding page loads with the intro step | ❌ | 1.2s |
| onboarding.spec.ts | Start walks through steps 1-3 with progress indicator and Back navigation | ❌ | 1.2s |
| onboarding.spec.ts | config and user/plan step cards link to their real settings pages | ❌ | 1.2s |
| onboarding.spec.ts | Skip for now leaves onboarding without dismissing it | ❌ | 1.1s |
| process_manager.spec.ts | tests/process_manager.spec.ts › search | ❌ | 1.2s |
| process_manager.spec.ts | tests/process_manager.spec.ts › asc/desc sorting | ❌ | 1.1s |
| process_manager.spec.ts | tests/process_manager.spec.ts › strace | ❌ | 1.2s |
| process_manager.spec.ts | tests/process_manager.spec.ts › kill | ❌ | 1.1s |
| reboot.spec.ts | reboot | ❌ | 1.2s |
| search.spec.ts | searching a known page surfaces it in the dropdown and navigates on click | ❌ | 1.2s |
| search.spec.ts | searching an existing username surfaces a user result | ❌ | 1.1s |
| search.spec.ts | searching an existing website surfaces a website result | ❌ | 1.2s |
| search.spec.ts | clearing the search query restores the dropdown results | ❌ | 1.2s |
| security_basic_auth.spec.ts | basic auth settings page loads with expected fields | ❌ | 1.2s |
| security_basic_auth.spec.ts | generate password button fills password field | ❌ | 1.2s |
| security_basic_auth.spec.ts | toggle password visibility button switches input type | ❌ | 1.2s |
| security_basic_auth.spec.ts | save basic auth settings persists username (kept disabled) | ❌ | 1.2s |
| security_blacklist_useragents.spec.ts | blacklist useragents page loads with expected fields | ⏭️ | 156ms |
| security_blacklist_useragents.spec.ts | edit and save blacklist useragents list | ⏭️ | 104ms |
| security_blacklist_useragents.spec.ts | restore default fetches default list into textarea | ⏭️ | 104ms |
| security_blacklist_useragents.spec.ts | toggle enable select | ⏭️ | 126ms |
| security_imunify.spec.ts | imunify page renders the branch matching current service state | ✅ | 297ms |
| security_passkeys.spec.ts | passkeys page loads | ✅ | 284ms |
| security_passkeys.spec.ts | shows either domain warning or add-passkey form depending on access method | ✅ | 260ms |
| security_passkeys.spec.ts | existing passkeys list shows rename and remove forms | ⏭️ | 276ms |
| security_passkeys.spec.ts | remove passkey form has a confirm dialog and is not submitted | ⏭️ | 262ms |
| security_twofa.spec.ts | 2fa page loads and shows the correct branch for current state | ✅ | 269ms |
| security_twofa.spec.ts | 2fa code input only accepts 6 digits | ✅ | 279ms |
| security_waf.spec.ts | waf settings page loads with status select and active/total badge | ✅ | 280ms |
| security_waf.spec.ts | manage rules link navigates to waf rules page | ✅ | 465ms |
| security_waf.spec.ts | search filters waf rule sets table | ✅ | 491ms |
| security_waf.spec.ts | view rule set opens raw rules in new tab | ✅ | 450ms |
| security_waf.spec.ts | toggle a rule set enable/disable and revert | ✅ | 732ms |
| server_migrate.spec.ts | migrate page shows start form or in-progress status | ✅ | 298ms |
| server_node.spec.ts | default node page loads with expected fields | ✅ | 253ms |
| server_node.spec.ts | default node fields are required | ✅ | 240ms |
| server_resource_usage.spec.ts | resource usage page shows drop-cache and clear-swap controls | ✅ | 623ms |
| server_resource_usage.spec.ts | resource usage history page loads with default line view | ✅ | 482ms |
| server_resource_usage.spec.ts | time range selector changes period via query param | ✅ | 625ms |
| server_resource_usage.spec.ts | view toggle switches between line and grid views | ✅ | 882ms |
| server_resource_usage.spec.ts | refresh button reloads the page | ✅ | 642ms |
| server_root_password.spec.ts | root password page loads with expected fields | ⏭️ | 111ms |
| server_root_password.spec.ts | password field rejects apostrophe via pattern attribute | ⏭️ | 112ms |
| server_ssh.spec.ts | ssh page loads with status indicator and basic tab fields | ✅ | 356ms |
| server_ssh.spec.ts | switching to advanced tab lazy-loads full sshd config | ✅ | 338ms |
| server_ssh.spec.ts | keys tab is only shown when pubkey auth is enabled | ✅ | 250ms |
| server_ssh.spec.ts | tab state persists via URL hash on reload | ✅ | 333ms |
| server_swap.spec.ts | swap page loads with current usage, devices table, and controls | ✅ | 319ms |
| server_timezone.spec.ts | timezone page loads with current timezone and select options | ✅ | 398ms |
| server_timezone.spec.ts | change timezone updates host setting and can be reverted | ✅ | 713ms |
| services_crash_logs.spec.ts | crash logs viewer loads with a log selector | ✅ | 288ms |
| services_crash_logs.spec.ts | selecting a crash log loads its content and reveals download/delete buttons | ⏭️ | 237ms |
| services_crash_logs.spec.ts | selecting a crash log via ?log_name= query param preselects and loads it | ⏭️ | 235ms |
| services_edit.spec.ts | edit services page loads with JSON editor and Go back link | ✅ | 249ms |
| services_edit.spec.ts | invalid JSON is rejected client-side without submitting | ✅ | 409ms |
| services_edit.spec.ts | saving the same (unchanged) JSON round-trips successfully | ✅ | 421ms |
| services_ftp.spec.ts | ftp accounts page renders branch matching current ftp server status | ✅ | 338ms |
| services_ftp.spec.ts | configuration tab navigates to ftp settings page | ✅ | 527ms |
| services_ftp.spec.ts | edit and save ftp configuration, then revert | ✅ | 1.5s |
| services_limits.spec.ts | service limits page loads with per-service-group sections | ✅ | 234ms |
| services_limits.spec.ts | each service group exposes numeric CPU/RAM and boolean fields | ✅ | 332ms |
| services_logs.spec.ts | log viewer page loads with selects and settings link | ✅ | 279ms |
| services_logs.spec.ts | selecting a log file loads its content and reveals download/delete buttons | ✅ | 366ms |
| services_logs.spec.ts | lines-select limits the number of fetched log lines via URL params | ✅ | 297ms |
| services_logs.spec.ts | edit log paths page validates JSON before submitting | ✅ | 386ms |
| services_podman.spec.ts | podman page loads with Info/Images/Volumes/Networks/Disk Usage tabs | ✅ | 1.7s |
| services_podman.spec.ts | info tab shows podman info output by default | ✅ | 1.5s |
| services_podman.spec.ts | images tab lists images with search and bulk action controls | ✅ | 1.7s |
| services_podman.spec.ts | search filters the images table | ✅ | 1.7s |
| services_podman.spec.ts | each downloaded, unused image exposes a Delete control; in-use images do not | ✅ | 2.1s |
| services_podman.spec.ts | volumes tab lists podman volumes | ✅ | 2.0s |
| services_podman.spec.ts | networks tab lists podman networks | ✅ | 1.8s |
| services_podman.spec.ts | disk usage tab shows podman system df output | ✅ | 1.7s |
| services_status.spec.ts | services page lists services with search and edit-services link | ✅ | 370ms |
| services_status.spec.ts | search filters the services table | ✅ | 519ms |
| services_status.spec.ts | each service row exposes start/stop and restart actions | ✅ | 649ms |
| services_status.spec.ts | monitored services link to notifications settings | ✅ | 369ms |
| settings_administrators.spec.ts | administrators page loads with table | ✅ | 274ms |
| settings_administrators.spec.ts | search filters the administrators table | ✅ | 423ms |
| settings_administrators.spec.ts | create, inspect, and delete a new administrator (Enterprise only) | ✅ | 948ms |
| settings_administrators.spec.ts | rename and change-password links navigate to dedicated pages | ✅ | 302ms |
| settings_api.spec.ts | api settings page renders branch matching current state | ✅ | 264ms |
| settings_api.spec.ts | api tester sends a safe GET request and shows response | ⏭️ | 230ms |
| settings_api.spec.ts | view examples loads endpoint documentation | ⏭️ | 265ms |
| settings_caddy.spec.ts | caddy settings page loads without error | ✅ | 121ms |
| settings_caddy.spec.ts | caddy metrics endpoint returns raw text proxy | ✅ | 103ms |
| settings_custom_code.spec.ts | custom code page loads with save button | ✅ | 287ms |
| settings_custom_code.spec.ts | pagespeed api key field edits and saves | ✅ | 702ms |
| settings_custom_code.spec.ts | edit, save, and revert "wp_plugins" textarea | ✅ | 704ms |
| settings_custom_code.spec.ts | edit, save, and revert "wp_themes" textarea | ✅ | 691ms |
| settings_custom_code.spec.ts | edit, save, and revert "forbidden_usernames" textarea | ✅ | 744ms |
| settings_custom_code.spec.ts | edit, save, and revert "restricted_domains" textarea | ✅ | 726ms |
| settings_custom_code.spec.ts | edit, save, and revert "post_update" textarea | ✅ | 669ms |
| settings_custom_code.spec.ts | edit, save, and revert "pre_startup" textarea | ✅ | 735ms |
| settings_custom_code.spec.ts | edit, save, and revert "custom_css" textarea (Enterprise only) | ✅ | 663ms |
| settings_custom_code.spec.ts | edit, save, and revert "custom_js" textarea (Enterprise only) | ⏭️ | 255ms |
| settings_custom_code.spec.ts | edit, save, and revert "in_header" textarea (Enterprise only) | ⏭️ | 282ms |
| settings_custom_code.spec.ts | edit, save, and revert "in_footer" textarea (Enterprise only) | ⏭️ | 271ms |
| settings_custom_code.spec.ts | edit, save, and revert "howto_guides" textarea (Enterprise only) | ✅ | 677ms |
| settings_custom_code.spec.ts | edit, save, and revert "custom_section" textarea (Enterprise only) | ✅ | 682ms |
| settings_custom_code.spec.ts | restore default fetches content into a textarea | ✅ | 1.2s |
| settings_defaults.spec.ts | defaults page loads with webserver/database/varnish/php pickers | ✅ | 365ms |
| settings_defaults.spec.ts | webserver picker selects without submitting | ✅ | 376ms |
| settings_defaults.spec.ts | autostart services exposes toggleable buttons | ✅ | 318ms |
| settings_defaults.spec.ts | advanced link navigates to defaults files editor | ✅ | 491ms |
| settings_defaults.spec.ts | defaults files editor exposes validate/save workflow | ✅ | 263ms |
| settings_domain_templates.spec.ts | edit template: IPv4 Zone | ✅ | 1.5s |
| settings_domain_templates.spec.ts | edit template: IPv6 Zone | ✅ | 1.0s |
| settings_domain_templates.spec.ts | edit template: Default Page | ✅ | 1.7s |
| settings_domain_templates.spec.ts | edit template: Suspended Website | ✅ | 1.2s |
| settings_domain_templates.spec.ts | edit template: Suspended User | ✅ | 1.7s |
| settings_domain_templates.spec.ts | edit template: Apache VHost | ✅ | 1.2s |
| settings_domain_templates.spec.ts | edit template: Nginx VHost | ✅ | 1.7s |
| settings_domain_templates.spec.ts | edit template: OpenResty VHost | ✅ | 1.8s |
| settings_domain_templates.spec.ts | edit template: Varnish Template | ✅ | 1.4s |
| settings_domain_templates.spec.ts | edit template: Caddy VHosts | ✅ | 1.3s |
| settings_domain_templates.spec.ts | edit zone for a domain | ✅ | 1.2s |
| settings_license.spec.ts | license page loads with key field and actions | ✅ | 305ms |
| settings_license.spec.ts | verify/downgrade links are gated on having a key set | ✅ | 264ms |
| settings_license.spec.ts | generate support report link is present | ✅ | 307ms |
| settings_locales.spec.ts | locales page loads with table | ✅ | 803ms |
| settings_locales.spec.ts | search filters the locales table | ✅ | 504ms |
| settings_locales.spec.ts | set a different installed locale as default, then revert | ✅ | 889ms |
| settings_locales.spec.ts | install button present for non-installed locales (not clicked) | ✅ | 390ms |
| settings_modules.spec.ts | modules page loads with grid, filters, and save button | ✅ | 428ms |
| settings_modules.spec.ts | search filters the modules grid | ✅ | 613ms |
| settings_modules.spec.ts | category filter buttons toggle active state | ✅ | 665ms |
| settings_modules.spec.ts | a module toggle switch responds to click without saving | ✅ | 547ms |
| settings_modules.spec.ts | enable all / disable all bulk buttons affect toggle states | ✅ | 648ms |
| settings_notifications.spec.ts | notifications settings page loads with email/webhook fields | ✅ | 305ms |
| settings_notifications.spec.ts | edit and save notification email, then revert | ✅ | 807ms |
| settings_notifications.spec.ts | attack-prevention thresholds appear only when attack toggle is enabled | ✅ | 318ms |
| settings_notifications.spec.ts | SMTP fields are present for mail delivery configuration | ✅ | 313ms |
| settings_notifications.spec.ts | service monitoring checkboxes are present | ✅ | 323ms |
| settings_openpanel.spec.ts | openpanel settings page loads with branding/nameserver/display sections | ✅ | 345ms |
| settings_openpanel.spec.ts | edit and save brand name, then revert | ✅ | 680ms |
| settings_openpanel.spec.ts | nameserver and file manager limit fields are present and numeric where expected | ✅ | 358ms |
| settings_openpanel.spec.ts | display toggle switches respond to clicks without saving | ✅ | 304ms |
| settings_php.spec.ts | php settings page loads with options textarea and ini accordions | ✅ | 676ms |
| settings_php.spec.ts | edit and save available php options, then revert | ✅ | 1.9s |
| settings_php.spec.ts | first php.ini accordion expands and collapses | ✅ | 966ms |
| settings_php.spec.ts | edit, save, and revert the first php.ini file | ✅ | 15.7s |
| settings_php.spec.ts | restore default fetches ini content from GitHub | ✅ | 8.0s |
| settings_resellers.spec.ts | resellers page loads with table | ✅ | 276ms |
| settings_resellers.spec.ts | create a new reseller | ✅ | 769ms |
| settings_resellers.spec.ts | edit plans & limits link navigates to update page | ✅ | 351ms |
| settings_resellers.spec.ts | delete reseller (runs last) | ✅ | 554ms |
| shortcuts.spec.ts | all keyboard shortcuts work correctly | ✅ | 14.2s |
| support_report.spec.ts | generating a support report redirects to /license with the report result | ✅ | 1.7s |
| system_ips.spec.ts | GET /system/ips/{username} returns the server's public IP addresses | ✅ | 25ms |
| terminal.spec.ts | terminal page loads for an admin user with expected UI elements | ✅ | 388ms |
| terminal.spec.ts | reconnect button is present | ✅ | 1.9s |
| terminal.spec.ts | shell selector offers bash/sh options | ✅ | 376ms |
| updates.spec.ts | check updates page | ✅ | 729ms |
| updates.spec.ts | update notification preferences | ✅ | 1.9s |
| updates.spec.ts | check changelog link | ✅ | 3.0s |
| users_export.spec.ts | export tab (Enterprise only) offers backup and transfer modes | ✅ | 1.2s |
| users_export.spec.ts | backup mode shows existing backups or the empty state, without generating one | ✅ | 1.0s |
| users_export.spec.ts | transfer mode exposes the SSH transfer form fields | ✅ | 1.1s |
| users_import.spec.ts | import account page loads with backup type selector and file picker | ✅ | 376ms |
| users_import.spec.ts | selecting a non-OpenPanel backup type reveals plan selection | ✅ | 343ms |
| users_import.spec.ts | account imports log page lists past import runs or the empty state | ✅ | 283ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/ returns api status | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/ with valid credentials returns access token | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/ with invalid credentials is rejected | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/whoami returns the authenticated username | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/whoami without a token is rejected | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/users lists users | ⏭️ | 3ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › mutating verbs on /api/users require auth | ✅ | 25ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/users/<username>/containers lists compose services | ⏭️ | 1ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/users/<username>/containers?stats=1 returns live stats | ⏭️ | 1ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/users/<username>/containers/<action>/<container> requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains lists all domains | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/new requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/<action>/<domain> (suspend/unsuspend/delete) requires auth | ✅ | 13ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/docroot/<domain> returns docroot | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/docroot/<domain> requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/<domain>/dns returns the zone file | ⏭️ | 1ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/<domain>/dns requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/<domain>/caddy returns the caddy config | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/<domain>/caddy requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/<domain>/vhost/<username> returns the vhost file | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/<domain>/vhost/<username> requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/<domain>/ssl returns ssl status | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/<domain>/ssl action=logs returns issuance logs | ⏭️ | 1ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/<domain>/log returns the paginated access log | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/<domain>/stats/<username> returns goaccess report | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/domains/file-templates returns default templates | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/domains/file-templates requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/dns/cluster returns cluster config | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/dns/cluster requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/dns/cluster/<ip> checks slave reachability | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/dns/zone-templates returns ipv4/ipv6 templates | ⏭️ | 1ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/dns/zone-templates requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/plans lists plans | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › plan lifecycle: POST create -> GET -> PUT edit -> DELETE | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › PATCH /api/plans/<id> requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/services lists monitored services | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › PUT /api/services requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/services/status checks services status | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/services/<action>/<service_name> requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/docker/info returns docker info | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/ips lists dedicated ip users | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/system returns system information | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/usage/cpu returns usage data | ⏭️ | 2ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/usage/memory returns usage data | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/usage/server returns usage data | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/usage/disk returns usage data | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/notifications lists notifications | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/notifications/<id>/read marks a notification as read | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › DELETE /api/notifications/<id> requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › DELETE /api/notifications/<id>?command=delete_all requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/emails/settings returns mailserver settings | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/emails/settings requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/emails/accounts lists mailboxes | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST and DELETE /api/emails/accounts require auth | ✅ | 9ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/emails/queue views the mail queue | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/emails/queue requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/emails/domain-limits views postfwd rules | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/emails/domain-limits?hits=<domain> views hit counters | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/emails/domain-limits requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/basic-auth returns basic auth config | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/basic-auth requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/blacklist-useragents returns the blacklist | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/blacklist-useragents requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/disable-admin requires auth (never executed) | ✅ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/firewall checks CSF availability | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/firewall requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/waf returns WAF status | ⏭️ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/waf requires auth | ✅ | 7ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/waf/rules lists WAF rule sets | ⏭️ | 1ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/waf/rules requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/2fa returns 2FA status | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/security/2fa/enable and /disable require auth | ✅ | 9ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/security/passkeys lists passkeys | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST and DELETE /api/security/passkeys require auth | ✅ | 8ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/crons lists cronjobs | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/crons requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/ssh returns ssh status/config/keys | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/ssh requires auth | ✅ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/ssh/config returns raw sshd_config | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/ssh/config requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/timezone returns current timezone | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/timezone requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/memory/drop-cache requires auth (not executed) | ✅ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/memory/drop-swap requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/processes lists processes sorted by memory | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/processes/<pid>/kill requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/node returns default clustering node | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/node requires auth | ✅ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/root-password requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/reboot requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/reboot/status reports panel availability | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/server/migrate reports migration status | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/server/migrate requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/administrators lists admin accounts | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/administrators requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/resellers lists reseller accounts | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/resellers requires auth | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/general returns general settings | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/general requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/defaults returns default env/services | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/defaults requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/defaults/files returns compose/env templates | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST and DELETE /api/settings/defaults/files require auth | ✅ | 9ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/defaults/files/<username> returns per-user files | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/defaults/files/<username> requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/features lists feature sets | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/features/default views the default feature set | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › feature set lifecycle: create -> update -> delete | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/locales lists locales | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/locales requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/modules lists enabled modules | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/modules requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/custom-code returns custom code snippets | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/custom-code requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/php returns php options | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/php requires auth | ✅ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/caddy/metrics returns prometheus metrics | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/updates returns update preferences | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/updates requires auth | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/updates/now requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/updates/tags lists available image tags | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/updates/tags requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/settings/notifications returns notification preferences | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/settings/notifications requires auth | ✅ | 4ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/license returns license info | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST and DELETE /api/license require auth (not executed) | ✅ | 10ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/license/info returns detailed license info | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/license/verify verifies the license | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/support/report generates a diagnostics report | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/import/cpanel lists import job statuses | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/import/<panel_type> requires auth (not executed) | ✅ | 6ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/import/backup-files lists discovered backup archives | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/import/transfers lists transfer log files | ⏭️ | 2ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › POST /api/import/transfers requires auth (not executed) | ✅ | 5ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/import/transfers/<username> lists per-user transfer logs | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/import/logs/account/<log> handles missing log gracefully | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › GET /api/import/logs/transfer/<log> handles missing log gracefully | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › user lifecycle: create -> suspend -> unsuspend -> delete | ⏭️ | 0ms |
| zzz-api_endpoints.spec.ts | tests/zzz-api_endpoints.spec.ts › domain lifecycle: new -> suspend -> unsuspend -> docroot -> delete | ⏭️ | 0ms |

</details>
<!-- AUTOMATED-RESULTS:END -->

