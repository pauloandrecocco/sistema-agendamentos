import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// The repository root .env is shared by api and web; API_PORT is the only API port setting.
const ROOT_DIR = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT_DIR, '');
  const apiPort = env.API_PORT || '3333';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
    test: {
      environment: 'node',
      passWithNoTests: true,
    },
  };
});
