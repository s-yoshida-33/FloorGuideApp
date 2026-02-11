const logger = require('./logger.cjs');

// Spout受信機クラス（ラッパー）
class SpoutReceiverWrapper {
  constructor(senderName) {
    this.senderName = senderName;
    this.receiver = null;
    this.useMock = false;
    this.mockFrameCount = 0;

    try {
      // ネイティブモジュールの読み込み
      const nativeModule = require('./electron-spout.node');
      
      // デバッグログ: モジュールの中身を確認
      logger.info('Spout: Loaded native module structure', { keys: Object.keys(nativeModule) });

      // SpoutInput (受信クラス) を優先的に使用
      // electron-spout の SpoutOutput は送信専用クラスであり、受信には使用できない
      if (nativeModule.SpoutInput) {
        // 新しいレシーバーモジュール（SpoutInput = 受信用）
        this.receiver = new nativeModule.SpoutInput(senderName);
        logger.info('Spout: SpoutInput (receiver) loaded successfully', { senderName });
      } else if (nativeModule.SpoutOutput) {
        // 旧モジュール: SpoutOutput は送信専用であり、受信には使用できない
        // pollReceiver() 等のメソッドが存在しないため、MOCKモードにフォールバック
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

      // テクスチャ取得 (receiveTexture)
      // pollReceiver が成功していれば、サイズ情報も更新されているはず
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
    // 30fps程度で変化させる
    this.mockFrameCount++;
    
    // Spout出力解像度（Wonder Flowからの入力を想定）
    // ユーザー情報: 1080x1920 (縦長)
    const width = 1080;
    const height = 1920;
    
    // データ量削減のため、モックでは小さいサイズで返すことも検討できるが
    // 実動作をシミュレートするためフルサイズに近いものを返すべきか？
    // いや、Node.jsで毎回 1080*1920*4 byte (約8MB) のバッファ確保は重すぎる。
    // モックでは小さくして、受け側で引き伸ばすテストにする。
    // -> しかしCanvas描画ロジックのテストのため、アスペクト比は合わせる。
    const mockW = 270; // 1/4
    const mockH = 480; // 1/4
    
    // 簡易的なバッファ生成（毎回作ると重いのでキャッシュしたいが、簡易実装で）
    // RGBA
    const size = mockW * mockH * 4;
    const buffer = Buffer.allocUnsafe(size);
    
    // 色を時間で変化させる
    const r = (this.mockFrameCount * 2) % 255;
    const g = (this.mockFrameCount * 3) % 255;
    const b = (this.mockFrameCount * 5) % 255;
    
    // 全ピクセル埋めるのは遅いので、先頭だけ埋めてあとは手抜き（実際は真っ黒になるかもだが）
    // fillを使う
    buffer.fill(255); // Alpha
    
    // ちゃんと見せたいので少し真面目に描く
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
