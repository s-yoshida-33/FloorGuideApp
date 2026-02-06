import { APP_CONFIG } from '../config';
import { logError, logInfo } from '../logs/logging';

type WsEventHandler = (data: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private channel: string | null = null;
  private handlers: Map<string, WsEventHandler[]> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectInterval: number = 1000;
  private maxReconnectInterval: number = 60000;
  private reconnectAttempts: number = 0;

  constructor() {}

  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Connect to the WebSocket server and subscribe to the device channel.
   * @param deviceId The ID of the device (e.g. "2") to subscribe to "device.2"
   */
  connect(deviceId: string) {
    if (this.ws) {
      this.disconnect();
    }

    this.channel = `device.${deviceId}`;
    const url = APP_CONFIG.wsUrl || 'wss://api-jp.wonder-screen.com/app/wonder';

    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        logInfo('ws', 'Connected to WebSocket server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribe();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          logError('ws', 'Failed to parse message', { error: e });
        }
      };

      this.ws.onclose = () => {
        logInfo('ws', 'Disconnected from WebSocket server');
        this.isConnected = false;
        this.scheduleReconnect(deviceId);
      };

      this.ws.onerror = (error) => {
        logError('ws', 'WebSocket error', { error });
        // Error will trigger close, which schedules reconnect
      };

    } catch (e) {
      logError('ws', 'Connection failed', { error: e });
      this.scheduleReconnect(deviceId);
    }
  }

  private subscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.channel) {
      const msg = {
        event: 'pusher:subscribe',
        data: {
          channel: this.channel
        }
      };
      this.ws.send(JSON.stringify(msg));
      logInfo('ws', `Subscribing to channel: ${this.channel}`);
    }
  }

  private handleMessage(message: any) {
    const { event, data, channel } = message;

    // Filter by channel if provided (though usually we only get what we sub to)
    if (channel && channel !== this.channel) return;

    // Handle internal Pusher events
    if (event === 'pusher:connection_established') {
      return;
    }
    if (event === 'pusher_internal:subscription_succeeded') {
      logInfo('ws', `Subscription succeeded: ${channel}`);
      return;
    }
    if (event === 'pusher:ping') {
      this.ws?.send(JSON.stringify({ event: 'pusher:pong' }));
      return;
    }

    // Dispatch app events
    logInfo('ws', `Received event: ${event}`, { data });
    
    // Parse data if it's a JSON string (Pusher often sends data as serialized JSON)
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    const listeners = this.handlers.get(event) || [];
    listeners.forEach(handler => handler(parsedData));
  }

  private scheduleReconnect(deviceId: string) {
    if (this.reconnectTimer) return;
    
    this.reconnectAttempts++;
    const delay = Math.min(
        this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectInterval
    );

    logInfo('ws', `Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(deviceId);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect trigger
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  on(event: string, handler: WsEventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)?.push(handler);
  }

  off(event: string, handler: WsEventHandler) {
    const listeners = this.handlers.get(event);
    if (listeners) {
      this.handlers.set(event, listeners.filter(h => h !== handler));
    }
  }
}

export const wsClient = new WsClient();
