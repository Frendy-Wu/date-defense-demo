import raw from './art-manifest.json';
export interface TextureInfo {url:string; width:number; height:number; bounds:number[]}
export interface AnimationInfo {url:string; frameWidth:number; frameHeight:number; frameCount:number; frameRate:number; repeat:number; bounds:number[]; events:{frame:number;name:string}[]}
export const art=raw as {images:Record<string,TextureInfo>;animations:Record<string,AnimationInfo>};
export const towerArt={
  ac:{idle:'ac_idle',active:'ac_active',attack:'ac_attack',width:85},
  car:{idle:'car_idle',active:'car_active',attack:'car_attack',width:112},
  awning:{idle:'awning_idle',active:'awning_active',attack:null,width:105},
  parking:{idle:'parking_idle',active:'parking_active_base',attack:null,width:45},
  vine:{idle:'vine_idle',active:'bean_closed',attack:null,width:76},
};
export const enemyArt={basic:'pap_basic_walk',telephoto:'pap_telephoto_walk',pro:'pap_pro_walk',boss:'boss_walk'};
/** Absolute animation time makes pause and 2× apply to art and simulation together. */
export function animationFrame(info:AnimationInfo,seconds:number,loop=info.repeat===-1){
  const n=Math.floor(Math.max(0,seconds)*info.frameRate);
  return loop?n%info.frameCount:Math.min(n,info.frameCount-1);
}
