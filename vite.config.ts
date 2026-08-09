import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/vercomp/" : "/",
  plugins: [solid({ hot: mode !== "test", dev: mode !== "test" })],
  resolve: {
    alias: {
      "@gi-tcg/assets-manager": import.meta.resolve("@gi-tcg/assets-manager"),
      "@gi-tcg/typings": import.meta.resolve("@gi-tcg/typings"),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        inline: true,
      },
    },
    coverage: {
      reporter: ["text", "html"],
    },
  },
}));
