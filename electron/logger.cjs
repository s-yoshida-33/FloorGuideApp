// electron/logger.cjs
// Centralized logger for the Electron main process and IPC logging.

const path = require('path');
const os = require('os');
const { app } = require('electron');
const log = require('electron-log');

const hostname = os.hostname();

// Configure file logging (location, size, etc.)
function configureLogger() {
  // Use Electron's userData path so we can always write logs
  const userData = app.getPath('userData');
  const logDir = path.join(userData, 'logs');

  // Single log file (electron-log will create the folder if needed)
  log.transports.file.resolvePath = () =>
    path.join(logDir, 'floor-guide-display.log');

  // Max file size ~5MB before it starts a new file
  log.transports.file.maxSize = 5 * 1024 * 1024;

  // Console level (for dev) and file level (for prod)
  log.transports.console.level = process.env.NODE_ENV === 'development'
    ? 'debug'
    : 'info';
  log.transports.file.level = 'info';

  // Optional: disable logging in production console if you want
  // log.transports.console.level = false;
}

// Helper to format messages with common metadata
function formatMessage(level, message, context = {}) {
  const appVersion = app.getVersion ? app.getVersion() : 'dev';

  const base = {
    // Keep keys flat so logs are easy to grep
    level,
    app: 'FloorGuideDisplay',
    version: appVersion,
    host: hostname,
    ...context,
  };

  // Serialize as a single line JSON string
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
}

module.exports = {
  configureLogger,
  debug: (msg, ctx) => write('debug', msg, ctx),
  info: (msg, ctx) => write('info', msg, ctx),
  warn: (msg, ctx) => write('warn', msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
  fatal: (msg, ctx) => write('fatal', msg, ctx),

  // Generic entry point for IPC
  logFromRenderer: ({ level = 'info', message = '', context = {} } = {}) => {
    write(level, message, { ...context, source: 'renderer' });
  },
};
