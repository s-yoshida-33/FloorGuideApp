// src/hooks/useBannerSync.ts
// Automatically checks S3 for banner image updates on app startup.
// If a newer set of banners is found, downloads them and calls onBannerUpdated.
//
// S3 layout:
//   s3://tti-distribution/public/gido/medias/banners/{layoutId}/{hostname}/
//     latest.json  →  { "files": ["banner-0-{ts}.webp", ...], "updated_at": "..." }

import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { logInfo, logError, logWarn } from '../logs/logging';

const S3_BANNERS_BASE = 'https://dl.tti.ninja/gido/medias/banners';

interface BannerMeta {
  lastUpdatedAt: string;
  fileCount: number;
}

interface BannerLatestJson {
  files: string[];
  updated_at: string;
}

const bannerMetaPath = (layoutId: string, hostname: string) =>
  `medias/banners/${layoutId}/${hostname}/.banner-meta.json`;

async function loadBannerMeta(layoutId: string, hostname: string): Promise<BannerMeta | null> {
  try {
    const path = bannerMetaPath(layoutId, hostname);
    const metaExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (!metaExists) return null;
    const content = await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    return JSON.parse(content) as BannerMeta;
  } catch {
    return null;
  }
}

async function saveBannerMeta(layoutId: string, hostname: string, meta: BannerMeta): Promise<void> {
  try {
    await mkdir(`medias/banners/${layoutId}/${hostname}`, {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    });
    await writeTextFile(
      bannerMetaPath(layoutId, hostname),
      JSON.stringify(meta, null, 2),
      { baseDir: BaseDirectory.AppLocalData },
    );
  } catch (e) {
    logWarn('BANNER_SYNC', 'Failed to save banner meta', { error: String(e) });
  }
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

async function buildBannerUrlsFromLocal(
  layoutId: string,
  hostname: string,
): Promise<string[]> {
  try {
    const entries = await invoke<Array<{ filename: string; abs_path: string }>>(
      'list_local_banners', { layoutId, hostname }
    );
    return entries.map((e) => convertFileSrc(e.abs_path));
  } catch (e) {
    logWarn('BANNER_SYNC', 'list_local_banners failed', { error: String(e) });
    return [];
  }
}

export interface BannerSyncCallbacks {
  onBannerUpdated: (assetUrls: string[]) => void;
}

/**
 * On mount: fetches latest.json from S3 and downloads banners if newer.
 * Calls onBannerUpdated with all locally cached banner URLs when done.
 * Only active when layoutId matches (e.g. "sakaikitahanada-v").
 */
export function useBannerSync(
  layoutId: string,
  hostname: string,
  { onBannerUpdated }: BannerSyncCallbacks,
) {
  const syncPerformed = useRef(false);

  const runSync = useCallback(async () => {
    if (!layoutId || !hostname) return;
    if (syncPerformed.current) return;
    syncPerformed.current = true;

    logInfo('BANNER_SYNC', 'Checking S3 for banner updates', { layoutId, hostname });

    // 1. Fetch latest.json from S3
    const latest = await fetchLatestJson(layoutId, hostname);
    if (!latest?.files || latest.files.length === 0) {
      logInfo('BANNER_SYNC', 'No latest.json found or empty (offline or not configured)', {
        layoutId, hostname,
      });
      return;
    }

    // 2. Compare with local meta
    const meta = await loadBannerMeta(layoutId, hostname);
    if (meta?.lastUpdatedAt === latest.updated_at) {
      logInfo('BANNER_SYNC', 'Banners already up to date', { updated_at: latest.updated_at });
      // Do NOT call onBannerUpdated here: the saved settings already have the correct
      // order (possibly user-customised). Overwriting with the filesystem order would
      // reset any reordering the user has made.
      return;
    }

    // 3. Purge stale banners (files no longer in latest.json)
    try {
      const deleted = await invoke<number>('cleanup_stale_banners', {
        layoutId,
        hostname,
        keepFilenames: latest.files,
      });
      if (deleted > 0) {
        logInfo('BANNER_SYNC', 'Purged stale banner files', { deleted });
      }
    } catch (e) {
      logWarn('BANNER_SYNC', 'cleanup_stale_banners failed (non-fatal)', { error: String(e) });
    }

    // 4. Download each file
    logInfo('BANNER_SYNC', 'Downloading banners', { count: latest.files.length, updated_at: latest.updated_at });

    const downloadedPaths: string[] = [];
    try {
      for (const filename of latest.files) {
        const fileUrl = `${S3_BANNERS_BASE}/${layoutId}/${hostname}/${filename}`;
        const absPath = await invoke<string>('sync_banner_from_s3', {
          layoutId,
          hostname,
          fileUrl,
          filename,
        });
        if (absPath) downloadedPaths.push(absPath);
      }

      await saveBannerMeta(layoutId, hostname, {
        lastUpdatedAt: latest.updated_at,
        fileCount: downloadedPaths.length,
      });

      // Use list_local_banners for sorted, canonical result
      const urls = await buildBannerUrlsFromLocal(layoutId, hostname);
      if (urls.length > 0) onBannerUpdated(urls);
      logInfo('BANNER_SYNC', 'Banners updated', { count: urls.length });
    } catch (e) {
      logError('BANNER_SYNC', 'Failed to download banners', { error: String(e) });
    }
  }, [layoutId, hostname, onBannerUpdated]);

  // Check S3 for updates; short delay to avoid competing with boot I/O.
  useEffect(() => {
    if (!layoutId || !hostname) return;
    syncPerformed.current = false;
    const tid = setTimeout(() => { runSync(); }, 1000);
    return () => clearTimeout(tid);
  }, [layoutId, hostname, runSync]);
}
