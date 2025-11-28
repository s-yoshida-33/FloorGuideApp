// src/main.tsx
// Main entry point for the React application
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import './styles/fonts.css'
import './styles/location-icons.css'
import { PatchScreen } from './screens/PatchScreen'

// Decide which screen to render based on URL hash
const isPatchMode = window.location.hash === '#patch';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    {isPatchMode ? <PatchScreen /> : <App />}
  </StrictMode>,
);
