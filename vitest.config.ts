import { defineConfig } from "vitest/config";
// Bound worker contention; bulk regression cases generate thousands of complete designs.
export default defineConfig({ test: { testTimeout: 30000, maxWorkers: 2 } });
