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
  return m[1] as FloorId;
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

/** Build a floorMaps object from all .webp files present in the local directory. */
async function buildFloorMapsFromLocal(
  mallId: string,
  hostname: string,
): Promise<Partial<Record<FloorId, string>>> {
  const floorMaps: Partial<Record<FloorId, string>> = {};
  try {
    const localMaps = await invoke<Array<{ filename: string; abs_path: string }>>(
      'list_local_maps', { mallId, hostname }
    );
    for (const entry of localMaps) {
      const floor = parseFloorFromFilename(entry.filename);
      if (floor) floorMaps[floor] = convertFileSrc(entry.abs_path);
    }
  } catch (e) {
    logWarn('MAP_SYNC', 'list_local_maps failed', { error: String(e) });
  }
  return floorMaps;
}

export interface MapSyncCallbacks {
  onMapUpdated: (floorMaps: Partial<Record<FloorId, string>>) => void;
}

/**
 * On mount: fetches latest.json from S3 and downloads the map if newer.
 * Calls onMapUpdated with all locally cached floor maps when done.
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
      const floorMaps = await buildFloorMapsFromLocal(mallId, hostname);
      if (Object.keys(floorMaps).length > 0) onMapUpdated(floorMaps);
      return;
    }

    // 3. Download new file
    const fileUrl = `${S3_MAPS_BASE}/${mallId}/${hostname}/${latest.file}`;
    logInfo('MAP_SYNC', 'Downloading map', { file: latest.file, url: fileUrl });

    try {
      await invoke<string>('sync_map_from_s3', {
        mallId,
        hostname,
        fileUrl,
        filename: latest.file,
      });

      await saveMapMeta(mallId, hostname, {
        lastFile: latest.file,
        lastUpdatedAt: latest.updated_at,
      });

      // Load ALL local floors after download (other floors survive thanks to per-floor cleanup)
      const floorMaps = await buildFloorMapsFromLocal(mallId, hostname);
      if (Object.keys(floorMaps).length > 0) onMapUpdated(floorMaps);
      logInfo('MAP_SYNC', 'Map updated', { file: latest.file, floors: Object.keys(floorMaps) });
    } catch (e) {
      logError('MAP_SYNC', 'Failed to download map', { error: String(e) });
    }
  }, [mallId, hostname, onMapUpdated]);

  // Check S3 for updates; short delay to avoid competing with boot I/O.
  useEffect(() => {
    if (!mallId || !hostname) return;
    const tid = setTimeout(() => { runSync(); }, 1000);
    return () => clearTimeout(tid);
  }, [mallId, hostname, runSync]);
}
