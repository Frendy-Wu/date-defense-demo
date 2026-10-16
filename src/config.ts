import * as XLSX from 'xlsx';

export const towerIds = ['ac', 'car', 'awning', 'parking', 'vine'] as const;
export type TowerId = typeof towerIds[number];
export type EnemyId = 'basic' | 'telephoto' | 'pro' | 'boss';
export interface EnemyConfig { id: EnemyId; name: string; hp: number; speed: number; damage: number }
export interface TowerConfig { id: TowerId; name: string; cost: number; damage: number; interval: number; range: number; targets: number }
export interface WaveGroup { wave: number; enemy: EnemyId; count: number; delay: number; interval: number }
export interface AssetConfig { id: string; path: string; width: number; height: number; anchorX: number; anchorY: number }
export interface Config {
  global: { hp: number; energy: number; feedback: number };
  enemies: EnemyConfig[]; towers: TowerConfig[]; waves: WaveGroup[];
  effects: { burnDamage: number; burnDuration: number; capacity: number; digestTime: number; blockLimit: number };
  boss: { reduction: number; stageDuration: number }; assets: AssetConfig[];
}
export const defaultConfig: Config = {
  global: { hp: 100, energy: 500, feedback: 1.5 },
  enemies: [
    { id: 'basic', name: '普通狗仔', hp: 42, speed: 115, damage: 12 },
    { id: 'telephoto', name: '长焦狗仔', hp: 75, speed: 100, damage: 18 },
    { id: 'pro', name: '专业狗仔', hp: 110, speed: 85, damage: 25 },
    { id: 'boss', name: 'Boss 狗仔', hp: 620, speed: 50, damage: 100 },
  ],
  towers: [
    { id: 'ac', name: '空调外机', cost: 90, damage: 18, interval: .6, range: 280, targets: 1 },
    { id: 'car', name: '汽车', cost: 110, damage: 28, interval: .85, range: 300, targets: 1 },
    { id: 'awning', name: '雨棚', cost: 100, damage: 34, interval: 1.2, range: 270, targets: 1 },
    { id: 'parking', name: '停车牌', cost: 80, damage: 16, interval: .7, range: 260, targets: 1 },
    { id: 'vine', name: '藤蔓', cost: 120, damage: 38, interval: .95, range: 300, targets: 1 },
  ],
  waves: [
    { wave: 1, enemy: 'basic', count: 4, delay: 0, interval: 1.8 },
    { wave: 2, enemy: 'basic', count: 4, delay: 0, interval: 1.2 },
    { wave: 2, enemy: 'telephoto', count: 2, delay: 3, interval: 2 },
    { wave: 3, enemy: 'basic', count: 5, delay: 0, interval: .85 },
    { wave: 3, enemy: 'telephoto', count: 3, delay: 2, interval: 1.2 },
    { wave: 3, enemy: 'pro', count: 2, delay: 4, interval: 1.5 },
    { wave: 4, enemy: 'basic', count: 8, delay: 0, interval: .65 },
    { wave: 4, enemy: 'telephoto', count: 4, delay: 2, interval: .9 },
    { wave: 4, enemy: 'pro', count: 3, delay: 4, interval: 1.2 },
    { wave: 5, enemy: 'boss', count: 1, delay: 0, interval: 1 },
  ],
  effects: { burnDamage: 5, burnDuration: 3, capacity: 2, digestTime: 3, blockLimit: 6 },
  boss: { reduction: .9, stageDuration: 2 }, assets: [],
};

