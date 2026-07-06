# Tool 02 — AI Inference Benchmark Lab

**Day 2 of 60 AI Tools in 60 Days**

Run an ML image-classification model **entirely in your browser** and measure
what actually matters when you deploy a model: cold start, preprocessing,
inference latency, confidence, and backend performance.

> Not just an AI app — a tool that measures how fast the model actually runs.

## Problem it solves

Most "AI" demos are thin wrappers over a hosted API. This one runs the model
on-device with [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
and surfaces the engineering layer underneath inference: where the milliseconds
go, how cold start compares to warm latency, and how a bigger model trades
accuracy for speed against a tiny one — all measured on your own hardware.

## Features

- **Client-side inference** — image never leaves the browser; no server, no API key.
- **Two bundled models** — MobileNet V2 (~14 MB) vs. SqueezeNet 1.1 (~5 MB), so
  you can benchmark accuracy vs. latency head-to-head on the same image.
- **Backend selection** — Auto / WebGPU / WASM, with live WebGPU availability detection.
- **Full timing breakdown** — cold start (load + compile), preprocessing,
  cold vs. warm inference, postprocessing, and total warm pipeline.
- **Cold → warm speedup** and a per-run latency chart.
- **Top-5 predictions** with confidence over the 1000-class ImageNet labels.
- **Export** the benchmark as JSON or Markdown (or copy to clipboard).
- **Device strip** — browser, OS, CPU cores, memory, WebGPU support.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- ONNX Runtime Web 1.20 (WASM + WebGPU / JSEP)
- Canvas 2D for preprocessing (resize → NCHW → ImageNet normalize)
- No backend, no database, no API keys

## How it works

1. The image is drawn to a 224×224 canvas and converted to a normalized
   `Float32Array` in NCHW layout (ImageNet mean/std).
2. An ONNX Runtime Web `InferenceSession` is created on the chosen backend —
   this is the measured **cold start** (model download/cache hit + graph compile).
3. Inference runs N times. The first run is reported as **cold**; the rest are
   averaged as **warm** latency.
4. The 1000 output logits get softmax + top-5, mapped to ImageNet labels.

Each stage is timed with `performance.now()`.

## Run locally

```bash
npm install
npm run dev
```

Open the printed `http://localhost:PORT`, upload an image (or click **Try
sample**), pick a model and backend, and hit **Run benchmark**.

Other scripts:

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## Environment variables

None. Everything runs client-side.

## Notes & limitations

- WASM runs single-threaded to avoid requiring cross-origin isolation
  (SharedArrayBuffer), keeping the app deployable anywhere. Multi-threaded WASM
  is a natural future upgrade.
- WebGPU requires a browser/GPU that exposes it (recent Chrome/Edge). The UI
  detects availability and falls back to WASM automatically in Auto mode.
- Model weights are bundled in `public/models/` and cached by the browser after
  first load; the ORT WASM binaries load from a version-pinned CDN.

## Links

- Repository: https://github.com/hatimshahera/inference-benchmark-lab

## Support Me

If this helped you, you can support my work here: [buymeacoffee.com/hatimshahera](https://buymeacoffee.com/hatimshahera)
