import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api/* to the StudySwap backend (server/ folder, port 4000).
    proxy: { '/api': 'http://localhost:4000' },
  },
});
