// src/screens/BootScreen.tsx
import React, { useEffect, useState } from 'react';
import { UpdateDialog } from '../components/UpdateDialog';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { logInfo } from '../logs/logging';

interface BootScreenProps {
  onBootComplete: () => void;
}

type BootStage = 'update' | 'countdown' | 'complete';

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  const { updateStatus, installUpdate } = useAutoUpdate();
  const [currentStage, setCurrentStage] = useState<BootStage>('update');
  const [countdownSeconds, setCountdownSeconds] = useState(90);

  // --- Stage 1: Update ---
  useEffect(() => {
    if (currentStage !== 'update') return;
    let timer: ReturnType<typeof setTimeout>;

    if (updateStatus.status === 'ready') {
      logInfo('BOOT', 'Update ready, restarting in 5s...');
      timer = setTimeout(() => installUpdate(), 5000);
    } else if (updateStatus.status === 'error' || updateStatus.status === 'uptodate') {
      logInfo('BOOT', `Update check finished (${updateStatus.status}), proceeding to countdown...`);
      timer = setTimeout(() => setCurrentStage('countdown'), 1500);
    }
    return () => { if (timer) clearTimeout(timer); };
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStatus.status, currentStage]);

  // --- Stage 2: Countdown ---
  useEffect(() => {
    if (currentStage !== 'countdown') return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCurrentStage('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentStage]);

  // --- Stage 3: Complete ---
  useEffect(() => {
    if (currentStage === 'complete') {
      setTimeout(() => onBootComplete(), 500);
    }
  }, [currentStage, onBootComplete]);

  const handleSkipUpdate = () => setCurrentStage('countdown');
  const handleSkipCountdown = () => setCurrentStage('complete');

  if (currentStage === 'update') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111827', zIndex: 50 }}>
        <UpdateDialog
          isOpen={true}
          status={updateStatus.status === 'idle' ? 'checking' : updateStatus.status}
          progress={updateStatus.progress}
          message={updateStatus.message}
          onInstall={installUpdate}
          onDismiss={handleSkipUpdate}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'white', marginBottom: '2rem' }}>Gido System</h1>
        {currentStage === 'countdown' && (
          <div style={{ backgroundColor: '#1f2937', padding: '1.5rem', borderRadius: '8px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white' }}>{countdownSeconds}</div>
            <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>Seconds remaining</p>
            <button onClick={handleSkipCountdown} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Start Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};