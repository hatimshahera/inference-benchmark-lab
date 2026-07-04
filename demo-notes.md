# Demo Notes — AI Inference Benchmark Lab

## What the demo should show

That a real ML model runs **in the browser**, classifies an image, and that the
tool measures the performance layer (cold start, latency, backend) — not just
the prediction.

## Step-by-step demo flow

1. Open the page. Point out the **device strip** at the bottom (browser, cores,
   WebGPU availability) — this is real hardware detection.
2. Click **Try sample** (the bundled Samoyed) or drag in any image.
3. Keep model = **MobileNet V2**, backend = **Auto**, runs = 10.
4. Hit **Run benchmark**. Show the prediction (**Samoyed ~95%**) and the timing
   grid: cold start vs. warm inference, plus the per-run latency chart where the
   first (cold) bar is taller.
5. Switch model to **SqueezeNet 1.1** and rerun. Prediction confidence drops
   (~67%) but the model is smaller — the accuracy/size tradeoff, live.
6. Toggle backend **WASM vs. WebGPU** (if available) and rerun to compare latency.
7. Click **Export .md** / **Copy report** to show the shareable benchmark report.

## Edge cases worth showing

- WebGPU unavailable → the WebGPU toggle is disabled and Auto falls back to WASM.
- Cold vs. warm: the first run after a fresh session is measurably slower.
- A non-dog image still classifies into its nearest ImageNet class.

## Screenshot / video ideas

- Prediction + confidence bar with the timing grid visible.
- The per-run latency chart (cold bar highlighted).
- Side-by-side: MobileNet 95% vs. SqueezeNet 67% on the same image.
- The exported Markdown report.

## Reel hook ideas

> "Day 2 of building 60 AI tools in 60 days: I built a browser-based AI
> inference benchmark — not just an AI app, but a tool that measures how fast
> the model actually runs."

Then show: upload image → prediction appears → latency numbers → switch
backend/model → rerun → export report.
