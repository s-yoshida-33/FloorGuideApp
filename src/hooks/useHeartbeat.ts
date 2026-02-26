// src/hooks/useHeartbeat.ts
import { useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { logInfo } from '../logs/logging';

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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
    return await invoke<SystemInfo>('get_system_info');
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
      const sysInfo = await getSystemInfo();

      // Startup log with system info
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

      // Hourly heartbeat with uptime and resource usage
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
    };

    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
};
