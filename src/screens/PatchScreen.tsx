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
  }
}

export function PatchScreen() {
  const [status, setStatus] = useState<string>('起動しています…');
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!window.updater) return;

    window.updater.onStatus((data) => {
      setStatus(data.message);
      if (data.state === 'none' || data.state === 'error') {
        setPercent(null);
      }
    });

    window.updater.onProgress((data) => {
      setPercent(data.percent);
    });
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        fontFamily: "'Rounded Mplus 1c', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <h1 style={{ fontSize: 20 }}>アップデートを確認中…</h1>
      <p>{status}</p>

      {percent != null && (
        <div style={{ width: '70%', marginTop: 8 }}>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              border: '1px solid #ccc',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${percent.toFixed(1)}%`,
                background: '#007aff',
                transition: 'width 0.2s linear',
              }}
            />
          </div>
          <p style={{ marginTop: 4, fontSize: 12, textAlign: 'right' }}>
            {percent.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}
