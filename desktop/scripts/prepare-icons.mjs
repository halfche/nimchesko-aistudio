import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import png2icons from 'png2icons';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(desktopDir, '..');
const buildDir = path.join(desktopDir, 'build');
const sourcePng = path.join(rootDir, 'public', 'pwa-512x512.png');

if (!fs.existsSync(sourcePng)) {
  throw new Error(`Missing source icon at ${sourcePng}`);
}

fs.mkdirSync(buildDir, { recursive: true });
const input = fs.readFileSync(sourcePng);

fs.writeFileSync(path.join(buildDir, 'icon.png'), input);

const ico = png2icons.createICO(input, png2icons.BICUBIC2, 0, false, true);
if (!ico) {
  throw new Error('Failed to generate icon.ico');
}
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

const icns = png2icons.createICNS(input, png2icons.BICUBIC2, 0);
if (!icns) {
  throw new Error('Failed to generate icon.icns');
}
fs.writeFileSync(path.join(buildDir, 'icon.icns'), icns);

console.log('Prepared desktop icons in desktop/build/{icon.png,icon.ico,icon.icns}');
