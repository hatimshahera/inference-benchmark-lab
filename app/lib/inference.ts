import type { InferenceSession, Tensor } from "onnxruntime-web";
import { ModelDef } from "./models";
import { Prediction, preprocessToNCHW, softmaxTopK } from "./preprocess";

export type Backend = "webgpu" | "wasm";
export type BackendChoice = "auto" | Backend;

const ORT_VERSION = "1.20.1";
type OrtModule = typeof import("onnxruntime-web");

let ortPromise: Promise<OrtModule> | null = null;

// ONNX Runtime Web is browser-only and pulls in Node code paths that would
// break SSR, so we load it lazily via dynamic import on first use. The WASM
// binaries are served from a version-pinned CDN so we don't have to copy them.
async function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = (import("onnxruntime-web/webgpu") as Promise<unknown>).then(
      (mod) => {
        const ort = mod as OrtModule;
        ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
        // Single-threaded keeps us off SharedArrayBuffer / cross-origin
        // isolation, which keeps the app deploy-anywhere simple.
        ort.env.wasm.numThreads = 1;
        return ort;
      },
    );
  }
  return ortPromise;
}

export interface BenchmarkResult {
  model: ModelDef;
  backend: Backend;
  /** Session creation: model download (or cache hit) + graph compile. */
  coldStartMs: number;
  preprocessMs: number;
  /** First inference run — includes any lazy backend warm-up. */
  coldInferenceMs: number;
  /** Mean of the remaining (warm) inference runs. */
  warmInferenceMs: number;
  postprocessMs: number;
  /** preprocess + warm inference + postprocess (steady-state pipeline). */
  totalMs: number;
  runs: number;
  inferenceTimes: number[];
  predictions: Prediction[];
  inputName: string;
  outputName: string;
}

export interface BenchmarkOptions {
  source: CanvasImageSource;
  model: ModelDef;
  backend: Backend;
  runs: number;
  labels: string[];
  onStage?: (stage: string) => void;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function runBenchmark(
  opts: BenchmarkOptions,
): Promise<BenchmarkResult> {
  const { source, model, backend, runs, labels, onStage } = opts;
  const ort = await loadOrt();

  onStage?.(`Loading ${model.name} on ${backend.toUpperCase()}…`);
  const coldStart = performance.now();
  let session: InferenceSession;
  try {
    session = await ort.InferenceSession.create(model.url, {
      executionProviders: [backend],
      graphOptimizationLevel: "all",
    });
  } catch (error) {
    throw new Error(
      `Failed to create a ${backend.toUpperCase()} session: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
  const coldStartMs = performance.now() - coldStart;

  try {
    onStage?.("Preprocessing image…");
    const preStart = performance.now();
    const inputData = preprocessToNCHW(source, model.inputSize);
    const preprocessMs = performance.now() - preStart;

    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    const dims = [1, 3, model.inputSize, model.inputSize];

    const inferenceTimes: number[] = [];
    let lastOutput: Float32Array | null = null;

    for (let run = 0; run < runs; run++) {
      onStage?.(`Inference run ${run + 1} / ${runs}…`);
      const tensor: Tensor = new ort.Tensor("float32", inputData, dims);
      const start = performance.now();
      const output = await session.run({ [inputName]: tensor });
      inferenceTimes.push(performance.now() - start);
      lastOutput = output[outputName].data as Float32Array;
    }

    if (!lastOutput) {
      throw new Error("No inference output was produced.");
    }

    onStage?.("Postprocessing…");
    const postStart = performance.now();
    const predictions = softmaxTopK(lastOutput, labels, 5);
    const postprocessMs = performance.now() - postStart;

    const coldInferenceMs = inferenceTimes[0];
    const warmRuns = inferenceTimes.slice(1);
    const warmInferenceMs = warmRuns.length
      ? mean(warmRuns)
      : coldInferenceMs;
    const totalMs = preprocessMs + warmInferenceMs + postprocessMs;

    return {
      model,
      backend,
      coldStartMs,
      preprocessMs,
      coldInferenceMs,
      warmInferenceMs,
      postprocessMs,
      totalMs,
      runs,
      inferenceTimes,
      predictions,
      inputName,
      outputName,
    };
  } finally {
    // Release native resources so repeated benchmarks measure a true cold start.
    await session.release();
  }
}
