import { useEffect } from "react";
import { sseClient } from "../api/sseClient";
import { logInfo, logError, logDebug } from "../logs/logging";

export function useBridgeEvents(onUpdate: () => void) {
  useEffect(() => {
    // Connect if not already connected
    sseClient.connect();

    const unsubscribeUpdate = sseClient.on('update', (data) => {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            // Use debug level to avoid flooding logs with frequent updates
            logDebug("BridgeEvents", "Update received", parsed);
            onUpdate();
        } catch (err) {
            logError("BridgeEvents", "Error parsing update event", { error: err });
            onUpdate();
        }
    });

    const unsubscribeConnected = sseClient.on('connected', (data) => {
         try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            logInfo("BridgeEvents", "Connected", parsed);
          } catch (err) {
            logInfo("BridgeEvents", "Connected (parse error)", { data });
          }
    });
    
    // We could also subscribe to status changes to log errors/reconnections if needed
    
    return () => {
      unsubscribeUpdate();
      unsubscribeConnected();
      // We do not disconnect here because sseClient is a singleton potentially used by others (debug window)
      // or we want it to persist. 
      // If we want to disconnect when the last listener leaves, we'd need reference counting in sseClient.
      // For now, persistent connection is fine for this app.
    };
  }, [onUpdate]);
}
