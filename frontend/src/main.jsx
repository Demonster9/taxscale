import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 1. Import PostHog
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

// 2. Initialize PostHog
// Replace 'YOUR_PROJECT_API_KEY_HERE' with your actual key from the PostHog dashboard
posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
  api_host: 'https://app.posthog.com',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 3. Wrap the App in the PostHogProvider */}
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </StrictMode>,
)