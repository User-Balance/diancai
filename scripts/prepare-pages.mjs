import { cp, mkdir, writeFile, readFile, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)), destination=path.join(root,'docs');
await mkdir(destination,{recursive:true});
await mkdir(path.join(destination,'assets'),{recursive:true});
// 仅清理本脚本此前生成的带 hash 的 Vite 文件，保留其他目录内容。
for(const filename of await readdir(path.join(destination,'assets'))) {
  if(/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(filename)) await unlink(path.join(destination,'assets',filename));
}
await cp(path.join(root,'dist'),destination,{recursive:true});
await writeFile(path.join(destination,'.nojekyll'),'');
await cp(path.join(root,'supabase/schema.sql'),path.join(destination,'schema.sql'));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
await writeFile(path.join(destination,'version.json'),JSON.stringify({name:pkg.name,version:pkg.version,built_at:new Date().toISOString()},null,2));
console.log('已生成 docs/，可通过 GitHub Pages → main → /docs 发布。');
