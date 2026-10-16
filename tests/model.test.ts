import test from 'node:test';
import assert from 'node:assert/strict';
import { GameModel, pointAt, pathLength } from '../src/model';
import { defaultConfig, towerIds, makeWorkbook, parseWorkbook, readConfig } from '../src/config';
import * as XLSX from 'xlsx';
const fresh=()=>new GameModel(structuredClone(defaultConfig));
function finish(m:GameModel){for(let i=0;i<24000&&!['between','won','lost'].includes(m.phase);i++)m.update(1/60);}

test('deployment is atomic, unique, and rejects occupied or invalid slots',()=>{
  const m=fresh();m.select('ac');assert.equal(m.deploy(-1),false);assert.equal(m.energy,500);
  assert.equal(m.deploy(2),true);assert.equal(m.energy,410);assert.equal(m.deploy(2),false);
  m.select('car');assert.equal(m.deploy(2),false);assert.equal(m.energy,410);assert.equal(m.towers.length,1);
  m.select('ac');assert.equal(m.towers.length,1);
});
test('insufficient energy never creates a tower or deducts funds',()=>{
  const m=fresh();m.energy=1;m.select('vine');assert.equal(m.deploy(0),false);assert.equal(m.energy,1);assert.equal(m.towers.length,0);
});
test('selection cancels and deploying during a wave works',()=>{
  const m=fresh();m.select('ac');m.cancel();assert.equal(m.selected,null);m.startWave();m.select('car');assert.ok(m.deploy(3));
});
test('five full waves are winnable with persistent towers and final Boss',()=>{
  const m=fresh();towerIds.forEach((id,i)=>{m.select(id);assert.ok(m.deploy([2,3,4,5,6][i]));});
  assert.equal(m.energy,0);
  for(let wave=1;wave<=5;wave++){assert.ok(m.startWave());assert.equal(m.startWave(),false);finish(m);assert.notEqual(m.phase,'lost',`lost on wave ${wave}, hp=${m.hp}`);assert.equal(m.towers.length,5);assert.equal(m.cleared,wave);}
  assert.equal(m.phase,'won');assert.equal(m.startWave(),false);console.log('default run:',{hp:m.hp,defeated:m.defeated,leaked:m.leaked});
});
test('undefended enemies damage shared HP once and defeat stops simulation',()=>{
  const m=fresh();m.startWave();finish(m);assert.equal(m.hp,52);assert.equal(m.leaked,4);m.startWave();finish(m);assert.equal(m.phase,'lost');assert.equal(m.hp,0);const old=m.leaked;m.update(10);assert.equal(m.leaked,old);
});
test('delayed spawns cannot end a wave early; pause freezes time',()=>{
  const m=fresh();m.config.waves[0].delay=3;m.startWave();m.update(.25);assert.equal(m.phase,'fighting');assert.equal(m.enemies.length,0);m.paused=true;const time=m.elapsed;m.update(.25);assert.equal(m.elapsed,time);
});
test('path terminates exactly and imported speed uses design units',()=>{
  assert.deepEqual(pointAt(pathLength),{x:270,y:760});const m=fresh();m.startWave();m.update(.1);assert.ok(Math.abs(m.enemies[0].distance-5.75)<.001);
});
test('Excel round trip preserves all config and changed numbers drive session',()=>{
  const c=structuredClone(defaultConfig);c.global.hp=222;c.global.energy=50;c.towers[0].damage=99;c.enemies[0].hp=100;
  const bytes=XLSX.write(makeWorkbook(c),{type:'array',bookType:'xlsx'});const imported=readConfig(bytes);assert.deepEqual(imported,c);const m=new GameModel(imported);assert.equal(m.hp,222);m.select('ac');assert.equal(m.deploy(0),false);
});
test('Excel errors include sheet and row, reject missing waves and references',()=>{
  const wb=makeWorkbook();wb.Sheets['狗仔'].C2.v=-5;wb.Sheets['波次'].B2.v='unknown';wb.Sheets['波次'].A11.v=4;
  assert.throws(()=>parseWorkbook(wb),/「狗仔」第 2 行/);try{parseWorkbook(wb);}catch(e){assert.match(String(e),/敌人ID unknown/);assert.match(String(e),/缺少第 5 波/);}
});
test('Excel rejects blank, infinity, duplicate IDs, fractional count, missing sheets and malformed input',()=>{
  for(const mutate of [(w:any)=>{w.Sheets['全局'].A2.v='';},(w:any)=>{w.Sheets['防御物'].E2.v=Infinity;},(w:any)=>{w.Sheets['防御物'].A3.v='ac';},(w:any)=>{w.Sheets['波次'].C2.v=1.5;},(w:any)=>{delete w.Sheets['Boss'];}]){const w=makeWorkbook();mutate(w);assert.throws(()=>parseWorkbook(w));}
  assert.throws(()=>readConfig(new TextEncoder().encode('garbage').buffer));
});
