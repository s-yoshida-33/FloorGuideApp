const logger = require('./logger.cjs');

// Spout受信機クラス（ラッパー）
class SpoutReceiverWrapper {
  constructor(senderName) {
    this.senderName = senderName;
    this.receiver = null;
    this.useMock = false;
    this.mockFrameCount = 0;

    try {
      // node-spoutの読み込みを試行
      // 実際にはユーザー環境で npm install electron-spout が必要
      // かつネイティブビルドが必要
      const nativeModule = require('./electron-spout.node');
      
      // デバッグログ: モジュールの中身を確認
      logger.info('Spout: Loaded native module structure', { keys: Object.keys(nativeModule) });

      // SpoutReceiverクラスの特定
      // electron-spout は default エクスポートや別名の可能性がある
      let SpoutReceiverClass = nativeModule.SpoutReceiver || nativeModule.Receiver || nativeModule.default || nativeModule;
      
      // もし関数としてエクスポートされていたら、それをクラスとして扱う
      if (typeof SpoutReceiverClass !== 'function' && typeof nativeModule === 'function') {
          SpoutReceiverClass = nativeModule;
      }

      try {
        this.receiver = new SpoutReceiverClass(senderName);
      } catch (err) {
        // new が不要なタイプかもしれない（ファクトリ関数の場合）
        logger.warn('Spout: new failed, trying function call', { error: err.message });
        this.receiver = SpoutReceiverClass(senderName);
      }

      logger.info('Spout: Native module loaded successfully', { senderName });
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
      const frame = this.receiver.receive();
      if (!frame) return null;
      
      return {
        buffer: frame.buffer, // Buffer or Uint8Array
        width: frame.width,
        height: frame.height
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
