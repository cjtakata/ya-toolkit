import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { captureInstallPrompt } from './components/install.js'

// Android/desktop fire the install prompt early; catch it before React mounts.
captureInstallPrompt()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
