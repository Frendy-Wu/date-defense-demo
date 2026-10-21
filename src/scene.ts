import Phaser from 'phaser';
import { GameModel, slots, sources } from './model';
import { couplePosition, vineHotspot } from './layout';
import { towerIds, type TowerId } from './config';
import {art, towerArt, enemyArt, animationFrame} from './art';

export class StreetScene extends Phaser.Scene {
  private objects=new Map<TowerId,Phaser.GameObjects.Sprite>();
  private people=new Map<number,Phaser.GameObjects.Sprite>();
  private ink!:Phaser.GameObjects.Graphics;
  private effects!:Phaser.GameObjects.Graphics;
  private couple!:Phaser.GameObjects.Sprite;
  private ghost!:Phaser.GameObjects.Sprite;
  private arm!:Phaser.GameObjects.Image;
  private gallerySprite!:Phaser.GameObjects.Sprite;
  private galleryShade!:Phaser.GameObjects.Rectangle;
  private galleryKey:string|null=null;
  private galleryTime=0;
  private wasPaused=false;
  private hoveredSlot=-1;
  private hoveredItem:TowerId|null=null;
  private failed:string[]=[];
  private marked=new Set<TowerId>();
  ready=false;
  get previewing(){return this.galleryKey!==null;}
  constructor(public model:GameModel,private onFrame:()=>void){super('street');}
  preload(){
    this.load.image('street','/assets/art/scene-clean.png');
    for(const [key,a]of Object.entries(art.images))this.load.image(key,a.url);
    for(const [key,a]of Object.entries(art.animations))this.load.spritesheet(`anim:${key}`,a.url,{frameWidth:a.frameWidth,frameHeight:a.frameHeight,endFrame:a.frameCount-1});
    for(const a of this.model.config.assets)this.load.image(`custom:${a.id}`,a.path);
    const bar=this.add.graphics();
    const text=this.add.text(270,450,'正在布置约会街景…',{fontFamily:'Microsoft YaHei',fontSize:'20px',color:'#faf4e8'}).setOrigin(.5);
    this.cameras.main.setBackgroundColor('#493c2f');
    this.load.on('progress',(v:number)=>{bar.clear().fillStyle(0xf1d7a8,.2).fillRoundedRect(100,485,340,6,3).fillStyle(0xf1d7a8).fillRoundedRect(100,485,340*v,6,3);});
    this.load.on('loaderror',(file:{key:string})=>this.failed.push(file.key));
    this.load.once('complete',()=>{bar.destroy();text.destroy();});
  }
  create(){
    this.add.image(270,480,this.textures.exists('custom:background')?'custom:background':'street').setDisplaySize(540,960);
    this.ink=this.add.graphics().setDepth(1);
    this.effects=this.add.graphics().setDepth(2000);
    this.ghost=this.add.sprite(0,0,'ac_idle').setAlpha(.45).setDepth(1999).setVisible(false);
    this.couple=this.add.sprite(couplePosition.x,couplePosition.y,'couple_idle').setDepth(couplePosition.y);
    this.arm=this.add.image(0,0,'parking_arm').setVisible(false);
    for(const id of towerIds)this.objects.set(id,this.add.sprite(0,0,towerArt[id].idle));
    this.galleryShade=this.add.rectangle(270,480,540,760,0xebe3d6,.97).setDepth(10000).setVisible(false);
    this.gallerySprite=this.add.sprite(270,680,'ac_idle').setDepth(10001).setVisible(false);
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>this.hover(p));
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(p.button!==0||this.galleryKey)return;
      const slot=this.slotAt(p.x,p.y);
      if(slot>=0&&this.model.selected){this.model.deploy(slot);return;}
      const id=this.itemAt(p.x,p.y);if(id){this.model.select(id);return;}this.model.cancel();
    });
    this.input.keyboard?.on('keydown-ESC',()=>{if(this.galleryKey)this.previewAsset(null);else this.model.cancel();});
    const leave=()=>{this.hoveredSlot=-1;this.hoveredItem=null;};
    this.game.canvas.addEventListener('pointerleave',leave);
    this.events.once('shutdown',()=>this.game.canvas.removeEventListener('pointerleave',leave));
    this.ready=true;
    if(this.failed.length)this.model.message=`部分素材未载入：${this.failed.join('、')}，请刷新或检查资源路径`;
    this.onFrame();
  }
  /** Gallery validates art separately; registering an animation does not implement its mechanic. */
  previewAsset(key:string|null){
    if(!this.ready)return;
    if(key&&!this.galleryKey){this.wasPaused=this.model.paused;this.model.paused=true;}
    if(!key&&this.galleryKey)this.model.paused=this.wasPaused;
    this.galleryKey=key;this.galleryTime=0;
    this.galleryShade.setVisible(!!key);this.gallerySprite.setVisible(!!key);
    this.onFrame();
  }
  private slotAt(x:number,y:number){return slots.findIndex(s=>Math.abs(s.x-x)<31&&Math.abs(s.y-y)<27);}
  private itemAt(x:number,y:number):TowerId|undefined{
    return towerIds.find(id=>{
      if(this.model.towers.some(t=>t.id===id))return false;
      if(id==='vine')return Math.abs(x-vineHotspot.x)<vineHotspot.width/2&&Math.abs(y-vineHotspot.y)<vineHotspot.height/2;
      const obj=this.objects.get(id)!;const b=obj.getBounds();
      if(!b.contains(x,y))return false;
      const localX=(x-b.x)/b.width*obj.frame.realWidth,localY=(y-b.y)/b.height*obj.frame.realHeight;
      return (this.textures.getPixelAlpha(Math.floor(localX),Math.floor(localY),obj.texture.key,obj.frame.name)??0)>30;
    });
  }
  private hover(p:Phaser.Input.Pointer){
    if(this.galleryKey)return;
    this.hoveredItem=this.itemAt(p.x,p.y)??null;this.hoveredSlot=this.slotAt(p.x,p.y);
    this.input.setDefaultCursor(this.hoveredItem||(this.model.selected&&this.hoveredSlot>=0)?'pointer':'default');
  }
  private drawSprite(obj:Phaser.GameObjects.Sprite,key:string,x:number,y:number,size:number,byHeight=false,seconds=0,loop?:boolean){
    const animation=art.animations[key], image=art.images[key];
    const texture=animation?`anim:${key}`:key;
    if(!this.textures.exists(texture)){obj.setVisible(false);return;}
    obj.setVisible(true).setTexture(texture,animation?animationFrame(animation,seconds,loop):undefined);
    if(key.startsWith('custom:')){
      const a=this.model.config.assets.find(a=>`custom:${a.id}`===key)!;
      obj.setOrigin(a.anchorX,a.anchorY).setDisplaySize(a.width/2,a.height/2).setPosition(x,y).setDepth(y);return;
    }
    const width=animation?.frameWidth??image?.width??obj.width,height=animation?.frameHeight??image?.height??obj.height;
    const b=animation?.bounds??image?.bounds??[0,0,width,height];
    obj.setOrigin((b[0]+b[2])/2/width,b[3]/height).setScale(size/(byHeight?b[3]-b[1]:b[2]-b[0])).setPosition(x,y).setDepth(y);
  }
  private outline(obj:Phaser.GameObjects.Sprite){
    if(this.game.renderer.type===Phaser.WEBGL)obj.postFX.addGlow(0xffefb0,3,0,false,.08,12);
  }
  update(_time:number,delta:number){
    if(!this.ready)return;
    const m=this.model;m.update(delta/1000);
    const g=this.ink;g.clear();this.effects.clear();this.ghost.setVisible(false);
    for(const [i,p]of slots.entries())if(m.selected&&!this.galleryKey){
      const used=m.towers.some(t=>t.slot===i);
      g.lineStyle(2,used?0x9c6f55:0xfff0b3,.85).fillStyle(used?0x6a5540:0xffe7a1,.22).fillRoundedRect(p.x-30,p.y-24,60,48,7).strokeRoundedRect(p.x-30,p.y-24,60,48,7);
    }
    if(m.selected&&this.hoveredSlot>=0&&!m.towers.some(t=>t.slot===this.hoveredSlot)&&!this.galleryKey){
      const p=slots[this.hoveredSlot],t=m.config.towers.find(t=>t.id===m.selected)!;
      g.lineStyle(1,0xffefb8,.6).fillStyle(0xffe8ab,.08).fillCircle(p.x,p.y,t.range/2).strokeCircle(p.x,p.y,t.range/2);
      this.drawSprite(this.ghost,towerArt[m.selected].active,p.x,p.y,towerArt[m.selected].width);this.ghost.setDepth(1999);
    }
    this.arm.setVisible(false);
    towerIds.forEach((id,i)=>{
      const obj=this.objects.get(id)!,tower=m.towers.find(t=>t.id===id),p=tower?slots[tower.slot]:sources[i],spec=towerArt[id];
      const recent=tower?m.clock-tower.lastAttack:100;
      const animation=spec.attack&&recent<.85;
      let key=tower?(tower.broken?'parking_broken':animation?spec.attack!:spec.active):spec.idle;
      const custom=`custom:${id}`;if(this.textures.exists(custom))key=custom;
      this.drawSprite(obj,key,p.x,p.y,spec.width,false,recent,true);
      if(id==='vine'&&!tower)obj.setVisible(false);
      const highlight=!tower&&(m.selected===id||this.hoveredItem===id);
      if(highlight&&!this.marked.has(id)){this.outline(obj);this.marked.add(id);}
      if(!highlight&&this.marked.has(id)){obj.postFX?.clear();this.marked.delete(id);}
      if(highlight&&id==='vine'){
        g.lineStyle(2,0xfff1ae,.95).beginPath().moveTo(74,335).lineTo(119,343).lineTo(138,371).lineTo(130,399).lineTo(119,443).lineTo(78,450).lineTo(59,413).lineTo(55,372).closePath().strokePath();
      }
      if(highlight)obj.setScale(obj.scaleX*1.04);
      obj.setAlpha(tower&&tower.readyIn>0?1-tower.readyIn:1);
      if(id==='parking'&&tower&&!tower.broken){
        const direction=p.x<300?1:-1;
        const a=art.images.parking_arm,b=a.bounds,tip=300+direction*25;
        this.arm.setVisible(true).setOrigin(.5,(b[1]+b[3])/2/a.height).setScale(Math.abs(p.x-tip)/(b[2]-b[0])).setFlipX(direction===-1).setPosition((p.x+tip)/2,p.y-35).setDepth(p.y+1);
      }
    });
    let coupleKey=m.phase==='won'?'couple_victory':m.phase==='lost'?'couple_defeat':m.clock-m.lastHit<.7?'couple_hit':m.phase==='fighting'?`couple_panic_${m.wave}`:m.wave>0&&m.wave<5?`couple_relief_${m.wave}`:'couple_idle';
    if(this.textures.exists('custom:couple'))coupleKey='custom:couple';
    this.drawSprite(this.couple,coupleKey,couplePosition.x,couplePosition.y,165,true);
    const live=new Set(m.enemies.map(e=>e.uid));for(const [id,obj]of this.people)if(!live.has(id)){obj.destroy();this.people.delete(id);}
    for(const e of m.enemies){
      let obj=this.people.get(e.uid);if(!obj){obj=this.add.sprite(e.x,e.y,enemyArt[e.config.id]);this.people.set(e.uid,obj);}
      const gate=m.towers.find(t=>t.id==='parking'&&t.breakingAt>=0&&!t.broken);
      const key=this.textures.exists(`custom:${e.config.id}`)?`custom:${e.config.id}`:e.config.id==='boss'&&gate?'boss_punch':enemyArt[e.config.id];
      const time=key==='boss_punch'?m.clock-gate!.breakingAt:m.clock+e.uid*.21;
      const height=e.config.id==='boss'?123:78;
      this.drawSprite(obj,key,e.x,e.y,height,true,time,key!=='boss_punch');
      if(e.config.id!=='boss')this.effects.fillStyle(0x402a1f,.7).fillRoundedRect(e.x-17,e.y-height-10,34,4,2).fillStyle(0xb7dc79).fillRoundedRect(e.x-17,e.y-height-10,34*Math.max(0,e.hp/e.config.hp),4,2);
    }
    for(const s of m.shots){
      const color=s.tower==='car'?0xfff1a0:s.tower==='vine'?0x7cae46:0xd0efff;
      this.effects.lineStyle(s.tower==='car'?6:2,color,s.life/.2*.7).lineBetween(s.x,s.y-35,s.tx,s.ty-35);
    }
    if(this.galleryKey){
      this.galleryTime+=delta/1000;
      this.drawSprite(this.gallerySprite,this.galleryKey,270,720,330,true,this.galleryTime);
      this.gallerySprite.setDepth(10001);
    }
    this.onFrame();
  }
}
