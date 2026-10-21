import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {art,animationFrame} from '../src/art';
import {GameModel} from '../src/model';
import {defaultConfig} from '../src/config';

test('all 74 static and 14 animation textures exist with bounded atlas dimensions',()=>{
  assert.equal(Object.keys(art.images).length,74);assert.equal(Object.keys(art.animations).length,14);
  for(const a of [...Object.values(art.images),...Object.values(art.animations)])assert.ok(fs.existsSync(`public${a.url}`),a.url);
  for(const a of Object.values(art.animations)){assert.ok(a.frameCount>0&&a.frameRate>0);assert.ok(a.bounds[3]>a.bounds[1]);assert.ok(a.frameWidth<=384&&a.frameHeight<=384);}
});
test('animation timing loops walk and holds single-shot final pose',()=>{
  assert.equal(animationFrame(art.animations.pap_basic_walk,1),4);
  assert.equal(animationFrame(art.animations.giant_emerge,30),19);
  assert.equal(animationFrame(art.animations.boss_enrage,.6),6);
});
test('parking blocks ordinary paparazzi indefinitely, inflicts no damage, and survives',()=>{
  const m=new GameModel(structuredClone(defaultConfig));m.select('parking');m.deploy(0);m.startWave();
  for(let i=0;i<2400;i++)m.update(1/60);
  assert.equal(m.hp,100);assert.equal(m.enemies.length,4);assert.equal(m.defeated,0);
  assert.ok(m.enemies.every(e=>e.hp===e.config.hp));assert.equal(m.towers[0].broken,false);
  const positions=m.enemies.map(e=>e.distance);m.update(.25);assert.deepEqual(m.enemies.map(e=>e.distance),positions);
});
test('Boss breaks parking after the punch and continues along the road',()=>{
  const m=new GameModel(structuredClone(defaultConfig));m.wave=4;m.select('parking');m.deploy(0);m.startWave();
  for(let i=0;i<600;i++)m.update(1/60);
  assert.equal(m.towers[0].broken,true);assert.ok(m.enemies[0].distance>140);assert.equal(m.enemies[0].hp,m.enemies[0].config.hp);
});
