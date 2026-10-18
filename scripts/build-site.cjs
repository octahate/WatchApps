const fs = require('node:fs');
const path = require('node:path');
const catalog = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
const revision = require('node:crypto').createHash('sha256').update(fs.readFileSync('apps.json')).update(fs.readFileSync('loader.js')).update(fs.readFileSync('index.html')).digest('hex').slice(0,12);
const out = '_site';
fs.rmSync(out, {recursive:true, force:true});
fs.mkdirSync(out);
for (const name of ['index.html','loader.js','apps.json','site.webmanifest','browserconfig.xml','css','core']) {
  fs.cpSync(name, path.join(out,name), {recursive:true});
}
fs.rmSync(path.join(out,'core','.git'), {force:true,recursive:true});
fs.mkdirSync(path.join(out,'img'));
for (const name of ['p8.jpeg','espruino-logo-sml.png','espruino-logo-mid.png','apple-touch-icon.png','favicon-16x16.png','favicon-32x32.png','android-chrome-192x192.png','android-chrome-512x512.png','mstile-150x150.png']) {
  fs.copyFileSync(path.join('img',name), path.join(out,'img',name));
}
for (const app of catalog) {
  if (!app.supports || !app.supports.includes('P8')) throw new Error('Non-P8 app: '+app.id);
  const dir = path.join('apps',app.id);
  const files = new Set([app.icon, app.readme, 'ChangeLog']);
  for (const file of [...(app.storage||[]),...(app.data||[]),...(app.screenshots||[])]) if (file.url) files.add(file.url);
  // Preserve images used by the app's readme without publishing alternate drivers.
  for (const name of fs.readdirSync(dir)) if (/\.(png|jpe?g|gif|svg)$/i.test(name)) files.add(name);
  for (const file of files) {
    if (!file || !fs.existsSync(path.join(dir,file))) continue;
    const dest = path.join(out,dir,file);
    fs.mkdirSync(path.dirname(dest), {recursive:true});
    fs.copyFileSync(path.join(dir,file),dest);
  }
}
for (const name of ['index.html','loader.js']) {
  const dest = path.join(out,name);
  fs.writeFileSync(dest, fs.readFileSync(dest,'utf8').replaceAll('__P8_BUILD__', revision));
}
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log(`Built P8-only store with ${catalog.length} apps.`);
