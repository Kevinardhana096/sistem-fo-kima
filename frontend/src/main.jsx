import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { registerNotificationServiceWorker } from './lib/browser-notifications'
import { UploadProgressProvider } from './components/UploadProgressProvider'

void registerNotificationServiceWorker()

const appNode = (
  <ErrorBoundary>
    <UploadProgressProvider>
      <App />
    </UploadProgressProvider>
  </ErrorBoundary>
)

createRoot(document.getElementById('root')).render(
  import.meta.env.DEV
    ? appNode
    : (
      <StrictMode>
        {appNode}
      </StrictMode>
    ),
)
