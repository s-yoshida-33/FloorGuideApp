// src/hooks/useShopChangeDetection.ts
//
// ショップリストの変化（追加・削除）を検出し、Slack に通知するフック。
// 前回のショップリストを AppLocalData に保存し、起動/SSE 更新のたびに比較する。
// 初回起動時（スナップショット未存在）はスナップショットの初期化のみ行い、通知しない。
import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
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
  // mallId を含めたキーで重複実行を防ぐ。
  // mallId 変化時はキーが変わるため、新しい mallId に対して必ず detect を実行する。
  const prevKeyRef = useRef<string>('');

  useEffect(() => {
    if (!mallId || shops.length === 0) return;

    const currentKey = `${mallId}:${shops.map(s => s.id).sort().join(',')}`;
    if (currentKey === prevKeyRef.current) return;
    prevKeyRef.current = currentKey;

    const options = { baseDir: BaseDirectory.AppLocalData };
    const filename = `shop-snapshot-${mallId}.json`;

    const detect = async () => {
      let previous: ShopEntry[] = [];
      let isFirst = false;

      try {
        if (await exists(filename, options)) {
          const json = await readTextFile(filename, options);
          const parsed: ShopSnapshot = JSON.parse(json);
          previous = parsed.shops || [];
        } else {
          isFirst = true;
        }
      } catch {
        isFirst = true;
      }

      if (isFirst) {
        await writeTextFile(filename, JSON.stringify({ shops } satisfies ShopSnapshot), options);
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

      await writeTextFile(filename, JSON.stringify({ shops } satisfies ShopSnapshot), options);

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
