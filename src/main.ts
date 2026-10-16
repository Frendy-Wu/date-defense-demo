import Phaser from 'phaser';
import * as XLSX from 'xlsx';
import { defaultConfig, makeWorkbook, readConfig, type Config } from './config';
import { GameModel } from './model';
import { StreetScene } from './scene';
import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<aside class="intro"><div class="eyebrow">A LITTLE STREET, A LITTLE MAGIC</div><h1>约会<br>保卫战<span>DATE DEFENDERS</span></h1><p>让街边的小物件，<br>守住两个人的约会。</p><div class="rule"><b>01</b><span>选择街边物品</span></div><div class="rule"><b>02</b><span>点击亮起的部署位</span></div><div class="rule"><b>03</b><span>守住全部五波狗仔</span></div><div class="stage">阶段 01 · 可玩框架<br><small>占位美术 / 统一基础攻击<br>专属机制与 Boss 演出待第二阶段接入</small></div></aside>
<main id="frame" aria-label="约会保卫战游戏"><div id="canvas"></div>
<header class="hud"><div><small>DATE DEFENDERS</small><strong id="wave">准备约会</strong></div><div class="energy"><small>部署能量</small><strong>ϟ <span id="energy">500</span></strong></div></header>
<div class="wave-dots" aria-label="五波进度">${[1,2,3,4,5].map(i=>`<i data-wave="${i}">${i}</i>`).join('')}</div>
<div class="health"><div><span>♥ 情侣共同血量</span><span id="hp"></span></div><progress id="health" max="100" value="100"></progress></div>
<footer><div id="hint" role="status"></div><div class="controls"><button id="next" class="primary">开始第 1 波</button><button id="pause" title="暂停游戏">暂停</button><button id="speed" title="切换游戏速度">1×</button></div></footer>
<div id="result" class="cover" hidden><div class="result-card"><small>DATE DEFENDERS</small><h2 id="result-title"></h2><p id="result-copy"></p><button id="again" class="primary">重新开始</button></div></div></main>
<aside class="tools"><details><summary>配表与调试 <span>＋</span></summary><p>导入 .xlsx 后先校验，点击“应用并重新开始”生效。</p><a href="/data/约会保卫战配置.xlsx" download>下载默认 Excel 模板 ↗</a><button id="export">导出当前配表</button><label class="file">选择 Excel 文件<input id="import" type="file" accept=".xlsx"></label><pre id="import-status" role="status">正在使用内置默认配置</pre><button id="apply" disabled>应用并重新开始</button><button id="reset-config">恢复默认并重开</button><p class="note">特殊效果与 Boss 参数为第二阶段预留，当前不参与战斗。射程、速度按 1080 × 1920 设计坐标填写。</p></details><button id="restart" class="text-button">↻ 重新开始本局</button><p class="key-hint">Esc 取消选择 · 点击空白取消<br>每种物品仅一次 · 部署跨波保留</p></aside>`;

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let config:Config=structuredClone(defaultConfig), pending:Config|null=null;
let model=new GameModel(config), game:Phaser.Game;let scene:StreetScene;let restarting=false;
function boot(){
  scene=new StreetScene(model,renderHUD);
  game=new Phaser.Game({type:Phaser.AUTO,parent:'canvas',width:540,height:960,backgroundColor:'#e7dfcf',scene:[scene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true},banner:false});
  restarting=false;renderHUD();
}
function restart(next=config){if(restarting)return;restarting=true;config=structuredClone(next);model=new GameModel(config);game.destroy(true);setTimeout(boot,0);}
let last='';
function renderHUD(){
  const signature=JSON.stringify([model.wave,model.phase,model.hp,model.energy,model.message,model.remaining,model.paused,model.speed]);if(signature===last)return;last=signature;
  el('wave').textContent=model.wave?`第 ${model.wave} / 5 波`:'准备约会';el('energy').textContent=String(model.energy);
  el('hp').textContent=`${model.hp} / ${config.global.hp}`;el<HTMLProgressElement>('health').max=config.global.hp;el<HTMLProgressElement>('health').value=model.hp;
  el('hint').textContent=model.paused?'已暂停 · 点击继续恢复':model.message;
  const next=el<HTMLButtonElement>('next');next.disabled=!['ready','between'].includes(model.phase)||model.paused;
  next.textContent=model.phase==='fighting'?`来袭中 · 剩余 ${model.remaining}`:model.phase==='clearing'?'清场中…':model.terminal?'本局结束':`开始第 ${model.wave+1} 波`;
  el('pause').textContent=model.paused?'继续':'暂停';el<HTMLButtonElement>('pause').disabled=model.terminal;
  el('speed').textContent=`${model.speed}×`;
  document.querySelectorAll<HTMLElement>('[data-wave]').forEach(dot=>{const n=Number(dot.dataset.wave);dot.classList.toggle('done',n<=model.cleared);dot.classList.toggle('active',n===model.wave);});
  el('result').hidden=!model.terminal;
  if(model.terminal){el('result-title').textContent=model.phase==='won'?'约会守住了！':'约会被打扰了';el('result-copy').textContent=`守住 ${model.cleared} / 5 波 · 阻止 ${model.defeated} 次偷拍\n剩余血量 ${model.hp} · 漏过 ${model.leaked} 名狗仔`;}
}
el('next').onclick=()=>{model.startWave();renderHUD();};el('pause').onclick=()=>{model.paused=!model.paused;renderHUD();};el('speed').onclick=()=>{model.speed=model.speed===1?2:1;renderHUD();};
el('restart').onclick=()=>restart();el('again').onclick=()=>restart();
el('export').onclick=()=>XLSX.writeFile(makeWorkbook(config),'约会保卫战-当前配置.xlsx');
el<HTMLInputElement>('import').onchange=async(event)=>{
  const file=(event.target as HTMLInputElement).files?.[0];pending=null;el<HTMLButtonElement>('apply').disabled=true;if(!file)return;
  try{if(!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('请选择 .xlsx 工作簿');pending=readConfig(await file.arrayBuffer());el('import-status').textContent=`校验通过：${file.name}\n5 波 / 5 种物品 / 初始血量 ${pending.global.hp}\n待应用；当前对局尚未改变`;el<HTMLButtonElement>('apply').disabled=false;}
  catch(error){el('import-status').textContent=`导入失败，当前配置未改变\n${error instanceof Error?error.message:String(error)}`;}
  (event.target as HTMLInputElement).value='';
};
el('apply').onclick=()=>{if(pending){restart(pending);pending=null;el<HTMLButtonElement>('apply').disabled=true;el('import-status').textContent='导入配置已应用，开始新一局';}};
el('reset-config').onclick=()=>{pending=null;el<HTMLButtonElement>('apply').disabled=true;restart(defaultConfig);el('import-status').textContent='已恢复默认配置';};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!model.terminal){model.paused=true;renderHUD();}});
boot();
// Read-only snapshots for reproducible browser QA. No gameplay shortcuts in production.
if(import.meta.env.DEV)Object.defineProperty(window,'__gameSnapshot',{get:()=>({phase:model.phase,wave:model.wave,hp:model.hp,energy:model.energy,selected:model.selected,towers:structuredClone(model.towers),enemies:model.enemies.length,remaining:model.remaining,paused:model.paused})});
