# Lesson — AI Inference Benchmark Lab

## What I built

A browser-based ML inference playground. It runs an ONNX image classifier
(MobileNet V2 or SqueezeNet 1.1) fully client-side with ONNX Runtime Web, and
measures the full pipeline: cold start, preprocessing, cold vs. warm inference,
postprocessing, and total latency — with backend selection (WebGPU / WASM),
device detection, a per-run latency chart, and JSON/Markdown export.

## What I learned

- **The benchmark is the product, not the prediction.** Running a model is easy;
  the interesting engineering is measuring *where the time goes* and making
  cold-vs-warm and backend differences visible.
- **Preprocessing has to exactly match how the model was trained** — 224×224,
  NCHW, RGB, ImageNet mean/std. Get the normalization wrong and confidence
  collapses even though nothing "errors".
- **Cold start ≠ inference.** Session creation (download + graph compile)
  dominates the first experience; warm inference is what steady-state latency
  actually looks like. Separating them changes the story.
- **Model size is a real tradeoff, live:** MobileNet hit ~95% on the sample where
  SqueezeNet hit ~67% — smaller and faster, but less confident.

## What was harder than expected

- **Bundler vs. package exports.** `onnxruntime-web/webgpu` is marked
  `"node": null` in its exports map, which broke Next.js's server-side module
  graph. The default bundle ships the non-JSEP WASM (no real WebGPU), so I had to
  alias the WebGPU bundle directly in the webpack config to get both a clean
  build and actual GPU support.
- **Keeping a browser-only, Node-hostile library out of SSR** — solved with a
  lazy dynamic import plus `fs/path/crypto` webpack fallbacks.
- **Serving the WASM binaries** — pointing `ort.env.wasm.wasmPaths` at a
  version-pinned CDN avoided copying binaries into the app.

## What I would improve

- Multi-threaded WASM (needs cross-origin isolation headers) for a fairer CPU number.
- Warm-up run excluded from stats + p50/p95 instead of a plain mean.
- Object detection model + bounding boxes, not just classification.
- Quantized (int8) model variant to benchmark against fp32.

## Skills used

ONNX Runtime Web, browser-based inference, WebGPU/WASM backends, image
preprocessing (canvas → tensor), latency measurement & profiling, model
deployment, Next.js/webpack module resolution, TypeScript.

## Possible future version

A v2 that compares **browser vs. server** inference, ONNX vs. API-based
inference, adds a quantized model, and wraps a Dockerised FastAPI model server
with Prometheus-style metrics — connecting client-side ML to production model
serving (KServe-style patterns).
