import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 這裡可以選擇性加入，方便在開發時自動開啟瀏覽器
    open: true 
  }
})