import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The code the street and the mall both walk with.
const SHARED = /[\/]src[\/](walk[\/](collide|walker)|street[\/](crowd|People))\.tsx?$/;

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      // One chunk of a pinned name, so the street's and the mall's size checks both count it.
      output: { codeSplitting: { groups: [{ name: 'walkShared', test: SHARED, includeDependenciesRecursively: false }] } },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
