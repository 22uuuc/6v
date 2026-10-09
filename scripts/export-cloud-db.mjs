// 一次性导出脚本：把种子内容库导出为 GitHub 仓库 db/ 目录所需的 JSON 文件
// 运行：node --experimental-strip-types scripts/export-cloud-db.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSeed } from '../src/data/seed.ts';

const seed = buildSeed();
const outDir = fileURLToPath(new URL('../cloud-db/', import.meta.url));

const files = [
  { path: 'db/books.json', data: seed.books },
  { path: 'db/chapters.json', data: seed.chapters },
  { path: 'db/visual-scripts.json', data: seed.visualScripts },
  { path: 'db/comic-chapters.json', data: seed.comicChapters },
  { path: 'db/comic-pages.json', data: seed.comicPages },
];

for (const f of files) {
  const full = outDir + f.path;
  mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
  writeFileSync(full, JSON.stringify(f.data, null, 2), 'utf8');
  const n = Array.isArray(f.data) ? f.data.length : Object.keys(f.data).length;
  console.log(`written ${f.path} (${n} 条, ${(f.data ? JSON.stringify(f.data).length : 0) / 1024} KB)`);
}
console.log('done');
