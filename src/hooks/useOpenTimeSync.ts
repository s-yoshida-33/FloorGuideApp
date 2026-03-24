// src/hooks/useOpenTimeSync.ts
// Automatically checks S3 for open-time image updates on app startup.
// If a newer file is found, downloads it and calls onOpenTimeUpdated with the asset URL.

import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { logInfo, logError, logWarn } from '../logs/logging';

const S3_OPEN_TIMES_BASE = 'https://dl.tti.ninja/gido/medias/open-times';
const META_FILENAME_PREFIX = 'open-time-meta-';

interface OpenTimeMeta {
  lastFile: string;
  lastUpdatedAt: string;
}

interface LatestJson {
  file: string;
  updated_at: string;
}

function metaKey(mallId: string): string {
  return `${META_FILENAME_PREFIX}${mallId}`;
}

async function loadOpenTimeMeta(mallId: string): Promise<OpenTimeMeta | null> {
  try {
    const filename = `${metaKey(mallId)}.json`;
    const json = await invoke<string>('get_named_settings', { filename });
    return JSON.parse(json) as OpenTimeMeta;
  } catch {
    return null;
  }
}

async function saveOpenTimeMeta(mallId: string, meta: OpenTimeMeta): Promise<void> {
  try {
    const filename = `${metaKey(mallId)}.json`;
    const json = JSON.stringify(meta, null, 2);
    await invoke('save_named_settings', { filename, json });
  } catch (e) {
    logWarn('OPEN_TIME_SYNC', 'Failed to save open-time meta', { error: String(e) });
  }
}

async function fetchLatestJson(mallId: string): Promise<LatestJson | null> {
  const url = `${S3_OPEN_TIMES_BASE}/${mallId}/latest.json?_=${Date.now()}`;
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const response = await tauriFetch(url, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
    });
    if (!response.ok) return null;
    return await response.json() as LatestJson;
  } catch {
    return null;
  }
}

export interface OpenTimeSyncCallbacks {
  onOpenTimeUpdated: (assetUrl: string) => void;
}

/**
 * On mount: fetches latest.json from S3 and downloads the open-time image if newer.
 * Calls onOpenTimeUpdated with the asset URL when a new image is available.
 */
export function useOpenTimeSync(
  mallId: string,
  { onOpenTimeUpdated }: OpenTimeSyncCallbacks,
) {
  const syncPerformed = useRef(false);

  const runSync = useCallback(async () => {
    if (!mallId) return;
    if (syncPerformed.current) return;
    syncPerformed.current = true;

    logInfo('OPEN_TIME_SYNC', 'Checking S3 for open-time updates', { mallId });

    // 1. Fetch latest.json from S3
    const latest = await fetchLatestJson(mallId);
    if (!latest?.file) {
      logInfo('OPEN_TIME_SYNC', 'No latest.json found (offline or not configured)', { mallId });
      return;
    }

    // 2. Compare with local meta
    const meta = await loadOpenTimeMeta(mallId);
    if (meta?.lastFile === latest.file) {
      logInfo('OPEN_TIME_SYNC', 'Open-time already up to date', { file: latest.file });

      // Still load from local disk and notify
      try {
        const localFiles = await invoke<Array<{ filename: string; abs_path: string }>>(
          'list_local_open_times', { mallId }
        );
        if (localFiles.length > 0) {
          onOpenTimeUpdated(convertFileSrc(localFiles[0].abs_path));
        }
      } catch (e) {
        logWarn('OPEN_TIME_SYNC', 'list_local_open_times failed', { error: String(e) });
      }
      return;
    }

    // 3. Download new file
    const fileUrl = `${S3_OPEN_TIMES_BASE}/${mallId}/${latest.file}`;
    logInfo('OPEN_TIME_SYNC', 'Downloading open-time image', { file: latest.file, url: fileUrl });

    try {
      const absPath = await invoke<string>('sync_open_time_from_s3', {
        mallId,
        fileUrl,
        filename: latest.file,
      });

      if (absPath) {
        await saveOpenTimeMeta(mallId, {
          lastFile: latest.file,
          lastUpdatedAt: latest.updated_at,
        });
        onOpenTimeUpdated(convertFileSrc(absPath));
        logInfo('OPEN_TIME_SYNC', 'Open-time image updated', { file: latest.file });
      }
    } catch (e) {
      logError('OPEN_TIME_SYNC', 'Failed to download open-time image', { error: String(e) });
    }
  }, [mallId, onOpenTimeUpdated]);

  useEffect(() => {
    if (!mallId) return;
    const tid = setTimeout(() => { runSync(); }, 5000);
    return () => clearTimeout(tid);
  }, [mallId, runSync]);
}
