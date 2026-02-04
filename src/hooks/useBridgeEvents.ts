import { useEffect } from 'react';
import { sseClient } from "../api/sseClient";
import type { Shop } from "../types/shop";

/**
 * Hook to listen for Bridge SSE events (mainly for shop updates)
 */
export function useBridgeEvents(onUpdate: (shops?: Shop[]) => void) {
  useEffect(() => {
    // Ensure connection is started
    sseClient.connect();

    const unsubscribeShops = sseClient.on('shops', (data: any) => {
      // Bridge usually sends { shops: [...] } or just [...]
      if (data && Array.isArray(data.shops)) {
          onUpdate(data.shops);
      } else if (Array.isArray(data)) {
          onUpdate(data);
      }
    });

    const unsubscribeUpdate = sseClient.on('update', () => {
        // Trigger generic update (fetch fresh data)
        onUpdate();
    });

    return () => {
      unsubscribeShops();
      unsubscribeUpdate();
    };
  }, [onUpdate]);
}
