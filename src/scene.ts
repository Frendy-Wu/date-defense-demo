import Phaser from 'phaser';
import { GameModel, slots, sources, path } from './model';
import { towerIds, type TowerId } from './config';

const colors:Record<string,number>={ac:0x6d9aaa,car:0xd99b55,awning:0xb86e65,parking:0x568ba1,vine:0x76986a};
export class StreetScene extends Phaser.Scene {
  model:GameModel; private ink!:Phaser.GameObjects.Graphics; private foreground!:Phaser.GameObjects.Graphics; private preview!:Phaser.GameObjects.Graphics;
  private objects=new Map<string,Phaser.GameObjects.Container>(); private people=new Map<number,Phaser.GameObjects.Container>();
  private slotLabels:Phaser.GameObjects.Text[]=[]; private hoveredSlot=-1; private hoveredItem:string|null=null;
  constructor(model:GameModel,private onFrame:()=>void){super('street');this.model=model;}
  preload(){for(const a of this.model.config.assets)this.load.image(a.id,a.path);}
  create(){
    this.cameras.main.setBackgroundColor('#e7dfcf');
    const g=this.add.graphics();
    g.fillStyle(0xd4c9b5).fillRect(0,100,540,680);
    for(let y=115;y<780;y+=36)for(let x=0;x<540;x+=36)g.lineStyle(1,0xbfb8a7,.38).strokeRect(x,y,36,36);
    g.fillStyle(0xece5d7).fillRoundedRect(12,122,100,590,16).fillRoundedRect(435,122,93,590,16);
    g.lineStyle(76,0xb3ad9f,1).beginPath().moveTo(path[0].x,path[0].y);for(const p of path.slice(1))g.lineTo(p.x,p.y);g.strokePath();
    g.lineStyle(65,0xc9c3b6,1).beginPath().moveTo(path[0].x,path[0].y);for(const p of path.slice(1))g.lineTo(p.x,p.y);g.strokePath();
    for(let y=125;y<755;y+=44){const x=y<260?270:y<360?295:y<520?253:270;g.fillStyle(0xf3eee2,.75).fillRoundedRect(x-2,y,4,17,2);}
    if(this.textures.exists('background'))this.add.image(270,480,'background').setDisplaySize(540,960);
    this.label(60,155,'WEST\nSIDE',15,'#9d8b70');this.label(483,165,'CAFÉ\nAMOUR',14,'#9d8b70');
    this.label(270,119,'↓  狗仔入口',13,'#746e62');
    g.fillStyle(0xb3bea0).fillRoundedRect(17,735,101,30,8).fillRoundedRect(422,735,101,30,8);
    for(const x of [35,65,95,440,470,500])g.fillStyle(0x879575).fillCircle(x,745,14);
    g.fillStyle(0xf3eadc).fillRoundedRect(120,779,300,103,30);
    g.fillStyle(0xc5ac8f).fillEllipse(270,851,130,23);
    if(this.textures.exists('couple')){const a=this.model.config.assets.find(a=>a.id==='couple')!;this.add.image(270,826,'couple').setDisplaySize(a.width/2,a.height/2).setOrigin(a.anchorX,a.anchorY);}else{
      this.drawPerson(g,241,820,0xc3837e,false);this.drawPerson(g,297,820,0x678792,false);this.label(270,801,'♥',19,'#b65e65');
    }
    this.label(270,870,'守住这一刻',12,'#8c7969');
    this.ink=this.add.graphics();this.preview=this.add.graphics().setAlpha(.45).setVisible(false);
    slots.forEach((p,i)=>{this.slotLabels.push(this.label(p.x,p.y,String(i+1).padStart(2,'0'),12,'#668575').setVisible(false));});
    towerIds.forEach((id,i)=>{
      const p=sources[i],container=this.add.container(p.x,p.y);const icon=this.add.graphics();this.drawItem(icon,id);container.add(icon);
      if(this.textures.exists(id)){const a=this.model.config.assets.find(a=>a.id===id)!;icon.setVisible(false);container.add(this.add.image(0,0,id).setDisplaySize(a.width/2,a.height/2).setOrigin(a.anchorX,a.anchorY));}
      const t=this.model.config.towers.find(t=>t.id===id)!;
      container.add(this.label(0,39,t.name,12,'#514d45'));container.add(this.label(0,56,`${t.cost} 能量`,10,'#887d6b'));
      this.objects.set(id,container);
    });
    this.foreground=this.add.graphics();
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>this.hover(p));
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(p.button!==0)return;
      const slot=slots.findIndex(s=>Math.abs(s.x-p.x)<29&&Math.abs(s.y-p.y)<29);
      if(slot>=0&&this.model.selected){this.model.deploy(slot);return;}
      const id=this.itemAt(p.x,p.y);if(id){this.model.select(id);return;}this.model.cancel();
    });
    this.input.keyboard?.on('keydown-ESC',()=>this.model.cancel());
    this.game.canvas.addEventListener('pointerleave',()=>{this.hoveredSlot=-1;this.hoveredItem=null;});
  }
  private label(x:number,y:number,text:string,size:number,color:string){return this.add.text(x,y,text,{fontFamily:'"Microsoft YaHei", sans-serif',fontSize:`${size}px`,color,align:'center',lineSpacing:5}).setOrigin(.5);}
  private itemAt(x:number,y:number):TowerId|undefined{return towerIds.find((id,i)=>!this.model.towers.some(t=>t.id===id)&&Math.abs(sources[i].x-x)<40&&Math.abs(sources[i].y-y)<45);}
  private hover(p:Phaser.Input.Pointer){this.hoveredItem=this.itemAt(p.x,p.y)??null;this.hoveredSlot=slots.findIndex(s=>Math.abs(s.x-p.x)<29&&Math.abs(s.y-p.y)<29);this.input.setDefaultCursor(this.hoveredItem||(this.model.selected&&this.hoveredSlot>=0)?'pointer':'default');}
  private drawItem(g:Phaser.GameObjects.Graphics,id:string){
    g.fillStyle(0x655b4b,.12).fillEllipse(0,26,65,12);g.lineStyle(2,0x4b554f);
    if(id==='ac'){g.fillStyle(0xf7f4e9).fillRoundedRect(-30,-20,60,43,5).strokeRoundedRect(-30,-20,60,43,5);g.lineStyle(3,colors.ac).strokeCircle(-8,1,14);for(let a=0;a<4;a++){const t=a*Math.PI/2;g.lineBetween(-8,1,-8+Math.cos(t)*11,1+Math.sin(t)*11);}g.lineBetween(13,-8,23,-8).lineBetween(13,0,23,0).lineBetween(13,8,23,8);}
    if(id==='car'){g.fillStyle(0x424c4b).fillRoundedRect(-27,-17,11,42,4).fillRoundedRect(16,-17,11,42,4);g.fillStyle(colors.car).fillRoundedRect(-23,-33,46,65,11);g.fillStyle(0x537886).fillRoundedRect(-17,-17,34,21,5);g.fillStyle(0xf9e9b4).fillRect(-18,20,11,7).fillRect(7,20,11,7);}
    if(id==='awning'){g.fillStyle(0x8c7760).fillRect(-25,-4,4,33).fillRect(21,-4,4,33);g.fillStyle(0xf8e9ca).fillTriangle(-35,4,35,4,23,-26).fillTriangle(-35,4,-23,-26,23,-26);for(let x=-25;x<30;x+=18)g.fillStyle(colors.awning).fillRect(x,-18,9,23);g.fillStyle(colors.awning).fillRoundedRect(-36,3,72,9,3);}
    if(id==='parking'){g.fillStyle(0x808a83).fillRect(-3,-5,6,35).fillRoundedRect(-14,27,28,5,2);g.fillStyle(colors.parking).fillRoundedRect(-21,-32,42,37,5);g.lineStyle(4,0xffffff).beginPath().moveTo(-6,-1).lineTo(-6,-24).lineTo(8,-24).lineTo(10,-12).lineTo(-6,-12).strokePath();}
    if(id==='vine'){g.fillStyle(0xbb8b66).fillRoundedRect(-20,12,40,23,5);g.lineStyle(5,0x668a5b).beginPath().moveTo(0,16).lineTo(-5,-5).lineTo(3,-29).strokePath();for(const [x,y]of[[-15,-10],[14,-22],[15,1],[-13,-28]])g.fillStyle(colors.vine).fillEllipse(x,y,24,13);}
  }
  private drawPerson(g:Phaser.GameObjects.Graphics,x:number,y:number,color:number,camera:boolean){
    g.fillStyle(0x594d43,.16).fillEllipse(x,y+22,29,10);g.lineStyle(5,0x59605b).lineBetween(x-6,y+7,x-7,y+19).lineBetween(x+6,y+7,x+8,y+19);
    g.fillStyle(color).fillRoundedRect(x-13,y-11,26,25,7);g.fillStyle(0xe3b58c).fillCircle(x,y-22,11);g.fillStyle(0x54493f).fillEllipse(x,y-29,23,9);
    if(camera){g.fillStyle(0x35454b).fillRoundedRect(x-10,y-8,23,13,3);g.fillStyle(0x8fb4ba).fillCircle(x+3,y-2,5);}
  }
  update(_time:number,delta:number){
    this.model.update(delta/1000);const m=this.model,g=this.ink;g.clear();
    slots.forEach((p,i)=>{const occupied=m.towers.some(t=>t.slot===i),visible=!!m.selected;this.slotLabels[i].setVisible(visible&&!occupied);if(visible){g.lineStyle(2,occupied?0xa18f7e:0x4c8f79,occupied?.5:.9).fillStyle(occupied?0xb29e88:0x75ad91,.2).fillRoundedRect(p.x-29,p.y-29,58,58,7).strokeRoundedRect(p.x-29,p.y-29,58,58,7);}});
    this.preview.clear().setVisible(false);
    if(m.selected&&this.hoveredSlot>=0&&!m.towers.some(t=>t.slot===this.hoveredSlot)){
      const p=slots[this.hoveredSlot],t=m.config.towers.find(t=>t.id===m.selected)!;g.fillStyle(0x5a9f89,.1).fillCircle(p.x,p.y,t.range/2).lineStyle(1,0x52937b,.6).strokeCircle(p.x,p.y,t.range/2);this.preview.setVisible(true).setPosition(p.x,p.y);this.drawItem(this.preview,m.selected);
    }
    towerIds.forEach((id,i)=>{const obj=this.objects.get(id)!;const t=m.towers.find(t=>t.id===id),p=t?slots[t.slot]:sources[i];obj.setPosition(p.x,p.y);const target=m.selected===id||this.hoveredItem===id?1.08:1;obj.setScale(Phaser.Math.Linear(obj.scaleX,target,.18));if(t){g.lineStyle(2,0x5e977d,.7).strokeCircle(p.x,p.y,34);g.fillStyle(colors[id],.08).fillCircle(sources[i].x,sources[i].y,28);}if(m.selected===id)g.lineStyle(3,0x457c69).strokeRoundedRect(p.x-40,p.y-43,80,110,12);});
    const live=new Set(m.enemies.map(e=>e.uid));for(const [id,obj]of this.people)if(!live.has(id)){obj.destroy();this.people.delete(id);}
    for(const e of m.enemies){let obj=this.people.get(e.uid);if(!obj){obj=this.add.container(e.x,e.y);const a=m.config.assets.find(a=>a.id===e.config.id);if(a&&this.textures.exists(a.id))obj.add(this.add.image(0,0,a.id).setDisplaySize(a.width/2,a.height/2).setOrigin(a.anchorX,a.anchorY));else{const shape=this.add.graphics();this.drawPerson(shape,0,0,e.config.id==='boss'?0x81596d:e.config.id==='pro'?0x8b956d:0xa17c6d,true);obj.add(shape);if(e.config.id==='boss')obj.setScale(1.6);}this.people.set(e.uid,obj);}obj.setPosition(e.x,e.y);g.fillStyle(0x8a7c71).fillRoundedRect(e.x-18,e.y-44,36,5,2);g.fillStyle(0xb96f65).fillRoundedRect(e.x-18,e.y-44,36*Math.max(0,e.hp/e.config.hp),5,2);}
    this.foreground.clear();for(const s of m.shots)this.foreground.lineStyle(3,0xe9ad50,s.life/.13).lineBetween(s.x,s.y,s.tx,s.ty);
    this.onFrame();
  }
}
