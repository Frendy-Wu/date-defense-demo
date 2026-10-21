import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import * as XLSX from 'xlsx';

const dir = path.resolve(process.argv[2]);
const server = spawn(path.join(dir, 'runtime/node.exe'), [path.join(dir, 'server.cjs'), '--no-open']);
let browser;
try {
  const url = await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.stdout.on('data', data => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) resolve(match[0]); });
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#next').disabled);
  await page.locator('summary').first().click();
  for (const locator of [page.getByText('下载默认 Excel 模板'), page.locator('#export')]) {
    const [download] = await Promise.all([page.waitForEvent('download'), locator.click()]);
    assert.equal(await download.failure(), null);
    const book = XLSX.read(await fs.readFile(await download.path()));
    assert.ok(book.Sheets['全局']);
  }
  const workbook = XLSX.read(await fs.readFile(path.join(dir, 'game/data/约会保卫战配置.xlsx')));
  workbook.Sheets['全局'].A2.v = 222;
  workbook.Sheets['全局'].B2.v = 123;
  await page.locator('#import').setInputFiles({ name: 'test.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) });
  await page.locator('#apply').click();
  await page.waitForFunction(() => document.querySelector('#hp').textContent === '222 / 222' && !document.querySelector('#next').disabled);
  assert.equal(await page.locator('#energy').textContent(), '123');
  await page.locator('summary').nth(1).click();
  const keys = await page.locator('#art-select option').evaluateAll(options => options.map(option => option.value));
  assert.equal(keys.length, 14);
  for (const key of keys) {
    await page.locator('#art-select').selectOption(key);
    await page.locator('#art-play').click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('#frame').evaluate(element => element.classList.contains('previewing')));
    assert.ok(await page.locator('#pause').isDisabled());
    await page.locator('#art-close').click();
  }
  await page.locator('#next').click();
  await page.waitForFunction(() => document.querySelector('#wave').textContent.includes('1 / 5'));
  await page.locator('#pause').click();
  assert.equal(await page.locator('#pause').textContent(), '继续');
  await page.screenshot({ path: 'test-results/portable.png' });
  assert.deepEqual(errors, []);
  console.log('Portable package passed: resources, template download, export, Excel import/apply, all 14 animation previews, wave start and pause.');
} finally {
  await browser?.close();
  server.kill();
}
