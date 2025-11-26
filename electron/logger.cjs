// electron/logger.cjs
// Unified logging with Slack webhook alerts and state-transition based notification control.

const path = require('path');
const os = require('os');
const { app } = require('electron');
const log = require('electron-log');
const https = require('https');

const hostname = os.hostname();
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';

/**
 * Configure file logger (electron-log)
 */
function configureLogger() {
  const userData = app.getPath('userData');
  const logDir = path.join(userData, 'logs');

  log.transports.file.resolvePath = () =>
    path.join(logDir, 'gido.log');

  log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB per file
  log.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  log.transports.file.level = 'info';

  if (!slackWebhookUrl) {
    log.info('SLACK_WEBHOOK_URL is not set; Slack notifications disabled.');
  }
}

/* --------------------------------------------------------------------------
   State-transition based Slack alert control
   -------------------------------------------------------------------------- */

/**
 * Scopes that should generate alerts.
 * Only these scopes will be monitored for transitions.
 */
const alertScopes = new Set(['map', 'shopList', 'video', 'openTime']);

/**
 * Keeps the last known alert state for each scope or (scope + floor).
 * key: "scope" or "scope:floor"
 * value: "ok" | "alert"
 */
const lastAlertState = Object.create(null);

/**
 * Determine whether a Slack alert should be triggered for this log entry.
 * This implements “alert → silence → recovery” behavior.
 *
 * Rules:
 * - On first warn/error/fatal after normal state → send ALERT once
 * - While already in alert state → send nothing
 * - On first info after alert state → send RECOVERY once
 * - All other transitions → send nothing
 */
function shouldSendSlack(level, message, context = {}) {
  const scope = context.scope;
  if (!scope || !alertScopes.has(scope)) return false;

  const key = context.floor ? `${scope}:${context.floor}` : scope;
  const prev = lastAlertState[key] || 'ok';

  // Transition to ALERT
  if (level === 'warn' || level === 'error' || level === 'fatal') {
    if (prev === 'alert') {
      // Already in alert state → silence
      return false;
    }
    lastAlertState[key] = 'alert';
    context.alertPhase = 'alert';
    return true;
  }

  // Transition to RECOVERY
  if (level === 'info') {
    if (prev === 'alert') {
      lastAlertState[key] = 'ok';
      context.alertPhase = 'recovered';
      return true;
    }
  }

  return false;
}

/* --------------------------------------------------------------------------
   Slack Webhook sender
   -------------------------------------------------------------------------- */

/**
 * Send a formatted Slack message using Incoming Webhook.
 */
function notifySlack(level, message, context = {}) {
  if (!slackWebhookUrl) return;

  const scope = context.scope;
  if (!scope || !alertScopes.has(scope)) return;

  const appVersion = app.getVersion ? app.getVersion() : 'dev';
  const phase = context.alertPhase; // "alert" | "recovered" | undefined

  const title =
    phase === 'recovered'
      ? `RECOVERY: ${scope}`
      : `ALERT: ${scope}`;

  const lines = [
    `*${title}*`,
    `*Level*: ${level.toUpperCase()}`,
    `*Scope*: ${scope}`,
    `*Message*: ${message}`,
    `*App*: Gido`,
    `*Version*: ${appVersion}`,
    `*Host*: ${hostname}`,
  ];

  if (context.floor) lines.push(`*Floor*: ${context.floor}`);
  if (context.error) lines.push(`*Error*: ${context.error}`);
  if (context.src) lines.push(`*Src*: ${context.src}`);
  if (context.assetId) lines.push(`*AssetId*: ${context.assetId}`);

  const payload = JSON.stringify({ text: lines.join('\n') });

  try {
    const url = new URL(slackWebhookUrl);

    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => res.resume(),
    );

    req.on('error', (err) => {
      log.warn(`Failed to send Slack alert: ${err.message}`);
    });

    req.write(payload);
    req.end();
  } catch (err) {
    log.warn(`Failed to prepare Slack request: ${err.message}`);
  }
}

/* --------------------------------------------------------------------------
   Core logging wrapper
   -------------------------------------------------------------------------- */

/**
 * Format one unified JSON log line.
 */
function formatMessage(level, message, context = {}) {
  const appVersion = app.getVersion ? app.getVersion() : 'dev';

  const base = {
    level,
    app: 'Gido',
    version: appVersion,
    host: hostname,
    ...context,
  };

  return JSON.stringify({
    ...base,
    message,
    ts: new Date().toISOString(),
  });
}

/**
 * Write log to file/console and optionally send Slack alert.
 */
function write(level, message, context = {}) {
  const line = formatMessage(level, message, context);

  switch (level) {
    case 'debug':
      log.debug(line);
      break;
    case 'info':
      log.info(line);
      break;
    case 'warn':
      log.warn(line);
      break;
    case 'error':
    case 'fatal':
      log.error(line);
      break;
    default:
      log.info(line);
      break;
  }

  // State-transition based Slack notification trigger
  if (shouldSendSlack(level, message, context)) {
    notifySlack(level, message, context);
  }
}

/* --------------------------------------------------------------------------
   Public API
   -------------------------------------------------------------------------- */

module.exports = {
  configureLogger,
  debug: (msg, ctx) => write('debug', msg, ctx),
  info: (msg, ctx) => write('info', msg, ctx),
  warn: (msg, ctx) => write('warn', msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
  fatal: (msg, ctx) => write('fatal', msg, ctx),

  /**
   * Called from renderer via IPC:
   * { level, message, context } is forwarded to the logger.
   */
  logFromRenderer: ({ level = 'info', message = '', context = {} } = {}) => {
    write(level, message, { ...context, source: 'renderer' });
  },
};
