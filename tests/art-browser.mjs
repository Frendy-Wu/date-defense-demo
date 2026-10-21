import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)failed.push(r.url());});
try{
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__gameSnapshot?.ready,{},{timeout:30000});
  await page.waitForTimeout(300);
  const state=()=>page.evaluate(()=>window.__gameSnapshot);
  async function point(x,y,hover=false){const b=await page.locator('canvas').boundingBox();const p=[b.x+x/540*b.width,b.y+y/960*b.height];if(hover)await page.mouse.move(...p);else await page.mouse.click(...p);}
  await page.screenshot({path:'test-results/art-ready.png'});
  await point(96,392);assert.equal((await state()).selected,'vine');
  await point(175,525,true);await page.screenshot({path:'test-results/art-vine.png'});
  await page.keyboard.press('Escape');
  const s=await state(), ids=['ac','car','awning','parking','vine'], chosen=[2,3,4,5,6];
  for(let i=0;i<5;i++){
    const p=s.sources[i];await point(i===4?96:p.x,i===4?392:p.y-30);
    assert.equal((await state()).selected,ids[i],`source hit ${ids[i]}`);
    const dest=s.slots[chosen[i]];await point(dest.x,dest.y);
    assert.equal((await state()).towers.length,i+1);
  }
  await page.screenshot({path:'test-results/art-deployed.png'});
  await page.locator('#speed').click();
  await page.locator('#next').click();
  await page.waitForTimeout(1800);await page.screenshot({path:'test-results/art-battle.png'});
  for(let wave=1;wave<=5;wave++){
    if(wave===5){
      await page.waitForFunction(()=>window.__gameSnapshot.boss>0);
      assert.equal(await page.locator('#boss-hud').isVisible(),true);
      await page.waitForTimeout(2500);await page.screenshot({path:'test-results/art-boss.png'});
    }
    await page.waitForFunction(()=>['between','won','lost'].includes(window.__gameSnapshot.phase),{},{timeout:60000});
    assert.notEqual((await state()).phase,'lost',`lost at ${wave}`);
    if(wave<5)await page.locator('#next').click();
  }
  await page.screenshot({path:'test-results/art-victory.png'});
  await page.locator('#again').click();await page.waitForFunction(()=>window.__gameSnapshot.ready&&window.__gameSnapshot.phase==='ready');
  await page.getByText('动画资源预览',{exact:false}).click();
  const manifest=JSON.parse(await fs.readFile('src/art-manifest.json','utf8'));
  for(const key of Object.keys(manifest.animations)){
    await page.locator('#art-select').selectOption(key);await page.locator('#art-play').click();
    assert.equal((await state()).paused,true);await page.waitForTimeout(100);
  }
  await page.locator('#art-select').selectOption('giant_emerge');await page.locator('#art-play').click();
  await page.waitForTimeout(2200);await page.screenshot({path:'test-results/art-gallery.png'});
  await page.locator('#art-close').click();assert.equal((await state()).paused,false);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/art-narrow.png'});
  assert.deepEqual(failed,[]);assert.deepEqual(errors,[]);
  console.log('Art browser: 5 sources, vine wall, 5 deployed towers, all five waves, Boss HP, 14 previews, resize: PASS');
}finally{await browser.close();}
