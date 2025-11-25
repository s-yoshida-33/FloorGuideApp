// electron/logger.cjs
// Centralized logger for the Electron main process and IPC logging.

const path = require('path');
const os = require('os');
const { app } = require('electron');
const log = require('electron-log');
const https = require('https');

const hostname = os.hostname();
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';

function configureLogger() {
  const userData = app.getPath('userData');
  const logDir = path.join(userData, 'logs');

  log.transports.file.resolvePath = () =>
    path.join(logDir, 'floor-guide-display.log');

  log.transports.file.maxSize = 5 * 1024 * 1024;

  log.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  log.transports.file.level = 'info';

  if (!slackWebhookUrl) {
    log.info(
      'SLACK_WEBHOOK_URL is not set; Slack alerts will be disabled.',
    );
  }
}

// ---------------------------------------------------------------------------
// Slack notification via Incoming Webhook
// ---------------------------------------------------------------------------

function notifySlack(level, message, context = {}) {
  if (!slackWebhookUrl) return;

  const scope = context.scope;
  const importantScopes = new Set(['map', 'shopList', 'video', 'openTime']);
  const importantLevels = new Set(['warn', 'error', 'fatal']);

  // Only send alerts for important scopes and levels
  if (!importantLevels.has(level) || !importantScopes.has(scope)) {
    return;
  }

  const appVersion = app.getVersion ? app.getVersion() : 'dev';

  const lines = [
    `*Level*: ${level.toUpperCase()}`,
    `*Scope*: ${scope}`,
    `*Message*: ${message}`,
    `*App*: FloorGuideDisplay`,
    `*Version*: ${appVersion}`,
    `*Host*: ${hostname}`,
  ];

  if (context.floor) {
    lines.push(`*Floor*: ${context.floor}`);
  }
  if (context.error) {
    lines.push(`*Error*: ${context.error}`);
  }
  if (context.src) {
    lines.push(`*Src*: ${context.src}`);
  }
  if (context.assetId) {
    lines.push(`*AssetId*: ${context.assetId}`);
  }

  const payload = JSON.stringify({
    text: lines.join('\n'),
  });

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
      (res) => {
        // We ignore the response body; just drain it
        res.resume();
      },
    );

    req.on('error', (err) => {
      // Do not crash the app; just log the failure
      log.warn(`Failed to send Slack alert: ${err.message}`);
    });

    req.write(payload);
    req.end();
  } catch (err) {
    log.warn(`Failed to prepare Slack alert: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Core logging
// ---------------------------------------------------------------------------

function formatMessage(level, message, context = {}) {
  const appVersion = app.getVersion ? app.getVersion() : 'dev';

  const base = {
    level,
    app: 'FloorGuideDisplay',
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

function write(level, message, context) {
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

  // Fire-and-forget Slack alert
  notifySlack(level, message, context);
}

module.exports = {
  configureLogger,
  debug: (msg, ctx) => write('debug', msg, ctx),
  info: (msg, ctx) => write('info', msg, ctx),
  warn: (msg, ctx) => write('warn', msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
  fatal: (msg, ctx) => write('fatal', msg, ctx),
  // Generic entry point for renderer logs
  logFromRenderer: ({ level = 'info', message = '', context = {} } = {}) => {
    write(level, message, { ...context, source: 'renderer' });
  },
};
