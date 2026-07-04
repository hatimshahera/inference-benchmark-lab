// ImageNet normalization constants shared by both bundled models.
export const IMAGENET_MEAN = [0.485, 0.456, 0.406];
export const IMAGENET_STD = [0.229, 0.224, 0.225];

export interface Prediction {
  index: number;
  label: string;
  confidence: number;
}

/**
 * Resize an image source to `size`x`size` and produce a normalized
 * Float32Array in NCHW layout (1 x 3 x size x size), RGB order.
 */
export function preprocessToNCHW(
  source: CanvasImageSource,
  size: number,
): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not get a 2D canvas context for preprocessing.");
  }

  ctx.drawImage(source, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    out[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    out[plane + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    out[2 * plane + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }
  return out;
}

/** Softmax + top-K over 1000 ImageNet logits. */
export function softmaxTopK(
  logits: Float32Array,
  labels: string[],
  k: number,
): Prediction[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i];
  }

  let sum = 0;
  const exps = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] - max);
    exps[i] = e;
    sum += e;
  }

  const indices = Array.from(logits.keys());
  indices.sort((a, b) => exps[b] - exps[a]);

  return indices.slice(0, k).map((index) => ({
    index,
    label: labels[index] ?? `class ${index}`,
    confidence: exps[index] / sum,
  }));
}
