import { useEffect } from "react";
import { sseClient } from "../api/sseClient";
import { extractShopsFromResponse, normalizeBridgeShops } from "../api/bridgeClient";
import type { Shop } from "../types/shop";
import { logInfo, logError } from "../logs/logging";

export function useBridgeEvents(onUpdate: (shops?: Shop[]) => void) {
  useEffect(() => {
    // Connect if not already connected
    sseClient.connect();

    const unsubscribeShops = sseClient.on('shops', (data) => {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            logInfo("DATA_SYNC", "Realtime update received (shops)", { 
                dataSize: JSON.stringify(parsed).length 
            });
            
            // Extract and normalize directly from event data
            const rawList = extractShopsFromResponse(parsed);
            const shops = normalizeBridgeShops(rawList);
            
            onUpdate(shops);
        } catch (err) {
            logError("DATA_SYNC", "Error parsing shops event", { error: err });
            // Fallback to refetch if parsing fails
            onUpdate();
        }
    });

    const unsubscribeUpdate = sseClient.on('update', (data) => {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            // Use debug level to avoid flooding logs with frequent updates
            logInfo("CMS_DELIVERY", "Timeline update signal received", parsed);
            // Legacy update event might not contain data, or we just treat it as a signal to refetch
            // if it doesn't have the expected structure.
            // If 'update' event also carries data in the future, we can parse it too.
            // For now, assume 'shops' event carries the data, and 'update' is a signal.
            onUpdate();
        } catch (err) {
            logError("CMS_DELIVERY", "Error parsing update event", { error: err });
            onUpdate();
        }
    });

    const unsubscribeConnected = sseClient.on('connected', (data) => {
         try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            logInfo("DATA_SYNC", "SSE Connection Established", parsed);
          } catch (err) {
            logInfo("DATA_SYNC", "SSE Connected (parse error)", { data });
          }
    });
    
    // We could also subscribe to status changes to log errors/reconnections if needed
    
    return () => {
      unsubscribeShops();
      unsubscribeUpdate();
      unsubscribeConnected();
      // We do not disconnect here because sseClient is a singleton potentially used by others (debug window)
      // or we want it to persist. 
      // If we want to disconnect when the last listener leaves, we'd need reference counting in sseClient.
      // For now, persistent connection is fine for this app.
    };
  }, [onUpdate]);
}
