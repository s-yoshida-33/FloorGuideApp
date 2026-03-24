// src/hooks/useOpenTimeForceFetch.ts
// Force-fetch the open-time image from S3, bypassing version comparison.
// Used by the "最新の営業時間を取得" button in ImageSettingsTab.

import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logInfo, logError } from '../logs/logging';

interface OpenTimeDownloadProgressPayload {
  phase: string;
  percent: number;
  message: string;
}

export interface OpenTimeForceFetchStatus {
  status: 'idle' | 'fetching' | 'done' | 'error';
  progress: number;
  message: string;
}

const S3_OPEN_TIMES_BASE = 'https://dl.tti.ninja/gido/medias/open-times';

interface LatestJson {
  file: string;
  updated_at: string;
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

export function useOpenTimeForceFetch() {
  const [status, setStatus] = useState<OpenTimeForceFetchStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const isFetching = useRef(false);

  const fetchOpenTime = async (mallId: string): Promise<string | null> => {
    if (isFetching.current) return null;
    isFetching.current = true;

    try {
      if (!mallId) {
        setStatus({ status: 'error', progress: 0, message: 'モールIDが未設定です' });
        return null;
      }

      setStatus({ status: 'fetching', progress: 5, message: 'S3から営業時間情報を取得中...' });

      const latest = await fetchLatestJson(mallId);
      if (!latest?.file) {
        setStatus({ status: 'error', progress: 0, message: 'S3上に営業時間データが見つかりませんでした' });
        return null;
      }

      const fileUrl = `${S3_OPEN_TIMES_BASE}/${mallId}/${latest.file}`;
      setStatus({ status: 'fetching', progress: 10, message: '営業時間画像をダウンロード中...' });

      let unlisten: UnlistenFn | null = null;
      let absPath: string;
      try {
        unlisten = await listen<OpenTimeDownloadProgressPayload>('open-time-download-progress', (event) => {
          const { percent, message } = event.payload;
          setStatus({
            status: 'fetching',
            progress: Math.min(95, 10 + Math.round(percent * 0.85)),
            message,
          });
        });

        absPath = await invoke<string>('sync_open_time_from_s3', {
          mallId,
          fileUrl,
          filename: latest.file,
        });
      } finally {
        if (unlisten) unlisten();
      }

      if (!absPath) {
        setStatus({ status: 'error', progress: 0, message: '営業時間画像の読み込みに失敗しました' });
        return null;
      }

      logInfo('OPEN_TIME_FORCE_FETCH', 'Open-time image updated from S3', { mallId, file: latest.file });
      setStatus({ status: 'done', progress: 100, message: '営業時間画像を取得しました' });
      return convertFileSrc(absPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('OPEN_TIME_FORCE_FETCH', 'Force fetch failed', { error: msg });
      setStatus({ status: 'error', progress: 0, message: '営業時間データの取得に失敗しました' });
      return null;
    } finally {
      isFetching.current = false;
    }
  };

  const reset = () => {
    setStatus({ status: 'idle', progress: 0, message: '' });
  };

  return { status, fetchOpenTime, reset };
}
