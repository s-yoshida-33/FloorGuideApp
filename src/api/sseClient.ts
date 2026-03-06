import { getApiBaseUrl } from "../config";

export type SseConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type Listener = (data: any) => void;

class SseClient {
  private _status: SseConnectionStatus = 'disconnected';
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private reconnectTimeout: number | null = null;
  private reconnectAttempt: number = 0;
  private static readonly BASE_DELAY_MS = 3000;
  private static readonly MAX_DELAY_MS = 60000;

  public get status(): SseConnectionStatus {
    return this._status;
  }

  private setStatus(status: SseConnectionStatus) {
    if (this._status !== status) {
      this._status = status;
      this.notifyListeners('status_change', { status });
    }
  }

  public on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: Listener) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  public async connect() {
    if (this._status === 'connected' || this._status === 'connecting') return;

    this.setStatus('connecting');
    try {
      const baseUrl = await getApiBaseUrl();
      const url = `${baseUrl}/api/events`;

      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus('connected');
      };

      this.eventSource.onerror = (_error) => {
        this.setStatus('error');
        this.eventSource?.close();
        this.eventSource = null;

        // Auto-reconnect with exponential backoff + jitter
        this.scheduleReconnect();
      };

      // Generic message handler if needed, or specific event listeners
      this.eventSource.addEventListener('message', (e) => {
          this.notifyListeners('message', e.data);
      });
      
      // Bridge specific events
      this.eventSource.addEventListener('update', (e) => {
          this.notifyListeners('update', e.data);
      });

      this.eventSource.addEventListener('shops', (e) => {
          this.notifyListeners('shops', e.data);
      });
      
      this.eventSource.addEventListener('connected', (e) => {
          this.notifyListeners('connected', e.data);
      });

    } catch (e) {
      this.setStatus('error');
      // Auto-reconnect with exponential backoff + jitter
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    const delay = Math.min(
      SseClient.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt),
      SseClient.MAX_DELAY_MS,
    );
    const jitter = Math.random() * delay * 0.3;
    const finalDelay = Math.round(delay + jitter);
    this.reconnectAttempt++;
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, finalDelay);
  }

  public disconnect() {
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('disconnected');
  }
}

export const sseClient = new SseClient();

