import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  webpack: (config) => {
    // onnxruntime-web references Node built-ins in code paths that never run
    // in the browser. Stub them so the client bundle builds cleanly.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    // The `onnxruntime-web/webgpu` subpath is marked `"node": null` in the
    // package exports, which trips Next's server-side module graph. Alias it
    // straight to the real WebGPU+WASM bundle so it resolves everywhere; the
    // code is only ever dynamically imported on the client.
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-web/webgpu$": resolve(
        __dirname,
        "node_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs",
      ),
    };
    return config;
  },
};

export default nextConfig;
