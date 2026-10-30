import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The manifest lets the e2e size and first-load checks follow each lazy scene's chunks, however they are split.
  build: { manifest: true },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
