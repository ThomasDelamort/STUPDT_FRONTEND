import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, lazyPlugins } from "vite-plus";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_URL || env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

  return {
    fmt: {},
    lint: {
      plugins: ["react", "typescript", "oxc"],
      rules: {
        "react/rules-of-hooks": "error",
        "react/only-export-components": [
          "warn",
          {
            allowConstantExport: true,
          },
        ],
        "vite-plus/prefer-vite-plus-imports": "error",
      },
      options: {
        typeAware: true,
        typeCheck: true,
      },
      jsPlugins: [
        {
          name: "vite-plus",
          specifier: "vite-plus/oxlint-plugin",
        },
      ],
    },
    plugins: lazyPlugins(() => [react()]),
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("error", (_err, _req, res) => {
              if ("writeHead" in res && !res.headersSent) {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    status: "offline",
                    error: "ECONNREFUSED",
                    message:
                      "Backend server is not running on port 8000. Start it in another terminal with: vp dev (backend) or python/node backend",
                  }),
                );
              }
            });
          },
        },
      },
    },
  };
});
