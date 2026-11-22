import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "server-only": resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
