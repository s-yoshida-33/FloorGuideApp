// src/hooks/useMapSync.ts
// Automatically checks S3 for map updates on app startup.
// Each floor has its own {floor}-latest.json so floors are managed independently.

import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { FloorId } from '../types/floorLayout';
import { logInfo, logError, logWarn } from '../logs/logging';

const S3_MAPS_BASE = 'https://dl.tti.ninja/gido/medias/maps';

// All possible floor IDs to check. Floors not present on S3 are silently skipped.
const ALL_FLOORS: FloorId[] = ['1F', '2F', '3F', '4F'];

interface LatestJson {
  file: string;
  updated_at: string;
}

/** Per-floor meta filename */
function floorMetaFilename(mallId: string, hostname: string, floor: FloorId): string {
  return `map-meta-${mallId}-${hostname}-${floor}.json`;
}

async function loadFloorMeta(mallId: string, hostname: string, floor: FloorId): Promise<string | null> {
  try {
    const json = await invoke<string>('get_named_settings', {
      filename: floorMetaFilename(mallId, hostname, floor),
    });
    return (JSON.parse(json) as { lastFile: string }).lastFile ?? null;
  } catch {
    return null;
  }
}

async function saveFloorMeta(mallId: string, hostname: string, floor: FloorId, lastFile: string): Promise<void> {
  try {
    await invoke('save_named_settings', {
      filename: floorMetaFilename(mallId, hostname, floor),
      json: JSON.stringify({ lastFile }, null, 2),
    });
  } catch (e) {
    logWarn('MAP_SYNC', 'Failed to save floor meta', { floor, error: String(e) });
  }
}

async function fetchFloorLatest(mallId: string, hostname: string, floor: FloorId): Promise<LatestJson | null> {
  const url = `${S3_MAPS_BASE}/${mallId}/${hostname}/${floor}-latest.json?_=${Date.now()}`;
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

/** Parse FloorId from a timestamped filename like "2F-map-2026-03-24-14-07-21.webp" */
function parseFloorFromFilename(filename: string): FloorId | null {
  const m = filename.match(/^(\dF)-map/);
  if (!m) return null;
  return m[1] as FloorId;
}

export interface MapSyncCallbacks {
  onMapUpdated: (floorMaps: Partial<Record<FloorId, string>>) => void;
}

/**
 * On mount: for each floor, fetches {floor}-latest.json from S3 and downloads
 * the map if newer. Calls onMapUpdated with all updated/cached floor maps.
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

    // Load all local map files once for cache-hit lookups
    let localMapsCache: Array<{ filename: string; abs_path: string }> = [];
    try {
      localMapsCache = await invoke<Array<{ filename: string; abs_path: string }>>(
        'list_local_maps', { mallId, hostname }
      );
    } catch (e) {
      logWarn('MAP_SYNC', 'list_local_maps failed on init', { error: String(e) });
    }

    const floorMaps: Partial<Record<FloorId, string>> = {};

    for (const floor of ALL_FLOORS) {
      // 1. Fetch per-floor latest.json from S3
      const latest = await fetchFloorLatest(mallId, hostname, floor);
      if (!latest?.file) continue; // This floor is not available on S3

      // 2. Compare with local meta
      const lastFile = await loadFloorMeta(mallId, hostname, floor);
      if (lastFile === latest.file) {
        logInfo('MAP_SYNC', 'Floor map up to date', { floor, file: latest.file });
        // Load from local disk cache
        const entry = localMapsCache.find(e => parseFloorFromFilename(e.filename) === floor);
        if (entry) floorMaps[floor] = convertFileSrc(entry.abs_path);
        continue;
      }

      // 3. Download new file
      const fileUrl = `${S3_MAPS_BASE}/${mallId}/${hostname}/${latest.file}`;
      logInfo('MAP_SYNC', 'Downloading map', { floor, file: latest.file });

      try {
        const absPath = await invoke<string>('sync_map_from_s3', {
          mallId,
          hostname,
          fileUrl,
          filename: latest.file,
        });

        if (absPath) {
          await saveFloorMeta(mallId, hostname, floor, latest.file);
          floorMaps[floor] = convertFileSrc(absPath);
          // Refresh local cache for subsequent floors
          localMapsCache = await invoke<Array<{ filename: string; abs_path: string }>>(
            'list_local_maps', { mallId, hostname }
          ).catch(() => localMapsCache);
          logInfo('MAP_SYNC', 'Map updated', { floor, file: latest.file });
        }
      } catch (e) {
        logError('MAP_SYNC', 'Failed to download map', { floor, error: String(e) });
      }
    }

    if (Object.keys(floorMaps).length > 0) {
      onMapUpdated(floorMaps);
    }
  }, [mallId, hostname, onMapUpdated]);

  useEffect(() => {
    if (!mallId || !hostname) return;
    const tid = setTimeout(() => { runSync(); }, 5000);
    return () => clearTimeout(tid);
  }, [mallId, hostname, runSync]);
}
