import { useEffect } from "react";
import { sseClient } from "../api/sseClient";
import type { Shop } from "../types/shop";
import { logInfo, logError } from "../logs/logging";

export function useBridgeEvents(onUpdate: (shops?: Shop[]) => void) {
  useEffect(() => {
    sseClient.connect();

    // 分離パターン: SSEは更新通知のみ。データはREST経由で取得する。
    const unsubscribeShops = sseClient.on('shops', () => {
      logInfo("DATA_SYNC", "Shop update signal received, fetching from REST");
      onUpdate();
    });

    const unsubscribeUpdate = sseClient.on('update', () => {
      logInfo("CMS_DELIVERY", "Update signal received, fetching from REST");
      onUpdate();
    });

    const unsubscribeConnected = sseClient.on('connected', (data) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        logInfo("DATA_SYNC", "SSE Connection Established", parsed);
      } catch {
        logInfo("DATA_SYNC", "SSE Connected", { data });
      }
    });

    return () => {
      unsubscribeShops();
      unsubscribeUpdate();
      unsubscribeConnected();
    };
  }, [onUpdate]);
}
