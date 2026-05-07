import type { LogTag, LogContext } from '../types/logging';
import { invoke } from '@tauri-apps/api/core';
import { bridgeState } from '../api/bridgeState';

const logToConsole = (
  level: 'debug' | 'info' | 'warn' | 'error',
  tag: LogTag,
  message: string,
  context?: LogContext,
) => {
  const payload = { tag, scope: tag, ...context };
  const logger = console[level] ?? console.log;
  logger(`[${tag}] ${message}`, payload);
};

const logToFile = async (
  level: 'debug' | 'info' | 'warn' | 'error',
  tag: LogTag,
  message: string,
  context?: LogContext,
) => {
  const upperLevel = level.toUpperCase();
  const contextStr = context ? JSON.stringify(context) : undefined;

  try {
    await invoke('write_log', { level: upperLevel, tag, message, context: contextStr });
  } catch {
    console.error('[logging] Failed to write log to file');
  }

  // Forward to Bridge-Ground asynchronously (fire-and-forget)
  const { baseUrl, appId } = bridgeState;
  if (baseUrl && appId) {
    const now = new Date();
    // Use local time (JST) to match the Rust write_log timestamp format.
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
               `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
    const fullMsg = contextStr ? `${message} | ${contextStr}` : message;
    fetch(`${baseUrl}/api/apps/${appId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: ts, level: upperLevel, tag, message: fullMsg }),
    }).catch(() => { /* ignore forwarding errors */ });
  }
};

/**
 * DEBUG: Suppressed in production builds.
 */
export function logDebug(tag: LogTag, message: string, context?: LogContext) {
  if (import.meta.env.PROD) return;
  logToConsole('debug', tag, message, context);
  logToFile('debug', tag, message, context);
}

/**
 * INFO: Startup, heartbeat, and significant state transitions.
 */
export function logInfo(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('info', tag, message, context);
  logToFile('info', tag, message, context);
}

/**
 * WARN: Recoverable issues that may need attention.
 */
export function logWarn(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('warn', tag, message, context);
  logToFile('warn', tag, message, context);
}

/**
 * ERROR: Failures requiring investigation.
 */
export function logError(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('error', tag, message, context);
  logToFile('error', tag, message, context);
}

export function logMessage(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext,
) {
  logToConsole(level, 'GENERAL', message, context);
  logToFile(level, 'GENERAL', message, context);
}
