import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { makeWorkbook } from '../src/config';
const wb=makeWorkbook();fs.writeFileSync('.workbook-tools/tables.json',JSON.stringify(wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1})})),null,2));
