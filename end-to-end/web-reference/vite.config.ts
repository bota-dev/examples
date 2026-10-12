import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'jsdom', include: ['tests/ui/**/*.test.tsx'], clearMocks: true },
});
