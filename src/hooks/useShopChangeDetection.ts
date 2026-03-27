// src/hooks/useShopChangeDetection.ts
//
// ショップリストの変化（追加・削除）を検出し、Slack に通知するフック。
// 前回のショップリストをローカルファイルに保存し、起動/SSE 更新のたびに比較する。
// 初回起動時（スナップショット未存在）はスナップショットの初期化のみ行い、通知しない。
import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logInfo } from '../logs/logging';

interface ShopEntry {
  id: string;
  name: string;
}

interface ShopSnapshot {
  shops: ShopEntry[];
}

export const useShopChangeDetection = (
  shops: ShopEntry[],
  mallId: string,
) => {
  // 前回チェック時のショップIDリスト（文字列化）を保持し、
  // 同一内容では detect を再実行しないようにする。
  const prevIdsRef = useRef<string>('');

  useEffect(() => {
    if (!mallId || shops.length === 0) return;

    const currentIds = shops.map(s => s.id).sort().join(',');
    if (currentIds === prevIdsRef.current) return;
    prevIdsRef.current = currentIds;

    const detect = async () => {
      const filename = `shop-snapshot-${mallId}.json`;

      let previous: ShopEntry[] = [];
      let isFirst = false;

      try {
        const json = await invoke<string>('get_named_settings', { filename });
        if (json && json !== '{}') {
          const parsed: ShopSnapshot = JSON.parse(json);
          previous = parsed.shops || [];
        } else {
          isFirst = true;
        }
      } catch {
        isFirst = true;
      }

      if (isFirst) {
        await invoke('save_named_settings', {
          filename,
          json: JSON.stringify({ shops } satisfies ShopSnapshot),
        });
        logInfo('SHOPLIST', 'ショップスナップショットを初期化しました', {
          count: String(shops.length),
          mall: mallId,
        });
        return;
      }

      const prevMap = new Map(previous.map(s => [s.id, s.name]));
      const currMap = new Map(shops.map(s => [s.id, s.name]));

      const added: ShopEntry[] = shops.filter(s => !prevMap.has(s.id));
      const removed: ShopEntry[] = previous.filter(s => !currMap.has(s.id));

      if (added.length === 0 && removed.length === 0) return;

      // スナップショット更新
      await invoke('save_named_settings', {
        filename,
        json: JSON.stringify({ shops } satisfies ShopSnapshot),
      });

      // Slack 通知（Rust 側で直接送信）
      await invoke('notify_shop_change', { added, removed });

      if (added.length > 0) {
        logInfo('SHOPLIST', `新規ショップ検出: ${added.map(s => s.name).join(', ')}`, {
          count: String(added.length),
          mall: mallId,
        });
      }
      if (removed.length > 0) {
        logInfo('SHOPLIST', `ショップ削除検出: ${removed.map(s => s.name).join(', ')}`, {
          count: String(removed.length),
          mall: mallId,
        });
      }
    };

    detect().catch(() => {
      // スナップショット I/O エラーは通知をスキップするだけで致命的でない
    });
  }, [shops, mallId]);
};
