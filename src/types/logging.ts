/**
 * Log tags for categorizing log messages.
 */
export type LogTag =
  // System lifecycle
  | 'SYS_INIT'
  | 'SYS_SHUTDOWN'

  // Data sync (Shop SSE / REST)
  | 'DATA_SYNC'

  // CMS delivery (Timeline SSE / video playback)
  | 'CMS_DELIVERY'

  // Asset checks (image visibility, load errors)
  | 'ASSET_CHECK'

  // Configuration
  | 'CONFIG'

  // Error handling
  | 'RENDERER_ERROR'
  | 'IPC_ERROR'

  // Catch-all for compatibility
  | string;

/**
 * Additional context attached to log entries.
 */
export interface LogContext {
  [key: string]: unknown;
}
