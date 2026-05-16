import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const rawPort = env.PORT ?? process.env.PORT ?? "5173";

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = env.BASE_PATH ?? process.env.BASE_PATH ?? "/";
  const apiTarget =
    (env.VITE_API_PROXY ?? process.env.VITE_API_PROXY)?.trim() ||
    `http://127.0.0.1:${env.API_PORT ?? process.env.API_PORT ?? "10000"}`;

  return {
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    publicDir: path.resolve(import.meta.dirname, "public"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-motion": ["framer-motion"],
            "vendor-radix": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
            ],
          },
        },
      },
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
