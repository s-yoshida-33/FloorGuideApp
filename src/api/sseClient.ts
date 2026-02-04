import { getApiBaseUrl } from '../config';

// Define connection status type
export type SseConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Event emitter implementation
type Listener = (data: any) => void;

class SseClient {
  public status: SseConnectionStatus = 'disconnected';
  private eventSource: EventSource | null = null;
  private listeners: Record<string, Listener[]> = {};
  private reconnectTimer: number | undefined;

  async connect() {
    if (this.eventSource && this.eventSource.readyState !== 2) return;

    this.updateStatus('connecting');

    try {
      const baseUrl = await getApiBaseUrl();
      // Bridge SSE endpoint
      const url = `${baseUrl}/api/events`;
      
      console.log('[SseClient] Connecting to:', url);
      
      this.eventSource = new EventSource(url);
      
      this.eventSource.onopen = () => {
        console.log('[SseClient] Connected');
        this.updateStatus('connected');
        this.emit('connected', {});
      };

      this.eventSource.onerror = (err) => {
        if (this.status !== 'error') {
            this.updateStatus('error');
        }
        this.eventSource?.close();
        this.scheduleReconnect();
      };

      // Listen for 'shops' event (Shop list update)
      this.eventSource.addEventListener('shops', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.emit('shops', data);
        } catch (err) {
          console.error('[SseClient] Failed to parse shops event', err);
        }
      });

      // Listen for 'update' event (Generic update signal)
      this.eventSource.addEventListener('update', (e: MessageEvent) => {
        try {
          const data = e.data ? JSON.parse(e.data) : {};
          this.emit('update', data);
        } catch (err) {
            this.emit('update', {});
        }
      });

    } catch (e) {
      console.error('[SseClient] Connection failed', e);
      this.updateStatus('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), 5000);
  }

  private updateStatus(status: SseConnectionStatus) {
    this.status = status;
    this.emit('status_change', { status });
  }

  on(event: string, callback: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
  
  disconnect() {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
      }
      this.updateStatus('disconnected');
  }
}

export const sseClient = new SseClient();
