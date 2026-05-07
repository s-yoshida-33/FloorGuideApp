import type { LogTag, LogContext } from '../types/logging';
import { invoke } from '@tauri-apps/api/core';

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
