// One-time mechanical extraction from the original authored frontend catalog.
import fs from 'node:fs';
import ts from 'typescript';
let source = fs.readFileSync('src/data.ts', 'utf8');
source = source.slice(0, source.indexOf('export const getCareer'));
const code = ts.transpile(source, { module: ts.ModuleKind.ESNext });
const data = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
fs.mkdirSync('backend/data', { recursive: true });
fs.writeFileSync('backend/data/careers.json', JSON.stringify(data.careers, null, 2) + '\n');
