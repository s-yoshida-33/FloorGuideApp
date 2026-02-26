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
      timer = setTimeout(() => {
        logInfo('BOOT', 'Executing auto-restart for update...');
        installUpdate();
      }, 5000);
    } else if (updateStatus.status === 'error') {
      logInfo('BOOT', 'Update error, skipping in 5s...');
      timer = setTimeout(() => {
        logInfo('BOOT', 'Auto-skipping update due to error');
        setCurrentStage('countdown');
      }, 5000);
    } else if (updateStatus.status === 'uptodate') {
      logInfo('BOOT', 'App is up to date, proceeding...');
      timer = setTimeout(() => setCurrentStage('countdown'), 1000);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [updateStatus.status, currentStage, installUpdate]);

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

  // --- Handlers ---
  const handleSkipUpdate = () => setCurrentStage('countdown');
  const handleSkipCountdown = () => setCurrentStage('complete');

  // Phase 1: Update dialog
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

  // Phase 2: Countdown
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(to bottom, #111827, #000000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
            Gido System
          </h1>
        </div>

        {currentStage === 'countdown' && (
          <div style={{ width: '24rem' }}>
            <div
              style={{
                textAlign: 'center',
                padding: '1.5rem',
                backgroundColor: '#1f2937',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                {countdownSeconds}
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Seconds remaining
              </p>
              <button
                onClick={handleSkipCountdown}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Start Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
