// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Test builds only (CI sets E2E_READABLE_SERVER_FN_IDS): keep the dev-style
    // readable server-function ids so Playwright fixtures can recognise calls.
    // Production builds keep TanStack's default hashed ids.
    ...(process.env.E2E_READABLE_SERVER_FN_IDS
      ? {
          serverFns: {
            generateFunctionId: ({
              filename,
              functionName,
            }: {
              filename: string;
              functionName: string;
            }) => Buffer.from(`${filename}--${functionName}`).toString("base64url"),
          },
        }
      : {}),
  },
  vite: {
    plugins: [mcpPlugin()],
  },
});
