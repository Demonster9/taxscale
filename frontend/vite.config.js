import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// Only load certificates if they actually exist (prevents Vercel crash)
let httpsConfig = false;
try {
  if (fs.existsSync('../backend/localhost+2-key.pem')) {
    httpsConfig = {
      key: fs.readFileSync('../backend/localhost+2-key.pem'),
      cert: fs.readFileSync('../backend/localhost+2.pem'),
    };
  }
} catch (err) {
  console.log("No local certificates found, running default server.");
}

export default defineConfig({
  plugins: [react()],
  server: {
    https: httpsConfig
  }
})