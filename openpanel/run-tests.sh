#!/bin/bash
#
# Runs the OpenPanel (user panel) Playwright suite headlessly, spec files in
# parallel on $WORKERS workers (default 4) and then tests/serial/ on one,
# updates this folder's README.md with a results table, and pushes that to
# git so results can be checked online.
#
# Meant to be invoked from cron on the test runner, e.g.:
#   0 22 * * * /root/playwright-test/openpanel/run-tests.sh
#
# Can also be run manually:
#   ./run-tests.sh
#   WORKERS=8 ./run-tests.sh
#
# To test the README-build + commit/push step alone, without waiting on a
# full (slow) test run, reuse the last JSON results file:
#   SKIP_TESTS=1 ./run-tests.sh

set -uo pipefail

LABEL="OpenPanel"

# cron runs with a minimal PATH -- make sure node/npx/git are findable.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO_DIR="$(dirname "$PROJECT_DIR")"
LOG_DIR="$REPO_DIR/logs"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/openpanel-${TIMESTAMP}.log"
JSON_FILE="$LOG_DIR/openpanel-latest.json"
README="$PROJECT_DIR/README.md"

mkdir -p "$LOG_DIR"
cd "$REPO_DIR" || { echo "Cannot cd to $REPO_DIR" >&2; exit 1; }

# pull in GITHUB_TOKEN (and anything else) from the same shared secrets
# file opencli/os_install.sh uses -- see .env.template for the full list
if [ -f "$REPO_DIR/.env" ]; then
  set -a
  source "$REPO_DIR/.env"
  set +a
fi

# keep each run's HTML report separate instead of overwriting the last one
export PLAYWRIGHT_HTML_REPORT="$LOG_DIR/html-report-openpanel-${TIMESTAMP}"
export PLAYWRIGHT_HTML_OPEN=never
export PLAYWRIGHT_JSON_OUTPUT_NAME="$JSON_FILE"

if [ "${SKIP_TESTS:-0}" = "1" ]; then
  if [ ! -f "$JSON_FILE" ]; then
    echo "SKIP_TESTS=1 but no existing results file at $JSON_FILE" >&2
    exit 1
  fi
  echo "SKIP_TESTS=1 -- reusing existing results file, not running tests" | tee -a "$LOG_FILE"
  TEST_STATUS=0
else
  {
    echo "=== $LABEL tests starting at $(date) ==="

    npx playwright test -c openpanel/playwright.config.ts --project=tests --workers="${WORKERS:-4}" --reporter=list,html,json
    TEST_STATUS=$?

    echo "=== $LABEL tests finished at $(date) with exit code $TEST_STATUS ==="
    echo "=== HTML report: $PLAYWRIGHT_HTML_REPORT ==="
  } >>"$LOG_FILE" 2>&1
fi

GITHUB_REPO="stefanpejcic/openpanel-tests"
BRANCH="main"

# build the results table into README.md, and (if GITHUB_TOKEN is set)
# open/update/close a single persistent GitHub issue for this script's
# failures -- regardless of pass/fail
node "$REPO_DIR/scripts/build-report.js" "$JSON_FILE" "$README" "$LABEL" "$GITHUB_REPO" >>"$LOG_FILE" 2>&1

# commit and push ONLY the README's current content -- `--only` ignores
# anything else that might already be staged, and this reuses the same
# GITHUB_TOKEN that opencli/os_install.sh expects in the environment,
# instead of requiring an SSH deploy key on this box.

if ! git diff --quiet -- "$README"; then
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    {
      echo "GITHUB_TOKEN is not set -- committing locally only, not pushing."
      git commit --only -m "Automated $LABEL test run: $(date +%Y-%m-%d\ %H:%M)" -- "$README"
    } >>"$LOG_FILE" 2>&1
  else
    # embed the token directly in the URL (standard PAT-over-HTTPS auth) so
    # git never falls back to an interactive credential prompt
    REMOTE_URL="https://stefanpejcic:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
    {
      git commit --only -m "Automated $LABEL test run: $(date +%Y-%m-%d\ %H:%M)" -- "$README" \
        && GIT_TERMINAL_PROMPT=0 git fetch "$REMOTE_URL" "$BRANCH" \
        && git rebase --autostash FETCH_HEAD \
        && GIT_TERMINAL_PROMPT=0 git push "$REMOTE_URL" "HEAD:$BRANCH"
    } >>"$LOG_FILE" 2>&1
  fi
fi

# prune logs/reports older than 30 days so this doesn't grow forever
find "$LOG_DIR" -maxdepth 1 \( -name 'openpanel-*.log' -o -name 'html-report-openpanel-*' \) -mtime +30 -exec rm -rf {} +

exit "$TEST_STATUS"
