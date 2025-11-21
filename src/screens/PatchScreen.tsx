import { useEffect, useState } from 'react';

type StatusState = 'checking' | 'available' | 'none' | 'downloaded' | 'error';

declare global {
  interface Window {
    updater?: {
      onStatus: (cb: (data: { state: StatusState; message: string }) => void) => void;
      onProgress: (cb: (data: {
        percent: number;
        transferred: number;
        total: number;
        speed: number;
      }) => void) => void;
    };
    appInfo?: {
      getVersion: () => Promise<string>;
    };
  }
}

export function PatchScreen() {
  const [statusState, setStatusState] = useState<StatusState>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('起動しています…');
  const [percent, setPercent] = useState<number | null>(null);
  const [transferred, setTransferred] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    if (!window.updater) return;

    window.updater.onStatus((data) => {
      setStatusState(data.state);
      setStatusMessage(data.message);

      if (data.state === 'none' || data.state === 'error') {
        setPercent(null);
        setTransferred(null);
        setTotal(null);
        setSpeed(null);
      }
    });

    window.updater.onProgress((data) => {
      setPercent(data.percent);
      setTransferred(data.transferred);
      setTotal(data.total);
      setSpeed(data.speed);
    });
  }, []);

  useEffect(() => {
    if (!window.appInfo) return;
    window.appInfo
      .getVersion()
      .then((v) => {
        setAppVersion(v);
      })
      .catch(() => {
        setAppVersion('');
      });
  }, []);

  const titleLabel = (() => {
    switch (statusState) {
      case 'checking':
        return 'アップデートを確認中…';
      case 'available':
        return 'アップデートをダウンロードしています';
      case 'downloaded':
        return 'アップデートが完了しました';
      case 'none':
        return '最新バージョンです';
      case 'error':
        return 'アップデートエラー';
      default:
        return 'アップデート状態';
    }
  })();

  const formatMB = (bytes: number | null) => {
    if (bytes == null || bytes <= 0) return '-';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bytesPerSec: number | null) => {
    if (bytesPerSec == null || bytesPerSec <= 0) return '-';
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        fontFamily: "system-ui, sans-serif",
        justifyContent: 'center',
        alignItems: 'center',
        color: '#f5f5f7',
      }}
    >
      {/* Center Card */}
      <div
        style={{
          padding: 32,
          borderRadius: 24,
          background:
          'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)),radial-gradient(circle at top left, #1b263b 0, #050608 45%, #020308 100%)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(18px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* ICON */}
            <img
              src="/build/icon.ico"
              alt="App Icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                boxShadow: '0 0 16px rgba(0,180,255,0.6)',
              }}
            />

            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>FloorGuideDisplay</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Preparing latest map &amp; shop data…
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {appVersion ? `v${appVersion}` : ''}
          </div>
        </div>

        {/* Status Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{titleLabel}</div>

          <p
            style={{
              fontSize: 13,
              opacity: 0.85,
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}
          >
            {statusMessage}
          </p>
        </div>

        {/* Progress Panel */}
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.12)',
            background:
              'radial-gradient(circle at top, rgba(0,180,255,0.18), rgba(0,0,0,0.7))',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
            Download status
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: 14,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.25)',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent ?? 0}%`,
                background: 'linear-gradient(90deg, #00b4ff, #00ffbf, #00b4ff)',
                boxShadow: '0 0 12px rgba(0,180,255,0.9)',
                transition: 'width 0.25s ease-out',
              }}
            />
          </div>

          <div style={{ fontSize: 12, textAlign: 'right', opacity: 0.9 }}>
            {percent != null ? `${percent.toFixed(1)}%` : '待機中…'}
          </div>

          {/* Numeric Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              rowGap: 6,
              columnGap: 16,
              fontSize: 11,
            }}
          >
            <div style={{ opacity: 0.7 }}>Transferred</div>
            <div style={{ textAlign: 'right' }}>{formatMB(transferred)}</div>

            <div style={{ opacity: 0.7 }}>Total</div>
            <div style={{ textAlign: 'right' }}>{formatMB(total)}</div>

            <div style={{ opacity: 0.7 }}>Speed</div>
            <div style={{ textAlign: 'right' }}>{formatSpeed(speed)}</div>

            <div style={{ opacity: 0.7 }}>State</div>
            <div style={{ textAlign: 'right' }}>{statusState}</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            opacity: 0.6,
            marginTop: 'auto',
          }}
        >
          <div>Do not turn off your device while updating.</div>
          <div>© 2025 Toei Techno International Inc.</div>
        </div>
      </div>
    </div>
  );
}
