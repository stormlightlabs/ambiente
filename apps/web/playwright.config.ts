import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/browser',
	use: { baseURL: 'http://127.0.0.1:4199', trace: 'on-first-retry' },
	webServer: { command: 'pnpm preview --host 127.0.0.1 --port 4199', port: 4199, reuseExistingServer: !process.env.CI },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
