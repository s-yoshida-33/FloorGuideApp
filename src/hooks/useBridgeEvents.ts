import { useEffect, useRef } from "react";
import { getApiBaseUrl } from "../config";
import { logInfo, logError } from "../logs/logging";

export function useBridgeEvents(onUpdate: () => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        const baseUrl = await getApiBaseUrl();
        const url = `${baseUrl}/api/events`;

        logInfo("BridgeEvents", "Connecting to SSE", { url });

        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.addEventListener("connected", (e) => {
          try {
            const data = e.data ? JSON.parse(e.data) : {};
            logInfo("BridgeEvents", "Connected", data);
          } catch (err) {
            logInfo("BridgeEvents", "Connected (parse error)", { data: e.data });
          }
        });

        eventSource.addEventListener("update", (e) => {
          try {
            const data = e.data ? JSON.parse(e.data) : {};
            logInfo("BridgeEvents", "Update received", data);
            onUpdate();
          } catch (err) {
            logError("BridgeEvents", "Error parsing update event", { error: err });
            // Even if parse fails, we might want to trigger update if event fired? 
            // Better to trigger it to be safe.
            onUpdate();
          }
        });

        eventSource.addEventListener("heartbeat", () => {
          // Heartbeat received
        });

        eventSource.onerror = (e) => {
          logError("BridgeEvents", "SSE connection error", { event: e });
          eventSource.close();
          eventSourceRef.current = null;

          if (mounted) {
            logInfo("BridgeEvents", "Reconnecting in 5s...");
            reconnectTimeoutRef.current = window.setTimeout(connect, 5000);
          }
        };

      } catch (err) {
        logError("BridgeEvents", "Failed to initialize SSE", { error: err });
        if (mounted) {
          reconnectTimeoutRef.current = window.setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [onUpdate]); // Re-connect if onUpdate changes, which is acceptable if wrapped in useCallback
}