export function makeWorkbook(c: Config = defaultConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('全局', [['情侣血量','初始能量','波间反馈秒'], [c.global.hp,c.global.energy,c.global.feedback]]);
  add('狗仔', [['ID','名称','血量','移动速度','突破伤害'], ...c.enemies.map(e=>[e.id,e.name,e.hp,e.speed,e.damage])]);
  add('防御物', [['ID','名称','部署能量','攻击力','攻击间隔秒','射程','目标数量'], ...c.towers.map(t=>[t.id,t.name,t.cost,t.damage,t.interval,t.range,t.targets])]);
  add('波次', [['波次','敌人ID','数量','出场延迟秒','生成间隔秒'], ...c.waves.map(w=>[w.wave,w.enemy,w.count,w.delay,w.interval])]);
  add('特殊效果', [['燃烧伤害','燃烧秒','捕获容量','消化秒','阻挡上限'], Object.values(c.effects)]);
  add('Boss', [['减伤比例','阶段秒'], Object.values(c.boss)]);
  add('资源映射', [['ID','素材路径','宽度','高度','锚点X','锚点Y'], ...c.assets.map(a=>[a.id,a.path,a.width,a.height,a.anchorX,a.anchorY])]);
  return wb;
}

export class ConfigError extends Error {
  constructor(public issues: string[]) { super(issues.join('\n')); }
}

