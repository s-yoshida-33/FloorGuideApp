// src/logging.ts
// Lightweight wrapper around window.logger for renderer-side logging.

type LogContext = Record<string, unknown>;

function baseContext(scope: string, extra?: LogContext) {
  return {
    scope, // e.g. "map", "shopList", "video", "openTime"
    ...extra,
  };
}

export function logInfo(scope: string, message: string, context?: LogContext) {
  window.logger?.info(message, baseContext(scope, context));
}

export function logWarn(scope: string, message: string, context?: LogContext) {
  window.logger?.warn(message, baseContext(scope, context));
}

export function logError(scope: string, message: string, context?: LogContext) {
  window.logger?.error(message, baseContext(scope, context));
}

export function logDebug(scope: string, message: string, context?: LogContext) {
  window.logger?.debug(message, baseContext(scope, context));
}
