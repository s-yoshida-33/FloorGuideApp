import { useEffect, useState } from 'react';
import appIcon from '../../build/icon.ico';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { getVersion } from '@tauri-apps/api/app';

interface PatchScreenProps {
  onComplete: () => void;
}

export function PatchScreen({ onComplete }: PatchScreenProps) {
  const { updateStatus, installUpdate } = useAutoUpdate();
  const [appVersion, setAppVersion] = useState<string>('');

  // Load app version from Tauri
  useEffect(() => {
    getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion(''));
  }, []);

  // When update is ready, auto-relaunch after 5 seconds
  useEffect(() => {
    if (updateStatus.status === 'ready') {
      const timer = setTimeout(() => {
        installUpdate();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus.status, installUpdate]);

  // When no update available or error, proceed immediately
  useEffect(() => {
    if (updateStatus.status === 'uptodate' || updateStatus.status === 'error') {
      onComplete();
    }
  }, [updateStatus.status, onComplete]);

  // Map Tauri update status to display title
  const titleLabel = (() => {
    switch (updateStatus.status) {
      case 'idle':
      case 'checking':
        return 'アップデートを確認中…';
      case 'available':
      case 'downloading':
        return 'アップデートをダウンロードしています';
      case 'ready':
        return 'アップデートが完了しました';
      case 'uptodate':
        return '最新バージョンです';
      case 'error':
        return 'アップデートエラー';
      default:
        return 'アップデート状態';
    }
  })();

  const displayMessage = updateStatus.message || '起動しています…';

  const formatMB = (bytes: number | null | undefined) => {
    if (bytes == null || bytes <= 0) return '-';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bytesPerSec: number | null | undefined) => {
    if (bytesPerSec == null || bytesPerSec <= 0) return '-';
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  const displayPercent = updateStatus.progress;

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        fontFamily: "system-ui, sans-serif",
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
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
            {displayMessage}
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
                width: `${displayPercent}%`,
                backgroundColor: '#0088ff',
                borderRight: displayPercent < 100 ? '2px solid #0066cc' : 'none',
                transition: 'width 0.2s linear',
                boxShadow: displayPercent > 0 ? 'inset 0 0 8px rgba(255,0,0,0.3)' : 'none',
              }}
            />
          </div>

          <div style={{ fontSize: 12, textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>
            {updateStatus.progress > 0 ? `${updateStatus.progress.toFixed(1)}%` : '待機中…'}
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
            <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{formatMB(updateStatus.transferred)}</div>

            <div style={{ color: '#888888' }}>Total</div>
            <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{formatMB(updateStatus.total)}</div>

            <div style={{ color: '#888888' }}>Speed</div>
            <div style={{ textAlign: 'right', color: '#00ff88', fontWeight: 600 }}>{formatSpeed(updateStatus.speed)}</div>

            <div style={{ color: '#888888' }}>State</div>
            <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600, textTransform: 'uppercase' }}>{updateStatus.status}</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#666666',
            marginTop: 'auto',
            paddingTop: 16,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Do not turn off your device while updating.</div>
            <div>&copy; 2026 Toei Techno International Inc.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
