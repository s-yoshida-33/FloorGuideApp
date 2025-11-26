import { useEffect, useState } from 'react';
import appIcon from '../../build/icon.ico';
import type { StatusState } from '../types/global';

export function PatchScreen() {
  const [statusState, setStatusState] = useState<StatusState>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('起動しています…');
  const [percent, setPercent] = useState<number | null>(null);
  const [transferred, setTransferred] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // Mock data for browser preview
    const isBrowser = !window.electronAPI;
    
    if (isBrowser) {
      // Simulate update progress for browser preview
      setAppVersion('0.1.0-beta.15');
      setStatusState('available');
      setStatusMessage('アップデートをダウンロードしています…\nしばらくお待ちください。');
      
      // Simulate progress
      let mockPercent = 0;
      const interval = setInterval(() => {
        mockPercent += 2;
        if (mockPercent > 100) {
          mockPercent = 100;
          setStatusState('downloaded');
          setStatusMessage('アップデートが完了しました。\nアプリを再起動してください。');
          clearInterval(interval);
        } else {
          setPercent(mockPercent);
          setTransferred(mockPercent * 1024 * 1024 * 2); // Mock: 2MB per percent
          setTotal(100 * 1024 * 1024 * 2); // Mock: 200MB total
          setSpeed(5 * 1024 * 1024); // Mock: 5MB/s
        }
      }, 100);
      
      return () => clearInterval(interval);
    }

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
    // Mock data for browser preview
    const isBrowser = !window.electronAPI;
    
    if (isBrowser) {
      // Already set in the previous useEffect
      return;
    }

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
        backgroundColor: 'transparent',
        color: '#fff',
      }}
    >
      {/* Center Card */}
      <div
        style={{
          minWidth: 800,
          maxWidth: 860,
          minHeight: 600,
          maxHeight: 660,
          padding: 32,
          borderRadius: 8,
          backgroundColor: '#0a0a0a',
          border: '2px solid #1a1a1a',
          boxShadow: '0 0 0 1px #2a2a2a, 0 8px 32px rgba(0,0,0,0.9)',
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
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                border: '2px solid #2a2a2a',
                backgroundColor: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src={appIcon}
                alt="App Icon"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>Gido</div>
              <div style={{ fontSize: 12, color: '#888888' }}>
                Preparing latest map &amp; shop data…
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#666666' }}>
            {appVersion ? `v${appVersion}` : ''}
          </div>
        </div>

        {/* Status Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{titleLabel}</div>

          <p
            style={{
              fontSize: 13,
              color: '#cccccc',
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
            borderRadius: 4,
            border: '2px solid #1a1a1a',
            backgroundColor: '#0f0f0f',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: '#888888', marginBottom: 6 }}>
            Download status
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: 20,
              borderRadius: 2,
              border: '2px solid #1a1a1a',
              overflow: 'hidden',
              backgroundColor: '#050505',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent ?? 0}%`,
                backgroundColor: '#00ff88',
                borderRight: percent && percent < 100 ? '2px solid #00cc66' : 'none',
                transition: 'width 0.2s linear',
                boxShadow: percent && percent > 0 ? 'inset 0 0 8px rgba(0,255,136,0.3)' : 'none',
              }}
            />
            {percent && percent > 0 && percent < 100 && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: '#00ff88',
                  boxShadow: '0 0 4px #00ff88',
                }}
              />
            )}
          </div>

          <div style={{ fontSize: 12, textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>
            {percent != null ? `${percent.toFixed(1)}%` : '待機中…'}
          </div>

          {/* Numeric Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              rowGap: 8,
              columnGap: 16,
              fontSize: 11,
              paddingTop: 8,
              borderTop: '1px solid #1a1a1a',
            }}
          >
            <div style={{ color: '#888888' }}>Transferred</div>
            <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{formatMB(transferred)}</div>

            <div style={{ color: '#888888' }}>Total</div>
            <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{formatMB(total)}</div>

            <div style={{ color: '#888888' }}>Speed</div>
            <div style={{ textAlign: 'right', color: '#00ff88', fontWeight: 600 }}>{formatSpeed(speed)}</div>

            <div style={{ color: '#888888' }}>State</div>
            <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600, textTransform: 'uppercase' }}>{statusState}</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#666666',
            marginTop: 'auto',
            paddingTop: 16,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <div>Do not turn off your device while updating.</div>
          <div>© 2025 Toei Techno International Inc.</div>
        </div>
      </div>
    </div>
  );
}
