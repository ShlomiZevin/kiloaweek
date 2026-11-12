import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] } } } },
  server: { port: 5190, proxy: { '/api': { target: 'http://127.0.0.1:5001', rewrite: p => '/kiloaweek-app/me-west1/kawApi' + p.replace(/^\/api/, '') } } },
});
