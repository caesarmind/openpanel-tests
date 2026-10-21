import { test, expect } from '@playwright/test';

async function navigateToPage(page: any, service: string) {
  await page.goto(`/cache/${service}`);
  await expect(page).toHaveURL(new RegExp(`cache/${service}`));
}

// cache services
const services = [
  {
    name: 'redis',
    port: '6379',
  },
  {
    name: 'valkey',
    port: '6379',
  },
  {
    name: 'memcached',
    port: '11211',
  },
  {
    name: 'elasticsearch',
    port: '9200',
  },
  {
    name: 'opensearch',
    port: '9200',
  },
];

const domain = 'wp.tests.openpanel.org';

// PHP connection test scripts per service
const connectionPhpScripts: Record<string, string> = {
  redis: `<?php
if (!class_exists('Redis')) {
    die('REDIS_EXTENSION_MISSING');
}

$redis = new Redis();
try {
  $redis->connect('redis', 6379, 3);
  $pong = $redis->ping();
  if ($pong === true || $pong === '+PONG' || $pong === 'PONG') {
    echo 'REDIS_OK';
  } else {
    echo 'REDIS_FAIL:unexpected_ping_response';
  }
} catch (Exception $e) {
  echo 'REDIS_FAIL:' . $e->getMessage();
}`,

  valkey: `<?php
if (!class_exists('Redis')) {
    die('REDIS_EXTENSION_MISSING');
}

$redis = new Redis();
try {
  $redis->connect('valkey', 6379, 3);
  $pong = $redis->ping();
  if ($pong === true || $pong === '+PONG' || $pong === 'PONG') {
    echo 'VALKEY_OK';
  } else {
    echo 'VALKEY_FAIL:unexpected_ping_response';
  }
} catch (Exception $e) {
  echo 'VALKEY_FAIL:' . $e->getMessage();
}`,
  
  memcached: `<?php
if (class_exists('Memcached')) {
  $mc = new Memcached();
  $mc->addServer('memcached', 11211);
  $key = 'openpanel_test_' . time();
  $mc->set($key, 'ok', 10);
  $val = $mc->get($key);
  if ($val === 'ok') {
    echo 'MEMCACHED_OK';
  } else {
    echo 'MEMCACHED_FAIL:get_returned_' . var_export($val, true);
  }
} else {
  $host = 'memcached';
  $port = 11211;
  
  $fp = fsockopen($host, $port, $errno, $errstr, 2);
  
  if (!$fp) {
      die("MEMCACHED_FAIL:connection_failed");
  }
  
  $key = 'openpanel_test_' . time();
  $value = 'ok';
  
  $cmd = "set $key 0 10 " . strlen($value) . "\\r\\n$value\\r\\n";
  fwrite($fp, $cmd);
  $setResponse = trim(fgets($fp));
  
  if ($setResponse !== "STORED") {
      fclose($fp);
      die("MEMCACHED_FAIL:set_" . $setResponse);
  }
  fwrite($fp, "get $key\\r\\n");
  
  $getResponse = '';
  while (!feof($fp)) {
      $line = fgets($fp);
      if (strpos($line, "END") !== false) {
          break;
      }
      $getResponse .= $line;
  }
  
  fclose($fp);
  
  if (strpos($getResponse, $value) !== false) {
      echo "MEMCACHED_OK";
  } else {
      echo "MEMCACHED_FAIL:get_returned_" . var_export($getResponse, true);
  }
}`,
 
  elasticsearch: `<?php
$url = 'http://elasticsearch:9200/_cluster/health';
$ctx = stream_context_create(['http' => ['timeout' => 5]]);
$res = @file_get_contents($url, false, $ctx);
if ($res === false) {
  echo 'ELASTICSEARCH_FAIL:could_not_reach_host';
} else {
  $json = json_decode($res, true);
  $status = $json['status'] ?? 'unknown';
  if (in_array($status, ['green', 'yellow'])) {
    echo 'ELASTICSEARCH_OK';
  } else {
    echo 'ELASTICSEARCH_FAIL:status_' . $status;
  }
}`,
 
  opensearch: `<?php
$url = 'http://opensearch:9200/_cluster/health';
$ctx = stream_context_create(['http' => ['timeout' => 5]]);
$res = @file_get_contents($url, false, $ctx);
if ($res === false) {
  echo 'OPENSEARCH_FAIL:could_not_reach_host';
} else {
  $json = json_decode($res, true);
  $status = $json['status'] ?? 'unknown';
  if (in_array($status, ['green', 'yellow'])) {
    echo 'OPENSEARCH_OK';
  } else {
    echo 'OPENSEARCH_FAIL:status_' . $status;
  }
}`,
};
 

