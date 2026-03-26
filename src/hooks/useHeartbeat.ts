// src/hooks/useHeartbeat.ts
import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { logInfo } from '../logs/logging';

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// get_system_info はGPU検出(wmic)のタイムアウト(10s)を含むため、
// IPC全体でも余裕を持って15秒でタイムアウトさせる。
// これにより、USB Mobile Monitorなどの仮想ドライバが wmic をブロックしても
// setInterval の開始が阻害されなくなる。
const SYSTEM_INFO_TIMEOUT_MS = 15_000;

interface SystemInfo {
  cpu_name: string;
  cpu_cores: number;
  cpu_usage: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_usage_percent: number;
  gpu_name: string;
  os_name: string;
  os_version: string;
}

const getSystemInfo = async (): Promise<SystemInfo | null> => {
  try {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SYSTEM_INFO_TIMEOUT_MS)
    );
    return await Promise.race([invoke<SystemInfo>('get_system_info'), timeout]);
  } catch {
    return null;
  }
};

const formatUptime = (ms: number): string => {
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${h}h${m}m`;
};

export const useHeartbeat = () => {
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const start = async () => {
      const version = await getVersion().catch(() => 'unknown');

      // インターバルを先に開始する。
      // 初回の getSystemInfo (GPU wmic 含む) がタイムアウトしても
      // 1時間ごとのハートビートが確実に動くようにするため。
      intervalId = setInterval(async () => {
        const uptimeMs = Date.now() - startTimeRef.current;
        const info = await getSystemInfo();

        if (info) {
          logInfo('SYS_INIT', `Heartbeat - v${version} - uptime: ${formatUptime(uptimeMs)}`, {
            cpuUsage: `${info.cpu_usage.toFixed(1)}%`,
            memoryUsed: `${info.memory_used_mb}MB/${info.memory_total_mb}MB (${info.memory_usage_percent.toFixed(1)}%)`,
          });
        } else {
          logInfo('SYS_INIT', `Heartbeat - v${version} - uptime: ${formatUptime(uptimeMs)}`);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // 起動時のシステム情報ログ (タイムアウト付き)
      const sysInfo = await getSystemInfo();
      if (sysInfo) {
        logInfo('SYS_INIT', `App started - v${version}`, {
          cpu: sysInfo.cpu_name,
          cpuCores: sysInfo.cpu_cores,
          gpu: sysInfo.gpu_name,
          memoryTotal: `${sysInfo.memory_total_mb}MB`,
          os: `${sysInfo.os_name} ${sysInfo.os_version}`,
        });
      } else {
        logInfo('SYS_INIT', `App started - v${version}`);
      }
    };

    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
};
