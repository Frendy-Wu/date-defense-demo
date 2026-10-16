import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const tables=JSON.parse(await fs.readFile(new URL('./tables.json',import.meta.url),'utf8'));
const workbook=Workbook.create();
for(const {name,rows} of tables){
  const sheet=workbook.worksheets.add(name);sheet.showGridLines=false;
  const range=sheet.getRangeByIndexes(0,0,rows.length,rows[0].length);range.values=rows;
  range.format.font={name:'Microsoft YaHei',size:11,color:'#33483C'};
  range.format.rowHeight=27;range.format.columnWidth=20;range.format.verticalAlignment='center';range.setNumberFormat('General');
  const header=sheet.getRangeByIndexes(0,0,1,rows[0].length);header.format.fill='#52765D';header.format.font={name:'Microsoft YaHei',size:11,bold:true,color:'#FFFFFF'};
  if(rows.length>1)sheet.getRangeByIndexes(1,0,rows.length-1,rows[0].length).format.fill='#FAF4E5';
  if(name==='波次')sheet.freezePanes.freezeRows(1);
}
workbook.recalculate();
console.log((await workbook.inspect({kind:'table',range:'防御物!A1:G6',include:'values',tableMaxRows:6,tableMaxCols:7,maxChars:2000})).ndjson);
for(const {name,rows}of tables){const preview=await workbook.render({sheetName:name,range:`A1:${String.fromCharCode(64+rows[0].length)}${Math.max(2,rows.length)}`,scale:1.5,format:'png'});await fs.writeFile(new URL(`../test-results/excel-${name}.png`,import.meta.url),new Uint8Array(await preview.arrayBuffer()));}
await (await SpreadsheetFile.exportXlsx(workbook)).save(fileURLToPath(new URL('../public/data/约会保卫战配置.xlsx',import.meta.url)));
