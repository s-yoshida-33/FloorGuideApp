// src/hooks/useMapForceFetch.ts
// Force-fetch maps from S3 for all floors, bypassing version comparison.
// Used by the "最新のマップ画像を取得" button in ImageSettingsTab.

import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { logInfo, logError } from '../logs/logging';
import type { FloorId } from '../types/floorLayout';

export interface MapForceFetchStatus {
  status: 'idle' | 'fetching' | 'done' | 'error';
  progress: number;
  message: string;
}

const S3_MAPS_BASE = 'https://dl.tti.ninja/gido/medias/maps';
const ALL_FLOORS: FloorId[] = ['1F', '2F', '3F', '4F'];

interface LatestJson {
  file: string;
  updated_at: string;
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

function parseFloorFromFilename(filename: string): FloorId | null {
  const m = filename.match(/^(\dF)-map/);
  if (!m) return null;
  return m[1] as FloorId;
}

export function useMapForceFetch() {
  const [status, setStatus] = useState<MapForceFetchStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const isFetching = useRef(false);

  const fetchMaps = async (
    mallId: string,
    hostname: string,
  ): Promise<Partial<Record<FloorId, string>> | null> => {
    if (isFetching.current) return null;
    isFetching.current = true;

    try {
      if (!mallId || !hostname) {
        setStatus({ status: 'error', progress: 0, message: 'ホスト名またはモールIDが未設定です' });
        return null;
      }

      setStatus({ status: 'fetching', progress: 5, message: 'S3からマップ情報を確認中...' });

      // Discover which floors have a latest.json on S3
      const available: Array<{ floor: FloorId; latest: LatestJson }> = [];
      for (const floor of ALL_FLOORS) {
        const latest = await fetchFloorLatest(mallId, hostname, floor);
        if (latest?.file) available.push({ floor, latest });
      }

      if (available.length === 0) {
        setStatus({ status: 'error', progress: 0, message: 'S3上にマップデータが見つかりませんでした' });
        return null;
      }

      const floorMaps: Partial<Record<FloorId, string>> = {};
      const total = available.length;

      for (let i = 0; i < available.length; i++) {
        const { floor, latest } = available[i];
        const fileUrl = `${S3_MAPS_BASE}/${mallId}/${hostname}/${latest.file}`;
        const baseProgress = Math.round(10 + (i / total) * 85);

        setStatus({
          status: 'fetching',
          progress: baseProgress,
          message: `${floor} マップをダウンロード中... (${i + 1}/${total})`,
        });

        try {
          const absPath = await invoke<string>('sync_map_from_s3', {
            mallId,
            hostname,
            fileUrl,
            filename: latest.file,
          });

          if (absPath) {
            floorMaps[floor] = convertFileSrc(absPath);
          }
        } catch (e) {
          logError('MAP_FORCE_FETCH', 'Failed to download floor map', {
            floor,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (Object.keys(floorMaps).length === 0) {
        setStatus({ status: 'error', progress: 0, message: 'マップ画像の取得に失敗しました' });
        return null;
      }

      // Supplement with any already-present local maps not yet in floorMaps
      const localMaps = await invoke<Array<{ filename: string; abs_path: string }>>(
        'list_local_maps', { mallId, hostname }
      ).catch(() => []);

      for (const entry of localMaps) {
        const f = parseFloorFromFilename(entry.filename);
        if (f && !floorMaps[f]) {
          floorMaps[f] = convertFileSrc(entry.abs_path);
        }
      }

      logInfo('MAP_FORCE_FETCH', 'Maps updated from S3', {
        mallId, hostname, floors: Object.keys(floorMaps),
      });
      setStatus({
        status: 'done',
        progress: 100,
        message: `マップ画像を取得しました（${Object.keys(floorMaps).join(', ')}）`,
      });
      return floorMaps;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MAP_FORCE_FETCH', 'Force fetch failed', { error: msg });
      setStatus({ status: 'error', progress: 0, message: 'マップデータの取得に失敗しました' });
      return null;
    } finally {
      isFetching.current = false;
    }
  };

  const reset = () => {
    setStatus({ status: 'idle', progress: 0, message: '' });
  };

  return { status, fetchMaps, reset };
}
