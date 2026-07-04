import { DeviceInfo } from "./device";
import { BenchmarkResult } from "./inference";

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface Report {
  generatedAt: string;
  model: { id: string; name: string; sizeMB: number; inputSize: number };
  backend: string;
  device: DeviceInfo;
  timingsMs: {
    coldStart: number;
    preprocess: number;
    coldInference: number;
    warmInference: number;
    postprocess: number;
    total: number;
  };
  runs: number;
  inferenceRunsMs: number[];
  topPrediction: { label: string; confidencePct: number };
  predictions: { label: string; confidencePct: number }[];
}

export function buildReport(
  result: BenchmarkResult,
  device: DeviceInfo,
  generatedAt: string,
): Report {
  return {
    generatedAt,
    model: {
      id: result.model.id,
      name: result.model.name,
      sizeMB: result.model.sizeMB,
      inputSize: result.model.inputSize,
    },
    backend: result.backend,
    device,
    timingsMs: {
      coldStart: round(result.coldStartMs),
      preprocess: round(result.preprocessMs, 2),
      coldInference: round(result.coldInferenceMs),
      warmInference: round(result.warmInferenceMs),
      postprocess: round(result.postprocessMs, 2),
      total: round(result.totalMs),
    },
    runs: result.runs,
    inferenceRunsMs: result.inferenceTimes.map((t) => round(t)),
    topPrediction: {
      label: result.predictions[0].label,
      confidencePct: round(result.predictions[0].confidence * 100),
    },
    predictions: result.predictions.map((p) => ({
      label: p.label,
      confidencePct: round(p.confidence * 100),
    })),
  };
}

export function toJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function toMarkdown(report: Report): string {
  const t = report.timingsMs;
  const d = report.device;
  const preds = report.predictions
    .map((p) => `| ${p.label} | ${p.confidencePct}% |`)
    .join("\n");

  return `# AI Inference Benchmark Report

_Generated: ${report.generatedAt}_

## Prediction

**${report.topPrediction.label}** — ${report.topPrediction.confidencePct}% confidence

| Label | Confidence |
| --- | --- |
${preds}

## Model & Backend

- **Model:** ${report.model.name} (${report.model.sizeMB} MB, ${report.model.inputSize}×${report.model.inputSize})
- **Backend:** ${report.backend.toUpperCase()}
- **Runs:** ${report.runs}

## Timings (ms)

| Stage | Time |
| --- | --- |
| Cold start (load + compile) | ${t.coldStart} ms |
| Preprocessing | ${t.preprocess} ms |
| Cold inference (first run) | ${t.coldInference} ms |
| Warm inference (avg) | ${t.warmInference} ms |
| Postprocessing | ${t.postprocess} ms |
| Total pipeline (warm) | ${t.total} ms |

## Device

- **Browser:** ${d.browser}
- **OS:** ${d.os}
- **CPU cores:** ${d.cores ?? "unknown"}
- **Device memory:** ${d.deviceMemoryGb ? `${d.deviceMemoryGb} GB` : "unknown"}
- **WebGPU available:** ${d.webgpu ? "yes" : "no"}
`;
}
