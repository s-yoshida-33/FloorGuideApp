// src/components/UpdateDialog.tsx
import React from 'react';

interface UpdateDialogProps {
  isOpen: boolean;
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'uptodate';
  progress: number;
  message: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isOpen, status, progress, message, onInstall, onDismiss,
}) => {
  if (!isOpen || status === 'idle') return null;
  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const isError = status === 'error';
  const isUptodate = status === 'uptodate';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%', color: '#333' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {isUptodate ? '最新バージョンです' : isReady ? 'アップデートが準備完了' : isError ? 'エラー' : 'アップデート確認中'}
        </h2>
        <p style={{ marginBottom: '1.5rem' }}>{message}</p>
        
        {isDownloading && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '999px', height: '8px' }}>
              <div style={{ backgroundColor: '#3b82f6', height: '8px', borderRadius: '999px', width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {!isDownloading && !isReady && !isError && !isUptodate && (
            <button onClick={onDismiss} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>キャンセル</button>
          )}
          {isReady && (
            <>
              <button onClick={onDismiss} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>後で</button>
              <button onClick={onInstall} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>今すぐ再起動</button>
            </>
          )}
          {(isError || isUptodate) && (
            <button onClick={onDismiss} style={{ padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>閉じる</button>
          )}
        </div>
      </div>
    </div>
  );
};