import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as XLSX from 'xlsx';
await fs.mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__gameSnapshot);
const snapshot=()=>page.evaluate(()=>window.__gameSnapshot);
async function click(x,y){const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+x/540*box.width,box.y+y/960*box.height);}
await page.screenshot({path:'test-results/01-ready.png'});
await click(55,260);assert.equal((await snapshot()).selected,'ac');
await page.keyboard.press('Escape');assert.equal((await snapshot()).selected,null);
await click(55,260);await click(177,355);assert.equal((await snapshot()).energy,410);
await click(485,320);await click(177,355);assert.equal((await snapshot()).energy,410);
await page.locator('#next').click();await click(408,375);assert.equal((await snapshot()).energy,300);
for(const [x,y,sx,sy]of [[55,420,137,500],[485,520,347,525],[55,600,166,650]]){await click(x,y);await click(sx,sy);}
assert.equal((await snapshot()).towers.length,5);assert.equal((await snapshot()).energy,0);
await page.locator('#speed').click();await page.screenshot({path:'test-results/02-battle.png'});
await page.locator('#pause').click();const paused=await snapshot();await page.waitForTimeout(250);assert.deepEqual(await snapshot(),paused);await page.locator('#pause').click();
for(let wave=1;wave<=5;wave++){
  await page.waitForFunction(()=>['between','won','lost'].includes(window.__gameSnapshot.phase),null,{timeout:60000});
  const s=await snapshot();assert.notEqual(s.phase,'lost',`wave ${wave}`);assert.equal(s.wave,wave);
  if(wave<5)await page.locator('#next').click();
}
assert.equal((await snapshot()).phase,'won');await page.screenshot({path:'test-results/03-victory.png'});
await page.locator('#again').click();await page.waitForFunction(()=>window.__gameSnapshot.phase==='ready');assert.equal((await snapshot()).energy,500);
await page.locator('summary').click();
// Use the delivered template, edit it in memory, then upload through the real file input.
const bytes=await fs.readFile('public/data/约会保卫战配置.xlsx');const wb=XLSX.read(bytes);wb.Sheets['全局'].A2.v=222;wb.Sheets['全局'].B2.v=1;
await page.locator('#import').setInputFiles({name:'changed.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});
await page.waitForFunction(()=>!document.querySelector('#apply').disabled);assert.equal((await snapshot()).hp,100);
await page.locator('#apply').click();await page.waitForFunction(()=>window.__gameSnapshot.hp===222);assert.equal((await snapshot()).energy,1);
await click(55,260);await click(177,355);assert.equal((await snapshot()).towers.length,0);assert.equal((await snapshot()).energy,1);
wb.Sheets['防御物'].D2.v=-1;
await page.locator('#import').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})});
await page.waitForFunction(()=>document.querySelector('#import-status').textContent.includes('导入失败'));assert.equal((await snapshot()).hp,222);assert.ok(await page.locator('#apply').isDisabled());await page.screenshot({path:'test-results/04-import.png'});
await page.locator('#reset-config').click();await page.waitForFunction(()=>window.__gameSnapshot.hp===100);
await page.locator('#speed').click();await page.locator('#next').click();await page.waitForFunction(()=>window.__gameSnapshot.phase==='between',null,{timeout:60000});
assert.equal((await snapshot()).hp,52);await page.locator('#next').click();await page.waitForFunction(()=>window.__gameSnapshot.phase==='lost',null,{timeout:60000});await page.screenshot({path:'test-results/05-defeat.png'});
await page.locator('#again').click();await page.waitForFunction(()=>window.__gameSnapshot.phase==='ready');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/06-narrow.png'});
const box=await page.locator('canvas').boundingBox();assert.ok(Math.abs(box.width/box.height-9/16)<.002);
assert.deepEqual(errors,[]);console.log('Browser checks passed: deployment, five waves, win/loss, restart, pause, import/apply/reject, narrow layout.');
await browser.close();
