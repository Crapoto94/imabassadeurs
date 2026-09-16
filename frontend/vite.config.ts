import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'URL de l'API est injectée au build via VITE_API_URL (jamais en dur dans les composants).
export default defineConfig({
  plugins: [react()],
  server: { port: 5311, host: true },
  preview: { port: 5311, host: true },
});
