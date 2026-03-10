/**
 * Log tags for categorizing log messages.
 *
 * Tags marked with [ALERT] are monitored by the Slack notification system
 * in main.rs. State transitions (ok→alert on WARN/ERROR, alert→ok on INFO)
 * trigger Slack notifications.
 */
export type LogTag =
  // System lifecycle
  | 'SYS_INIT'
  | 'SYS_SHUTDOWN'

  // UI / Screen features
  | 'MAP'             // [ALERT] Floor map display / interaction errors
  | 'SHOPLIST'        // [ALERT] Shop list rendering errors
  | 'VIDEO'           // [ALERT] Video player / CMS delivery errors

  // Data fetching / communication
  | 'DATA_SYNC'       // [ALERT] Shop API data sync errors
  | 'CMS_DELIVERY'    // [ALERT] CMS timeline delivery errors
  | 'SSE'             // [ALERT] SSE connection errors

  // Asset (file) management
  | 'ASSET_CHECK'     // [ALERT] Asset file existence / download errors

  // System / App infrastructure
  | 'SYSTEM'          // [ALERT] Rust backend crashes, watchdog timeouts
  | 'RENDERER_ERROR'  // [ALERT] WebView/React rendering errors
  | 'APP'             // [ALERT] App lifecycle errors
  | 'UPDATER'         // [ALERT] Tauri auto-update errors
  | 'CONFIG'          // [ALERT] Settings file read/write errors

  // Non-alert scopes
  | 'IPC_ERROR'

  // Catch-all for compatibility
  | string;

/**
 * Additional context attached to log entries.
 */
export interface LogContext {
  [key: string]: unknown;
}
