"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceInfo, DeviceInfo } from "./lib/device";
import {
  Backend,
  BackendChoice,
  BenchmarkResult,
  runBenchmark,
} from "./lib/inference";
import { loadLabels } from "./lib/labels";
import { getModel, MODELS } from "./lib/models";
import { buildReport, toJson, toMarkdown } from "./lib/report";

const DEFAULT_RUNS = 10;

interface ComparisonEntry {
  id: number;
  label: string;
  modelName: string;
  backend: Backend;
  runs: number;
  coldStartMs: number;
  coldInferenceMs: number;
  warmInferenceMs: number;
  totalMs: number;
  topLabel: string;
  topConfidence: number;
}

type MetricKey = "warmInferenceMs" | "coldStartMs" | "coldInferenceMs" | "totalMs";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "warmInferenceMs", label: "Warm inference" },
  { key: "coldInferenceMs", label: "Cold inference" },
  { key: "coldStartMs", label: "Cold start" },
  { key: "totalMs", label: "Total pipeline" },
];

function fmt(ms: number, digits = 0): string {
  return `${ms.toFixed(digits)} ms`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("");

  const [modelId, setModelId] = useState(MODELS[0].id);
  const [backendChoice, setBackendChoice] = useState<BackendChoice>("auto");
  const [runs, setRuns] = useState(DEFAULT_RUNS);

  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [stage, setStage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");

  const [comparisons, setComparisons] = useState<ComparisonEntry[]>([]);
  const [metric, setMetric] = useState<MetricKey>("warmInferenceMs");

  const objectUrlRef = useRef<string>("");
  const entryIdRef = useRef(0);

  useEffect(() => {
    getDeviceInfo().then(setDevice).catch(() => setDevice(null));
    // Warm the label cache so the first real run only pays for the model.
    loadLabels().catch(() => {});
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const resolvedBackend: Backend = useMemo(() => {
    if (backendChoice === "auto") {
      return device?.webgpu ? "webgpu" : "wasm";
    }
    return backendChoice;
  }, [backendChoice, device]);

  function loadImageFromUrl(url: string, name: string) {
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      setImageUrl(url);
      setFileName(name);
      setResult(null);
      setError("");
    };
    img.onerror = () => setError("Could not load that image.");
    img.src = url;
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    loadImageFromUrl(url, file.name);
  }

  function loadSample() {
    // Optional bundled sample; harmless if absent.
    loadImageFromUrl("/samples/dog.jpg", "dog.jpg");
  }

  async function handleRun() {
    if (!imageEl) {
      setError("Upload an image first.");
      return;
    }
    setError("");
    setCopyState("");
    setResult(null);
    setIsRunning(true);
    try {
      const labels = await loadLabels();
      const benchmark = await runBenchmark({
        source: imageEl,
        model: getModel(modelId),
        backend: resolvedBackend,
        runs,
        labels,
        onStage: setStage,
      });
      setResult(benchmark);
      const entry: ComparisonEntry = {
        id: (entryIdRef.current += 1),
        label: `${benchmark.model.name} · ${benchmark.backend.toUpperCase()}`,
        modelName: benchmark.model.name,
        backend: benchmark.backend,
        runs: benchmark.runs,
        coldStartMs: benchmark.coldStartMs,
        coldInferenceMs: benchmark.coldInferenceMs,
        warmInferenceMs: benchmark.warmInferenceMs,
        totalMs: benchmark.totalMs,
        topLabel: benchmark.predictions[0].label,
        topConfidence: benchmark.predictions[0].confidence,
      };
      setComparisons((prev) => [...prev, entry]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark failed.");
    } finally {
      setIsRunning(false);
      setStage("");
    }
  }

  function removeComparison(id: number) {
    setComparisons((prev) => prev.filter((e) => e.id !== id));
  }

  function exportJson() {
    if (!result || !device) return;
    const report = buildReport(result, device, new Date().toISOString());
    downloadFile("benchmark-report.json", toJson(report), "application/json");
  }

  function exportMarkdown() {
    if (!result || !device) return;
    const report = buildReport(result, device, new Date().toISOString());
    downloadFile("benchmark-report.md", toMarkdown(report), "text/markdown");
  }

  async function copyMarkdown() {
    if (!result || !device) return;
    const report = buildReport(result, device, new Date().toISOString());
    try {
      await navigator.clipboard.writeText(toMarkdown(report));
      setCopyState("Copied");
      window.setTimeout(() => setCopyState(""), 1600);
    } catch {
      setCopyState("Copy failed");
    }
  }

  const maxRunTime = result
    ? Math.max(...result.inferenceTimes)
    : 0;

  const metricMax = comparisons.length
    ? Math.max(...comparisons.map((c) => c[metric]))
    : 0;
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? "";
  // Lowest latency wins — highlight the fastest entry for the chosen metric.
  const bestId = comparisons.length
    ? comparisons.reduce((best, c) => (c[metric] < best[metric] ? c : best)).id
    : null;

  return (
    <main className="page-shell">
      <header className="intro">
        <p className="eyebrow">Tool 02</p>
        <h1>AI Inference Benchmark Lab</h1>
        <p className="lede">
          Run an ML image model entirely in your browser and measure what
          actually matters in deployment: cold start, preprocessing,
          inference latency, confidence, and backend performance.
        </p>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid">
        {/* Controls */}
        <section className="card controls">
          <h2 className="card-title">1 · Configure</h2>

          <label className="field-label">Image</label>
          <div
            className={`dropzone${imageUrl ? " has-image" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="preview-img" src={imageUrl} alt={fileName} />
            ) : (
              <p className="dropzone-hint">Drop an image here or choose a file</p>
            )}
          </div>
          <div className="upload-row">
            <label className="btn btn-secondary file-btn">
              Choose image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                hidden
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadSample}
            >
              Try sample
            </button>
          </div>
          {fileName ? <p className="file-name">{fileName}</p> : null}

          <label className="field-label" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.sizeMB} MB
              </option>
            ))}
          </select>
          <p className="field-hint">{getModel(modelId).description}</p>

          <label className="field-label">Backend</label>
          <div className="segmented">
            {(["auto", "webgpu", "wasm"] as BackendChoice[]).map((choice) => {
              const disabled = choice === "webgpu" && device !== null && !device.webgpu;
              return (
                <button
                  key={choice}
                  type="button"
                  className={`seg${backendChoice === choice ? " is-active" : ""}`}
                  onClick={() => setBackendChoice(choice)}
                  disabled={disabled}
                  title={
                    disabled ? "WebGPU is not available in this browser" : undefined
                  }
                >
                  {choice === "auto"
                    ? "Auto"
                    : choice === "webgpu"
                      ? "WebGPU"
                      : "WASM"}
                </button>
              );
            })}
          </div>
          <p className="field-hint">
            Resolved backend:{" "}
            <strong>{resolvedBackend.toUpperCase()}</strong>
            {device ? (device.webgpu ? " · WebGPU detected" : " · WebGPU unavailable") : ""}
          </p>

          <label className="field-label" htmlFor="runs">
            Inference runs: <strong>{runs}</strong>
          </label>
          <input
            id="runs"
            type="range"
            min={1}
            max={50}
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
          />
          <p className="field-hint">
            First run is cold; the rest are averaged as warm latency.
          </p>

          <button
            type="button"
            className="btn btn-primary run-btn"
            onClick={handleRun}
            disabled={isRunning || !imageEl}
          >
            {isRunning ? stage || "Running…" : "Run benchmark"}
          </button>
        </section>

        {/* Results */}
        <section className="card results">
          <h2 className="card-title">2 · Results</h2>

          {!result && !isRunning ? (
            <div className="empty-state">
              <p>Upload an image and run the benchmark to see predictions and latency.</p>
            </div>
          ) : null}

          {isRunning && !result ? (
            <div className="empty-state">
              <p className="running">{stage || "Warming up…"}</p>
            </div>
          ) : null}

          {result ? (
            <>
              <div className="prediction">
                <div className="prediction-top">
                  <span className="prediction-label">
                    {result.predictions[0].label}
                  </span>
                  <span className="prediction-conf">
                    {pct(result.predictions[0].confidence)}
                  </span>
                </div>
                <div className="conf-bar">
                  <span
                    className="conf-fill"
                    style={{ width: pct(result.predictions[0].confidence) }}
                  />
                </div>
                <ul className="pred-list">
                  {result.predictions.slice(1).map((p) => (
                    <li key={p.index}>
                      <span>{p.label}</span>
                      <span className="pred-pct">{pct(p.confidence)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="timings">
                <div className="timing-grid">
                  <Metric label="Cold start" value={fmt(result.coldStartMs)} sub="load + compile" />
                  <Metric label="Preprocess" value={fmt(result.preprocessMs, 1)} />
                  <Metric label="Cold inference" value={fmt(result.coldInferenceMs)} sub="first run" />
                  <Metric
                    label="Warm inference"
                    value={fmt(result.warmInferenceMs)}
                    sub="avg"
                    highlight
                  />
                  <Metric label="Postprocess" value={fmt(result.postprocessMs, 1)} />
                  <Metric label="Total (warm)" value={fmt(result.totalMs)} sub="pipeline" />
                </div>

                <div className="badges">
                  <span className="badge">{result.backend.toUpperCase()}</span>
                  <span className="badge">{result.model.name}</span>
                  <span className="badge">
                    {result.coldInferenceMs > result.warmInferenceMs
                      ? `${(result.coldInferenceMs / result.warmInferenceMs).toFixed(1)}× cold→warm speedup`
                      : "stable cold/warm"}
                  </span>
                </div>

                <div className="chart">
                  <p className="chart-title">Per-run inference latency</p>
                  <div className="chart-bars">
                    {result.inferenceTimes.map((t, i) => (
                      <div
                        key={i}
                        className={`chart-bar${i === 0 ? " is-cold" : ""}`}
                        style={{ height: `${Math.max(6, (t / maxRunTime) * 100)}%` }}
                        title={`Run ${i + 1}: ${t.toFixed(1)} ms${i === 0 ? " (cold)" : ""}`}
                      />
                    ))}
                  </div>
                  <p className="chart-legend">
                    <span className="dot cold" /> cold run &nbsp;
                    <span className="dot warm" /> warm runs
                  </p>
                </div>
              </div>

              <div className="export-row">
                <button type="button" className="btn btn-secondary" onClick={copyMarkdown}>
                  {copyState || "Copy report"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={exportMarkdown}>
                  Export .md
                </button>
                <button type="button" className="btn btn-secondary" onClick={exportJson}>
                  Export .json
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* Comparison */}
      {comparisons.length > 0 ? (
        <section className="card comparison">
          <div className="comparison-head">
            <h2 className="card-title">3 · Compare runs</h2>
            <button
              type="button"
              className="btn btn-ghost clear-btn"
              onClick={() => setComparisons([])}
            >
              Clear all
            </button>
          </div>

          <p className="comparison-hint">
            Every benchmark you run is added here. Change the model or backend and
            run again to compare. Lower latency is better.
          </p>

          <div className="segmented metric-toggle">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`seg${metric === m.key ? " is-active" : ""}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="cmp-chart-title">
            {metricLabel} <span className="cmp-chart-sub">(lower is better)</span>
          </p>
          <div className="cmp-chart">
            {comparisons.map((c) => {
              const value = c[metric];
              const width = metricMax ? (value / metricMax) * 100 : 0;
              return (
                <div className="cmp-row" key={c.id}>
                  <span className="cmp-label">
                    {c.label}
                    {c.id === bestId ? <span className="cmp-best">fastest</span> : null}
                  </span>
                  <div className="cmp-bar-track">
                    <span
                      className={`cmp-bar cmp-${c.backend}${
                        c.id === bestId ? " is-best" : ""
                      }`}
                      style={{ width: `${Math.max(3, width)}%` }}
                    />
                  </div>
                  <span className="cmp-value">{fmt(value)}</span>
                </div>
              );
            })}
          </div>

          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Backend</th>
                  <th>Cold start</th>
                  <th>Cold inf.</th>
                  <th>Warm inf.</th>
                  <th>Total</th>
                  <th>Prediction</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c) => (
                  <tr key={c.id} className={c.id === bestId ? "is-best-row" : ""}>
                    <td>{c.modelName}</td>
                    <td>
                      <span className={`chip chip-${c.backend}`}>
                        {c.backend.toUpperCase()}
                      </span>
                    </td>
                    <td className="num">{fmt(c.coldStartMs)}</td>
                    <td className="num">{fmt(c.coldInferenceMs)}</td>
                    <td className="num strong">{fmt(c.warmInferenceMs)}</td>
                    <td className="num">{fmt(c.totalMs)}</td>
                    <td>
                      {c.topLabel} · {pct(c.topConfidence)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cmp-remove"
                        onClick={() => removeComparison(c.id)}
                        aria-label={`Remove ${c.label}`}
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Device strip */}
      {device ? (
        <section className="card device-strip">
          <span className="device-item">
            <span className="device-key">Browser</span> {device.browser}
          </span>
          <span className="device-item">
            <span className="device-key">OS</span> {device.os}
          </span>
          <span className="device-item">
            <span className="device-key">CPU cores</span> {device.cores ?? "?"}
          </span>
          <span className="device-item">
            <span className="device-key">Memory</span>{" "}
            {device.deviceMemoryGb ? `${device.deviceMemoryGb} GB` : "?"}
          </span>
          <span className="device-item">
            <span className="device-key">WebGPU</span>{" "}
            <span className={device.webgpu ? "yes" : "no"}>
              {device.webgpu ? "available" : "unavailable"}
            </span>
          </span>
        </section>
      ) : null}

      <p className="privacy-note">
        Everything runs locally in your browser — the image never leaves your
        device. Model weights load once and are cached by the browser.
      </p>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`metric${highlight ? " is-highlight" : ""}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub ? <span className="metric-sub">{sub}</span> : null}
    </div>
  );
}
