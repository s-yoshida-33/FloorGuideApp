const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static');
const logger = require('./logger.cjs');

// Electron本番環境(asar)でのバイナリパス問題を回避するための設定
let binaryPath = ffmpegPath;
if (binaryPath.includes('app.asar')) {
  binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfmpegPath(binaryPath);

let probePath = ffprobePath.path;
if (probePath.includes('app.asar')) {
  probePath = probePath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfprobePath(probePath);

const OPTIMIZED_SIGNATURE = 'gido-optimized-baseline'; // 最適化済み判定用タグ
const TIMEOUT_MS = 300000; // 5分

/**
 * プロセスの優先度を下げる（CPU負荷対策）
 */
function setLowPriority(pid) {
  try {
    if (os.platform() === 'win32') {
      // Windows: Belownormal priority
      exec(`wmic process where processid=${pid} CALL setpriority "below normal"`, (error) => {
        if (error) {
           logger.debug(`Failed to set priority for PID ${pid}`, { error: error.message });
        } else {
           logger.debug(`Set low priority for FFmpeg PID ${pid}`);
        }
      });
    } else {
      // Linux/Mac: nice値を設定
      exec(`renice -n 19 -p ${pid}`, (error) => {
        if (error) logger.debug(`Failed to set priority for PID ${pid}`, { error: error.message });
      });
    }
  } catch (e) {
    logger.warn('Error setting process priority', { error: e.message });
  }
}

/**
 * ファイルが書き込み可能か（ロックされていないか）チェック
 */
function isFileLocked(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return false;
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES') {
      return true;
    }
    return true;
  }
}

/**
 * 動画が既に最適化済みかメタデータでチェック
 */
function isAlreadyOptimized(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(false);
      const tags = metadata.format.tags || {};
      if (tags.comment === OPTIMIZED_SIGNATURE) {
        return resolve(true);
      }
      resolve(false);
    });
  });
}

/**
 * 動画の最適化実行処理
 * Baselineプロファイル、1080pリサイズ、ビットレート制限で軽量化
 */
function optimizeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting video optimization: ${path.basename(inputPath)}`);
    
    const command = ffmpeg(inputPath)
      .outputOptions([
        // --- 負荷軽減のための追加設定 ---
        '-threads 1',       // CPUコア使用数を1つに制限
        '-preset ultrafast', // veryfast → ultrafast に変更（圧縮効率より速度優先）

        // より積極的な解像度・フレームレート削減
        '-vf scale=1280:-2,fps=24', // 1080p(1920px) → 720p(1280px), 30fps → 24fps
        
        '-c:v libx264',             // H.264
        '-profile:v baseline',      // Baselineプロファイル (デコード負荷軽減の肝)
        '-level 3.0',               // 3.1 → 3.0 でさらに軽量化
        
        // ビットレートをさらに削減
        '-b:v 1500k',               // 2000k → 1500k
        '-maxrate 1800k',           // 2500k → 1800k
        '-bufsize 3600k',           // 5000k → 3600k
        
        // 音声も軽量化
        '-c:a aac',
        '-b:a 96k',                 // 128k → 96k
        '-ac 1',                    // ステレオ→モノラル
        
        '-movflags +faststart',     // Web再生最適化
        '-metadata', `comment=${OPTIMIZED_SIGNATURE}` // 完了フラグ付与
      ]);

    const timeout = setTimeout(() => {
        logger.error(`Optimization timed out for ${path.basename(inputPath)}`);
        command.kill('SIGKILL');
        reject(new Error('Optimization timed out'));
    }, TIMEOUT_MS);

    command
      .on('start', (commandLine) => {
        // プロセスIDを取得して優先度を下げる
        if (command.ffmpegProc && command.ffmpegProc.pid) {
          const pid = command.ffmpegProc.pid;
          // 少し待ってから優先度を変更（プロセスが確実に起動してから）
          setTimeout(() => setLowPriority(pid), 500);
        }
      })
      .save(outputPath)
      .on('end', () => {
        clearTimeout(timeout);
        logger.info(`Optimization completed: ${path.basename(inputPath)}`);
        resolve();
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        if (!err.message.includes('SIGKILL')) {
            logger.error(`Optimization failed: ${path.basename(inputPath)}`, { error: err.message });
            reject(err);
        }
      });
  });
}

/**
 * ディレクトリ内の全動画ファイルを再帰的に検索して最適化
 */
async function optimizeAllVideosInDirectory(dirPath) {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
  const filesToProcess = [];

  // 1. ファイル収集 (非同期・ノンブロッキング)
  async function scan(dir) {
    try {
      // fs.promises を使用して非同期に読み込み
      // withFileTypes: true で dirent オブジェクトを取得し、別途 stat を呼ぶオーバーヘッドを削減
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 再帰呼び出しも await する
          await scan(fullPath);
        } else if (entry.isFile() && videoExtensions.includes(path.extname(fullPath).toLowerCase())) {
          filesToProcess.push(fullPath);
        }
      }
    } catch (e) {
      // ディレクトリが存在しない、アクセス権エラーなどは無視して続行
    }
  }
  
  await scan(dirPath);
  if (filesToProcess.length > 0) {
    logger.info(`Found ${filesToProcess.length} videos to optimize in ${dirPath}`);
  }

  // 2. 順次処理
  for (const inputPath of filesToProcess) {
    const filename = path.basename(inputPath);
    const tempPath = inputPath + '.temp.mp4';

    if (isFileLocked(inputPath)) {
      logger.warn(`Skipping optimization for locked file: ${filename}`);
      continue;
    }

    const optimized = await isAlreadyOptimized(inputPath);
    if (optimized) {
       continue;
    }

    try {
      await optimizeVideo(inputPath, tempPath);
      
      // 元ファイルを置き換え
      if (isFileLocked(inputPath)) {
         if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
         continue;
      }
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      fs.renameSync(tempPath, inputPath);
      
    } catch (error) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

module.exports = {
  optimizeAllVideosInDirectory
};
