const logger = require('./logger.cjs');

// Spout受信機クラス（ラッパー）
class SpoutReceiverWrapper {
  constructor(senderName) {
    this.senderName = senderName;
    this.receiver = null;
    this.connected = false;

    try {
      const nativeModule = require('./electron-spout.node');

      if (nativeModule.SpoutInput) {
        this.receiver = new nativeModule.SpoutInput(senderName);
        logger.info('Spout: SpoutInput (receiver) loaded', { senderName });

        // 起動時に利用可能なSpout senderを一覧表示
        this.logAvailableSenders();
      } else {
        logger.error('Spout: SpoutInput not found in native module', {
          keys: Object.keys(nativeModule)
        });
      }
    } catch (e) {
      logger.error('Spout: Failed to load native module', { error: e.message });
    }
  }

  logAvailableSenders() {
    try {
      if (this.receiver && typeof this.receiver.getAvailableSenders === 'function') {
        const senders = this.receiver.getAvailableSenders();
        logger.info('Spout: Available senders', {
          count: senders.length,
          senders,
          lookingFor: this.senderName
        });

        if (senders.length === 0) {
          logger.warn('Spout: No active Spout senders found. Is Wonder Flow running?');
        } else if (!senders.includes(this.senderName)) {
          logger.warn('Spout: Sender name mismatch', {
            expected: this.senderName,
            available: senders
          });
        }
      }
    } catch (e) {
      logger.warn('Spout: Failed to get available senders', { error: e.message });
    }
  }

  receive() {
    if (!this.receiver) {
      return null;
    }

    try {
      // receiveTexture() handles everything:
      //   - Connection establishment (returns null during probe phase)
      //   - Frame reception via ReceiveImage (double-buffered staging)
      //   - Returns Buffer with RGBA pixels, or null if no frame
      const buffer = this.receiver.receiveTexture();

      if (!buffer) {
        // No frame: either connecting, no new frame, or disconnected
        if (this.connected && !this.receiver.pollReceiver()) {
          this.connected = false;
          logger.warn('Spout: Connection lost');
        }
        return null;
      }

      // Got a frame - update connection state
      if (!this.connected) {
        this.connected = true;
        logger.info('Spout: Connected to sender', {
          width: this.receiver.getReceiverWidth(),
          height: this.receiver.getReceiverHeight()
        });
      }

      const width = this.receiver.getReceiverWidth();
      const height = this.receiver.getReceiverHeight();

      if (width === 0 || height === 0) {
        return null;
      }

      return { buffer, width, height };
    } catch (e) {
      logger.error('Spout: Error during receive', { error: e.message });
      return null;
    }
  }

    getDiagnostics() {
      try {
        if (this.receiver && typeof this.receiver.getDiagnostics === 'function') {
          return this.receiver.getDiagnostics();
        }
      } catch (e) {
        logger.warn('Spout: Failed to get diagnostics', { error: e.message });
      }
      return null;
    }
}

module.exports = { SpoutReceiverWrapper };
