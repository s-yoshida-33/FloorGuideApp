// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import './styles/index.css'
import App from './App.tsx'
import './styles/fonts.css'
import './styles/location-icons.css'

// Send initial watchdog ping immediately — before React renders.
// This ensures the Rust watchdog knows the WebView JS engine is alive
// even if React component mounting fails.
invoke('webview_ping').catch(() => {});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