/** Parse into a new configuration. Never mutate a running session on failed validation. */
export function parseWorkbook(wb: XLSX.WorkBook): Config {
  const issues: string[] = [];
  type Row = { row: number; values: Record<string, unknown> };
  const rows = (sheet: string, headers: string[]): Row[] => {
    const ws = wb.Sheets[sheet];
    if (!ws) { issues.push(`「${sheet}」第 1 行：缺少工作表`); return []; }
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: true });
    const head = (data[0] || []).map(String);
    for (const h of headers) if (!head.includes(h)) issues.push(`「${sheet}」第 1 行：缺少列 ${h}`);
    if(new Set(head.filter(Boolean)).size!==head.filter(Boolean).length) issues.push(`「${sheet}」第 1 行：列名重复`);
    return data.slice(1).flatMap((r, i) => r.every(v => v === '') ? [] : [{ row: i + 2, values: Object.fromEntries(headers.map(h => [h, r[head.indexOf(h)]])) }]);
  };
  const num = (s: string, r: Row, k: string, min = 0, max = 1e6, integer = false) => {
    const raw = r.values[k]; const v = typeof raw==='number' ? raw : Number(String(raw ?? '').trim());
    if (raw === undefined || raw === null || String(raw).trim() === '' || typeof raw === 'boolean' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) issues.push(`「${s}」第 ${r.row} 行：${k} 须为 ${min}～${max} 的${integer?'整数':'数值'}`);
    return v;
  };
  const str = (s: string, r: Row, k: string) => { const v=String(r.values[k]??'').trim(); if(!v)issues.push(`「${s}」第 ${r.row} 行：${k} 不能为空`); return v; };
  const one = (s: string, headers: string[]) => { const rr=rows(s,headers); if(rr.length!==1) issues.push(`「${s}」第 2 行：必须且只能有一条配置`); return rr[0]??{row:2,values:{}}; };
  const g=one('全局',['情侣血量','初始能量','波间反馈秒']);
  const enemies=rows('狗仔',['ID','名称','血量','移动速度','突破伤害']).map(r=>({id:str('狗仔',r,'ID') as EnemyId,name:str('狗仔',r,'名称'),hp:num('狗仔',r,'血量',1),speed:num('狗仔',r,'移动速度',1,1000),damage:num('狗仔',r,'突破伤害',0)}));
  const towers=rows('防御物',['ID','名称','部署能量','攻击力','攻击间隔秒','射程','目标数量']).map(r=>({id:str('防御物',r,'ID') as TowerId,name:str('防御物',r,'名称'),cost:num('防御物',r,'部署能量'),damage:num('防御物',r,'攻击力'),interval:num('防御物',r,'攻击间隔秒',.05,60),range:num('防御物',r,'射程',1,2000),targets:num('防御物',r,'目标数量',1,100,true)}));
  const checkIds=(s:string, actual:string[],expected:readonly string[])=>{
    const actualRows=rows(s,['ID']);
    actual.forEach((id,i)=>{if(!expected.includes(id)||actual.indexOf(id)!==i)issues.push(`「${s}」第 ${actualRows[i].row} 行：未知或重复 ID ${id}`);});
    expected.forEach(id=>{if(!actual.includes(id))issues.push(`「${s}」第 2 行：缺少 ID ${id}`);});
  };
  checkIds('狗仔',enemies.map(e=>e.id),['basic','telephoto','pro','boss']); checkIds('防御物',towers.map(t=>t.id),towerIds);
  const waves=rows('波次',['波次','敌人ID','数量','出场延迟秒','生成间隔秒']).map(r=>{
    const enemy=str('波次',r,'敌人ID') as EnemyId;
    if(!enemies.some(e=>e.id===enemy)) issues.push(`「波次」第 ${r.row} 行：敌人ID ${enemy} 未在狗仔表定义`);
    const wave=num('波次',r,'波次',1,5,true), count=num('波次',r,'数量',1,200,true);
    if((wave===5 && enemy!=='boss')||(wave!==5 && enemy==='boss'))issues.push(`「波次」第 ${r.row} 行：Boss 只用于第五波，且第五波只能是 Boss`);
    return {wave,enemy,count,delay:num('波次',r,'出场延迟秒',0,120),interval:num('波次',r,'生成间隔秒',.05,60)};
  });
  for(let wave=1;wave<=5;wave++)if(!waves.some(w=>w.wave===wave))issues.push(`「波次」第 2 行：缺少第 ${wave} 波`);
  if(waves.filter(w=>w.wave===5).reduce((n,w)=>n+w.count,0)!==1)issues.push('「波次」第 2 行：第五波必须恰好一名 Boss');
  if(waves.reduce((n,w)=>n+w.count,0)>1000)issues.push('「波次」第 2 行：整局敌人不得超过 1000');
  const e=one('特殊效果',['燃烧伤害','燃烧秒','捕获容量','消化秒','阻挡上限']);
  const b=one('Boss',['减伤比例','阶段秒']);
  const assets=rows('资源映射',['ID','素材路径','宽度','高度','锚点X','锚点Y']).map(r=>{
    const id=str('资源映射',r,'ID'), path=str('资源映射',r,'素材路径');
    if(!/^(\/assets\/)[\w./-]+\.(png|jpg|jpeg|webp)$/i.test(path)||path.includes('..'))issues.push(`「资源映射」第 ${r.row} 行：路径应为 /assets/ 下的本地图片`);
    if(![...towerIds,'basic','telephoto','pro','boss','couple','background'].includes(id))issues.push(`「资源映射」第 ${r.row} 行：未知资源 ID ${id}`);
    return {id,path,width:num('资源映射',r,'宽度',1,2000),height:num('资源映射',r,'高度',1,2000),anchorX:num('资源映射',r,'锚点X',0,1),anchorY:num('资源映射',r,'锚点Y',0,1)};
  });
  if(new Set(assets.map(a=>a.id)).size!==assets.length)issues.push('「资源映射」第 2 行：资源 ID 重复');
  const c:Config={global:{hp:num('全局',g,'情侣血量',1),energy:num('全局',g,'初始能量'),feedback:num('全局',g,'波间反馈秒',0,20)},enemies,towers,waves,
    effects:{burnDamage:num('特殊效果',e,'燃烧伤害'),burnDuration:num('特殊效果',e,'燃烧秒',.05,60),capacity:num('特殊效果',e,'捕获容量',1,100,true),digestTime:num('特殊效果',e,'消化秒',.05,60),blockLimit:num('特殊效果',e,'阻挡上限',1,100,true)},
    boss:{reduction:num('Boss',b,'减伤比例',0,1),stageDuration:num('Boss',b,'阶段秒',.05,60)},assets};
  if(issues.length)throw new ConfigError(issues); return c;
}

export function readConfig(bytes: ArrayBuffer): Config {
  if(bytes.byteLength>5*1024*1024)throw new ConfigError(['文件超过 5 MB，请使用数值配表，不要嵌入美术图片。']);
  try { return parseWorkbook(XLSX.read(bytes,{type:'array'})); }
  catch(error) { if(error instanceof ConfigError)throw error; throw new ConfigError(['无法读取工作簿，请使用有效的 .xlsx 文件。']); }
}
