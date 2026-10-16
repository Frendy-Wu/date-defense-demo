import { type Config, type EnemyConfig, type TowerId } from './config';
export const path = [{x:270,y:105},{x:270,y:240},{x:310,y:345},{x:235,y:490},{x:270,y:620},{x:270,y:760}];
export const slots = [{x:166,y:210},{x:378,y:230},{x:177,y:355},{x:408,y:375},{x:137,y:500},{x:347,y:525},{x:166,y:650},{x:378,y:670}];
export const sources = [{x:55,y:260},{x:485,y:320},{x:55,y:420},{x:485,y:520},{x:55,y:600}];
export const pathLength = path.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-path[i].x,p.y-path[i].y),0);
export function pointAt(distance:number) {
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(distance<=len){const t=Math.max(0,distance)/len;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}distance-=len;}
  return {...path[path.length-1]};
}
export type Phase = 'ready'|'fighting'|'clearing'|'between'|'won'|'lost';
export interface Enemy { uid:number; config:EnemyConfig; hp:number; distance:number; x:number; y:number }
export interface Tower { id:TowerId; slot:number; cooldown:number; readyIn:number }
export interface Shot {x:number;y:number;tx:number;ty:number;life:number}
export class GameModel {
  phase:Phase='ready'; wave=0; hp:number; energy:number; selected:TowerId|null=null;
  towers:Tower[]=[]; enemies:Enemy[]=[]; shots:Shot[]=[]; elapsed=0; cleared=0; defeated=0; leaked=0;
  message='点击街边物品，选择位置部署'; paused=false; speed=1;
  private queue:{time:number;id:string}[]=[]; private uid=0; private feedback=0;
  constructor(public config:Config){this.hp=config.global.hp;this.energy=config.global.energy;}
  get terminal(){return this.phase==='won'||this.phase==='lost';}
  select(id:TowerId){if(this.terminal||this.paused)return;if(this.towers.some(t=>t.id===id)){this.message='每种物品只能部署一次';return;}this.selected=this.selected===id?null:id;this.message=this.selected?'选择亮起的部署位 · Esc 取消':'点击街边物品，选择位置部署';}
  cancel(){this.selected=null;}
  deploy(slot:number):boolean{
    if(this.terminal||this.paused||!this.selected)return false;
    if(!slots[slot]||this.towers.some(t=>t.slot===slot)){this.message='此位置不可部署，不扣除能量';return false;}
    const t=this.config.towers.find(t=>t.id===this.selected)!;
    if(this.energy<t.cost){this.message=`能量不足：需要 ${t.cost}，当前 ${this.energy}`;return false;}
    if(this.towers.some(t=>t.id===this.selected))return false;
    this.energy-=t.cost;this.towers.push({id:t.id,slot,cooldown:0,readyIn:.4});this.selected=null;this.message=`${t.name}已部署 · −${t.cost} 能量`;return true;
  }
  startWave(){
    if(this.paused||!['ready','between'].includes(this.phase)||this.wave>=5)return false;
    this.wave++;this.elapsed=0;this.queue=[];
    for(const g of this.config.waves.filter(w=>w.wave===this.wave))for(let i=0;i<g.count;i++)this.queue.push({time:g.delay+i*g.interval,id:g.enemy});
    this.queue.sort((a,b)=>a.time-b.time);this.phase='fighting';this.message=`第 ${this.wave} 波来袭 · 战斗中也可以部署`;return true;
  }
  get remaining(){return this.queue.length+this.enemies.length;}
  update(realDt:number){
    if(this.paused||this.terminal)return;
    // Fixed-size substeps prevent tunnelling and missed shots at 2x speed.
    let remaining=Math.max(0,Math.min(realDt,.25))*this.speed;
    while(remaining>1e-8){const dt=Math.min(remaining,1/60);this.step(dt);remaining-=dt;if(this.terminal)break;}
  }
  private step(dt:number){
    this.shots=this.shots.filter(s=>(s.life-=dt)>0);
    this.towers.forEach(t=>{t.readyIn=Math.max(0,t.readyIn-dt);t.cooldown=Math.max(0,t.cooldown-dt);});
    if(this.phase==='clearing'){this.feedback-=dt;if(this.feedback<=0){this.cleared=this.wave;this.phase=this.wave===5?'won':'between';this.message=this.wave===5?'约会守住了！':'清场完成，可以部署或开始下一波';}return;}
    if(this.phase!=='fighting')return;
    this.elapsed+=dt;
    while(this.queue.length&&this.queue[0].time<=this.elapsed){const next=this.queue.shift()!;const config=this.config.enemies.find(e=>e.id===next.id)!;this.enemies.push({uid:++this.uid,config,hp:config.hp,distance:0,...pointAt(0)});}
    for(const e of this.enemies){e.distance+=e.config.speed/2*dt;Object.assign(e,pointAt(e.distance));}
    // Stage 1 shared baseline attack; stage 2 will replace this with dedicated behaviors.
    for(const tower of this.towers){
      if(tower.readyIn>0||tower.cooldown>0)continue;
      const cfg=this.config.towers.find(t=>t.id===tower.id)!, p=slots[tower.slot];
      const targets=this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<=cfg.range/2).sort((a,b)=>b.distance-a.distance).slice(0,cfg.targets);
      if(targets.length){tower.cooldown=cfg.interval;for(const e of targets){e.hp-=cfg.damage;this.shots.push({x:p.x,y:p.y,tx:e.x,ty:e.y,life:.13});}}
    }
    this.enemies=this.enemies.filter(e=>{if(e.hp<=0){this.defeated++;return false;}if(e.distance>=pathLength){this.hp=Math.max(0,this.hp-e.config.damage);this.leaked++;this.message=`被偷拍！共同血量 −${e.config.damage}`;return false;}return true;});
    if(this.hp<=0){this.phase='lost';this.selected=null;this.message='约会被打扰了，试试调整部署位置';return;}
    if(!this.queue.length&&!this.enemies.length){this.phase='clearing';this.feedback=this.config.global.feedback;this.message=`第 ${this.wave} 波已守住`;}
  }
}
