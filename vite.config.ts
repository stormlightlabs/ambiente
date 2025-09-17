import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  test: {
    expect: { requireAssertions: true },
    ui: false,
    watch: false,
    projects: [{
      extends: "./vite.config.ts",
      test: {
        testTimeout: 2500,
        retry: 1,
        name: "client",
        environment: "browser",
        browser: { enabled: true, provider: "playwright", instances: [{ browser: "chromium", headless: true }] },
        include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
        exclude: ["src/lib/server/**"],
        setupFiles: ["./vitest-setup-client.ts"],
      },
    }, {
      extends: "./vite.config.ts",
      test: {
        name: "server",
        environment: "node",
        include: ["src/**/*.{test,spec}.{js,ts}"],
        exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
      },
    }],
  },
});
