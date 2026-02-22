#!/usr/bin/env node

/**
 * Tauri Build Runner
 * 環境変数を読み込んで PowerShell スクリプトを実行
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const script = args[0] || 'sign-and-build.ps1';

console.log('[*] Tauri Build Runner');
console.log(`[*] Script: ${script}`);
console.log('[*] Reading environment variables...');

// Use absolute path for PowerShell script
const scriptPath = path.join(__dirname, script);

console.log(`[*] Executing: powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
console.log('');

// Use spawn with inherited stdio to avoid hanging
const ps = spawn('powershell', [
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
], {
    stdio: 'inherit',
    shell: true
});

ps.on('close', (code) => {
    if (code !== 0) {
        console.error(`[!] PowerShell exited with code ${code}`);
        process.exit(code);
    }
});
