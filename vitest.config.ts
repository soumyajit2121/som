import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` throws outside the React Server bundle; it is a no-op in tests.
  "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          // The host timezone is deliberately NOT India: IST handling must not depend on it.
          env: { TZ: "UTC" },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          env: { TZ: "UTC" },
          setupFiles: ["tests/support/load-env.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
