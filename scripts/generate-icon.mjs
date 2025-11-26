// scripts/generate-icon.mjs
// SVGからICOファイルを生成するスクリプト

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// SVGファイルのパス
const svgPath = join(rootDir, 'src', 'assets', 'icon.svg');
const icoPath = join(rootDir, 'build', 'icon.ico');

console.log('アイコン生成スクリプト');
console.log('================================');

// 必要なパッケージのチェック
let sharp, toIco;
try {
  sharp = await import('sharp');
  toIco = await import('to-ico');
} catch (error) {
  console.error('エラー: 必要なパッケージがインストールされていません');
  console.error('以下のコマンドでインストールしてください:');
  console.error('  npm install --save-dev sharp to-ico');
  console.error('');
  console.error('または、オンラインツールを使用してSVGからICOに変換してください:');
  console.error('  - https://convertio.co/svg-ico/');
  console.error('  - https://cloudconvert.com/svg-to-ico');
  process.exit(1);
}

try {
  // SVGファイルを読み込む
  console.log('SVGファイルを読み込んでいます...');
  const svgBuffer = readFileSync(svgPath);
  
  // 必要なサイズのリスト（Windows ICO形式）
  const sizes = [16, 32, 48, 64, 128, 256];
  
  console.log('PNG画像を生成しています...');
  const pngBuffers = await Promise.all(
    sizes.map(async (size) => {
      const png = await sharp.default(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      return { size, buffer: png };
    })
  );
  
  console.log('ICOファイルを生成しています...');
  const icoBuffer = await toIco.default(
    pngBuffers.map(({ buffer }) => buffer)
  );
  
  // buildディレクトリが存在するか確認
  const buildDir = join(rootDir, 'build');
  try {
    mkdirSync(buildDir, { recursive: true });
  } catch (err) {
    // ディレクトリが既に存在する場合は無視
  }
  
  // ICOファイルを書き込む
  writeFileSync(icoPath, icoBuffer);
  
  // src/assets/icon.icoにもコピー
  const assetsIcoPath = join(rootDir, 'src', 'assets', 'icon.ico');
  writeFileSync(assetsIcoPath, icoBuffer);
  
  console.log('✓ ICOファイルが正常に生成されました:');
  console.log('  ', icoPath);
  console.log('  ', assetsIcoPath);
  console.log('');
  console.log('生成されたサイズ:', sizes.join(', '));
} catch (error) {
  console.error('エラーが発生しました:');
  console.error(error.message);
  if (error.code === 'ENOENT') {
    console.error('ファイルが見つかりません:', svgPath);
  }
  process.exit(1);
}
