// src/hooks/useMapForceFetch.ts
// Force-fetch a map from S3, bypassing version comparison.
// Used by the "S3からマップ取得" button in ImageSettingsTab.
// Downloads the latest single .webp file for the given mall/hostname unit.

import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logInfo, logError } from '../logs/logging';
import type { FloorId } from '../types/floorLayout';

interface MapDownloadProgressPayload {
  phase: string;
  percent: number;
  message: string;
}

export interface MapForceFetchStatus {
  status: 'idle' | 'fetching' | 'done' | 'error';
  progress: number;
  message: string;
}

const S3_MAPS_BASE = 'https://dl.tti.ninja/gido/medias/maps';
const CHECK_TIMEOUT_MS = 10_000;

interface LatestJson {
  file: string;
  updated_at: string;
}

function parseFloorFromFilename(filename: string): FloorId | null {
  const m = filename.match(/^(\dF)-map/);
  if (!m) return null;
  return m[1] as FloorId;
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

      setStatus({ status: 'fetching', progress: 5, message: 'S3からマップ情報を取得中...' });

      const latest = await fetchLatestJson(mallId, hostname);
      if (!latest?.file) {
        setStatus({ status: 'error', progress: 0, message: 'S3上にマップデータが見つかりませんでした' });
        return null;
      }

      const fileUrl = `${S3_MAPS_BASE}/${mallId}/${hostname}/${latest.file}`;
      setStatus({ status: 'fetching', progress: 10, message: 'マップデータをダウンロード中...' });

      let unlisten: UnlistenFn | null = null;
      let absPath: string;
      try {
        unlisten = await listen<MapDownloadProgressPayload>('map-download-progress', (event) => {
          const { percent, message } = event.payload;
          setStatus({
            status: 'fetching',
            progress: Math.min(95, 10 + Math.round(percent * 0.85)),
            message,
          });
        });

        absPath = await invoke<string>('sync_map_from_s3', {
          mallId,
          hostname,
          fileUrl,
          filename: latest.file,
        });
      } finally {
        if (unlisten) unlisten();
      }

      const floor = parseFloorFromFilename(latest.file);
      if (!floor || !absPath) {
        setStatus({ status: 'error', progress: 0, message: 'マップ画像の読み込みに失敗しました' });
        return null;
      }

      // Load all local maps (may include previously downloaded floors)
      const localMaps = await invoke<Array<{ filename: string; abs_path: string }>>(
        'list_local_maps', { mallId, hostname }
      ).catch(() => []);

      const floorMaps: Partial<Record<FloorId, string>> = {};
      for (const entry of localMaps) {
        const f = parseFloorFromFilename(entry.filename);
        if (f) floorMaps[f] = convertFileSrc(entry.abs_path);
      }
      // Ensure the just-downloaded file is always included
      if (!floorMaps[floor]) {
        floorMaps[floor] = convertFileSrc(absPath);
      }

      logInfo('MAP_FORCE_FETCH', 'Map updated from S3', { mallId, hostname, file: latest.file });
      setStatus({ status: 'done', progress: 100, message: 'マップ画像を取得しました' });
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
