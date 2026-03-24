// src/hooks/useMapSync.ts
// Automatically checks S3 for map updates on app startup.
// If a newer file is found, downloads it and returns updated floor maps.

import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { FloorId } from '../types/floorLayout';
import { logInfo, logError, logWarn } from '../logs/logging';

const S3_MAPS_BASE = 'https://dl.tti.ninja/gido/medias/maps';
const META_FILENAME_PREFIX = 'map-meta-';
const CHECK_TIMEOUT_MS = 10_000;

interface MapMeta {
  lastFile: string;
  lastUpdatedAt: string;
}

interface LatestJson {
  file: string;
  updated_at: string;
}

/** Parse FloorId from a timestamped filename like "1F-map-2026-03-24-14-07-21.webp" */
function parseFloorFromFilename(filename: string): FloorId | null {
  const m = filename.match(/^(\dF)-map/);
  if (!m) return null;
  const floor = m[1] as FloorId;
  return floor;
}

/** Sanitize mall_id + hostname to build a safe settings key */
function metaKey(mallId: string, hostname: string): string {
  return `${META_FILENAME_PREFIX}${mallId}-${hostname}`;
}

async function loadMapMeta(mallId: string, hostname: string): Promise<MapMeta | null> {
  try {
    const filename = `${metaKey(mallId, hostname)}.json`;
    const json = await invoke<string>('get_named_settings', { filename });
    return JSON.parse(json) as MapMeta;
  } catch {
    return null;
  }
}

async function saveMapMeta(mallId: string, hostname: string, meta: MapMeta): Promise<void> {
  try {
    const filename = `${metaKey(mallId, hostname)}.json`;
    const json = JSON.stringify(meta, null, 2);
    await invoke('save_named_settings', { filename, json });
  } catch (e) {
    logWarn('MAP_SYNC', 'Failed to save map meta', { error: String(e) });
  }
}

async function fetchLatestJson(mallId: string, hostname: string): Promise<LatestJson | null> {
  const url = `${S3_MAPS_BASE}/${mallId}/${hostname}/latest.json?_=${Date.now()}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.json() as LatestJson;
  } catch {
    clearTimeout(tid);
    return null;
  }
}

export interface MapSyncCallbacks {
  onMapUpdated: (floorMaps: Partial<Record<FloorId, string>>) => void;
}

/**
 * On mount: fetches latest.json from S3 and downloads the map if newer.
 * Calls onMapUpdated with { [floorId]: assetUrl } when a new map is available.
 */
export function useMapSync(
  mallId: string,
  hostname: string,
  { onMapUpdated }: MapSyncCallbacks,
) {
  const syncPerformed = useRef(false);

  const runSync = useCallback(async () => {
    if (!mallId || !hostname) return;
    if (syncPerformed.current) return;
    syncPerformed.current = true;

    logInfo('MAP_SYNC', 'Checking S3 for map updates', { mallId, hostname });

    // 1. Fetch latest.json from S3
    const latest = await fetchLatestJson(mallId, hostname);
    if (!latest?.file) {
      logInfo('MAP_SYNC', 'No latest.json found (offline or not configured)', { mallId, hostname });
      return;
    }

    // 2. Compare with local meta
    const meta = await loadMapMeta(mallId, hostname);
    if (meta?.lastFile === latest.file) {
      logInfo('MAP_SYNC', 'Map already up to date', { file: latest.file });

      // Still load from local disk and notify
      try {
        const localMaps = await invoke<Array<{ filename: string; abs_path: string }>>(
          'list_local_maps', { mallId, hostname }
        );
        const floorMaps: Partial<Record<FloorId, string>> = {};
        for (const entry of localMaps) {
          const floor = parseFloorFromFilename(entry.filename);
          if (floor) floorMaps[floor] = convertFileSrc(entry.abs_path);
        }
        if (Object.keys(floorMaps).length > 0) onMapUpdated(floorMaps);
      } catch (e) {
        logWarn('MAP_SYNC', 'list_local_maps failed', { error: String(e) });
      }
      return;
    }

    // 3. Download new file
    const fileUrl = `${S3_MAPS_BASE}/${mallId}/${hostname}/${latest.file}`;
    logInfo('MAP_SYNC', 'Downloading map', { file: latest.file, url: fileUrl });

    try {
      const absPath = await invoke<string>('sync_map_from_s3', {
        mallId,
        hostname,
        fileUrl,
        filename: latest.file,
      });

      const floor = parseFloorFromFilename(latest.file);
      if (floor && absPath) {
        await saveMapMeta(mallId, hostname, {
          lastFile: latest.file,
          lastUpdatedAt: latest.updated_at,
        });
        onMapUpdated({ [floor]: convertFileSrc(absPath) });
        logInfo('MAP_SYNC', 'Map updated', { floor, file: latest.file });
      }
    } catch (e) {
      logError('MAP_SYNC', 'Failed to download map', { error: String(e) });
    }
  }, [mallId, hostname, onMapUpdated]);

  useEffect(() => {
    if (!mallId || !hostname) return;
    // Small delay to let the app fully initialize before making network requests
    const tid = setTimeout(() => { runSync(); }, 5000);
    return () => clearTimeout(tid);
  }, [mallId, hostname, runSync]);
}
