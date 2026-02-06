import React from 'react';

interface DeviceCodeDisplayProps {
  code: string;
}

export const DeviceCodeDisplay: React.FC<DeviceCodeDisplayProps> = ({ code }) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a1a', // Slightly lighter than pure black for depth
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
      padding: '2rem',
      boxSizing: 'border-box',
      position: 'absolute',
      top: 0,
      left: 0,
    }}>
      <div style={{ 
        fontSize: '1.8rem', 
        marginBottom: '2rem', 
        opacity: 0.8,
        fontWeight: 'bold'
      }}>
        端末連携コード
      </div>
      
      <div style={{ 
        fontSize: '6rem', 
        fontWeight: 'bold', 
        letterSpacing: '0.8rem',
        border: '6px solid rgba(255, 255, 255, 0.3)',
        padding: '2rem 4rem',
        borderRadius: '16px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
        fontFamily: 'monospace' // Monospace for alignment
      }}>
        {code}
      </div>
      
      <div style={{ 
        marginTop: '3rem', 
        fontSize: '1.4rem', 
        opacity: 0.7,
        maxWidth: '80%',
        textAlign: 'center',
        lineHeight: 1.5
      }}>
        管理画面の端末登録ページで<br/>上記コードを入力してください
      </div>
      
      <div style={{
        marginTop: '4rem',
        fontSize: '1rem',
        opacity: 0.4,
        position: 'absolute',
        bottom: '2rem'
      }}>
        Waiting for configuration...
      </div>
    </div>
  );
};
