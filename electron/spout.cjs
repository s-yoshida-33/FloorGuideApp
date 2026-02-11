const logger = require('./logger.cjs');

// Spout受信機クラス（ラッパー）
class SpoutReceiverWrapper {
  constructor(senderName) {
    this.senderName = senderName;
    this.receiver = null;
    this.useMock = false;
    this.mockFrameCount = 0;
    this.diagnosticLogged = false;
    this.diagnosticInterval = null;

    try {
      // ネイティブモジュールの読み込み
      const nativeModule = require('./electron-spout.node');
      
      // デバッグログ: モジュールの中身を確認
      logger.info('Spout: Loaded native module structure', { keys: Object.keys(nativeModule) });

      // SpoutInput (受信クラス) を優先的に使用
      if (nativeModule.SpoutInput) {
        this.receiver = new nativeModule.SpoutInput(senderName);
        logger.info('Spout: SpoutInput (receiver) loaded successfully', { senderName });

        // 起動時に利用可能なSpout senderを一覧表示（診断用）
        this.logAvailableSenders();
        
        // 定期的に診断情報をログに出力（接続できない間だけ）
        this.diagnosticInterval = setInterval(() => {
          if (!this.diagnosticLogged) {
            this.logDiagnostics();
          }
        }, 10000); // 10秒ごと

      } else if (nativeModule.SpoutOutput) {
        logger.warn('Spout: Only SpoutOutput (sender) found in native module. ' +
          'SpoutInput (receiver) is required to receive from Wonder Flow. ' +
          'Please rebuild the native module with SpoutInput support. ' +
          'Falling back to MOCK mode.');
        this.useMock = true;
      } else {
        logger.warn('Spout: Neither SpoutInput nor SpoutOutput found in native module', {
          keys: Object.keys(nativeModule)
        });
        this.useMock = true;
      }
    } catch (e) {
      logger.warn('Spout: Failed to load native module, using MOCK mode', { error: e.message });
      this.useMock = true;
    }
  }

  // 利用可能なSpout senderを一覧表示
  logAvailableSenders() {
    try {
      if (this.receiver && typeof this.receiver.getAvailableSenders === 'function') {
        const senders = this.receiver.getAvailableSenders();
        logger.info('Spout: Available senders on this system', {
          count: senders.length,
          senders: senders,
          lookingFor: this.senderName
        });

        if (senders.length === 0) {
          logger.warn('Spout: No active Spout senders found. Is Wonder Flow running and sending via Spout?');
        } else if (!senders.includes(this.senderName)) {
          logger.warn('Spout: Sender name mismatch!', {
            expected: this.senderName,
            available: senders,
            hint: 'Change senderName in main.cjs to match one of the available senders'
          });
        }
      }
    } catch (e) {
      logger.warn('Spout: Failed to get available senders', { error: e.message });
    }
  }

  // 診断情報のログ出力
  logDiagnostics() {
    try {
      if (this.receiver && typeof this.receiver.getDiagnostics === 'function') {
        const diag = this.receiver.getDiagnostics();
        logger.info('Spout: Diagnostics', diag);
      }
    } catch (e) {
      // 診断失敗は無視
    }
  }

  receive() {
    if (this.useMock) {
      return this.generateMockFrame();
    }

    try {
      // 受信チェック (pollReceiver)
      const isConnected = this.receiver.pollReceiver();
      
      if (!isConnected) {
        if (Math.random() < 0.01) {
          logger.info('Spout: No connection (pollReceiver returned false)');
       }
        return null;
      }

      // 接続成功 - 定期診断を停止
      if (!this.diagnosticLogged) {
        this.diagnosticLogged = true;
        if (this.diagnosticInterval) {
          clearInterval(this.diagnosticInterval);
          this.diagnosticInterval = null;
        }
        logger.info('Spout: Connected to sender!', {
          width: this.receiver.getReceiverWidth(),
          height: this.receiver.getReceiverHeight()
        });
      }

      // テクスチャ取得 (receiveTexture)
      const width = this.receiver.getReceiverWidth();
      const height = this.receiver.getReceiverHeight();
      
      if (width === 0 || height === 0) {
        if (Math.random() < 0.01) {
           logger.warn('Spout: Connected but size is 0x0');
        }
        return null;
      }

      const buffer = this.receiver.receiveTexture();
      if (!buffer) {
        logger.warn('Spout: Failed to get texture buffer (buffer is null)');
        return null;
      }

      if (Math.random() < 0.1) {
        const centerIdx = Math.floor((height / 2) * width + (width / 2)) * 4;

        if (centerIdx + 3 < buffer.length) {
          logger.info('Spout Pixel Debug', {
            width, 
            height,
            R: buffer[centerIdx],
            G: buffer[centerIdx + 1],
            B: buffer[centerIdx + 2],
            A: buffer[centerIdx + 3]
          });
        } else {
          logger.error('Spout Buffer Error: Buffer too small', {
            expected: width * height * 4, 
            actual: buffer.length
          });
        }
      }
      
      return {
        buffer: buffer,
        width: width,
        height: height
      };
    } catch (e) {
      logger.error('Spout: Error during receive', { error: e.message });
      return null;
    }
  }

  // モックフレーム生成（ノイズ画像）
  generateMockFrame() {
    this.mockFrameCount++;
    
    const mockW = 270; // 1/4
    const mockH = 480; // 1/4
    
    const size = mockW * mockH * 4;
    const buffer = Buffer.allocUnsafe(size);
    
    const r = (this.mockFrameCount * 2) % 255;
    const g = (this.mockFrameCount * 3) % 255;
    const b = (this.mockFrameCount * 5) % 255;
    
    buffer.fill(255);
    
    for (let i = 0; i < size; i += 4) {
      buffer[i] = r;     // R
      buffer[i+1] = g;   // G
      buffer[i+2] = b;   // B
      buffer[i+3] = 255; // A
    }

    return {
      buffer: buffer,
      width: mockW,
      height: mockH,
      isMock: true
    };
  }
}

module.exports = { SpoutReceiverWrapper };
