// src/hooks/useBannerForceFetch.ts
// Force-fetch banner images from S3, bypassing version comparison.
// Used by the "最新のバナーを取得" button in ImageSettingsTab.
//
// S3 layout:
//   s3://tti-distribution/public/gido/medias/banners/{layoutId}/{hostname}/
//     latest.json  →  { "files": ["banner-0-{ts}.webp", ...], "updated_at": "..." }
//     banner-0-{ts}.webp
//     banner-1-{ts}.webp
//     ...

import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logInfo, logError } from '../logs/logging';

interface BannerDownloadProgressPayload {
  phase: string;
  percent: number;
  message: string;
}

export interface BannerForceFetchStatus {
  status: 'idle' | 'fetching' | 'done' | 'error';
  progress: number;
  message: string;
}

const S3_BANNERS_BASE = 'https://dl.tti.ninja/gido/medias/banners';

interface BannerLatestJson {
  files: string[];
  updated_at: string;
}

async function fetchLatestJson(
  layoutId: string,
  hostname: string,
): Promise<BannerLatestJson | null> {
  const url = `${S3_BANNERS_BASE}/${layoutId}/${hostname}/latest.json?_=${Date.now()}`;
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const response = await tauriFetch(url, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
    });
    if (!response.ok) return null;
    return await response.json() as BannerLatestJson;
  } catch {
    return null;
  }
}

export function useBannerForceFetch() {
  const [status, setStatus] = useState<BannerForceFetchStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const isFetching = useRef(false);

  const fetchBanners = async (
    layoutId: string,
    hostname: string,
  ): Promise<string[] | null> => {
    if (isFetching.current) return null;
    isFetching.current = true;

    try {
      if (!layoutId || !hostname) {
        setStatus({ status: 'error', progress: 0, message: 'ホスト名またはレイアウトIDが未設定です' });
        return null;
      }

      setStatus({ status: 'fetching', progress: 5, message: 'S3からバナー情報を取得中...' });

      const latest = await fetchLatestJson(layoutId, hostname);
      if (!latest?.files || latest.files.length === 0) {
        setStatus({ status: 'error', progress: 0, message: 'S3上にバナーデータが見つかりませんでした' });
        return null;
      }

      const assetUrls: string[] = [];
      const total = latest.files.length;

      for (let i = 0; i < total; i++) {
        const filename = latest.files[i];
        const fileUrl = `${S3_BANNERS_BASE}/${layoutId}/${hostname}/${filename}`;
        const progressBase = 10 + Math.round((i / total) * 80);

        setStatus({
          status: 'fetching',
          progress: progressBase,
          message: `バナー画像をダウンロード中 (${i + 1}/${total})...`,
        });

        let unlisten: UnlistenFn | null = null;
        let absPath: string;
        try {
          unlisten = await listen<BannerDownloadProgressPayload>('banner-download-progress', (event) => {
            const { percent, message } = event.payload;
            setStatus({
              status: 'fetching',
              progress: Math.min(90, progressBase + Math.round(percent * 0.1)),
              message,
            });
          });

          absPath = await invoke<string>('sync_banner_from_s3', {
            layoutId,
            hostname,
            fileUrl,
            filename,
          });
        } finally {
          if (unlisten) unlisten();
        }

        if (!absPath) {
          setStatus({ status: 'error', progress: 0, message: `バナー画像 ${i + 1} の読み込みに失敗しました` });
          return null;
        }

        assetUrls.push(convertFileSrc(absPath));
      }

      // Fetch all local banners to get a consistent sorted list
      const localBanners = await invoke<Array<{ filename: string; abs_path: string }>>(
        'list_local_banners', { layoutId, hostname }
      ).catch(() => []);

      const finalUrls = localBanners.length > 0
        ? localBanners.map((e) => convertFileSrc(e.abs_path))
        : assetUrls;

      logInfo('BANNER_FORCE_FETCH', 'Banners updated from S3', {
        layoutId, hostname, count: finalUrls.length,
      });
      setStatus({
        status: 'done',
        progress: 100,
        message: `バナー画像を取得しました（${finalUrls.length}枚）`,
      });
      return finalUrls;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('BANNER_FORCE_FETCH', 'Force fetch failed', { error: msg });
      setStatus({ status: 'error', progress: 0, message: 'バナーデータの取得に失敗しました' });
      return null;
    } finally {
      isFetching.current = false;
    }
  };

  const reset = () => {
    setStatus({ status: 'idle', progress: 0, message: '' });
  };

  return { status, fetchBanners, reset };
}