for (const service of services) {
  test(service.name, async ({ page }) => {
    test.setTimeout(3 * 60_000); // room for the 90s Running wait plus the healthcheck, elasticsearch is slow to boot

    // PRE-CLEANUP: ensure service is disabled before starting
    await navigateToPage(page, service.name);
    const initialStatus = await page.locator('#service-page-status').textContent();
    if (initialStatus?.trim() === 'Running') {
      const disableBtnPre = page.locator('button', { hasText: 'Click to Disable' });
      await disableBtnPre.click();
      await expect(page.locator('text=is now disabled')).toBeVisible();
      await expect(page.locator('#service-page-status')).toHaveText('Disabled');
    }
    
    await navigateToPage(page, service.name);

    // CHECK
    const statusText = page.locator('#service-page-status');
    await expect(statusText).toHaveText('Disabled');
    const nameText = await page.locator('#service-page-name').textContent();
    expect(nameText?.toLowerCase()).toContain(service.name);
    await expect(page.locator('#service-page-port')).toHaveText(service.port);

    console.log(`${service.name} page has expected info`);

    // ENABLE
    const enableBtn = page.locator('button', { hasText: 'Click to Enable' });
    await enableBtn.click();
    await expect(page.locator('text=is now enabled')).toBeVisible();

    const timeoutMs = 90_000;
    const startTime = Date.now();
    let isRunning = false;
    
    while (Date.now() - startTime < timeoutMs) {
      await navigateToPage(page, service.name);
      
      const statusText = page.locator('#service-page-status');
      
      try {
        await statusText.waitFor({ state: 'visible', timeout: 3000 });
        const status = await statusText.textContent();
        
        if (status?.trim() === 'Running') {
          isRunning = true;
          break;
        }
      } catch {
        // continue
      }
    
      await page.waitForTimeout(1000);
    }
    
    if (!isRunning) {
      throw new Error(`${service.name} did not reach Running state within ${timeoutMs}ms`);
    }

    const greenBars = page.locator('.bg-emerald-500').first();
    await expect(greenBars).toBeVisible();
    console.log(`${service.name} starts successfully`);

    // TEST CONNECTION
    await page.goto(`/file-manager/edit-file/${domain}/cache_connection_test.php?editor=text&new=true`); 
    await page.locator('#editor-text').fill(connectionPhpScripts[service.name]);
    await page.getByRole('button', { name: 'Save' }).click();
    // wait for the save, otherwise the page below can still run the previous service's script
    await expect(page.getByText(/saved|success/i).first()).toBeVisible();
    const testUrl = `https://${domain}/cache_connection_test.php?nocache=${Math.floor(Math.random() * 100_000)}`;
    // apache resolves php-fpm per request and a lookup can miss while podman's dns reloads after a container change
    let body: string | null = '';
    for (let i = 0; i < 6; i++) {
      await page.goto(testUrl);
      body = await page.locator('body').textContent();
      if (!body?.includes('Proxy Error')) break;
      await page.waitForTimeout(5000);
    }
    const expectedOk = `${service.name.toUpperCase()}_OK`;
    await expect(body?.trim().includes(expectedOk), `Expected "${expectedOk}" in response but got: ${body}`).toBe(true);
    console.log(`${service.name} connection test from php passed`);
  
    // CONTAINER STATS
    await navigateToPage(page, service.name);
    
    const statsContainer = page.locator('#service-page-stats');
    await expect(statsContainer.locator('span.font-medium').filter({ hasText: '--' })).toHaveCount(0, { timeout: 15000 });
    const getStat = (label) => statsContainer.locator('div', { hasText: label }).locator('span.font-medium').last();
    
    const statItems = statsContainer.locator('div.flex.items-center.justify-between');
          
    const count = await statItems.count();
    
    const stats = {};
    for (let i = 0; i < count; i++) {
      const item = statItems.nth(i);
      const label = await item.locator('span').first().innerText();
      const value = await item.locator('span').last().innerText();
      stats[label.trim()] = value.trim();
    }
    
    const requiredKeys = ['ID', 'Name', 'CPU Usage', 'Memory Usage', 'Memory %', 'Network I/O', 'Block I/O', 'PIDs'];
    for (const key of requiredKeys) {
      expect(stats).toHaveProperty(key, expect.any(String));
    }
    
    await expect(getStat('Name')).toHaveText(service.name);
    
    const validations = {
      'ID':           { re: /^[a-f0-9]{12}$/,                    desc: '12 hex chars' },
      'CPU Usage':    { re: /^\d+\.\d+%$/,                       desc: 'percentage like 0.05%' },
      'Memory Usage': { re: /^\d+(\.\d+)?\w+\s*\/\s*\d+(\.\d+)?\w+$/, desc: 'bytes like 2.098MiB / 102.4MiB' },
      'Memory %':     { re: /^\d+\.\d+%$/,                       desc: 'percentage like 2.05%' },
      'Network I/O':  { re: /^\d+(\.\d+)?\w+\s*\/\s*\d+(\.\d+)?\w+$/, desc: 'bytes like 1.04kB / 126B' },
      'Block I/O':    { re: /^\d+(\.\d+)?\w+\s*\/\s*\d+(\.\d+)?\w+$/, desc: 'bytes like 147kB / 0B' },
      'PIDs':         { re: /^\d+$/,                             desc: 'integer like 10' },
    };
    
    for (const [label, { re, desc }] of Object.entries(validations)) {
      const value = stats[label];
      expect(re.test(value), `"${label}" value "${value}" should match ${desc}`).toBe(true);
    }  

    // LOGS
    await page.click('button:has-text("View container log")');
    await page.waitForTimeout(1000);
    const logContent = page.locator('#log-content');
    await expect(logContent).not.toHaveText('No logs.');
    await expect(logContent).not.toBeEmpty();
    console.log(`${service.name} logs are available`);

    // DISABLE
    await navigateToPage(page, service.name);
    const disableBtn = page.locator('button', { hasText: 'Click to Disable' });
    await disableBtn.click();
    await expect(page.locator('text=is now disabled')).toBeVisible();
    await expect(page.locator('#service-page-status')).toHaveText('Disabled');
    await expect(page.locator('.bg-gray-400').first()).toBeVisible();
    console.log(`${service.name} is disabled successfully`);
  });
}
