import { defineConfig, devices } from '@playwright/test';

const gpuArgs = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  // Software WebGL (SwiftShader) is CPU-bound; more workers starve each other's frames.
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: gpuArgs } } },
    {
      name: 'mobile',
      // DPR 1 keeps touch, viewport and isMobile but cuts software-rendered pixels ~7x; at DPR 2.6
      // SwiftShader drops to ~4 fps and time-based camera blends starve.
      use: { ...devices['Pixel 7'], deviceScaleFactor: 1, launchOptions: { args: gpuArgs } },
    },
  ],
  webServer: {
    command: 'npm run build:e2e && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // Always build fresh: a reused server silently serves a stale bundle.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
